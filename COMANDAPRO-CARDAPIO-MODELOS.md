# ComandaPRO — Arquitetura dos 3 Modelos de Cardápio

> Decisão-mãe: os 3 modelos NÃO são 3 skins do mesmo cardápio. São **3 modelos de dados +
> 3 comportamentos de pedido diferentes**, plugados sobre **um contrato de pedido comum**.
> Quem escolhe o modelo da loja é `store_config.menu_template` (`acai` | `bar` | `grid`).

## Princípio: contrato comum embaixo, modelos plugáveis em cima

```
  [ Modelo ACAI ]   [ Modelo BAR ]   [ Modelo GRID ]      ← cada um: dados + UI público + editor admin
        \                |                /
         \               |               /
      criarPedido()  →  orders + order_items (+ station)   ← CONTRATO COMUM (ponto de convergência)
                           |
   caixa · financeiro · fidelidade · KDS · impressão · mesas/comanda   ← camadas COMPARTILHADAS
```

**Regra de ouro:** cada modelo monta o carrinho do SEU jeito, mas todos terminam gravando
`orders` + `order_items` no mesmo formato. Por isso caixa, financeiro, KDS, impressão e comanda
são escritos **uma vez** e servem os 3. A `station` (quando existe) viaja no `order` — é o que o
KDS e a impressora por estação leem. Modelo sem estação grava `station = default` (ex.: `copa`).

---

## Modelo 1 — ACAI (montagem no copo) · JÁ EXISTE

- **Comportamento:** escolhe tamanho (300/500/700ml = preço-base) → adiciona modificadores
  (acompanhamentos grátis-até-N, frutas, caldas, adicionais pagos) → 1 item complexo montado.
- **Dados:** `SIZES` + `GROUPS` em **blob jsonb por loja** (`menu.ts` / menu-store). NÃO tem
  categoria→produto. **Não mexer** — fica como está.
- **Pedido:** 1 linha = copo montado (tamanho + lista de modificadores + preço calculado).
- **Estação:** única (`copa`) ou nenhuma. `has_stations = false`.
- **Venda por peso:** balcão/mesa em R$/kg (já existe). ⭐ diferencial nosso, o Medellín não tem.
- **Segmentos:** açaiteria, sorveteria.

## Modelo 2 — BAR (categoria → produto, espelha Medellín) · 1ª ONDA, A PORTAR

- **Comportamento:** navega categorias (Petiscos, Cervejas, Drinks…) → adiciona produtos
  (foto + preço + `size_label`) → observação livre por item → carrinho "Seu pedido".
- **Dados (NOVO, relacional, multi-tenant) — migration `mt-10` CRAVADA e provada na fonte:**
  - `menu_categories` (id, store_id, name, **station**, **description**, img, sort, active)
  - `menu_products` (id, store_id, category_id, name, price_cents, size_label, img, **sort**, active)
  - Relacional (não blob) porque o roteamento/KDS consulta `orders` por `station` e junta
    `order_items` — blob atrapalharia. RLS por loja igual às demais tabelas.
  - **Validado 1:1 contra o código real do Medellín (notas de arquitetura):**
    `description` só na categoria (subtítulo do banner). `order_items` SNAPSHOTA
    `name`/`size_label`/`unit_price` no momento do pedido (cópia, não FK viva — mudar preço depois
    não afeta pedido lançado). O **KDS não lê `menu_products` em runtime**, só `category.station`.
    Ícone (chef/taça) é DERIVADO da station, não é coluna. Foto = `image_url` na própria row
    (categoria E produto); fallback `CAT_IMG` do Medellín vira placeholder neutro no ComandaPRO.
    Urgência do card KDS = calculada de `created_at` em runtime, sem coluna. `is_combo` ficou fora
    do 1º corte. `active` na categoria é melhoria nossa (esconder categoria inteira).
- **Pedido:** N linhas simples; **`sendCartOrder` parte o carrinho por `station`** → 1 `order`
  por estação (petiscos→cozinha, bebidas→bar).
- **Estação:** `station` mora na CATEGORIA, herda pro item. `has_stations = true`.
  Cozinha → impressora+KDS da cozinha; bar → impressora do bar. (ver
  `reference_roteamento_estacao_medellin` na memória.)
- **Tema:** `.theme-dark` (escuro + acento da loja no lugar do vermelho Medellín); fontes serif.
- **Extras do bar (2ª onda):** cover artístico, dose/garrafa + ficha técnica, comissão/gorjeta.
- **Segmentos:** bar, petiscaria.

## Modelo 3 — GRID (vitrine foto grande, estilo iFood) · DEFINIR ANTES DE CODAR

- **Comportamento (a fechar):** categorias em destaque visual → prato com **foto grande +
  descrição + preço** → adiciona. Mais "vitrine" que "montagem".
- **Ponto aberto — o grid cobre 2 segmentos com lógica diferente:**
  - **Restaurante:** prato pronto, foto grande, `station = cozinha` (usa o mesmo motor de
    roteamento do bar). `has_stations = true`. Pode precisar de adicionais (hoje ninguém tem —
    é gap dos dois, candidato a roadmap).
  - **Marmitaria / a quilo:** venda por **peso** (R$/kg, igual ao açaí no balcão) OU marmita
    montada (P/M/G + proteínas + acompanhamentos = parecido com o modelo açaí). `sells_by_weight
    = true`, `has_stations = false`.
- **Hipótese de dados:** reusar `menu_categories` + `menu_products` do bar (mesmo shape
  relacional), só com layout público diferente (card foto-grande) e sem `station` quando o
  segmento não usa. O peso entra pela flag `sells_by_weight`, não por modelo novo.
- **Decisão pendente:** o grid é (a) só um LAYOUT do modelo bar (mesmo dado, UI foto-grande), ou
  (b) um modelo de dados próprio? Recomendação inicial: **(a)** — economiza schema e o
  comportamento (peso vs station) vira feature flag, não modelo. Validar quando chegarmos nele.
- **Segmentos:** restaurante, marmitaria.

---

## Roteador público — `/[slug]`

```
const cfg = await getStoreConfig(storeId)
switch (cfg.menu_template) {
  case "acai": return <TemplateAcai .../>   // extrair do AcaiBuilder atual
  case "bar":  return <TemplateBar  .../>   // porte do Medellín
  case "grid": return <TemplateGrid .../>   // fase posterior
}
```

## Plano de ondas

1. **1ª onda — modelo BAR — ✅ COMPLETA** (falta só prova de impressão com hardware no local).
   - ✅ FEITO (visual): schema `menu_categories(station)`+`menu_products` (mt-10), data layer
     `menu-bar-store.ts`, `TemplateBar` público premium, `/[slug]` switch, loja `bar-demo` seedada.
   - ✅ FEITO (motor — gravação): `tab_orders.station` (mt-11); `addTabItems` PARTICIONA por
     estação (1 tab_order por estação, comanda íntegra). Provado na fonte: pedido misto → 2
     tab_orders (cozinha/bar). Açaí preservado (station default 'cozinha').
   - ✅ FEITO (KDS): telas de preparo `/admin/preparo` — kanban pendente→preparando→pronto→entregue,
     cards por mesa com itens/urgência/estação, seletor Todas/Cozinha/Bar, polling 8s. Data layer
     `getStationOrders`/`advanceTabOrder` + `/api/kds`. Provado na fonte (feed + avançar + entregar).
   - ✅ FEITO (mesa→KDS): rota pública `/[slug]/mesa/N` (QR) + `/api/mesa-pedido` — abre/reusa a
     comanda da mesa e grava roteado por estação (preço/estação server-authoritative via
     `resolveOrderItems`). `getOrCreateTableByNumber`; mt-12 (tables UNIQUE store_id+number, era
     global). Provado end-to-end: pedido na Mesa 12 caiu no KDS cozinha+bar com observação.
   - ✅ FEITO (impressão por estação): `stationTicketHtml` (via de preparo — faixa da estação, mesa
     gigante, sem preço); `printTicket(html, station)` usa `getStationPrinter(station)` (fallback
     iframe); KDS com toggle "Impressão automática" + botão imprimir por card (auto-print de pedido
     novo, 1ª carga = baseline); tela `/admin/impressora` configura 1 impressora por destino
     (caixa + cozinha + bar). FALTA PROVAR com hardware (QZ Tray + impressora física no local) —
     papel saindo só dá pra confirmar no Vidal/Medellín; a lógica/UI estão prontas e type-safe.
   - ✅ FEITO (editor admin): `/admin/cardapio` vira `switch(menu_template)` → `CardapioBarEditor`
     (CRUD categorias com estação + produtos; modais; `/api/cardapio-bar`). CRUD provado pela
     sessão real (criar/editar/excluir + cascade).
   Açaí já roda no `TemplateAcai`. Cliente imediato (Vidal, açaiteria) não depende disso.
2. **2ª onda:** profundidade do bar — cover, dose/garrafa + ficha técnica + baixa por trigger,
   comissão/gorjeta por garçom.
3. ✅ **modelo GRID FEITO** (restaurante/marmita): `TemplateGrid` (`src/components/grid/`, tema CLARO,
   foto grande estilo iFood) REUSA o schema (menu_categories/menu_products) e o motor (mesa→KDS→
   impressão) do bar — confirmada a decisão (a) "grid = só layout". `/[slug]` e `/mesa/N` switch
   incluem grid. Loja `restaurante-demo` (login restaurante@comandapro.app/restaurante2026).
   FALTA no grid: marmita por PESO (`sells_by_weight` — refinamento; hoje grid = produto+preço fixo).

## Camadas que NÃO se duplicam (servem os 3 modelos)

Caixa (abertura/sangria/suprimento/conferência — `cash-store`) · financeiro · fidelidade
(`loyalty-store`) · mesas/comanda (`tables-store`) · impressão QZ 80mm · KDS · billing/multi-tenant.
