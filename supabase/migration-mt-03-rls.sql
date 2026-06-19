-- ComandaPRO Fase 2.6: RLS por loja — substitui as policies `demo_all` (public / USING(true))
-- pela isolação por tenant. A demo_all é a BRECHA: qualquer um com a publishable key lê/escreve
-- TUDO via PostgREST. Esta migration fecha isso.
--
-- ⚠️⚠️ NÃO APLICAR ENQUANTO A PRODUÇÃO USAR ANON. ⚠️⚠️
-- Hoje (19/06) a produção do Cantinho (projetoa-ai.vercel.app) tem só NEXT_PUBLIC_SUPABASE_ANON_KEY
-- na Vercel — o db() lá cai no anon e DEPENDE da demo_all. Aplicar isto agora = Cantinho fora do ar.
-- PRÉ-REQUISITO: todo consumidor do banco usando SERVICE-ROLE. Aplicar SÓ junto do deploy do
-- ComandaPRO com SUPABASE_SERVICE_ROLE_KEY configurada (e produção redeployada usando service-role).
--
-- Pós-aplicação: service-role (rotas server) bypassa RLS → app funciona; anon perde acesso direto
-- (brecha fechada); authenticated (dono) enxerga só a própria loja. (Ramo de funcionário/staff
-- entra quando existir a tabela staff — hoje só há o dono via stores.owner_id.)

-- stores: habilita RLS + dono vê a própria loja
alter table public.stores enable row level security;
drop policy if exists stores_owner on public.stores;
create policy stores_owner on public.stores for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- demais tabelas: troca demo_all (public/true) por isolamento por loja (dono logado)
do $$
declare
  t text;
  tabelas text[] := array[
    'app_settings','app_menu','app_loyalty',
    'orders','customers','stock_items','cash_sessions','expenses','fixed_expenses',
    'tables','tabs','tab_orders','tab_order_items','tab_payments','service_calls'
  ];
begin
  foreach t in array tabelas loop
    execute format('drop policy if exists demo_all on public.%I', t);
    execute format(
      'create policy store_owner on public.%I for all to authenticated '
      'using (store_id in (select id from stores where owner_id = auth.uid())) '
      'with check (store_id in (select id from stores where owner_id = auth.uid()))', t);
  end loop;
end $$;
