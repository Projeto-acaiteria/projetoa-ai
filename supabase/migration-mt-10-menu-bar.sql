-- ComandaPRO — modelo de cardápio BAR (categoria → produto, espelha o Medellín).
-- Multi-tenant + RLS por loja. Shape validado 1:1 contra o código real do Medellín:
--   station mora na CATEGORIA (roteia cozinha/bar/copa, herda pro item).
--   description só na categoria (subtítulo do banner). size_label = 1 variação livre no produto.
--   foto = URL na própria row (image_url). sort explícito em categoria E produto.
--   active na categoria é melhoria nossa (esconder categoria inteira) — não existe no Medellín.
-- Convive com o modelo açaí (app_menu blob, intocado); store_config.menu_template decide qual a loja usa.

create table if not exists public.menu_categories (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  name        text not null,
  station     text not null default 'cozinha', -- 'cozinha' | 'bar' | 'copa' ... (aberto)
  description text,
  img         text,                            -- image_url do banner (null = placeholder no front)
  sort        int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists menu_categories_store_sort on public.menu_categories(store_id, sort);

create table if not exists public.menu_products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  name        text not null,
  price_cents int  not null default 0,
  size_label  text,                            -- variação única livre ("dose"/"garrafa"/"500g")
  img         text,                            -- image_url do produto
  sort        int  not null default 0,
  active      boolean not null default true,   -- false = some do cardápio público
  created_at  timestamptz not null default now()
);
create index if not exists menu_products_cat_sort on public.menu_products(store_id, category_id, sort);

-- RLS por loja (igual às demais tabelas: dono authenticated vê a própria; service-role bypassa;
-- anon bloqueado — o cardápio público é lido via server com service-role).
alter table public.menu_categories enable row level security;
alter table public.menu_products  enable row level security;

drop policy if exists store_owner on public.menu_categories;
create policy store_owner on public.menu_categories for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));

drop policy if exists store_owner on public.menu_products;
create policy store_owner on public.menu_products for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
