-- ComandaPRO — FAIXA de preço nomeada no modificador (pizza: Tradicional/Especial/Premium).
-- O dono nomeia a faixa no montador; cada sabor daquela faixa guarda o rótulo. O cardápio público
-- agrupa os sabores por faixa (label + preço). Coluna nova, nullable → não afeta nada existente.
alter table public.menu_modifiers add column if not exists tier_label text;
