# Integração Site ↔ ComandaPRO (headless commerce)

> Design da conexão entre o site `starteq.vercel.app` (projeto `starteq-palmas`) e o ComandaPRO.
> Data: 06/07/2026. Ainda NÃO construído — este é o desenho pra validar.

## Princípio
**ComandaPRO = ERP / cérebro** (fonte ÚNICA da verdade: estoque, vendas, OS, financeiro, comissão).
**O site = a vitrine (storefront head)** — lê e escreve via **API do ComandaPRO**. Sem banco próprio no site, sem sincronização. É *headless commerce*: um backend, várias vitrines/canais.

Estoque é UM só: vender no **site**, no **balcão** ou numa **OS** sempre mexe no mesmo `stock_items`.

## As 3 pontes (API pública por slug, no ComandaPRO)

1. **Catálogo** — `GET /api/loja/{slug}/produtos`
   O site lê os produtos (nome, preço, estoque, categoria, **specs**) direto do ComandaPRO.
   O estoque/preço que o dono ajusta no sistema aparece no site na hora. Público (é vitrine).

2. **Venda** — `POST /api/loja/{slug}/pedido`  (carrinho)
   Cria um **pedido PENDENTE** no ComandaPRO. O dono confirma → baixa estoque + entra no financeiro.
   Baixa só na confirmação (não no clique) — senão dá pra sabotar o estoque com pedido falso.

3. **Montagem** — `POST /api/loja/{slug}/montagem`  (build do cliente = lista de SKUs)
   Cria a **OS de montagem PENDENTE** com as peças (reusa `createMontagemOS`).
   Recepção atribui técnico → técnico monta → quita → baixa + comissão. **Mesmo destino** do balcão.

## O que muda no site (`starteq-palmas`)
- `catalog.ts` (mock) sai → o site **busca o catálogo da API** do ComandaPRO.
- O **montador** (que já valida compatibilidade) → no "finalizar", **posta o build** → cria a OS (em vez de só mandar WhatsApp). Pode manter o WhatsApp como confirmação.
- O **checkout** → posta o pedido.

## Segurança
- GET catálogo = **público** (vitrine).
- POST pedido/montagem = cria **pendente**; e-commerce é público por natureza, e nada baixa até o dono confirmar.
- Opcional v2: uma **chave por loja** pro site se identificar (rate-limit/trust).
- RLS: os endpoints rodam server-side com service-role (como o resto do ComandaPRO); a loja é resolvida pelo **slug** (como o `/[slug]` do cardápio já faz).

## Fluxo omnichannel (o argumento de venda)
Cliente monta o PC no site → **OS pendente** no ComandaPRO → recepção atribui técnico → técnico monta → quita → **baixa de estoque + comissão apurada**. Zero digitação dupla. O dono vê tudo num painel só.

## Fases de construção (quando arrancar)
1. **API catálogo (GET)** — o site lê do ComandaPRO. Menor risco.
2. **API montagem (POST)** — o montador do site cria OS (o pedaço que o Eduardo mais quer).
3. **API pedido (POST)** — checkout do site cria venda.
4. **Ajustar o site** pra consumir (tirar o mock, apontar pra API).

## Decisões pra cravar
1. Confirma o modelo **headless** (site = vitrine, ComandaPRO = backend/ERP)?
2. O site continua sendo o `starteq-palmas` (Next próprio, só trocando a fonte de dados)? Ou quer o ComandaPRO servindo a vitrine pública também (`comandapro.net.br/{slug}`)?
3. Pedido do site entra **pendente** (dono confirma) — ok? (recomendado).
