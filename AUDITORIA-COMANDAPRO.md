# Auditoria ComandaPRO — em ondas (CIC no DELL · conta real Cantinho do Açaí)

> Método: Eduardo executa na máquina (vendas, caixa, PIN — financeiro/segurança), o CIC lê/verifica a tela, o Verbo prova na fonte (banco). Dados do Cantinho serão **zerados** antes da entrega ao Vidal.
> Início: 29/06/2026.

## Achados (punch-list de correção)

| # | Achado | Onda | Severidade | Decisão | Status |
|---|--------|------|-----------|---------|--------|
| 1 | **Caixa não emite comprovante de sangria/suprimento.** O `MovModal` registra o movimento (operador/motivo/hora/valor na trilha digital) mas não chama `printTicket`. O dinheiro mexe certo — só não há cupom físico de retirada/reforço. | O2 | Baixa (trilha digital + totais na Leitura X já cobrem o mínimo) | **Construído** — `movTicketHtml` (cabeçalho white-label + valor + operador/motivo + saldo; sangria com linha de assinatura), disparado no `MovModal` via **toggle por-máquina** em /admin/impressora (default ligado). Impressão best-effort (movimento salvo antes). | 🟡 commitado (ee394db) — **falta deploy pós-Onda 3 + teste no papel** |
| 2 | **Cupom corta caractere nas bordas.** Causa real (3 rodadas): papel 80mm tem ~72mm imprimíveis e o conteúdo vazava. Solução final: `size:72` + conteúdo **64mm centralizado** (padding 4mm/lado) = mesmo envelope do texto centralizado que cabe. Afeta TODO cupom (venda, Leitura X, estação, teste). | O2 | **Alta** | **CORRIGIDO E CONFIRMADO NO PAPEL** (DELL/EPSON, 29/06) — sai inteiro dos dois lados. Brand-agnóstico (HTML-raster, acento não depende de codepage). | ✅✅ fechado |

| 3 | **Mesa: tap no item-picker pode somar 2 ao carrinho.** Onda 3 passo 5: o 500ml entrou 2x. O envio (`confirmAdd`) é guardado por `busy` (sem double-submit de rede) e o total fechou certo (2×500+1×300 = R$42, provado em `tab_*`). Resta confirmar se 1 tap dispara dobrado no picker (UX) ou foi tap duplo. | O3 | Baixa (operador vê o carrinho antes de confirmar; total íntegro) | Investigar handler de tap do picker; se dobrar, debounce. | Aberto (a investigar) |

## Onda 3 — verificação na fonte (29/06, store 48412a95)

Todos os writes da Onda 3 batem no banco (não só na UI):
- #1909 copo+adicionais R$16 dinheiro ✓ · Cliente Teste 6→**22 pts** ✓
- #1910 split: `payments:[dinheiro 1250, pix 1250]` ✓✓ (gravou o split, não só o método primário)
- #1911 peso 300g R$17,10 dinheiro ✓
- Mesa #104 `fechada`, `tab_payments` 4200 dinheiro, itens 2×500+1×300 ✓ (schema `tabs/tab_*`, separado de `orders`)
- Caixa: fundo R$50, sessão aberta, 3 movimentos ✓ · Leitura X não zera ✓
- Financeiro × Leitura X reconciliam (156,60 hoje + 69,95 baseline = 226,55) ✓
- **Resgate de fidelidade** (#1914): Teste CIC 108→18 pts (−100 resgate +10 compra); pedido `discountCents:0`, total R$10 (só item pago), item grátis = brinde no lado da fidelidade, NÃO desconto em R$. Regra "ponto ≠ R$" provada no dado ✓✓

## Progresso das ondas

- **O1 — Auth + mapa de rotas:** ✅ 13 rotas, zero erro de console, design índigo consistente. (Responsividade <980px não validável no CIC — checar manual no DevTools.)
- **O2 — Caixa (impressão + movimentos + vendas):** 🔄 em andamento.
  - Impressora EPSON + QZ validados no DELL (print silencioso ok).
  - Leitura X: imprime e **não zera** o caixa. ✅
  - PIN 4321 setado · bloqueio com PIN errado a confirmar.
  - Sangria/suprimento: movimento financeiro correto (caixa caiu/subiu certo). Comprovante = Achado #1.
  - Vendas (peso/copo/produto/split/fidelidade+resgate): pendente.
- **O3 — Fechar caixa + cruzamento Financeiro:** ✅ Z com divergência **R$ 0,00** nas 3 formas; sessão `closedAt` preenchido, 0 sessões abertas, reconciliação persistida (`expected/counted/diffCents` = 0). Provado na fonte.

### 🟢 INTEGRIDADE FUNCIONAL — CRAVADA (29/06)
Vendas (copo/peso/split/produto), mesas, fidelidade (ganho + resgate como brinde, ponto ≠ R$), caixa (sangria/suprimento/Leitura X/fechamento) e cruzamento Financeiro — todos provados no banco. Pendências restantes são de ENTREGA (não de teste): largura da impressora (setup do aparelho), zerar dados de teste, trocar senha do Vidal; e Achados #1 (comprovante sangria — construído, falta teste no papel) e #3 (picker de mesa — investigar).
- Próximas: Mesas/comandas · Delivery/cardápio digital · Billing (cuidado: Asaas produção) · Visual/responsivo.
