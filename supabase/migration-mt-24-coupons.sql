-- ComandaPRO — CORE: cupom de DESCONTO (NÃO confundir com o cupom de impressão/recibo térmico).
-- Governa o desconto que já existe em orders.discountCents: em vez do operador digitar % / R$ solto,
-- ele aplica um código com regra (validade, mínimo, teto, limite de uso). Por loja, RLS por owner.
-- Tudo em CENTAVOS (int), como o resto do dinheiro. O split serviço/peça é do vertical de AT, não daqui.
create table if not exists public.coupons (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references public.stores(id) on delete cascade,
  code               text not null,                        -- comparar sempre em UPPER
  description        text not null default '',
  kind               text not null default 'percentual',  -- 'percentual' | 'valor'
  percent            numeric(5,2),                         -- kind=percentual: 10 = 10%
  value_cents        integer,                              -- kind=valor: desconto fixo em centavos
  min_subtotal_cents integer,                              -- subtotal mínimo pra valer
  max_discount_cents integer,                              -- teto do desconto (útil p/ percentual)
  valid_from         timestamptz,
  valid_until        timestamptz,
  usage_limit        integer,                              -- null = ilimitado
  used_count         integer not null default 0,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);
-- código único por loja (case-insensitive)
create unique index if not exists coupons_store_code on public.coupons(store_id, upper(code));
create index if not exists coupons_store_active on public.coupons(store_id, active);

alter table public.coupons enable row level security;
drop policy if exists store_owner on public.coupons;
create policy store_owner on public.coupons for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
