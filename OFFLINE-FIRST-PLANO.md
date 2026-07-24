# ComandaPRO — Offline-First (plano de arquitetura)

> **Status:** ESTUDO fechado em 23/07/2026. Construção agendada pra depois (decisão do Eduardo).
> **Profundidade escolhida:** *resiliência a quedas* — aguentar a net oscilar por minutos/horas
> sem travar a operação e sincronizar ao voltar. **Não** é operar dias offline nem virar app local.
> **Regra de segurança:** nasce e se prova numa instância isolada; o **Cantinho (pagante) é o
> último a receber, nunca a cobaia**. Testar simulando queda ANTES de subir.

---

## 1. Por que (o requisito)

POS de bar/food roda em lugar com internet ruim. O modelo do ComandaPRO é multi-mesa, multi-negócio
rodando ao mesmo tempo — se cada escrita depende de net na hora, uma oscilação de 5 min trava a casa
cheia. Offline-first é capacidade **CORE da plataforma** (vale pra todo tenant food), não de um cliente.

## 2. Estado atual (auditado no código, 23/07/2026)

**Já existe e funciona:**
- `src/lib/offline-queue.ts` — fila de escrita em IndexedDB: `submitOrQueue` (envia, ou enfileira se a
  rede cai) + `flushQueue` (drena ao reconectar). **Só a OS do Starteq usa** (`NovaOSForm.tsx`).
- `public/sw.js` — service worker cacheia GETs (network-first) → reabrir o app offline mostra o que já
  carregou (cardápio, telas).
- `src/components/admin/OfflineIndicator.tsx` + `RegisterSW.tsx` — encanamento de UI (contador de pendentes).
- **Blueprint** em `medellin-bar/src/lib/offline.ts` (repo morto) — já resolveu as partes difíceis:
  `registerOp`, `mapId`/`resolveId` (id temporário → real), cache. É o mapa a adaptar.

**NÃO existe — e é o risco 🔴:**
- **Nenhuma rota de escrita tem idempotência.** `mesas/lancar`, `mesas/pagamento`, `mesas/fechar-conta`,
  `balcao-venda`, `vendas` — zero `op_id`. (O "idempotente" em `mesas/adicionar` é só um comentário: a
  rota garante mesas 1..n, não tem chave de operação.)
- A fila atual (`offline-queue.ts`) reenvia **o mesmo corpo cru** no replay, sem chave de operação.

**Por que isso é grave:** a rede cai *depois* que o servidor gravou, mas antes da resposta chegar. O
cliente acha que ficou pendente → `flushQueue` reenvia → **pedido duplicado e cobrança em dobro.**
Ligar a fila de food hoje, sem idempotência, **cria** um bug de dinheiro. Idempotência é pré-requisito
inegociável de tudo que envolve pedido/pagamento. Ref. incidente de seq dessincronizado (setval).

## 3. Os dois problemas difíceis

### 3.1 Idempotência (`op_id`) — o alicerce
Cada operação de escrita nasce com um `opId` único **gerado no cliente** e **reusado em todo replay**.
O servidor garante "processa no máximo 1 vez".

**Desenho recomendado — ledger de operações (`processed_ops`):**

```sql
create table processed_ops (
  op_id      text primary key,          -- gerado no cliente (uuid/time+rand)
  store_id   uuid not null,
  kind       text not null,             -- 'lancar' | 'pagamento' | 'fechar' | 'balcao-venda'
  result     jsonb,                     -- a MESMA resposta devolvida na 1ª vez (ex.: { tabId })
  created_at timestamptz default now()
);
```

Fluxo em cada rota de escrita (idealmente numa função SQL/rpc pra ser atômico):
1. **Claim:** `insert into processed_ops(op_id, ...) ` — o `primary key` trava a corrida. Se der `23505`,
   a operação já existe → devolve `result` gravado (replay = no-op que retorna o mesmo).
2. Executa o trabalho real (cria tab_order + itens + baixa estoque / registra pagamento).
3. **Grava o `result`** no ledger (ex.: o `tabId`), pra o replay devolver idêntico.

> Alternativa mais simples por-tabela (`tab_orders.op_id unique` + `onConflict ignoreDuplicates`) funciona
> pra inserts de 1 linha, mas o `lancar` é multi-passo (order+itens+estoque) e o cliente precisa do MESMO
> `tabId` de volta — por isso o ledger com `result` é melhor. Padronizar o ledger em todas as rotas.

### 3.2 Dependência de ordem (id temporário)
`lancar` (rascunho) **retorna o `tabId`** que o `pagamento`, o `fechar-conta` e o "adicionar mais itens"
usam depois. Se a abertura está na fila offline, o cliente ainda não tem `tabId` real.

**Solução (padrão do blueprint):**
- Ao abrir mesa offline, o cliente cria um **`tempTabId` negativo** e um `opId`.
- Ops seguintes (adicionar item, pagar) referenciam o `tempTabId`.
- No `flushQueue`, replay **estritamente em ordem**: a 1ª op (abrir) volta com o `tabId` real →
  `mapId(tempTabId → realTabId)`. Antes de enviar cada op seguinte, `resolveId(tempTabId)` troca pelo real.
- A fila precisa ser **estruturada** (`{kind, payload}` + re-serializar resolvendo ids), não guardar o
  corpo cru como hoje. Ou seja: o food usa um motor de fila mais rico que o `submitOrQueue` atual (que é
  suficiente pra OS, um POST solto sem dependência).

## 4. Leitura offline (pra poder OPERAR, não só escrever)
Escrever na fila não basta — pra atender offline o operador precisa **ler**: cardápio, mesas, a comanda.
- `sw.js` já cacheia GETs vistos (network-first) → cardápio e telas abrem offline.
- **Snapshot local** do essencial (cardápio + mesas abertas) num cache versionado, atualizado a cada
  carga online. Estado ao vivo ("mesa X ocupada agora") não fica fresco offline — aceitável pra quedas
  de minutos, não pra horas. A UI mostra "dados de HH:MM" quando offline.

## 5. Regra de dinheiro (λ.prova-na-fonte)
Pagamento/fechar-conta feito offline **não lê a row no banco na hora** — a prova vem no sync.
- Venda/caixa offline = **provisório até sincronizar**; a UI TEM que marcar "ainda não subiu"
  (badge no item pendente, contador no indicador). Reconciliação real acontece no reconectar.
- Sem isso, recria o "achei que salvou". Fechamento de caixa offline é o caso mais sensível.

## 6. Fatiamento por risco (ordem de construção)

| # | Fatia | Resolve | Risco |
|---|-------|---------|-------|
| **1** | **`op_id` no servidor** (ledger `processed_ops` nas rotas de escrita) | idempotência — replay/retry não duplica | baixo (só protege; comportamento igual online) |
| **2** | **"Continuar servindo"** — lançar item em comanda JÁ aberta, offline + cardápio/comanda em cache | 80% do caso real (wifi oscila, garçom segue anotando) | médio (tabId já é real; sem id temporário) |
| **3** | **Abrir mesa nova offline** (tempTabId → resolveId) | mesa que nasce sem net | alto (resolução de id + ordem) |
| **4** | **Pagar / fechar offline** (provisório-até-sync, UI explícita) | fechar conta sem net | **altíssimo (dinheiro)** — por último |

Cada fatia sobe só depois de provada. Fatia 1 é pré-requisito das outras três.

## 7. Plano de teste (obrigatório antes de qualquer deploy)
Simular **queda real**, não só `navigator.onLine`:
1. Lançar item, matar a rede no meio → item vai pra fila (não some, não erra pro operador).
2. Voltar a rede → `flushQueue` → **provar no banco (SQL) que criou 1 linha, não 2.**
3. **Duplo-replay forçado** (mandar o mesmo `opId` 2x) → servidor grava 1, devolve o mesmo `tabId`.
4. Abrir mesa offline + lançar 2 itens offline + reconectar → 1 comanda, 2 itens, `tabId` resolvido.
5. Pagamento offline → badge "pendente" → sync → caixa bate. Provar reconciliação na fonte.

## 8. Segurança de rollout
- Construir e provar numa **instância isolada** (banco separado). O Cantinho pagante e o Medellín vivem no
  mesmo banco do `acai-system` → nada de teste de queda ali.
- Fatia 1 (op_id) é aditiva e segura (coluna/tabela nova + claim), mas ainda assim: build local + deploy
  verificado + análise de impacto. Migration antes do push. Cantinho é o ÚLTIMO tenant a ligar o offline.
- Deploy: push na `main` auto-deploya. `gh auth switch --user ImpulsoDigital063` antes (senão 403).
  Migration via `node scripts/db.mjs` (o MCP do Supabase aponta pro projeto errado).

## 9. Decisões deixadas pra hora de construir
- Ledger único (`processed_ops`) vs `op_id` por tabela — recomendado: ledger.
- TTL/limpeza do ledger (op antiga não volta) — ex.: purgar `processed_ops` > 7 dias.
- Motor de fila do food: evoluir o `offline-queue.ts` (estruturar `{kind,payload}` + resolveId) ou portar
  o do blueprint. Recomendado: evoluir o que já existe, mantendo o Starteq funcionando.
- Até onde o `sw.js` pré-cacheia (só GET visto vs snapshot proativo do cardápio/mesas).
