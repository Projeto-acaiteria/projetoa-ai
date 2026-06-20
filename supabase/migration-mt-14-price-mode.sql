-- ComandaPRO — price_mode no grupo de modificador (sacada do Ichiban/ExpressoDelivery): como o preço
-- do grupo e calculado. 'sum' (default: adicionais somam) | 'highest' (pizza meio-a-meio: paga o sabor
-- mais caro) | 'average' (media). Resolve pizza/sushi/acai com 1 campo, reusando o motor existente.
alter table public.menu_modifier_groups add column if not exists price_mode text not null default 'sum';
