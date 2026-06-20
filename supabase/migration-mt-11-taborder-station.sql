-- ComandaPRO — roteamento por estação na COMANDA (motor). Cada tab_order (um "envio") pertence a
-- UMA estação. Pedido com itens de cozinha + bar vira 2 tab_orders, cada um pra sua impressora/KDS.
-- A comanda (tab) continua íntegra somando tudo. Modelo açaí (sem estação) grava station='cozinha'
-- (default) → 1 tab_order só, comportamento atual preservado.
alter table public.tab_orders add column if not exists station text not null default 'cozinha';
create index if not exists tab_orders_station on public.tab_orders(store_id, station, status);
