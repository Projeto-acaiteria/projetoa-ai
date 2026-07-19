-- FIX isolamento (18/07/2026): print_jobs era a ÚNICA tabela com RLS desligada + grants pro anon.
-- Com a anon key pública qualquer um lia os cupons (com telefone do cliente) de QUALQUER tenant,
-- e podia injetar HTML na fila de impressão / marcar done / TRUNCATE de qualquer loja.
-- SEGURO: print_jobs só é acessada em src/app/api/print-jobs/route.ts via db()=service_role
-- (que IGNORA RLS). Nenhum client lê a tabela direto → impressão continua funcionando.

alter table public.print_jobs enable row level security;
revoke all on table public.print_jobs from anon, authenticated;

-- ROLLBACK (se precisar voltar):
--   alter table public.print_jobs disable row level security;
--   grant all on table public.print_jobs to anon, authenticated;
