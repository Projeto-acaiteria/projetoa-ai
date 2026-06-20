# ComandaPRO — Pesquisa de Delivery (4 agentes em campo · 20/06/2026)

Pesquisa de mercado pra fundamentar o **módulo de delivery próprio** (pedido pelo link da loja,
sem comissão de marketplace, confirmação por WhatsApp). Decisões do Eduardo já tomadas:
**incluído + ligável por loja** (não add-on, não travado por plano) · **construir tudo de uma vez**
(toggle + gate + delivery no grid + wiring do açaí).

---

## 1. DOR DO CONSUMIDOR (o que faz desistir do delivery)

Ordenado por força do dado:

1. **Taxa de entrega / taxa mínima** — 71% são contra taxa mínima e **71% NÃO pedem se forçados a pagar mais pela entrega** (Quaest/ANR, mar/2026). É o gatilho nº1 de desistência. → loja define a própria política (frete fixo baixo, grátis acima de X, retirada sem taxa).
2. **Preço maior no app que no balcão** — comissão 15–27% obriga a inflar preço no app. 99Food usou "mesmo preço do balcão" como marketing. → link próprio sem comissão = preço igual ao balcão. **Pitch direto pro consumidor.**
3. **Atraso sem previsibilidade/rastreio** (PROTESTE) → confirmação + status por WhatsApp/página de acompanhamento.
4. **Pedido errado** (top-3 PROTESTE) → pedido entra estruturado no KDS, sem retranscrição; contato direto resolve.
5. **Comida fria / embalagem ruim** → loja controla o próprio entregador/raio.
6. **Cancelamento/reembolso difícil** (suporte robótico) → relação humana por WhatsApp.
7. **Falta de transparência** (precisou Portaria 61/2026 obrigar abertura de repasse) → carrinho simples subtotal+frete+total.
8. **Checkout obrigatório com conta** — 25% abandonam se exige criar conta, 18% por checkout longo (Baymard) → **checkout de convidado**.
9. **Ter que baixar app** → link PWA no navegador, WhatsApp já instalado.
10. **Confiança ("a loja existe? vai chegar?")** — link próprio PERDE o selo de garantia do marketplace → neutralizado por confirmação WhatsApp + **pagar na entrega**.
11. **Pagamento limitado / pagar antecipado** — PIX é ~40% do e-commerce → PIX/dinheiro/cartão **na entrega**.

**3 insights de diferenciação:** (a) posicionar "mesmo preço do balcão, sem taxa mínima" — a dor nº1 é financeira; (b) WhatsApp como camada de **confiança + status**, não só pedido (ataca 4 dores de uma vez, barato sobre o QZ Tray que já temos); (c) checkout de convidado + pagar na entrega como PADRÃO — é onde o marketplace é estruturalmente pior (ele PRECISA de conta + pagamento antecipado).

## 2. DOR DO DONO (munição de venda)

1. **Comissão come o lucro** — comissão efetiva média **28,7%** (Abrasel/CNDL 2024); margem do food-service é **4–8%**. A comissão sozinha é maior que o lucro inteiro. → link próprio = **0% comissão**, só mensalidade fixa.
2. **Comissão sobre o BRUTO, não o lucro** — prato R$70 c/ 65% margem: comissão 31% (R$21,70) derruba contribuição de 60%→34%. **R$18,20/pedido.**
3. **Taxa de pagamento empilhada** — +3,2–3,5% sobre a comissão (total ~26,5% no plano Entrega).
4. **Não ter o contato do cliente** — "o cliente é do iFood", sem base pra fidelizar. → cada pedido vira cadastro da loja.
5. **Refém do algoritmo/ranking** (regras opacas) → loja dona do canal e do tráfego.
6. **Pagar anúncio DENTRO do app** pra aparecer onde já paga 30%.
7. **Caos no pico** (papel/telefone) → entra direto no painel + confirma automático.
8. **Roteirizar entregadores próprios** → painel agrupa por bairro/entregador.
9. **Taxa por bairro "no olho"** → taxa configurável por bairro/CEP.
10. **Pedido não cai organizado na cozinha** → impressão térmica + KDS por estação (já temos).
11. **Conciliar repasse do marketplace** (atrasado e líquido de taxas) → pagamento direto, conciliação simples.
12. **Promoção "obrigatória"** pra não sumir do app → loja decide a própria promoção.

**3 pitches matadores:** (1) "Pare de doar quase 30% de cada pedido" (28,7% comissão × 4–8% margem); (2) "São R$18,20 que ficam no seu caixa a cada pedido" — 500 pedidos/mês, 30% migrando = **R$2.730/mês / R$32.760/ano**; (3) "Pare de construir a clientela do iFood. Construa a sua." Canal próprio supera o marketplace a partir de **~150 pedidos/mês**.

**Honestidade (tese dominante do setor):** não é "matar o iFood", é **híbrido** — marketplace como vitrine de aquisição, canal próprio como onde o lucro aparece. Posicionar o ComandaPRO como "o canal onde você lucra de verdade".

## 3. FERRAMENTAS / STACK (reusar o que já roda: Asaas, QZ Tray, Supabase)

**Stack mínimo do MVP — custo incremental ≈ R$0:**
1. **Pedido**: link da loja (cardápio digital já existe) + carrinho + checkout de convidado.
2. **Endereço**: **ViaCEP** (grátis, sem chave) + número/complemento + **taxa por bairro** (tabela do lojista — já existe `deliveryZones` em settings).
3. **Pagamento**: **Asaas PIX** copia-e-cola/QR (reusa integração do billing + webhook) OU **"pagar na entrega"** (PIX/dinheiro/cartão).
4. **Pro lojista**: cai no **KDS** + **impressão térmica QZ Tray** (já temos).
5. **Pro cliente**: **página pública de acompanhamento via Supabase Realtime** + botão **`wa.me` pré-preenchido** (zero custo, zero risco de ban).
6. **Entrega**: **motoboy próprio**, status manual (saiu/entregue) no painel.

**Stack de evolução:** WhatsApp Cloud API oficial (utility template ~R$0,03–0,08/status, mudou 01/07/2025 pra cobrança por template); Mercado Pago (PIX 0,49–0,99% — vence Asaas fixo R$0,99→1,99 em ticket baixo); rastreio do entregador em tempo real (GPS do browser → Supabase Realtime → mapa Leaflet/OSM); taxa por km via OSM/OSRM (Google Maps perdeu o crédito de US$200 em 01/03/2025 — ir de OSM); Uber Direct / Uber Flash (Loggi) como logística terceirizada **ativável por cidade** (cobre capital, NÃO o interior MA/TO dos clientes atuais).

**Atenção:** Asaas PIX é fixo (R$0,99→R$1,99); em ticket baixo de food perde pro Mercado Pago (%). Reuso vence no MVP, monitorar.

## 4. CONCORRENTES + DIFERENCIAL

**Como o mercado empacota delivery** (valida nossa escolha):
- **Mensalidade fixa, delivery incluído por tier** = PADRÃO de fato (Anota R$219–329, Saipos ~R$240, Goomer R$99–299, Yooga R$249–269, Neemo R$129–289, Sischef R$99+). **Nossa escolha está alinhada.**
- **Delivery como tier separado** (Cardápio Web: só no R$209,99+) = gera atrito "preço explode com módulo". **Evitar.**
- **Comissão por pedido** (Delivery Direto 5–10%, Cardápio na Mão 2%, Anota 0,99% no Pix) = **contradiz o discurso anti-iFood**, vira munição contra eles.

**Reclamações transversais dos líderes (= nossas brechas):** billing predatório (reajuste-surpresa, cancelamento difícil, repasse travado — Neemo negativa no Serasa, Sischef contrato 12m, Anota/Yooga reajuste sem aviso) + **instabilidade em pico** (cai na sexta/domingo e derruba pedido). Reputação RA: Consumer 8.3 (melhor), Saipos 6.82, Anota 6.1, Neemo pior.

**5 diferenciais defensáveis do ComandaPRO:**
1. **Zero comissão de verdade, sem pegadinha** (estrutural — mensalidade fixa; bate Delivery Direto/Anota que mordem %).
2. **Multi-segmento** (açaí/sorveteria peso R$kg + copo montável que ninguém trata nativo; concorrentes são genéricos "restaurante").
3. **Comanda + mesa + KDS + delivery no MESMO sistema, sem add-on** (Cardápio Web cobra delivery à parte; muitos são só-delivery OU só-ERP).
4. **WhatsApp nativo no plano base** (Goomer/Sischef trancam no tier de R$184+).
5. **Sem contrato amarrado + preço transparente** (ataca a dor nº1 do mercado; casa com λ.prova-na-fonte).

**Brecha pra martelar:** uptime real + billing honesto + suporte humano — o mercado inteiro falha nisso.

---

## DECISÕES DE BUILD (aterradas na pesquisa)

- **Oferta:** incluído + ligável por loja, **0% comissão**, sem add-on. (Confirmado pelo padrão de mercado.)
- **Checkout de convidado** (sem conta) — dor #8 do consumidor.
- **Pagar na entrega** PIX/dinheiro/cartão como padrão V1; Asaas PIX online como evolução. — dores #10/#11.
- **Taxa por bairro** (reusa `deliveryZones`) no V1; por km é evolução (OSM, não Google).
- **ViaCEP** pro endereço (grátis).
- **Status do pedido**: KDS + impressão (já temos) pro lojista; **página de acompanhamento + `wa.me`** pro cliente. — dores #3/#6.
- **Logística terceirizada (Uber Direct/Flash) = evolução ativável por cidade** (não cobre interior).

Fontes completas nos outputs dos agentes (Quaest/ANR, Abrasel/CNDL, PROTESTE, Baymard, Asaas, Mercado Pago, Uber Direct, ViaCEP, ReclameAqui dos concorrentes). Pesquisa rodada com 4 agentes paralelos.
