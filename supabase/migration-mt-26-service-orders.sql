-- ComandaPRO — vertical de ASSISTÊNCIA TÉCNICA: ordens de serviço (OS).
-- Domínio novo (não-food). Convenção ComandaPRO: centavos, store_id, RLS por owner.
-- Técnico REUSA a tabela staff (staff_id) — não cria tabela de técnico redundante.
-- Comissão = service_value (mão de obra) da OS quitada; peça NUNCA entra na base (regra Júnior).
create table if not exists public.service_orders (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references public.stores(id) on delete cascade,
  code                text,                       -- display: OS-2026-0001
  customer_name       text not null default '',
  customer_phone      text not null default '',
  device              text not null default '',   -- aparelho (marca/modelo)
  imei                text,                        -- IMEI/serial (rastreio/garantia)
  device_password     text,                        -- senha do aparelho (cifrar depois — LGPD)
  problem             text not null default '',    -- defeito relatado pelo cliente
  diagnosis           text,                        -- laudo técnico
  status              text not null default 'aguardando', -- aguardando|em_reparo|pronto|entregue|cancelado
  staff_id            uuid references public.staff(id) on delete set null, -- técnico (reusa staff)
  commission_percent  numeric(5,2) not null default 0,
  service_value_cents integer not null default 0,  -- mão de obra (BASE da comissão)
  parts_value_cents   integer not null default 0,  -- peças
  discount_cents      integer not null default 0,  -- cupom/desconto
  total_cents         integer not null default 0,  -- LÍQUIDO (service+parts-desconto)
  payment_status      text not null default 'aberta', -- aberta|parcial|quitada
  payment_method      text,
  paid_at             timestamptz,
  warranty_days       integer default 90,          -- garantia legal (CDC art. 26 II)
  estimated_at        timestamptz,                 -- prazo previsto
  delivered_at        timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists service_orders_store on public.service_orders(store_id, status);
create index if not exists service_orders_store_tech on public.service_orders(store_id, staff_id);

-- peças usadas na OS (baixa de estoque na quitação; parts_value = soma)
create table if not exists public.os_parts (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  os_id           uuid not null references public.service_orders(id) on delete cascade,
  sku             text,
  name            text not null default '',
  qty             integer not null default 1,
  unit_cost_cents integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists os_parts_os on public.os_parts(os_id);

-- RLS: mesmo padrão vigente das tabelas de tenant (owner_id). O hardening de membership
-- (recepção/técnico veem a loja) entra junto com o das outras tabelas, num passo só.
alter table public.service_orders enable row level security;
drop policy if exists store_owner on public.service_orders;
create policy store_owner on public.service_orders for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));

alter table public.os_parts enable row level security;
drop policy if exists store_owner on public.os_parts;
create policy store_owner on public.os_parts for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
