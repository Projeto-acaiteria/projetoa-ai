# Auditoria ComandaPRO — em ondas (CIC no DELL · conta real Cantinho do Açaí)

> Método: Eduardo executa na máquina (vendas, caixa, PIN — financeiro/segurança), o CIC lê/verifica a tela, o Verbo prova na fonte (banco). Dados do Cantinho serão **zerados** antes da entrega ao Vidal.
> Início: 29/06/2026.

## Achados (punch-list de correção)

| # | Achado | Onda | Severidade | Decisão | Status |
|---|--------|------|-----------|---------|--------|
| 1 | **Caixa não emite comprovante de sangria/suprimento.** O `MovModal` registra o movimento (operador/motivo/hora/valor na trilha digital) mas não chama `printTicket`. O dinheiro mexe certo — só não há cupom físico de retirada/reforço. | O2 | Baixa (trilha digital + totais na Leitura X já cobrem o mínimo) | **Construir** — produto multi-tenant; vários segmentos (multi-caixa/turno) precisam do rastro físico assinado. Implementar como **toggle por-máquina** (default conforme segmento), reusando `ticket.ts` + `printTicket`, igual à Leitura X. | Backlog (lote pós-onda) |
| 2 | **Cupom corta o 1º caractere de cada linha à esquerda.** `qz.ts` usava `scaleContent:true` + `size:{width:80}` → ampliava o corpo de 72mm p/ 80mm e estourava a área imprimível. Provado na foto do cupom do Cantinho. | O2 | **Alta** (cupom ilegível/feio na entrega ao cliente; afeta TODO cupom: venda, Leitura X, estação) | **Corrigido** — `size` → 72mm (largura imprimível universal de térmica 80mm, vale p/ Epson/Elgin/Bematech/Daruma/etc.). Abordagem HTML-rasterizada já é brand-agnóstica (acento não depende do codepage da impressora). | ✅ Fix commitado — falta reimprimir p/ confirmar no papel |

## Progresso das ondas

- **O1 — Auth + mapa de rotas:** ✅ 13 rotas, zero erro de console, design índigo consistente. (Responsividade <980px não validável no CIC — checar manual no DevTools.)
- **O2 — Caixa (impressão + movimentos + vendas):** 🔄 em andamento.
  - Impressora EPSON + QZ validados no DELL (print silencioso ok).
  - Leitura X: imprime e **não zera** o caixa. ✅
  - PIN 4321 setado · bloqueio com PIN errado a confirmar.
  - Sangria/suprimento: movimento financeiro correto (caixa caiu/subiu certo). Comprovante = Achado #1.
  - Vendas (peso/copo/produto/split/fidelidade+resgate): pendente.
- **O3 — Fechar caixa + cruzamento Financeiro:** pendente.
- Próximas: Mesas/comandas · Delivery/cardápio digital · Billing (cuidado: Asaas produção) · Visual/responsivo.
