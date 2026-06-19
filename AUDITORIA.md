# Auditoria densa — acai-system (18/06/2026)

4 auditores de código (mesa, balcão, delivery, caixa/financeiro) + teste dinâmico ao vivo.
Veredito: **o sistema funciona no fluxo feliz (1 operação por vez), mas NÃO está pronto pra
operação real** — tem 2 problemas-raiz estruturais + 2 bugs de integração, todos CRÍTICOS.

---

## 🔴 CRÍTICOS — 2 raízes explicam quase tudo

### RAIZ A — Race condition em TODOS os stores (`writeAll` = apaga tabela + reinsere)
A migração pro Supabase manteve a lógica de arquivo JSON: `readAll()` → muta em memória →
`writeAll()` que faz `delete()` na tabela INTEIRA e re-insere o array. Sem transação.
Afeta `orders`, `customers`, `stock_items`, `cash_sessions`, `expenses`.
- **2 pedidos/vendas simultâneos → um SOME silenciosamente** (o segundo a gravar apagou o primeiro). É o pico do delivery.
- ids de comanda colidem (`#1044` reusado via `max+1`).
- Entre o delete e o insert a tabela fica VAZIA → leitura concorrente lê zero.
- Corrompe pontos/cliente e baixa de estoque do mesmo jeito.
- O read-after-write (λ.prova-na-fonte) NÃO protege — cada request confirma a própria row antes de outra sobrescrever.
**Fix:** operações por-linha reais (`insert` única, `update where id=`, incremento atômico `qty = qty - x`); id por `bigserial` do Postgres, não `max+1`. As mesas (`tab_payments`) já estão no modelo certo.
Arquivos: orders-store.ts:45, customers-store.ts:28, stock-store.ts:62, cash-store.ts:31, expense-store.ts:24.

### RAIZ B — Servidor confia no client (preço forjado no delivery)
`/api/pedidos` (link público, sem auth) aceita `subtotalCents`/`totalCents`/preços calculados no
browser e grava sem recalcular. Qualquer um manda `totalCents:1` e leva um 700ml por R$0,01.
Também dá pra forjar `consumes` (baixa de estoque arbitrária) e inflar pontos.
O balcão (`/api/vendas:46`) faz CERTO (recalcula server-side) — falta replicar no delivery.
**Fix:** a rota recarrega `readMenu()`+`getStore()`, reprecifica os itens, recalcula taxa por bairro, e DESCARTA os valores do client. Valida pedido mínimo.
Arquivo: pedidos/route.ts:24,39-41.

### RAIZ C (integração) — Receita das MESAS é invisível no financeiro e no caixa
Confirmado no código E no meu teste ao vivo: `/api/financeiro` e o resumo do caixa só leem
`orders`; ninguém lê `tab_payments`. Todo dinheiro recebido em mesa fica **fora do faturamento
e fora da conciliação de caixa** → relatório de lucro mente pra baixo + quebra de caixa falsa
todo dia (sobra sistemática = total recebido em dinheiro nas mesas).
**Fix:** financeiro e caixa somarem `tab_payments` das comandas fechadas (date=paid_at, method, mode="mesa").
Arquivos: financeiro/route.ts:10, caixa/route.ts:10.

### RAIZ D (integração) — Estoque NUNCA baixa pela comanda de mesa
A tela de mesas monta o item sem ficha técnica (`consumes` sempre vazio) → vender na mesa não
abate polpa/copo/nada. O `moveStock` da comanda é código morto.
**Fix:** o client monta `consumes` a partir da receita (igual PDV/AcaiBuilder); açaí pesado deriva polpa proporcional aos gramas.
Arquivo: MesasClient.tsx:181-197.

### RAIZ E — Erros do Supabase são engolidos
Nenhum `readAll/writeAll` checa o `error` do supabase-js. Um erro transitório de leitura vira
`[]` (tratado como "vazio") → o próximo `writeAll` (delete-all) **apaga a tabela de verdade**.
Perda catastrófica disparada por um soluço de rede.
**Fix:** checar `{ data, error }` em toda query; distinguir "erro" de "vazio".

---

## 🟠 ALTOS
- **Validação só no client:** valor pago em dinheiro < total passa no server (quebra de caixa); qty/preço negativos aceitos. (vendas + pedidos + mesas)
- **closeTab não revalida** → duplo-clique credita pontos 2x e pode fechar comanda não-paga.
- **Comanda dupla na mesma mesa** (sem unique parcial no banco).
- **Auto-impressão frágil:** `seen` é estado volátil do browser — F5/aba dormindo = pedido nunca imprime; reuso de id (da Raiz A) imprime o errado.
- **Venda não-atômica:** 4 writes sem transação; estoque/pontos podem falhar com `ok:true`.
- **Abrir 2 caixas simultâneos** (check só em memória).
- **Taxa de cartão das mesas não é registrada** → margem superestimada.

## 🟡 GAPS / MÉDIOS
- **Modo PESO ausente no balcão avulso** — `pricePerKgCents` existe no schema mas o PDV não usa. Buraco central da açaiteria (cliente pesa e vai).
- Receita do delivery por `createdAt`, não data de entrega/pagamento.
- `isOpenNow` usa timezone do servidor (UTC na Vercel) → gate de horário 3h errado.
- "Pediu a conta" (service_calls) não aparece na grade de mesas.
- 1ª compra: critério diverge mesa vs balcão.
- Sem cancelar item lançado / remover mesa.

## ✅ O que está CORRETO (não re-mexer)
- Pontos sobre produtos sem taxa (mesa e balcão) — regra cravada respeitada.
- Tudo em centavos inteiros, sem erro de float; taxa via Math.round consistente.
- Caixa físico só conta dinheiro (pix/cartão fora da gaveta) — certo, só falta aplicar às mesas.
- Pontos nunca viram dinheiro (Math.floor coerente).

---

## Plano de correção priorizado
1. **Raiz A (concorrência)** — reescrever os stores pra operações por-linha. Destrava operação multi-terminal. É a base de tudo.
2. **Raiz E (erros engolidos)** — checar error em toda query (rápido, evita perda catastrófica).
3. **Raiz C + D (mesas no financeiro + estoque)** — sem isso a mesa não fecha o caixa nem controla estoque.
4. **Raiz B (preço forjado)** — recalcular o pedido no servidor. Antes de divulgar o link com volume.
5. **Altos** — validação server-side (valor pago, qty/preço), closeTab idempotente, unique de comanda/caixa, impressão persistida.
6. **Gaps** — modo peso no balcão, timezone, service_calls na grade.
