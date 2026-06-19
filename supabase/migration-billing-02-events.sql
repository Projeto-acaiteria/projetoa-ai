-- ComandaPRO 3.5: dedup de webhook (idempotência — reenvio do Asaas não estende pago_ate 2x).
create table if not exists billing_events (
  payment_id   text primary key,
  event        text,
  store_id     uuid references stores(id) on delete cascade,
  processed_at timestamptz not null default now()
);
