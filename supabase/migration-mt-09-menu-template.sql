-- 3 modelos de cardápio: acai (montagem) | bar (comanda Medellin) | grid (clássico, foto grande).
-- Default por segmento; a loja pode trocar depois.
alter table public.store_config add column if not exists menu_template text not null default 'acai';
update public.store_config set menu_template = case
  when business_type in ('bar','petiscaria') then 'bar'
  when business_type in ('restaurante','marmitaria') then 'grid'
  else 'acai'
end;
