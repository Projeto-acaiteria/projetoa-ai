-- mt-32: cancelar VENDA DE MESA (comanda fechada) — espelha o estorno do balcão (orders.cancelled).
-- A comanda ganha o conceito de "cancelada": não some, vira registro auditável, e sai do caixa/
-- faturamento/CMV/comissão pelos filtros no código. points_awarded guarda os pontos dados no
-- fechamento pra o cancelamento saber quanto estornar (antes não era persistido). Idempotente.
alter table tabs add column if not exists cancelled     boolean not null default false;
alter table tabs add column if not exists cancelled_at   timestamptz;
alter table tabs add column if not exists cancel_reason  text;
alter table tabs add column if not exists cancelled_by   text;
alter table tabs add column if not exists points_awarded int not null default 0;

create index if not exists tabs_store_cancelled_idx on tabs (store_id, cancelled);
