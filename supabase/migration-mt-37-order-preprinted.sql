-- mt-37: marca o pedido que JÁ foi impresso localmente no lançamento OFFLINE, pra o vigia headless
-- (CaixaPrepPrinter) NÃO reimprimir quando o item sobe no sync (senão a cozinha recebe 2× o ticket).
-- Só o lançar offline seta true; online segue false (o CaixaPrepPrinter imprime normal, multi-device).
alter table tab_orders add column if not exists pre_printed boolean not null default false;
