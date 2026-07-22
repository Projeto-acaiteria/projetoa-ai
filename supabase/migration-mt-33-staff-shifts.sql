-- mt-33: PRESENÇA (diárias) do garçom. O Medellín paga por DIÁRIA, não por comissão — e por isso
-- ninguém vincula garçom na comanda (não há incentivo). Então a presença NÃO pode ser derivada de
-- quem atendeu: precisa de registro próprio. O check-in nasce no login do garçom e é idempotente
-- (1 linha por garçom por NOITE OPERACIONAL). diaria_cents é SNAPSHOT: reajustar a diária depois
-- não reescreve noite já trabalhada. bonus_cents e a edição da diária são do Adm. Idempotente.
create table if not exists staff_shifts (
  id            bigint generated always as identity primary key,
  store_id      uuid not null references stores(id) on delete cascade,
  staff_id      uuid not null references staff(id) on delete cascade,
  noite         date not null,                       -- noite operacional (6h→6h), não dia civil
  diaria_cents  int  not null default 0,             -- snapshot da diária cadastrada no dia
  bonus_cents   int  not null default 0,             -- extra da noite (Adm)
  source        text not null default 'login',       -- 'login' (check-in) | 'manual' (Adm lançou)
  checked_in_at timestamptz not null default now()
);

-- 1 presença por garçom por noite: torna o check-in do login idempotente (23505 = já registrado)
create unique index if not exists staff_shifts_uniq on staff_shifts (store_id, staff_id, noite);
create index if not exists staff_shifts_store_noite_idx on staff_shifts (store_id, noite);

alter table staff_shifts enable row level security;
drop policy if exists store_owner on public.staff_shifts;
create policy store_owner on public.staff_shifts for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
