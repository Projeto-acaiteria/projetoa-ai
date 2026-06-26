-- mt-21: 1 COMANDA ABERTA por mesa (anti-corrida). Vários pedidos simultâneos pelo QR da MESMA
-- mesa criavam comandas DUPLICADAS (getOrCreateOpenTab era read-then-insert sem trava).
-- Índice parcial único garante no banco; o código (getOrCreateOpenTab) trata o 23505 reusando a
-- comanda vencedora. Antes do índice, fecha duplicatas existentes (mantém a mais antiga).

with dups as (
  select id, row_number() over (partition by store_id, table_id order by id) rn
  from tabs
  where status = 'aberta' and table_id is not null
)
update tabs set status = 'fechada', closed_at = now()
where id in (select id from dups where rn > 1);

create unique index if not exists tabs_one_open_per_table
  on tabs (store_id, table_id) where status = 'aberta';
