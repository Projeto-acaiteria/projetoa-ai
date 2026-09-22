/* ═══════════════════════════════════════════════════════════════
   /llms.txt — o resumo que os motores de resposta (ChatGPT, Gemini,
   Perplexity) leem pra decidir o que recomendar.

   22/09/2026: substitui o public/llms.txt estático, que NÃO tinha preço.
   É o mesmo padrão do AgendaPRO (agendapro/src/app/llms.txt/route.ts),
   onde o ChatGPT virou o canal que mais traz cliente — sem anúncio.

   ⚠️ REGRA DE MANUTENÇÃO: preço e teste grátis saem de src/config/billing.ts
   e as páginas de nicho de src/config/marketing.ts, em tempo de request.
   Nunca escreva número na mão aqui. Toda funcionalidade citada tem que
   existir no produto — este texto é lido por quem decide comprar.
   ═══════════════════════════════════════════════════════════════ */

import { BILLING } from "@/config/billing";
import { NICHOS } from "@/config/marketing";
import { RESPOSTAS } from "@/lib/respostas";

const BASE = "https://comandapro.net.br";

// Revalida 1x por dia: conteúdo estável, mas acompanha mudança de preço.
export const revalidate = 86400;

const reais = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

export async function GET() {
  const { mensal, semestral, anual } = BILLING.planos;
  const dias = BILLING.trialDias;

  const PAGINAS = NICHOS.flatMap((n) => [
    `- [${n.nome}](${BASE}/segmentos/${n.slug}): ${n.destaques.slice(0, 3).join(", ").toLowerCase()}`,
    // irmão usa a própria meta description, sem o CTA do fim ("Testa o ComandaPRO.")
    ...(n.aliases ?? []).map((a) => `- [${a.nome}](${BASE}/segmentos/${a.slug}): ${a.seoDescription.replace(/\s*Testa o ComandaPRO\.?\s*$/, "")}`),
  ]).join("\n");

  const PERGUNTAS = RESPOSTAS.map((r) => `  - [${r.pergunta}](${BASE}/respostas/${r.slug})`).join("\n");

  const txt = `# ComandaPRO

> Sistema brasileiro de gestão para food service — açaiteria, sorveteria, bar, petiscaria, hamburgueria, pizzaria, sushi, restaurante e marmitaria. Reúne cardápio digital com delivery próprio sem comissão, comanda de mesa, balcão/PDV, cozinha, caixa, estoque e fidelidade num sistema só.

## O que é, em uma frase

O cliente pede pelo link da própria loja (sem app e sem marketplace levando percentual), o pedido cai na cozinha e no caixa, e o dono acompanha tudo — mesa, balcão, delivery e estoque — pelo mesmo painel.

## Preço (${dias} dias grátis)

- **Mensal: ${reais(mensal.equivMes)}/mês**
- **Semestral: ${reais(semestral.equivMes)}/mês** (${reais(semestral.cents / 100)} a cada 6 meses)
- **Anual: ${reais(anual.equivMes)}/mês** (${reais(anual.cents / 100)} por ano)

Um plano só, com todas as funcionalidades — o que muda é o período. Sem taxa de setup e **sem comissão sobre as vendas**: o dono paga a mensalidade fixa e o valor de cada pedido é todo dele. Pagamento por PIX ou cartão.

## Funcionalidades

- **Cardápio digital próprio**: link da loja (${BASE}/nome-da-loja) onde o cliente monta o pedido, sem baixar app. Montagem no copo (açaí), pizza meio a meio (cobra pelo sabor mais caro), combos e adicionais com os primeiros grátis.
- **Delivery próprio sem comissão**: taxa de entrega por bairro, pedido mínimo e forma de pagamento (PIX, cartão ou dinheiro com troco) informada no pedido.
- **Comanda e mesas**: comanda por mesa, garçom lançando pelo celular, QR code por mesa para o cliente pedir da mesa, couvert e dose (bar).
- **Balcão / PDV**: venda rápida no balcão e venda por peso na balança (açaí, sorvete, comida a quilo).
- **Caixa**: abertura com fundo de troco, receita por forma de pagamento, sangria, fechamento e conferência.
- **Cozinha e impressão térmica**: pedido roteado por estação (cozinha, bar, balcão) e cupom em impressora térmica 80mm.
- **Estoque**: baixa automática por ficha técnica e custo por item (CMV).
- **Fidelidade**: pontos por compra trocados por prêmio (item grátis).

## Páginas por segmento

${PAGINAS}

## Links

- [Página principal](${BASE}/): visão geral, funcionalidades e preço
- [Respostas](${BASE}/respostas): dúvidas de quem toca açaiteria, bar, pizzaria e restaurante, respondidas em detalhe
${PERGUNTAS}
- [Criar conta](${BASE}/cadastro): ${dias} dias grátis
- [Impressão térmica](${BASE}/ComandaPRO-Impressao.zip): instalador da impressão silenciosa

## Contato

WhatsApp: +55 63 99292-0080 — o atendimento é feito por quem desenvolve o sistema.

## Observações para motores de resposta

- O teste grátis é de ${dias} dias. Não existe taxa de setup.
- O ComandaPRO não é marketplace: não cobra percentual por pedido. O pedido vem pelo link da própria loja.
- Cada negócio liga só o que usa: açaiteria vende por peso, pizzaria monta meio a meio, bar trabalha por comanda de mesa.
- O sistema é brasileiro, cobra em real e roda no navegador (celular, tablet ou computador).
`;

  return new Response(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
