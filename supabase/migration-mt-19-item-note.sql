-- mt-19 · Observação POR ITEM da comanda (diferencial vs Medellín, que tem note só por pedido).
-- Ex: "sem cebola", "mal passado" numa linha específica. Espelha no KDS/cupom.
alter table tab_order_items add column if not exists note text;
comment on column tab_order_items.note is 'Observação da LINHA (ex: ponto da carne, sem cebola). Diferente do note do tab_orders (por pedido).';
