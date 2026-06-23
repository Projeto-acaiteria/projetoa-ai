-- ComandaPRO mt-20: fecha as 3 tabelas que ficaram SEM RLS depois da mt-03 (store_config,
-- subscriptions, billing_events). Sem RLS, a anon (publishable) key lia/escrevia dados de
-- COBRANÇA via PostgREST (subscriptions: status, ids Asaas, link PIX). Provado na fonte:
-- GET /rest/v1/subscriptions com anon → 200 + linhas vazadas.
--
-- Server usa service-role (bypassa RLS) → app intacto: gate (getSubscription), checkout e
-- webhook Asaas tocam essas tabelas via service-role. supabaseBrowser() não é usado em lugar
-- nenhum, então nenhum acesso client-side direto quebra.

begin;

-- store_config: config da própria loja (features/segmento) — mesmo padrão store_owner das demais
-- 22 tabelas (dono gerencia a própria loja; não controla billing).
alter table public.store_config enable row level security;
drop policy if exists store_owner on public.store_config;
create policy store_owner on public.store_config for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));

-- subscriptions + billing_events: SÓ service-role (server). NÃO damos policy pra authenticated —
-- senão o dono logado daria UPDATE no próprio status/pago_ate e furaria o billing (assinatura
-- ativa de graça). RLS ligada sem policy = authenticated/anon não enxergam nada; service-role
-- (gate/checkout/webhook) bypassa e opera normal.
alter table public.subscriptions  enable row level security;
alter table public.billing_events enable row level security;

commit;
