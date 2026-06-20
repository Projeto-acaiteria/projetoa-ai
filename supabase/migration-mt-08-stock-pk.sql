-- Ativacao: stock_items PK vira (store_id, id) — ids fixos ("polpa" etc) unicos POR loja.
alter table public.stock_items drop constraint if exists stock_items_pkey;
alter table public.stock_items add primary key (store_id, id);
