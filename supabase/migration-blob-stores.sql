-- Stores existentes viram blob jsonb (PK natural + data). Migração 1:1, filtro
-- em memória como já era. As tabelas de MESAS continuam relacionais (não tocar).
drop table if exists orders cascade;
create table orders (id bigint primary key, data jsonb not null);

drop table if exists customers cascade;
create table customers (phone text primary key, data jsonb not null);

drop table if exists stock_items cascade;
create table stock_items (id text primary key, data jsonb not null);

drop table if exists cash_sessions cascade;
create table cash_sessions (id bigint primary key, data jsonb not null);

drop table if exists expenses cascade;
create table expenses (id text primary key, data jsonb not null);

drop table if exists fixed_expenses cascade;
create table fixed_expenses (id text primary key, data jsonb not null);

do $$
declare t text;
begin
  foreach t in array array['orders','customers','stock_items','cash_sessions','expenses','fixed_expenses']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists demo_all on %I', t);
    execute format('create policy demo_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;
