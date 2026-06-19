# Açaí System → SaaS multi-tenant (espelhando o AgendaPRO)

Hoje o sistema é **single-tenant** (1 açaiteria: Cantinho do Açaí, admin sem login,
dados sem dono). Pra virar SaaS (vender mensal pra N açaiterias), precisa de
multi-tenancy + auth + billing recorrente. O AgendaPRO já resolve tudo isso —
a meta é **reusar, não reinventar**.

## 1. Multi-tenancy (a base, maior esforço)
- Tabela `lojas` (tenant): id, nome, slug, plano, status, created_at, owner_user_id.
- Adicionar `loja_id` em TODAS as tabelas: orders, customers, stock_items, cash_sessions,
  expenses, fixed_expenses, tables, tabs, tab_orders, tab_payments, service_calls,
  e as configs (app_settings/app_menu/app_loyalty deixam de ser singleton id=1 → uma linha por loja).
- Toda query filtra por `loja_id`. **RLS por tenant** (cada conta só enxerga a própria loja).
- Cardápio público vira por-loja: `/[slug]/cardapio` ou subdomínio (cantinhodoacai...). Cada link puxa o cardápio daquela açaiteria.
- Migração: o Cantinho atual vira a **primeira loja** (loja_id existente → todos os dados recebem esse id).

## 2. Auth / contas — REUSAR do AgendaPRO
- **Supabase Auth** (email/senha) — AgendaPRO já usa (ref `aazvqjhebfcoruyipoaw`). [[reference_agendapro_auth_reset]]
- Painel admin atrás de login; o `loja_id` do usuário define os dados.
- Dono + funcionários (roles: dono/operador/recepção — como Palace/AgendaPRO).
- **Signup público OFF** — conta nasce via `admin.createUser` server-side (lição do AgendaPRO: bot criou contas em 6s). [[reference_agendapro_signup_locked]]
- Reset de senha: link recovery (dono) / flag password_changed (funcionário).

## 3. Onboarding / provisionamento
- Criar loja = cria tenant + conta do dono + dados iniciais (menu default, settings, 40 mesas opcionais).
- Definir slug/subdomínio.

## 4. Billing recorrente — REUSAR do AgendaPRO
- **Asaas** (produção, cobrança real) — AgendaPRO já integra. [[reference_agendapro_billing_enforcement]]
- Assinatura **mensal recorrente** (é o que o Vidal pediu).
- **Trial** (X dias) → depois cobra. Status: `active | trial | pending_payment | suspended`.
- **Gate de acesso:** olha SÓ o status (não period_end). Bloqueia se não-ativo. `permanent_courtesy` isenta.
- **Cron de expiração** de trial/cortesia (AgendaPRO v85).
- Converter: `pending_payment → checkout` Asaas.

## 5. Planos
- Definir níveis (ex: **Essencial** = cardápio+delivery+impressão | **Completo** = +mesas+peso+fidelidade+estoque+financeiro).
- O Vidal entra no plano mensal (valor da pesquisa de mercado em curso).

## O que PEGAR PRONTO do AgendaPRO (pedir ao Verbo de lá)
- Cliente Supabase Auth + fluxo de login/reset.
- Integração Asaas: criar assinatura, webhook de pagamento, atualizar status.
- O **gate de billing** (middleware/guard que checa status e bloqueia).
- O **cron de expiração** de trial.
- O padrão de `admin.createUser` server-side (signup controlado).
- O modelo de planos/status.

## Fases (ordem)
1. **Multi-tenancy** (loja_id + RLS + queries por loja) — a fundação.
2. **Auth** (login no painel, loja do usuário).
3. **Billing** (Asaas: assinatura, gate, trial, cron).
4. **Onboarding** (cadastro de nova loja + landing).

## Decisão estratégica
- O Cantinho do Vidal vira a **loja #1** (primeiro tenant pagante — valida o SaaS com cliente real).
- Casa com a tese [[softwarehouse]] (recorrência) e [[project_pdv_foodservice_produto]] (fork-agora-SaaS-depois).
