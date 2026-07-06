-- Backfill de rastreabilidade: a coluna has_estoque JÁ existe em produção (aplicada
-- direto no SQL Editor sem migration no repo). Este arquivo recoloca o repo como
-- fonte da verdade do schema. Idempotente (if not exists) → no-op no banco atual;
-- serve pra quem recriar o banco do zero a partir das migrations.
-- Liga/desliga o módulo Estoque na nav do admin (store_config.has_estoque).
alter table public.store_config add column if not exists has_estoque boolean not null default false;
