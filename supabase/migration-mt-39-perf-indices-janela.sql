-- mt-39 · Índices pra a janela do resumo do caixa (economia Supabase free).
-- O resumo agora busca só a sessão (não a história inteira). Estes índices fazem o filtro rodar
-- no índice (multi-tenant: store_id primeiro), não em seq scan. "if not exists" = idempotente.
--
-- orders: NÃO tem coluna created_at — o createdAt mora no jsonb `data`. Índice de EXPRESSÃO sobre
-- (data->>'createdAt') (texto ISO "…Z", que ordena igual cronológico). Casa com o filtro do PostgREST.
-- tab_payments: paid_at é coluna real (timestamptz).
-- Tabelas pequenas no nano → build rápido.

create index if not exists orders_store_created_idx on public.orders (store_id, ((data->>'createdAt')));
create index if not exists tab_payments_store_paid_idx on public.tab_payments (store_id, paid_at);
