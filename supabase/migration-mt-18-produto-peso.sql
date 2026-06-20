-- mt-18 · Produto vendido POR PESO (marmita / comida a quilo) no menu relacional (bar/grid).
-- by_weight=true → price_cents passa a ser o preço por KG; a venda multiplica peso(g)/1000 × price_cents.
-- tare_grams = peso do prato/embalagem a descontar (tara). Motor igual ao do açaí (pricePerKgCents).
alter table menu_products
  add column if not exists by_weight boolean not null default false,
  add column if not exists tare_grams integer not null default 0;

comment on column menu_products.by_weight is 'Vendido por peso: price_cents = R$/kg; preço = (peso-tara)/1000 × price_cents.';
comment on column menu_products.tare_grams is 'Tara (g) descontada do peso bruto antes de calcular o preço.';
