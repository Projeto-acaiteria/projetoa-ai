-- ComandaPRO — bar 2a onda: GARCONS + comissao/gorjeta. staff = garcom (comissao = acordo do patrao,
-- % sobre o que vende; DIFERENTE da gorjeta/taxa que e dos trabalhadores). waiter_id na comanda liga
-- a venda ao garcom, destravando o relatorio de acerto e o rateio da gorjeta.
create table if not exists public.staff (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references public.stores(id) on delete cascade,
  name               text not null,
  commission_percent numeric(5,2) not null default 0,  -- % de comissao sobre o consumo que o garcom vende
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists staff_store on public.staff(store_id, active);

alter table public.tabs add column if not exists waiter_id uuid references public.staff(id) on delete set null;

alter table public.staff enable row level security;
drop policy if exists store_owner on public.staff;
create policy store_owner on public.staff for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
