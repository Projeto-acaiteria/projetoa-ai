# ComandaPRO — Fase 4: Onboarding multi-segmento (estudo dos espelhos)

Diretriz do Eduardo (19/06): o onboarding é o momento da verdade — onde o dono cadastra o negócio.
É aqui que o ComandaPRO se qualifica pela VARIEDADE de negócios que atende, e tem que ser
INTUITIVO (facilita a vida do empresário, não complica). λ.menos-cliques vale dobrado.

Fonte: estudo de 3 espelhos reais (acai-system, medellin-bar, agendapro) + palace-system (caixa).

## SEGMENTOS QUE O COMANDAPRO PODE DOMINAR
O NÚCLEO (cardápio + comanda + caixa + mesas + delivery por link + impressão térmica + fidelidade
+ financeiro) serve TODO food service. Cada segmento liga features específicas:

| Perfil de operação | Negócios | Features específicas |
|---|---|---|
| **Self-service por PESO** (R$/kg) | açaiteria, sorveteria, marmitaria/comida a quilo, casa de açaí | modo peso (balança), montagem no copo |
| **Balcão rápido / fast food** | hamburgueria, lanchonete, pastelaria, cafeteria, padaria, food truck, creperia, tapiocaria, espetinho | balcão ágil, delivery, montagem/adicionais |
| **Mesa / sentado** | restaurante, pizzaria, churrascaria, petiscaria | mesas + comanda + estações (cozinha) + delivery |
| **Bar / noturno** | bar, pub, choperia, casa de shows | cover artístico + dose/garrafa + estações (bar) + mesas |

→ O onboarding abre com **"Que tipo de negócio é o seu?"** e a escolha (a) liga as features certas,
(b) faz seed de um cardápio-base do segmento, (c) ajusta a linguagem/copy. Isso é o que nos
qualifica por variedade SEM virar um formulário gigante.

## FLUXO DE ONBOARDING (espelhado do AgendaPRO — validado em produção)
1. **Cadastro — wizard de 2 passos** (não um form gigante):
   - Passo 1 NEGÓCIO: nome, **segmento** (a lista acima), **slug** com validação realtime (debounce
     380ms, ✓ disponível / ✗ taken), WhatsApp, + insight opcional (como descobriu / maior necessidade).
   - Passo 2 DONO: nome, email (login), senha (8+, maiúscula+número), toggle "você opera no caixa
     ou só administra?".
2. **Backend** (`/api/cadastro`, espelha AgendaPRO): admin.createUser → cria store → cria subscription
   `trial` (7 dias) → ROLLBACK manual se falhar. 3 camadas anti-bot (rate-limit memória + Postgres
   `signup_attempts` + Turnstile). Signup público OFF.
3. **Tela de sucesso**: "Conta criada!" + link público do cardápio (`comandapro.com.br/slug`) + entra no painel.
4. **Welcome modal** (1x, delay 400ms, skippable, copy POR SEGMENTO).
5. **Checklist guiado** (some quando 100%, colapsável, cada item linka pra config):
   - Logo/identidade · 1º produto no cardápio · horários · compartilhar link/QR · receber 1º pedido.

## O QUE COLETAR / CONFIGURAR (do acai-system) — com DEFAULTS por segmento
- **(A) IDENTIDADE:** nome, logo, cor, tagline, cidade/WhatsApp.
- **(B) OPERAÇÃO:** modelos de venda usados (balcão/peso/mesas/delivery), features liga/desliga,
  formas de pagamento + taxas (default 0/0/2/3.5 dinheiro/pix/débito/crédito), horários
  (default 10–22h), taxa de entrega / bairros.
- **(C) CARDÁPIO:** categorias → produtos → tamanhos → acompanhamentos (grátis-até-N) → ficha técnica
  (consumo de estoque). **SEED por segmento** (açaí: 3 tamanhos + grupos cereais/frutas/caldas/premium).
- **(D) HARDWARE:** impressora QZ (cert-mãe Impulso já resolve; detecção automática).

## DIFERENÇAS POR SEGMENTO (do medellin-bar) → viram CONFIG, não fork
- **Cover artístico** (bar): tabela `events` (artista, valor/pessoa, noite ativa) + `people_count` na
  comanda; cover é SNAPSHOT na abertura. Liga só se segmento=bar e dono ativar.
- **Dose/garrafa** (bar): stock_item tipo dose, `doses_per_bottle`, `open_doses`, "abrir garrafa".
- **Estações** (bar/restaurante): categoria→estação (cozinha/bar), pedido roteado, 2 KDS.
- **Peso** (açaí/marmita): R$/kg, entrada de gramas, polpa proporcional.
- → **Modelo:** tabela `store_config` por loja: `business_type`, `cover_enabled`, `stock_type`
  (simple/dose), `has_tables`, `num_stations`, etc. A UI mostra/esconde por essas flags.

## PRINCÍPIOS (intuitivo — facilitar, não complicar)
- **Seed inteligente por segmento** (cardápio-base pronto pra editar) > tela vazia. MAS sem encher de
  lixo que o dono tem que limpar — o AgendaPRO deixa serviços/horários VAZIOS de propósito (força o
  dono a pensar no próprio negócio). **Decisão a calibrar:** açaí compensa seed de cardápio (estrutura
  complexa); horários/serviços talvez não. Testar o equilíbrio.
- Pedir o MÍNIMO na criação; resto via checklist depois.
- Copy na linguagem do segmento.
- NÃO pedir CNPJ/endereço/foto na criação (atrito que faz desistir).

## CAIXA / FINANCEIRO — modelo do palace-system (APROVADO em uso real)
**Entidades:** `cash_closings` (fechamento/dia, breakdown por método pix/cash/crédito/débito + taxas
+ cortesia + pontos, **bruto vs líquido**, dinheiro contado vs esperado, `cash_diff`) · `cash_movements`
(sangria=saída, suprimento=entrada de troco) · comanda modular `invoices`+`invoice_items`+`invoice_payments`
(com **SPLIT** de pagamento: pix+dinheiro juntos) · `expenses` (por categoria, por `occurred_at`, recorrente).
**Regras validadas (espelhar):**
1. receita/caixa conta por **paid_at**, não data do atendimento ([[feedback_recebido_por_data_de_pagamento]])
2. **só dinheiro físico** entra na gaveta (pix/cartão são bancários, não contam no `cash_diff`)
3. taxa de cartão sempre visível — **bruto vs líquido** separados
4. split de pagamento na comanda (1 comanda, N métodos)
5. cortesia e pontos = receita rastreada mas NÃO entra no líquido (receita "perdida")
6. fechamento confere contado vs esperado (fundo + vendas + suprimentos − sangrias) com diff colorido
7. recepcionista vê só o dia; dono vê tudo (histórico/financeiro/despesas) — RLS
**Fluxo de caixa em 4 visões** (diário/semanal/mensal/anual) + drill-down: saldo inicial → receitas por
método → despesas por categoria → resultado.
**Adaptar food service:** garçom/balconista no lugar de "profissional" (comissão de venda OPCIONAL por
segmento); itens = pratos/bebidas/combos; cortesia = brinde. O acai-system JÁ tem caixa+financeiro+despesas
— RECONCILIAR com este modelo (palace é mais completo: split, bruto/líquido, comanda modular, conferência).

## APPDELIVERY — referência FUTURA (não pra Fase 4)
O onboarding não precisa do AppDelivery (ele é logística de ENTREGA B2B, não cadastro de negócio). Mas
quando o MÓDULO DELIVERY do ComandaPRO evoluir além de "link → impressão" (status do pedido recebido→
preparando→saiu→entregue, gestão de entregador, taxa por distância/zona), o AppDelivery ([[project_app_entregas_b2b_palmas]])
é a referência natural — já resolveu entrega em produção. Anotar pro roadmap do delivery, não agora.
