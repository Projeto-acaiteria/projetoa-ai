-- mt-40 · SEGURANÇA: trancar a função move_stock (05/08/2026).
-- move_stock é SECURITY DEFINER (ignora RLS por dentro) e nascia executável por PUBLIC/anon —
-- ou seja, QUALQUER um com a chave anon (pública, vai no bundle) podia mexer no estoque de
-- QUALQUER loja por store_id, sem login. É a mesma classe de buraco achada no AgendaPRO.
--
-- Ela é chamada SÓ pelo servidor (stock-store.ts via db()=service_role). Então a correção é
-- camada 1 (quem pode chamar): revoga de todos e concede só a service_role. O servidor segue
-- funcionando; anon/authenticated deixam de alcançar a função. Sem guarda auth.uid() por dentro
-- de propósito: service_role não tem auth.uid(), então a autorização é o guard das rotas (server).
--
-- REGRA QUE FICA: toda SECURITY DEFINER nova precisa de REVOKE explícito no mesmo migration.

REVOKE ALL ON FUNCTION public.move_stock(uuid, text, text, numeric, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.move_stock(uuid, text, text, numeric, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.move_stock(uuid, text, text, numeric, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.move_stock(uuid, text, text, numeric, text, text, jsonb) TO service_role;
