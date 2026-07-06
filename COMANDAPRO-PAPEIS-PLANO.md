# ComandaPRO — Sistema de Papéis (contas de funcionário)

> Desenho pra validação ANTES de tocar em auth/RLS de prod (Cantinho pagante está vivo). Branch `saas-vertical`.
> Cravado com Eduardo 05/07/2026: precisa de **login de recepção** e **login de técnico**, cada papel com acesso escopado.

## 1. Objetivo
Sair de "1 conta = 1 loja (dono)" para **contas de funcionário com papéis** dentro da mesma loja:
- **Owner (dono)** — acesso total (existe hoje).
- **Recepção** — opera balcão/atendimento, limitado.
- **Técnico** — login próprio, vê **só a agenda de serviços DELE** (OS dele + comissão dele).

Capacidade de PLATAFORMA (serve todo vertical: bar tem atendente, AT tem recepcionista/técnico).

## 2. Estado atual (auditado — file:line)
- `stores.owner_id → auth.users`; **1 conta = 1 loja**. `getCurrentStore` (`src/lib/auth/store.ts:26-35`) = `db().from("stores").eq("owner_id", user.id)`. `resolveStoreId` (`src/lib/auth/current.ts:9-16`) = `store.id ?? CANTINHO`.
- `db()` (`src/lib/supabase.ts`) = **SERVICE ROLE** → **bypassa RLS**. Logo o isolamento de tenant em RUNTIME é **app-layer** (`resolveStoreId` + `.eq("store_id")` nos 34 stores/rotas), NÃO a RLS.
- RLS (`store_owner` = `owner_id = auth.uid()`) = **rede de defesa** pro caminho anon/client (auditoria: sem uso de dado client-side hoje; teste empírico confirma anon vê `[]`).
- Sem login de funcionário; `staff`/garçom é registro sem auth.

## 3. Insight que de-risca (importante)
Como o runtime usa service-role, o sistema de papéis **nasce no APP LAYER** (membership + gating), com risco zero de prod. A **RLS vira endurecimento posterior** (defesa em profundidade), feito na branch e validado com o **re-teste anti-vazamento** (anon vê `[]`) antes de encostar no Cantinho. O **escopo do técnico** (só as OS dele) é **app-layer** — RLS por papel/linha é complexo e não é o enforcer de runtime.

## 4. Modelo de dados
Tabela nova `store_members`:
```
id           uuid pk
store_id     uuid → stores(id) on delete cascade
user_id      uuid → auth.users  (o login do funcionário)
role         text  -- 'owner' | 'reception' | 'technician'
technician_id uuid null → (registro de técnico do vertical AT)
active       boolean default true
created_at   timestamptz
unique(store_id, user_id)
```
- **Owner:** mantém `stores.owner_id` (compat) E ganha uma linha `store_members` role=owner (migração popula os owners existentes). Assim tudo fica membership-based e uniforme.
- RLS: `store_owner` (owner) + membership.

## 5. Auth (mudança)
- `getCurrentMembership()` novo: `user.id` → `store_members` (store_id, role, technician_id); fallback `owner_id` (compat). Retorna `{ store, role, technicianId }`.
- `getCurrentStore`/`resolveStoreId` reusam (resolve por owner OU membro). Nova `getCurrentRole()`.
- Login: funcionário loga no MESMO fluxo (email+senha Supabase Auth); a sessão resolve loja+papel.

## 6. Matriz de permissão (proposta — validar)
| Recurso | Owner | Recepção | Técnico |
|---|---|---|---|
| Caixa (abrir/fechar/vender) | ✅ | ✅ | ❌ |
| OS/comanda (abrir/atender/cobrar) | ✅ | ✅ | ⚠️ só as dele |
| Imprimir cupom/recibo | ✅ | ✅ | ❌ |
| Clientes | ✅ | ✅ (ver/criar) | ❌ |
| Financeiro / DRE | ✅ | ❌ | ❌ |
| Comissão (de todos) | ✅ | ❌ | ⚠️ só a dele |
| Cupom (criar/editar) | ✅ | ❌ | ❌ |
| Estoque (editar) | ✅ | ❌ | ❌ |
| Config / Ajustes / Equipe | ✅ | ❌ | ❌ |
| Excluir (qualquer) | ✅ | ❌ | ❌ |
| **Minha área** (minhas OS + minha comissão) | — | — | ✅ |

Espelha a Letícia no Palace (recepção restrita) + λ.garcom-app-so-pedidos (técnico vê o trabalho e o ganho DELE, não o financeiro da loja).

## 7. Gating (nav + ações)
- **Nav** filtra por papel (como já filtra por segmento em `AdminShell`). Técnico → nav mínima ("Minha área"). Recepção → subconjunto operacional.
- **Ações server-side** checam papel: helper `can(role, action)` / `requireRole()` nas rotas sensíveis (financeiro, config, exclusões, cupom).
- Técnico: toda query da "minha área" filtra por `technician_id = o dele`.

## 8. Fluxo de convite (dono cria funcionário)
Ajustes → **Equipe** → convidar: nome, email, papel, (técnico: liga ao registro de técnico). Cria auth user (`admin.createUser`) + `store_members`. Senha temp `<primeironome>2026`, troca no 1º login.

## 9. Tela do técnico ("agenda dele")
"Minha área" — porta do `starteq-palmas/tecnico/page`: OS dele por status + comissão (apurada/paga/potencial cinza). No vertical de AT. (Food/bar: papel técnico não se aplica; garçom vira outro papel depois.)

## 10. RLS — endurecimento (defesa em profundidade, com cuidado)
- Policy passa de `owner_id = auth.uid()` para `owner_id = auth.uid() OR store_id in (select store_id from store_members where user_id = auth.uid() and active)` em **toda** tabela de tenant (ou helper `auth_store_ids()`).
- Feito na branch → aplicado em teste/staging → **re-rodar o teste anti-vazamento (anon vê `[]`)** → só então prod. Cantinho por último.
- Técnico NÃO ganha escopo por-linha na RLS (é app-layer). RLS garante só a fronteira de loja.

## 11. Fases (ordem segura)
- **A — Fundação (branch, risco zero prod):** `store_members` + migração (owner vira member) + auth resolve por membership + `getCurrentRole`.
- **B — Gating:** nav + ações por papel; tela "Minha área" do técnico.
- **C — Convite:** fluxo do dono criar login de funcionário (Equipe).
- **D — RLS hardening + re-verificação** anti-vazamento.
- **E — Cantinho por último** (análise de impacto; owner do Cantinho vira member role=owner sem perder nada).

## 12. Riscos / proteção do Cantinho
- Runtime já isola por app (service-role + `resolveStoreId`); papéis SOMAM gating, não removem isolação.
- A RLS de prod é a rede — endurecer só com re-teste empírico depois.
- Nada aplicado em prod sem o Eduardo; branch + verificação; Cantinho por último.
