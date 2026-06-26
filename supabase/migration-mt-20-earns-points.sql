-- mt-20: Fidelidade POR CATEGORIA (ComandaPRO, multi-segmento)
-- Cada categoria do cardápio decide se DÁ pontos. Default true = todas pontuam
-- (não quebra loja existente). A pontuação passa a somar só os centavos dos itens
-- cuja categoria pontua (eligibleCents), em vez do total bruto da venda.
-- Universal: serve açaí (tirar refri), bar (tirar revenda), restaurante (tirar bebida)...

alter table menu_categories add column if not exists earns_points boolean not null default true;

-- a mesa credita pontos no FECHAMENTO (lê tab_order_items, que não carregam categoria) →
-- persiste a elegibilidade na linha, resolvida no lançamento (mesmo padrão de mods/note).
alter table tab_order_items add column if not exists earns_points boolean not null default true;
