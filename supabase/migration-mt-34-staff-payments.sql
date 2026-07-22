-- mt-34: PAGAMENTO das diárias. A mt-33 passou a contar as noites, mas não havia onde registrar
-- que a casa PAGOU — então dava pra pagar a mesma noite duas vezes e o custo não aparecia no
-- resultado. Espelha o padrão do pagamento de comissão do técnico (recibo + trava anti-2x), mas
-- pra o bar: o recibo agrega NOITES, não ordens de serviço.
create table if not exists staff_payments (
  id           bigint generated always as identity primary key,
  store_id     uuid not null references stores(id) on delete cascade,
  staff_id     uuid not null references staff(id) on delete cascade,
  total_cents  int  not null,              -- soma de diárias + bônus das noites incluídas
  noites       int  not null default 0,    -- quantas noites o recibo cobre
  period_start date,
  period_end   date,
  notes        text,
  paid_by      text,                       -- email do operador que registrou
  paid_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- carimbo na noite: quem já foi pago não entra em novo pagamento (trava anti-2x).
-- ON DELETE SET NULL: estornar o recibo devolve as noites pra "a pagar".
alter table staff_shifts add column if not exists payment_id bigint references staff_payments(id) on delete set null;

create index if not exists staff_payments_store_staff_idx on staff_payments (store_id, staff_id);
create index if not exists staff_shifts_payment_idx on staff_shifts (payment_id);

alter table staff_payments enable row level security;
drop policy if exists store_owner on public.staff_payments;
create policy store_owner on public.staff_payments for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
