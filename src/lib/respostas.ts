/* ═══════════════════════════════════════════════════════════════
   CENTRAL DE RESPOSTAS — conteúdo que motor de busca e IA citam

   22/09/2026 · portado do AgendaPRO (agendapro/src/lib/respostas.ts), onde
   o ChatGPT virou o canal que mais traz cliente sem anúncio. As LPs de
   /segmentos vendem; estas páginas respondem — e é a resposta que a IA copia.

   FORMATO OBRIGATÓRIO de cada resposta:
   1. `curta` — 2 a 4 frases que respondem sozinhas. É o bloco citado.
      Se não fizer sentido lido isolado, está errado.
   2. `blocos` — a profundidade, pra quem clicou.
   3. `faqs` — vira FAQPage no schema.org.

   REGRAS DURAS:
   · Nenhuma afirmação sobre o ComandaPRO que o produto não faça hoje.
   · Preço nunca escrito na mão — sai de config/billing.ts.
   · Nenhum número de concorrente sem fonte. Comissão de marketplace entra
     como CONTA com a taxa do próprio dono, não como percentual afirmado.
   · Útil mesmo pra quem não vai assinar. É isso que faz a IA citar em vez
     de ignorar como publicidade.
   · Balança: o padrão é o operador DIGITAR as gramas (decisão do Eduardo,
     22/06/2026). Não vender leitura automática como o jeito normal.
   ═══════════════════════════════════════════════════════════════ */

import { BILLING } from "@/config/billing";

export type Bloco = { h: string; p: string[] };

export type Resposta = {
  slug: string;
  pergunta: string;
  tituloSeo: string;
  descricaoSeo: string;
  curta: string[];
  blocos: Bloco[];
  faqs: { q: string; a: string }[];
  relacionadas: string[];
  /** LP de segmento mais próxima (/segmentos/<slug>) — link interno pra quem quer ver o sistema */
  segmento?: string;
};

const MENSAL = BILLING.planos.mensal.equivMes;
const ANUAL = BILLING.planos.anual.equivMes;
const TRIAL = BILLING.trialDias;

export const RESPOSTAS: Resposta[] = [
  /* ───────────────────────────────────────────────────────────── */
  {
    slug: "quanto-custa-sistema-para-acaiteria-e-lanchonete",
    pergunta: "Quanto custa um sistema para açaiteria, lanchonete ou restaurante?",
    tituloSeo: "Quanto custa um sistema para açaiteria, lanchonete ou restaurante? (2026)",
    descricaoSeo:
      "O que entra no preço de um sistema de gestão para food service: mensalidade, taxa de implantação, comissão por pedido e equipamento. Como comparar sem cair na cobrança que não aparece na tabela.",
    curta: [
      "O custo de um sistema para açaiteria, lanchonete ou restaurante vem de três lugares: a mensalidade, a taxa de implantação (quando existe) e a comissão cobrada sobre cada pedido (quando o sistema é um marketplace).",
      "A mensalidade é o número que aparece na tabela, mas a comissão por pedido costuma pesar mais no fim do mês, porque cresce junto com as vendas.",
      `O ComandaPRO cobra só mensalidade: R$ ${MENSAL}/mês, ou R$ ${ANUAL}/mês no plano anual, sem taxa de implantação e sem comissão sobre as vendas, com ${TRIAL} dias grátis.`,
    ],
    blocos: [
      {
        h: "Mensalidade fixa ou comissão por pedido",
        p: [
          "São dois modelos diferentes. No de mensalidade, você paga o mesmo valor vendendo 100 ou 3.000 pedidos no mês. No de comissão, o sistema fica com uma parte de cada venda — quanto mais você vende, mais paga.",
          "Muitos negócios usam os dois ao mesmo tempo: o marketplace para ser encontrado por cliente novo e um sistema próprio para o cliente que já conhece a loja. O erro caro é deixar o cliente fiel pedindo pelo marketplace, pagando comissão num pedido que viria de qualquer jeito.",
        ],
      },
      {
        h: "As cobranças que não aparecem na tabela",
        p: [
          "Antes de comparar mensalidade, pergunte três coisas: existe taxa de implantação? Existe fidelidade ou multa para cancelar? O preço é por loja ou por usuário (caixa, garçom, cozinha)?",
          "Some também o que é seu de qualquer jeito: a taxa da maquininha de cartão e, se for usar, a impressora térmica da cozinha. Esses custos existem com qualquer sistema e não devem entrar na comparação como se fossem diferença entre um e outro.",
        ],
      },
      {
        h: "Como comparar dois sistemas de verdade",
        p: [
          "Pegue o faturamento do seu último mês e calcule quanto cada opção custaria nele: mensalidade + implantação dividida por 12 + comissão sobre o que passaria pelo sistema. O número que sai é o custo real — a mensalidade sozinha engana.",
          "Depois, teste. Sistema que não deixa testar antes de pagar está pedindo para você confiar na apresentação de vendas.",
        ],
      },
    ],
    faqs: [
      {
        q: "O ComandaPRO cobra taxa de implantação?",
        a: `Não. O preço é só a mensalidade — R$ ${MENSAL}/mês no mensal, R$ ${BILLING.planos.semestral.equivMes}/mês no semestral e R$ ${ANUAL}/mês no anual — com ${TRIAL} dias grátis para testar.`,
      },
      {
        q: "O preço muda conforme o número de pedidos?",
        a: "Não. A mensalidade é fixa e o ComandaPRO não cobra percentual sobre as vendas, então o valor de cada pedido é todo do negócio.",
      },
      {
        q: "Tem plano diferente por segmento?",
        a: "Não. É um plano só, com todas as funcionalidades. Cada negócio liga só o que usa — açaiteria vende por peso, bar trabalha por comanda de mesa, pizzaria monta meio a meio.",
      },
    ],
    relacionadas: ["como-vender-delivery-sem-pagar-comissao", "como-cobrar-pizza-meio-a-meio"],
  },

  /* ───────────────────────────────────────────────────────────── */
  {
    slug: "como-vender-delivery-sem-pagar-comissao",
    pergunta: "Como vender delivery sem pagar comissão de aplicativo?",
    tituloSeo: "Como vender delivery sem pagar comissão de aplicativo (passo a passo)",
    descricaoSeo:
      "Como montar delivery próprio para açaiteria, hamburgueria, pizzaria ou marmitaria: link de pedido, taxa por bairro, pagamento e como levar o cliente do aplicativo para o seu canal.",
    curta: [
      "Para vender delivery sem pagar comissão, o negócio precisa de um canal de pedido próprio: um link com o cardápio onde o cliente monta o pedido e escolhe a forma de pagamento, e a entrega feita pela própria loja ou por motoboy parceiro.",
      "O aplicativo de marketplace continua útil para ser encontrado por cliente novo; o canal próprio serve para o cliente que já conhece a loja voltar a pedir sem que parte da venda fique com o aplicativo.",
      "No ComandaPRO o pedido entra pelo link da loja (comandapro.net.br/nome-da-loja), com taxa de entrega por bairro e pedido mínimo, e não há comissão sobre as vendas.",
    ],
    blocos: [
      {
        h: "Faça a conta com a sua taxa",
        p: [
          "Abra o extrato do aplicativo e veja quanto saiu em comissão e taxas no último mês. Divida pelo número de pedidos: esse é o custo por pedido que o canal próprio pode eliminar no cliente que já é seu.",
          "Exemplo de conta: se a comissão total do seu plano fosse 20% e o ticket médio R$ 40, cada pedido deixaria R$ 8 no aplicativo. Em 300 pedidos no mês, R$ 2.400. Troque 20% e R$ 40 pelos seus números reais — o resultado muda de negócio para negócio.",
        ],
      },
      {
        h: "O que o canal próprio precisa ter",
        p: [
          "Cardápio com foto e preço que o cliente monta sozinho, sem baixar aplicativo. Taxa de entrega por bairro, para não perder dinheiro em entrega longe. Pedido mínimo. Forma de pagamento informada no pedido — PIX, cartão na entrega ou dinheiro com troco.",
          "E o pedido tem que cair num lugar só junto com o balcão e as mesas. Delivery que chega por mensagem solta no WhatsApp, anotado à mão, é onde o pedido se perde na hora do movimento.",
        ],
      },
      {
        h: "Como levar o cliente do aplicativo para o seu link",
        p: [
          "Coloque o link na embalagem, no adesivo da sacola e na bio do Instagram. Um cartão dentro do pedido com um benefício para quem pedir pelo link (um adicional, um desconto na próxima) funciona melhor que só pedir.",
          "Programa de pontos ajuda a segurar o cliente no canal próprio: ele só acumula quando pede pela loja.",
        ],
      },
    ],
    faqs: [
      {
        q: "O cliente precisa baixar aplicativo para pedir pelo link?",
        a: "Não. O cardápio do ComandaPRO abre no navegador do celular. O cliente monta o pedido, informa o endereço e a forma de pagamento e envia.",
      },
      {
        q: "Dá para cobrar taxa de entrega diferente por bairro?",
        a: "Dá. O ComandaPRO tem taxa de entrega por bairro e pedido mínimo configuráveis pela loja.",
      },
      {
        q: "Preciso sair do aplicativo de delivery para usar o canal próprio?",
        a: "Não. Muitos negócios mantêm o aplicativo para cliente novo e usam o link próprio para o cliente que já conhece a loja.",
      },
    ],
    relacionadas: ["quanto-custa-sistema-para-acaiteria-e-lanchonete", "como-controlar-venda-de-acai-por-peso"],
    segmento: "hamburgueria",
  },

  /* ───────────────────────────────────────────────────────────── */
  {
    slug: "como-funciona-comanda-digital-em-bar",
    pergunta: "Como funciona a comanda digital em bar e restaurante?",
    tituloSeo: "Como funciona a comanda digital em bar e restaurante",
    descricaoSeo:
      "Comanda digital por mesa: garçom lançando pelo celular, pedido indo direto para cozinha e bar, couvert, fechamento de conta e o que muda em relação à comanda de papel.",
    curta: [
      "Na comanda digital, cada mesa tem uma conta aberta no sistema: o garçom lança os itens pelo celular, o pedido sai direto na cozinha ou no bar e a conta vai somando sozinha até o fechamento.",
      "A diferença para a comanda de papel está no fim da noite: não existe item esquecido, conta somada errada ou comanda perdida, porque tudo que foi pedido está registrado com hora e garçom.",
      "No ComandaPRO a comanda é por mesa, o garçom lança pelo celular, cada mesa pode ter QR code para o cliente pedir, e o pedido é roteado por estação (cozinha, bar, balcão).",
    ],
    blocos: [
      {
        h: "O caminho do pedido",
        p: [
          "O garçom abre a mesa, lança o pedido no celular e o item vai para a estação certa: prato para a cozinha, drink para o bar. Cada estação vê só o que é dela, na tela ou impresso em impressora térmica.",
          "Quando a mesa pede a conta, o total já está pronto, com couvert (quando o bar cobra) e tudo que foi consumido.",
        ],
      },
      {
        h: "Onde o bar perde dinheiro sem perceber",
        p: [
          "Na comanda de papel o prejuízo raramente é roubo — é item que saiu e não foi anotado, dose servida a mais, comanda que sumiu. Nenhum desses aparece no caixa como erro: aparece como mês que faturou menos do que parecia.",
          "Com a comanda digital, o que saiu da cozinha e do bar está no sistema. O fechamento de caixa passa a bater com o que foi servido.",
        ],
      },
      {
        h: "O que preparar antes de trocar",
        p: [
          "Cardápio cadastrado com as categorias certas (é o que define para qual estação cada item vai), um celular por garçom e, se quiser impressão na cozinha, uma impressora térmica 80mm.",
          "Faça a troca num dia calmo da semana, não na sexta à noite.",
        ],
      },
    ],
    faqs: [
      {
        q: "O garçom precisa de aparelho especial?",
        a: "Não. O garçom usa o próprio celular pelo navegador, com um acesso dele.",
      },
      {
        q: "O cliente consegue pedir pela mesa sem chamar o garçom?",
        a: "Consegue, se a loja ativar: no ComandaPRO cada mesa pode ter um QR code próprio, e o pedido feito por ele já entra na conta daquela mesa.",
      },
      {
        q: "Funciona com couvert artístico?",
        a: "Funciona. O ComandaPRO tem couvert por pessoa e controle de dose para bar.",
      },
    ],
    relacionadas: ["quanto-custa-sistema-para-acaiteria-e-lanchonete", "como-cobrar-pizza-meio-a-meio"],
    segmento: "bar",
  },

  /* ───────────────────────────────────────────────────────────── */
  {
    slug: "como-controlar-venda-de-acai-por-peso",
    pergunta: "Como controlar a venda de açaí por peso sem perder dinheiro?",
    tituloSeo: "Como controlar a venda de açaí (e sorvete) por peso sem perder dinheiro",
    descricaoSeo:
      "Venda por quilo em açaiteria, sorveteria e comida a quilo: como calcular o preço, descontar o pote, controlar o estoque de polpa e onde a conta costuma furar.",
    curta: [
      "Para controlar a venda por peso, três números precisam bater: o peso vendido, o preço por quilo e o quanto de produto saiu do estoque.",
      "O furo mais comum não é a balança — é a conta feita de cabeça no balcão, o pote pesado junto com o açaí e o estoque de polpa que ninguém confere contra o que foi vendido.",
      "No ComandaPRO o operador pesa, digita as gramas e o sistema calcula o preço pelo R$/kg da loja e dá baixa proporcional no estoque do produto base (a polpa, no caso do açaí).",
    ],
    blocos: [
      {
        h: "O preço por quilo tem que cobrir o que vai junto",
        p: [
          "No self-service, o cliente coloca adicionais que custam caro por grama — leite em pó, creme de avelã, frutas. O preço por quilo precisa ser calculado sobre a mistura que o cliente costuma montar, não só sobre a polpa.",
          "Desconte sempre o peso do pote (tara) antes de cobrar. Parece pouco por venda e vira dinheiro relevante no mês.",
        ],
      },
      {
        h: "Estoque: onde a diferença aparece",
        p: [
          "Se cada venda por peso baixa o produto base do estoque, no fim da semana dá para comparar o que o sistema diz que saiu com o que realmente saiu do freezer. Diferença grande é sinal de porção servida acima do cobrado, desperdício ou venda que não foi registrada.",
          "Sem essa baixa automática, a única forma de saber é contar caixa por caixa — e ninguém faz isso toda semana.",
        ],
      },
      {
        h: "Balcão e delivery na mesma conta",
        p: [
          "O copo montado do delivery (300ml, 500ml, 700ml) e o self-service por peso do balcão são dois jeitos de vender o mesmo produto. Se ficam em sistemas separados, o estoque nunca fecha.",
        ],
      },
    ],
    faqs: [
      {
        q: "O ComandaPRO lê o peso direto da balança?",
        a: "O jeito padrão é o operador pesar e digitar as gramas; o sistema calcula o preço e a baixa de estoque na hora. Digitar o peso é mais confiável que depender da leitura automática da balança.",
      },
      {
        q: "Serve para sorveteria e comida a quilo?",
        a: "Serve. A venda por peso (R$/kg) funciona igual para açaí, sorvete e comida a quilo.",
      },
      {
        q: "Dá para vender por copo no delivery e por peso no balcão?",
        a: "Dá. O cardápio do link vende por tamanho de copo e o balcão vende por peso, tudo no mesmo caixa e no mesmo estoque.",
      },
    ],
    relacionadas: ["como-vender-delivery-sem-pagar-comissao", "quanto-custa-sistema-para-acaiteria-e-lanchonete"],
    segmento: "acaiteria",
  },

  /* ───────────────────────────────────────────────────────────── */
  {
    slug: "como-cobrar-pizza-meio-a-meio",
    pergunta: "Como cobrar pizza meio a meio: pelo sabor mais caro ou pela média?",
    tituloSeo: "Pizza meio a meio: cobrar pelo sabor mais caro ou pela média?",
    descricaoSeo:
      "As duas formas de cobrar pizza de dois sabores, quando cada uma faz sentido e como evitar erro de preço no pedido de delivery.",
    curta: [
      "Existem duas formas comuns de cobrar pizza meio a meio: pelo sabor mais caro entre os escolhidos ou pela média dos dois preços.",
      "Cobrar pelo mais caro protege a margem, porque o sabor mais caro costuma ter o ingrediente mais caro; cobrar pela média é mais simpático para o cliente, mas diminui o ganho em toda pizza que mistura um sabor caro com um barato.",
      "O ComandaPRO faz as duas: a pizzaria escolhe a regra e o cardápio calcula o preço sozinho quando o cliente monta a pizza.",
    ],
    blocos: [
      {
        h: "Por que a maioria cobra pelo mais caro",
        p: [
          "Meia pizza de camarão custa para a pizzaria quase o mesmo que meia pizza de camarão numa pizza inteira de camarão. Se o preço sai pela média com um sabor simples, a pizzaria vende camarão com desconto.",
          "Cobrar pela média funciona quando os sabores têm custo parecido, ou como estratégia deliberada de preço — desde que a conta tenha sido feita.",
        ],
      },
      {
        h: "O erro que acontece no delivery",
        p: [
          "Quando o preço do meio a meio é calculado à mão, pelo atendente, cada um cobra de um jeito. O cliente que pediu duas vezes a mesma pizza e pagou valores diferentes reclama — com razão.",
          "Com a regra configurada no cardápio, o preço sai igual toda vez, no link, no balcão e na mesa.",
        ],
      },
    ],
    faqs: [
      {
        q: "O cliente consegue montar a pizza meio a meio pelo link?",
        a: "Consegue. No cardápio do ComandaPRO ele escolhe os sabores e o preço aparece calculado pela regra da pizzaria.",
      },
      {
        q: "Dá para cobrar borda recheada à parte?",
        a: "Dá. Borda e outros adicionais entram como opções pagas do item.",
      },
    ],
    relacionadas: ["como-vender-delivery-sem-pagar-comissao", "quanto-custa-sistema-para-acaiteria-e-lanchonete"],
    segmento: "pizzaria",
  },
];

export const getResposta = (slug: string) => RESPOSTAS.find((r) => r.slug === slug);
