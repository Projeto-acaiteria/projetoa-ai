-- ComandaPRO — motor de PERSONALIZAÇÃO/MONTAGEM por produto (pizza meio-a-meio, monta-seu-lanche,
-- adicionais, ponto da carne, remover ingrediente). Espelha o conceito de GROUPS do açaí, relacional
-- pro modelo bar/grid. min_select/max_select = obrigatório/teto; free_up_to = N primeiros grátis.
-- A escolha do cliente viaja em tab_order_items.mods (jsonb) → ESPELHA no KDS e no cupom (dor #8 da
-- pesquisa: "adicional some na cozinha"). Preço do item = base + soma dos modificadores pagos.

create table if not exists public.menu_modifier_groups (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  product_id  uuid not null references public.menu_products(id) on delete cascade,
  title       text not null,
  min_select  int  not null default 0,  -- 0 = opcional · >=1 = obrigatório escolher
  max_select  int  not null default 0,  -- 0 = ilimitado
  free_up_to  int  not null default 0,  -- N primeiros não somam preço (ex: 3 acompanhamentos grátis)
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists modgroups_product on public.menu_modifier_groups(store_id, product_id, sort);

create table if not exists public.menu_modifiers (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  group_id    uuid not null references public.menu_modifier_groups(id) on delete cascade,
  name        text not null,
  price_cents int  not null default 0,
  sort        int  not null default 0,
  active      boolean not null default true
);
create index if not exists modifiers_group on public.menu_modifiers(store_id, group_id, sort);

-- escolha do cliente por linha do pedido: [{name, price_cents}] — snapshot (não FK viva), espelha no KDS/cupom
alter table public.tab_order_items add column if not exists mods jsonb;

-- RLS por loja (igual às demais)
alter table public.menu_modifier_groups enable row level security;
alter table public.menu_modifiers       enable row level security;
drop policy if exists store_owner on public.menu_modifier_groups;
create policy store_owner on public.menu_modifier_groups for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
drop policy if exists store_owner on public.menu_modifiers;
create policy store_owner on public.menu_modifiers for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
