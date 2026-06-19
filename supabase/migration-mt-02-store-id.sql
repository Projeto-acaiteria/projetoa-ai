-- ComandaPRO multi-tenant — Fase 1, fatia 2: store_id em todas as tabelas + backfill p/ loja #1.
--
-- Abordagem SEGURA (não quebra o Cantinho em produção):
--   store_id uuid NOT NULL DEFAULT <id-do-Cantinho> REFERENCES stores(id) ON DELETE CASCADE
--   - o DEFAULT preenche TODAS as linhas existentes já no ADD COLUMN (backfill automático)
--   - e faz os inserts atuais do código (que ainda não passam store_id) caírem no Cantinho
--   Na Fase 2 (auth): o código passa a setar store_id explícito → aí removemos o DEFAULT
--   (pra forçar store_id consciente e impedir vazamento pro Cantinho quando houver 2ª loja).
--
-- Idempotente (add column if not exists). FK on delete cascade + índice por store_id.
-- NOTA Fase 2: customers tem PK=phone → trocar pra PK composta (store_id, phone) quando
-- ajustar o customers-store.ts (telefone só é único DENTRO de uma loja).

do $$
declare
  cid uuid := (select id from stores where slug = 'cantinho-do-acai');
  t   text;
  tabelas text[] := array[
    'app_settings','app_menu','app_loyalty',
    'orders','customers','stock_items','cash_sessions','expenses','fixed_expenses',
    'tables','tabs','tab_orders','tab_order_items','tab_payments','service_calls'
  ];
begin
  if cid is null then
    raise exception 'Loja #1 (cantinho-do-acai) nao encontrada — rode a migration-mt-01 antes';
  end if;
  foreach t in array tabelas loop
    execute format(
      'alter table public.%I add column if not exists store_id uuid not null default %L references public.stores(id) on delete cascade',
      t, cid);
    execute format('create index if not exists %I on public.%I(store_id)', t || '_store_id_idx', t);
  end loop;
end $$;
