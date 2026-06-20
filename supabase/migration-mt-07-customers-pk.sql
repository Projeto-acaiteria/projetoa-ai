-- Ativacao: customers PK vira (store_id, phone) — telefone unico POR loja (nao global).
alter table public.customers drop constraint if exists customers_pkey;
alter table public.customers add primary key (store_id, phone);
