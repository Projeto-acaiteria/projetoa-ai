# ComandaPRO — Verticais de Food Service (mapa de profundidade)

> Visão (Eduardo 20/06): dominar TODOS os verticais de food service em profundidade —
> bar, cozinha, hamburgueria, pizzaria, sushi, açaiteria, music bar, marmita...
> Princípio anti-"largura rasa": **núcleo comum** (1 vez) + **módulo de profundidade por vertical**,
> reusando o máximo. Cada vertical entra fundo conforme **demanda/venda real** — o mapa fica pronto
> pra atacar rápido quando o cliente aparece (não construir os 7 especulando de uma vez).

## Núcleo comum — JÁ TEMOS (serve todos)
Cardápio público (3 layouts: montagem/bar/grid) · pedido pela mesa (QR) · roteamento por estação →
KDS cozinha/bar · impressão térmica 80mm por estação · caixa/comanda (abertura/sangria/conferência/
split) · fidelidade · banco de imagens + upload comprimido · multi-tenant + billing Asaas.

## Padrões REUSÁVEIS (cada um destrava vários verticais)
- **Montagem** (grupos de modificador: obrigatório/opcional, grátis-até-N, pago) → açaí ✅, hambúrguer, marmita, temaki
- **Ficha técnica + dose/garrafa** (insumo por produto, baixa no pedido) → bar, cozinha, sushi, pizza
- **Tamanho × variação** → pizza (meio-a-meio), sushi (combinado), açaí (tamanho)
- **Comissão/gorjeta por garçom** → bar, restaurante, music bar
- **Cover + agenda de eventos** → music bar
- **Venda por peso (R$/kg)** → açaí ✅, marmita a quilo

## Por vertical — módulo de profundidade + status

| Vertical | Módulo específico (a profundidade) | Status |
|---|---|---|
| **Açaiteria/Sorveteria** | montagem no copo (size+modifiers grátis-até-N+pagos) · peso · fidelidade | ✅ forte |
| **Restaurante/Cozinha** | grid foto · estação cozinha · ficha técnica | ✅ visual+motor · ⏳ ficha |
| **Bar** | dose/garrafa · ficha técnica · cover · comissão garçom · roteamento | ⏳ 2ª onda (em foco) |
| **Music bar** | tudo do bar + **agenda de shows/artistas** + cover por evento (snapshot/pessoa + repasse) | ⏳ = bar + agenda |
| **Hamburgueria** | **montagem do lanche** (pão obrigatório + ponto da carne + adicionais) + **combos** (lanche+batata+bebida) | ⏳ reusa Montagem |
| **Pizzaria** | **tamanho × sabores MEIO-A-MEIO** (até N sabores, preço = maior) + borda recheada + adicional | ⏳ NOVO (meio-a-meio é a chave) |
| **Sushi/Japonês** | **combinados** (1 item = N peças) + **rodízio** (preço/pessoa) + temaki montado | ⏳ NOVO (combinado+rodízio) |
| **Marmitaria** | peso (R$/kg) OU marmita montada (P/M/G + proteína + acompanhamentos) | ⏳ reusa Montagem/peso |

## Ordem de ataque — REVISADA pela pesquisa web (20/06, ver COMANDAPRO-PESQUISA-VERTICAIS.md)
A pesquisa nos 8 nichos mudou a prioridade. O que vende NÃO é feature de nicho — é resolver a **dor #1
transversal** (em todos os 8): "sistema trava no pico" + "tela de fechar conta lenta". Eixo de venda =
**"não trava no pico"** (confiabilidade) + **contrato limpo** (sem fidelidade abusiva) + **tudo num produto
só** (mata PDV+Goomer+AnotaAI = 3 mensalidades).

Ranking por ROI (da pesquisa):
1. **Núcleo de confiabilidade** — offline-first + fechamento instantâneo + read-after-write VISÍVEL. 1 esforço
   ataca a dor #1 de todos. (GRANDE/arriscado — fazer COM o Eduardo, não autônomo.)
2. **Restaurante à la carte** — menor gap (falta fiscal NFC-e, financeiro DRE, divisão de conta). Fiscal é
   sensível — alinhar antes.
3. **Açaiteria** — gap = balança (porta serial) + monta-açaí. Balança precisa hardware/campo.
4. **Pizza + Hambúrguer (juntos)** — mesmo **motor de montagem/personalização à prova de erro** (meio-a-meio =
   monta-lanche). PURO SOFTWARE, alto valor, destrava 2 nichos + é a recomendação de UI central. ← **1º alvo autônomo.**
5. **Marmitaria** (balança + IA previsão) · 6. **Sushi** (rodízio, juridicamente sensível) · 7. **Bar** (chopp
   por ml, nicho) · 8. **Music bar** (portaria/cashless, maior esforço).

**Decisão de execução autônoma (carta branca):** começo pelo **#4 — motor de personalização/montagem que
ESPELHA no KDS e no cupom** (ataca a dor #8 "adicional some na cozinha", é a recomendação de UI #1, e destrava
pizza+hambúrguer reusando o motor de GROUPS do açaí + o KDS/impressão já prontos). Confiabilidade (#1), fiscal
(#2) e balança (#3) ficam pra alinhar com o Eduardo (risco/hardware/jurídico).

## Regra de cadência (anti-largura-rasa)
Cada vertical só entra em profundidade quando há **cliente/demanda real ou espelho** pra validar — não
abrir nicho novo antes do anterior estar fechado e (idealmente) com cliente usando. O mapa existe pra
responder rápido à venda, não pra construir 8 verticais especulando. Casa com o roteiro "20 projetos →
recorrência" da tese-mãe.
