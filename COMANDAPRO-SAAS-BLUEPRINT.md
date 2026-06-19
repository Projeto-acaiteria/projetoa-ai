# ComandaPRO — Blueprint SaaS (extraído do AgendaPRO, validado em 3 negócios reais)

Fonte: depuração do código real do AgendaPRO pelos Verbos de lá (19/06). É o mapa de
implementação da fundação multi-tenant + auth + billing do ComandaPRO. Seguir linha a linha.

## DECISÃO #0 — RESOLVIDA: **1 conta = 1 loja** (Eduardo, 19/06)
Modelo do AgendaPRO: tenant resolvido por `stores.owner_id = auth.uid()` (lookup puro, sem
JWT claim, sem app_metadata, sem membership). **NÃO** nascemos com membership. Se um cliente
virar multi-unidade no futuro = projeto à parte (reescreve RLS). Nomenclatura ComandaPRO:
tabela tenant = `stores`, coluna em tudo = `store_id` (inglês, consistente com orders/customers).

## 1) MULTI-TENANCY
- **Tenant:** tabela `stores`, pk `id uuid` + `slug text unique` (URL pública `/[slug]`) +
  `owner_id references auth.users`. No schema base (não migration).
- **Amarração:** toda tabela-filha tem `store_id uuid references stores(id) on delete cascade`.
  Tabela 2º nível (ex order_items) sobe via FK do pai na policy. **Toda query filtra
  `.eq('store_id', storeId)` explícito — inclusive service-role** (lá RLS é bypassada, o filtro
  manual é a ÚNICA defesa).
- **RLS template canônico** (FOR ALL TO authenticated):
  `USING ( store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
           OR store_id IN (SELECT store_id FROM staff WHERE auth_user_id = auth.uid() AND active) )`
  (2º ramo = funcionário da loja; nosso equivalente a `professionals`). SECURITY DEFINER vai nos
  TRIGGERS de validação que leem outras tabelas ignorando RLS — **nunca** nas policies.
- **Resolução do tenant:** no layout protegido → `getCurrentUser()` → `getCurrentStore(user.id)`
  (`.eq('owner_id', user.id).maybeSingle()`), envolto em `cache()` do React (1 hit/request),
  propaga `store.id` pra tudo. `getCurrentStore` com retry backoff 0/200/400/600ms (pós-signup o
  Supabase devolve null transitório — copiar).
- **Pegadinhas pagas:**
  1. `USING(true)` legado fura tudo — dumpar `pg_policy` antes, dropar as permissivas uma a uma
     (anon lia 1039 customers de todos tenants até dropar). [[feedback_rls_dump_pgpolicy_antes]]
  2. Recursão RLS: policy de staff com subquery na própria staff = "infinite recursion" → usar
     função SECURITY DEFINER. [[feedback_rls_no_subquery_self]]
  3. Ordem de deploy ao apertar RLS: 1º sobe código que move writes públicos pra rota server
     com service-role, DEPOIS a migration que liga RLS. Invertido = front quebra em produção.
     → **cardápio/pedido público nasce já como rota server + service-role + rate-limit, RLS
     travada, zero policy pública de write.**
  4. `getServiceClient()` precisa `auth:{persistSession:false}` (senão vaza sessão entre requests).

## 2) AUTH — `@supabase/ssr` ^0.10.2
- **Copiar literal:** `src/lib/supabase/server.ts` (cookies async + try/catch vazio no setAll —
  Server Component não escreve cookie), `client.ts`, `src/middleware.ts` +
  `src/lib/supabase/middleware.ts`. O `updateSession` chama `supabase.auth.getUser()` só pra
  refresh do token — **sem isso o usuário desloga sozinho em ~1h** (bug real do Olímpio).
- **Usuário→tenant:** sem membership. Dono = `stores.owner_id`; funcionário = `staff.auth_user_id`
  (+ store_id). Papéis = flags booleanas em `staff` (is_owner/is_receptionist/...) + redirect no
  layout (gating inline por route group `(protected)`, sem permissions.ts central). Padrão
  `resolveStoreId` (tenta dono → cai pra funcionário).
- **Signup público OFF + criação server-side** (`/api/cadastro`):
  `admin.auth.admin.createUser({ email, password, email_confirm:true })` depois cadeia com
  ROLLBACK manual (cria store → falhou? deleteUser. cria subscription(pending_payment) → falhou?
  deleta store+user). **3 camadas anti-bot:** rate-limit in-memory (5/h) + rate-limit persistente
  em Postgres (`signup_attempts`, sobrevive cold start) + Turnstile. NUNCA reabrir "Allow new users
  to sign up" no painel (bot criou 5 contas em 6s). [[reference_agendapro_signup_locked]]
- **Reset senha — 2 fluxos:**
  - Dono (auto): `resetPasswordForEmail(email, {redirectTo:'/admin/redefinir-senha'})` → tela troca
    com `supabase.auth.updateUser({password})`. Tela espera 300ms antes de `getSession()` (hash async).
  - Funcionário: dono reseta via `admin.updateUserById` + seta `staff.password_changed=false` → 1º
    login cai em `/trocar-senha`. **CRÍTICO: na auto-troca usar `supabase.auth.updateUser`, NUNCA
    `admin.updateUserById`** (o admin variant invalida todas as sessões → loop de login, bug Leticia).
  - Config Supabase: Site URL + Redirect `/**` casados; rota de auth com no-store em
    CDN-Cache-Control + Vercel-CDN-Cache-Control. [[feedback_vercel_cdn_cache_auth]]

## 3) BILLING ASAAS (mensal recorrente)
- **`src/lib/asaas.ts` copiar 1:1** (menos toAsaasParams): base prod/sandbox por prefixo da key,
  header `access_token` (não Bearer), createCustomer/createSubscription/createPayment/getPixQrCode/
  getNextDueDate/refundPayment, retorno normalizado `{ok,status,data,error}`. Env: `ASAAS_API_KEY`,
  `ASAAS_WEBHOOK_TOKEN`.
- **Checkout** (`/api/billing/checkout-asaas`): get-or-create customer em 3 camadas (coluna salva →
  findByExternalReference → createCustomer). Cartão → createSubscription recorrente. PIX →
  createPayment avulso + getPixQrCode inline (cliente não sai). **`externalReference =
  "store_id|modalidade|coberturaMeses"`** — load-bearing: PIX avulso não tem subscription, é a ÚNICA
  forma do webhook saber qual tenant liberar e por quantos meses. Manter formato.
- **Webhook** (`/api/webhooks/asaas`): valida `asaas-access-token == ASAAS_WEBHOOK_TOKEN`.
  PAYMENT_CONFIRMED/RECEIVED liberam. Cálculo período:
  `base = sub.pago_ate && new Date(sub.pago_ate) > now ? sub.pago_ate : now;
   base.setMonth(base.getMonth() + coberturaMeses)` (preserva crédito em renovação antecipada).
  → status='active', pago_ate=base, grace_ends_at=null. PAYMENT_OVERDUE → past_due + grace=now+3d.
  PAYMENT_REFUNDED → cancelled + refunded_at. Sempre responde 200.
- **Schema `subscriptions`:** estado vivo = **`pago_ate`** (NÃO current_period_end). status
  CHECK(pending_payment|trial|active|past_due|cancelled|expired). Colunas: pago_ate, grace_ends_at,
  provider, asaas_customer_id/subscription_id/payment_id_atual, pix_link_atual, setup_paid_at,
  refund_deadline_at/refunded_at, permanent_courtesy. (Ignorar mp_* e public_blocked_at — legado.)
- **GATE** (`/admin/(protected)/layout.tsx`) — **olha SÓ status:**
  `blocked = !sub || sub.status==='pending_payment' || sub.status==='cancelled' || !!sub.refunded_at
   || (sub.status==='past_due' && grace_ends_at < now)`. NÃO compara pago_ate/period_end. Quem expira
  é o CRON, não o gate. [[reference_agendapro_billing_enforcement]]
- **Trial + CRON** (`/api/cron/billing-check`, `0 11 * * *`, auth Bearer CRON_SECRET):
  - Passo 1 (PIX): D-3 cria cobrança+email; D-2/D-1 lembrete; fallback dias<0 && active → past_due+grace.
  - Passo 2: expira trial/cortesia = `status=active AND permanent_courtesy=false AND plan_modalidade
    IS NULL AND asaas_subscription_id IS NULL` → D-0 vira pending_payment. `permanent_courtesy=true`
    excluído = isenção vitalícia. [[feedback_palace_cutoff_financeiro_28_05]]
  - Pegadinha: Vercel Hobby = cron 1x/dia → se webhook falha + cron de madrugada, ~24h acesso indevido.
- **Converter pending → checkout** (`/admin/bloqueado` + BillingPlanSelector): paywall status-driven;
  se pix_link_atual existe mostra "Continuar pagamento". Cartão: `window.open('about:blank')` ANTES do
  await fetch (preserva user-gesture do Safari iOS). PIX: QR inline.

## OS 6 BUGS — CORRIGIR AO PORTAR (não copiar)
1. **Idempotência webhook:** dedup por `payment.id` (hoje reenvio do Asaas estende pago_ate = mês grátis).
2. **Token webhook obrigatório:** hoje sem a env deixa passar (webhook aberto). Falhar fechado.
3. **Fuso:** getNextDueDate/diasAteVencer cortam em UTC → "D-3" escorrega 1 dia vs BR. Normalizar no fuso BR.
4. **Nascer só Asaas:** sem provider default mercado_pago, sem colunas mp_*.
5. **Lock anti duplo-checkout:** 2 POSTs simultâneos podem criar 2 subscriptions Asaas.
6. (Multi-loja — já resolvido: 1 conta = 1 loja.)

## NÃO SERVE PRA FOOD SERVICE (descartar do AgendaPRO)
professionals/working_hours/appointments/appointment_services/waitlist/points_* (modelagem de agenda) →
trocar por stores/products/orders/order_items/tables/categories (que o acai-system já tem). Manter só o
padrão `store_id + on delete cascade`. `src/config/pricing.ts`, planos solo/equipe, 4 modalidades, valores
hardcoded do cron → nossa régua é outra (definir: por PDV? flat? faturamento?). Manter só o formato do
externalReference.

## ARQUIVOS DO AGENDAPRO (referência, ordem de leitura)
supabase-schema.sql · v81-rls-booking-tables.sql · v82-drop-public-policies.sql ·
v48-fix-recep-rls-recursion.sql · src/lib/admin-data.ts · src/lib/supabase/{server,client,middleware}.ts ·
src/middleware.ts · src/app/admin/(protected)/layout.tsx · src/app/api/cadastro/route.ts · src/lib/asaas.ts ·
src/app/api/billing/checkout-asaas/route.ts · src/app/api/webhooks/asaas/route.ts ·
src/app/api/cron/billing-check/route.ts · src/app/admin/bloqueado/page.tsx
