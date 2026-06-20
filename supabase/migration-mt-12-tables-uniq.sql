-- Multi-tenant: a tabela `tables` tinha UNIQUE(number) GLOBAL (resquício single-tenant) — mesa 12
-- de uma loja colidia com a de outra. Troca pela unique composta (store_id, number), igual fizemos
-- em customers (mt-07) e stock_items (mt-08).
alter table public.tables drop constraint if exists tables_number_key;
alter table public.tables add constraint tables_store_number_uniq unique (store_id, number);
