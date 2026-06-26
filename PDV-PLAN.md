# PDV-PLAN — frente de caixa familiar & completa

Roadmap pra nossa frente de caixa (PDV) parecer **familiar** (o operador BR já conhece de Saipos/Consumer/Stone) e **completa** em UX. Fonte: estudo de produtos reais + leitura do nosso código (jun/2026). Régua: a venda de balcão tem que ser rápida e reconhecível.

## Anatomia que o operador BR espera (mapa mental)
1. **Busca-first** — UM campo resolve nome + código do produto + código de barras (Enter ou bipa adiciona). Grid de tiles é secundário; no balcão manda o teclado/leitor.
2. **Comanda lateral** = lista corrida com total rolando; caminho rápido "venda de balcão sem cliente".
3. **Fluxo canônico:** buscar → Enter → qtd → observação → desconto (% ou R$) → pagamento → forma(s) → troco → finalizar.
4. **Pagamento (o mais rico no BR):** múltiplas formas numa venda só (split de tender) · troco só na parte em dinheiro · TEF (crédito/débito/voucher/PIX-QR no pinpad) · parcelamento (loja vs emissor) · valor empurrado pra maquininha + espera aprovação (= λ.prova-na-fonte no pagamento).
5. **Caixa com dente (Consumer = padrão-ouro):** abertura com fundo · bloqueia venda até abrir · sangria com **senha + usuário + justificativa + trilha** · suprimento/reforço · fechamento com **conferência por método** (esperado vs contado, divergência ao centavo) · **Leitura X** (parcial, não-zera, N vezes) vs **Redução Z** (fecha o dia).
6. **Dois modos de entrada:** F-keys (PC fixo) + touch (tablet). F1 abre a lista de atalhos (descoberta embutida).
7. **Periféricos:** térmica (recibo+cozinha+DANFE) · gaveta abre sozinha ao finalizar · balança (digitar grama é modo legítimo — já é o nosso) · leitor de barras · KDS.

## Gaps do nosso PDV (file:line)
Temos DUAS telas de venda paralelas: `PDV.tsx` (caixa, template açaí) e `BalcaoClient.tsx` (bar/grid); `caixa/page.tsx:18-20` decide. Backend de caixa (`cash-store.ts`, `api/caixa/route.ts`) é sólido.

- **G1 — sem busca/código/leitor.** Só grid. `PDV.tsx:161-175`, `BalcaoClient.tsx:133-148`. (gap #1 de familiaridade)
- **G2 — pagamento de UMA forma só.** `PDV.tsx:534`, `BalcaoClient.tsx:29`. Sem split.
- **G3 — sem desconto/acréscimo.** Total é soma crua (`PDV.tsx:74`).
- **G4 — zero atalhos de teclado.** Só Enter na busca de cliente.
- **G5 — sangria sem auditoria.** `cash-store.ts:6-11` não guarda QUEM fez; sem senha. `CaixaClient.tsx` MovModal só valor+motivo.
- **G6 — sem Leitura X.** Só fechamento (Z). `resumo()` (`api/caixa/route.ts:11-36`) já calcula tudo que o X precisa.
- **G7 — item sem observação livre.** `CartLine.note` existe (`PDV.tsx:23`) mas nada na UI escreve.
- **G8 — sem TEF; Pix manual.** Cartão é só registro de taxa (`PDV.tsx:612-625`); não captura pagamento.
- **G9 — gaveta não abre; sem via de cozinha no fluxo do caixa.**
- **G10 — PDV e Balcão divergentes** (UX/payment/cupom/rota diferentes pro mesmo ato de vender).

## Prioridade (menos esforço → mais ambicioso)
- **P1 — Busca no catálogo** (G1). Baixo, impacto enorme. Input que filtra nome + casa código/barras; Enter adiciona.
- **P2 — Desconto na venda** (G3). Baixo. Botão % ou R$; `discountCents` no payload + cupom.
- **P3 — Observação livre por item** (G7). Baixo. Campo "obs" → `CartLine.note`.
- **P4 — Atalhos de teclado + lista F1** (G4). Médio-baixo. Finalizar/forma de pgto/Esc.
- **P6 — Leitura X** (G6). Médio-baixo. Botão imprime o `resumo()` sem fechar.
- **P5 — Sangria com operador + senha + auditoria** (G5). Médio. `by`/`operator` no `CashMovement`.
- **P7 — Split de pagamento (múltiplas formas)** (G2). Médio-alto. Lista de pagamentos; troco só no dinheiro; corrige snapshot por método.
- **P8 — Unificar PDV+Balcão** (G10). Médio-alto, estrutural. Fazer DEPOIS de P1-P3.
- **P9 — Gaveta ao finalizar + cupom de cozinha no PDV** (G9). Médio. QZ Tray já existe.
- **P10 — TEF / Pix QR com confirmação** (G8). Alto, dependência externa. Por último.

**Corte sugerido:** P1-P4 + P6 = quick wins que já fazem "parecer PDV de verdade". P5 e P7 = as 2 features de peso. P8-P10 = projetos maiores.

## Fontes
Saipos (frente-de-caixa, TEF), Consumer (caixa, venda por kg), Conta Azul (atalhos PDV), Square (modifiers), Toast (ordering/payments/cash drawer), Stone/Cielo LIO/Mercado Pago Point.
