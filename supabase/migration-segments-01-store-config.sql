-- ComandaPRO Fase 4: config por loja (multi-segmento). Cada flag liga/desliga uma feature.
-- O onboarding preenche a partir do business_type (defaults em src/config/segments.ts).
create table if not exists store_config (
  store_id        uuid primary key references stores(id) on delete cascade,
  business_type   text not null default 'acaiteria',
  sells_by_weight boolean not null default false,
  has_balcao      boolean not null default true,
  has_tables      boolean not null default true,
  has_delivery    boolean not null default true,
  cover_enabled   boolean not null default false,
  stock_dose      boolean not null default false,
  has_stations    boolean not null default false,
  loyalty_enabled boolean not null default true,
  created_at      timestamptz not null default now()
);
-- Cantinho (loja #1) = açaiteria
insert into store_config (store_id, business_type, sells_by_weight, has_balcao, has_tables, has_delivery, loyalty_enabled)
select id, 'acaiteria', true, true, true, true, true from stores where slug='cantinho-do-acai'
on conflict (store_id) do nothing;
