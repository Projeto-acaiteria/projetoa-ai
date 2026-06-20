-- mt-17 · Ficha técnica do produto (bar/grid) + custo de insumo (CMV)
-- recipe: liga um menu_product a insumos do estoque [{stockId, qty}] → baixa automática na venda.
-- O estoque vive em stock_items.data (jsonb) — custo por unidade entra lá via app (cost_cents/costPerUnit),
-- então aqui só precisamos da coluna recipe no produto relacional.
alter table menu_products
  add column if not exists recipe jsonb not null default '[]'::jsonb;

comment on column menu_products.recipe is
  'Ficha técnica: [{stockId, qty}] consumido por unidade vendida. Baixa automática server-side em addTabItems.';
