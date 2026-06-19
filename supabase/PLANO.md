# Migração Supabase + Módulo de Mesas — Cantinho do Açaí

## Estratégia
Migrar os 8 stores `.data` JSON → Supabase, mantendo o app igual (delivery/balcão
intactos), e ADICIONAR o módulo de mesas (portado do Medellín, adaptado).
Dois fluxos de pedido coexistem:
- **Delivery/balcão** (já existe): tabela `orders` (Order atual, items em JSONB).
- **Mesas** (novo): `tabs` → `tab_orders` → `tab_order_items` + `tab_payments` + `service_calls`.

## Decisões
- Valores em **centavos (int)** em todo lugar (consistência com o açaí; Medellín usava numeric/reais).
- Arrays simples (history, movements, items do delivery) ficam **JSONB** (migração 1:1, sem query individual).
- Config single-row (settings, menu, loyalty) = 1 linha com `data jsonb`.
- Mesas = **relacional** (segue o Medellín).
- RLS: stores via **service_role** (server). Mesas com RLS permissiva (`using true`) pro realtime anon ler.

## Caveats do port (REMOVER do Medellín)
- Cover artístico (events, people_count, cover_value) — bar de música, não açaí.
- Dose/garrafa — não tem no açaí.
- Roteamento bar/cozinha (orders.station) — açaí é "balcão" só.
- Garçom/comissão.
- Ficha técnica de drink — açaí usa o `consumes` que já tem.

## MANTER (essencial)
- tables → tabs → tab_orders → tab_order_items → tab_payments + service_calls.
- Fluxo: abrir mesa → lançar item → ver comanda → pediu a conta → fechar (multi-pagamento + dividir + taxa serviço).
- Grade do salão: verde livre / dourado ocupada / âmbar pediu a conta + valor + tempo.
- Integração açaí: lançar item reusa o cardápio montável; baixa estoque via `consumes`; pontua fidelidade ao fechar com cliente identificado.

## Funções a portar (data layer → stores do açaí)
getOrCreateOpenTab, sendCartOrder, getTabFull, createServiceCall, addPayment, closeTab, getTables, getOpenTabs.

## Status
- [x] Mapa das mesas (agente) + modelo do açaí mapeado
- [x] @supabase/supabase-js instalado + `lib/supabase.ts` (client lazy)
- [ ] schema.sql (em progresso)
- [ ] Chaves no `.env.local` (Eduardo criando o projeto)
- [ ] Migrar os 8 stores → Supabase
- [ ] Módulo de mesas (schema + stores + UI)
