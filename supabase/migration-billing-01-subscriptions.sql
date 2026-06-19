-- ComandaPRO Fase 3.1: tabela subscriptions (estado de billing por loja).
-- Estado vivo = pago_ate (NÃO period_end). 1 subscription por loja. Só Asaas (sem mp_* legado).
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references stores(id) on delete cascade,
  status text not null default 'trial'
    check (status in ('pending_payment','trial','active','past_due','cancelled','expired')),
  pago_ate timestamptz,
  grace_ends_at timestamptz,
  provider text default 'asaas',
  asaas_customer_id text,
  asaas_subscription_id text,
  asaas_payment_id_atual text,
  pix_link_atual text,
  setup_paid_at timestamptz,
  refund_deadline_at timestamptz,
  refunded_at timestamptz,
  permanent_courtesy boolean not null default false,
  plano text,
  created_at timestamptz not null default now()
);
-- Cantinho (loja #1) = cortesia permanente (loja teste / 1o cliente; nunca bloqueia)
insert into subscriptions (store_id, status, permanent_courtesy)
select id, 'active', true from stores where slug='cantinho-do-acai'
on conflict (store_id) do nothing;
