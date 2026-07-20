-- mt-30: log de cancelamento de item em comanda ABERTA (mesa/bar).
-- Espelha a filosofia do estorno de venda (orders.cancelled): item não some sem rastro —
-- cada cancelamento vira registro auditável (o quê, quanto, motivo, quem, quando). A linha
-- viva da comanda é decrementada/apagada (pra o total ficar certo) e o app estorna o estoque.
-- Idempotente. RLS store_owner igual às irmãs (tabs / tab_orders / tab_order_items).
create table if not exists tab_item_cancellations (
  id               bigint generated always as identity primary key,
  store_id         uuid   not null references stores(id) on delete cascade,
  tab_id           bigint not null references tabs(id) on delete cascade,
  tab_order_id     bigint,                 -- pode já ter sido apagado (pedido esvaziou) → sem FK dura
  item_name        text   not null,
  size_label       text,
  qty              int    not null,        -- quantas unidades foram canceladas neste registro
  unit_price_cents int    not null default 0,
  mods             jsonb,
  reason           text   not null,
  cancelled_by     text,                   -- email do operador logado que cancelou
  created_at       timestamptz not null default now()
);

create index if not exists tab_item_cancellations_store_tab_idx
  on tab_item_cancellations (store_id, tab_id);

alter table tab_item_cancellations enable row level security;
drop policy if exists store_owner on public.tab_item_cancellations;
create policy store_owner on public.tab_item_cancellations for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
