-- mt-31: o log de cancelamento é AUDITORIA — tem que sobreviver à mesa ser liberada.
-- A mt-30 criou tab_id com FK on delete cascade → ao liberar/deletar a comanda vazia (último
-- item cancelado), o registro do log sumiria junto (cascade). Remove a FK dura: tab_id vira só
-- um bigint (igual tab_order_id), guardando a referência sem amarrar ao ciclo de vida do tab.
-- Idempotente.
alter table tab_item_cancellations drop constraint if exists tab_item_cancellations_tab_id_fkey;
