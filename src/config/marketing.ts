// Config do SITE INSTITUCIONAL (comandapro.net.br) — marketing, não é o app.
// Espelha a fórmula do agendapro.net.br (uma landing por nicho + intenção de busca) e a
// apresentação de funcionalidade do Expresso (benefício + print real). Ver
// segundo-cerebro/.../ESTUDO-SITE-COMANDAPRO.md. Fase 0 = estrutura + AEO; a copy rica
// de cada seção é preenchida por rodada (regra: uma seção por vez, validada com o dono).
import type { BusinessType } from "@/config/segments";
import { BILLING } from "@/config/billing";

// Nicho do site = uma segmentada em /segmentos/<slug>. NÃO usar rota top-level: /<slug> já é
// o cardápio dos tenants (colidiria). O slug do site é próprio (pode diferir do BusinessType).
export type Faq = { q: string; a: string };
export type Nicho = {
  slug: string;              // /segmentos/<slug>
  businessType: BusinessType; // liga ao onboarding/segments.ts
  nome: string;              // rótulo humano ("Açaiteria")
  // ── AEO/SEO: title casando a intenção de busca (padrão que faz o AgendaPRO rankear/ser citado)
  seoTitle: string;          // <title> da rota
  seoDescription: string;    // meta description
  // ── Conteúdo da LP segmentada (o template lê daqui)
  heroH1: string;            // headline (parte forte)
  heroAccent: string;        // parte da headline no acento índigo
  heroSub: string;           // subtítulo
  cardapioImg: string | null; // print real do cardápio (celular) — null = usa mock genérico
  cardapioCaption: string;
  destaques: string[];       // pills do que importa pro nicho
  dores: string[];           // 3 dores específicas do nicho
  faqs: Faq[];               // FAQ do nicho (munição AEO)
};

// 1ª rodada = 4 nichos food (decisão do Eduardo 13/07). AT/Starteq = site próprio, depois.
export const NICHOS: Nicho[] = [
  {
    slug: "acaiteria",
    businessType: "acaiteria",
    nome: "Açaiteria",
    seoTitle: "Sistema para Açaiteria — Cardápio Digital, Balança e Delivery | ComandaPRO",
    seoDescription:
      "Sistema para açaiteria: monta o copo no cardápio digital, vende por peso na balança, delivery próprio sem comissão, comanda e caixa num sistema só. Testa o ComandaPRO.",
    heroH1: "Sistema pra açaiteria que",
    heroAccent: "monta o copo sozinho.",
    heroSub: "O cliente monta o açaí no seu link — tamanho, adicionais (os primeiros grátis), sabor — e o preço nunca sai errado. Venda por peso, delivery próprio sem comissão e fidelidade por pontos, num sistema só.",
    cardapioImg: "/site/cardapio-acai.jpg",
    cardapioCaption: "Cardápio real · Cantinho do Açaí",
    destaques: ["Monta o copo no cardápio", "Venda por peso na balança", "Adicionais grátis até o limite", "Delivery 0% comissão", "Fidelidade por pontos"],
    dores: ["Fila no balcão anotando adicional no papel", "Cliente do iFood que nunca volta — e a comissão comendo a margem", "Não sabe qual sabor e adicional mais saem"],
    faqs: [
      { q: "O cliente monta o açaí sozinho pelo link?", a: "Sim. Ele escolhe o tamanho, adiciona frutas, cremes e crocantes com a regra 'os primeiros grátis' (você define quantos) já aplicada, e vê o preço subir ao vivo — sem app pra baixar." },
      { q: "Dá pra vender por peso (R$/kg)?", a: "Sim. O ComandaPRO integra com a balança (protocolo Toledo) ou você digita as gramas, e o preço sai pelo peso automaticamente." },
      { q: "Como funciona a fidelidade da açaiteria?", a: "O cliente ganha pontos por compra e troca por um item seu (ex: copo 350ml grátis). Ele consulta o saldo pelo telefone e o cupom imprime quanto falta pro próximo prêmio. Pontos nunca viram dinheiro." },
      { q: "Preciso pagar comissão no delivery?", a: "Não. O pedido vem pelo seu link, com sua taxa por bairro, e o valor é todo seu — sem marketplace levando percentual." },
      { q: "Quanto custa?", a: `A partir de R$ ${BILLING.planos.anual.equivMes}/mês no anual, com ${BILLING.trialDias} dias grátis e sem taxa de setup.` },
    ],
  },
  {
    // BAR & PETISCARIA — venue de noite: comanda de mesa, couvert, dose/garrafa. NÃO tem fidelidade
    // nem lidera com delivery (o forte é o salão). Regras vêm de segments.ts (coverEnabled, stockDose).
    slug: "bar",
    businessType: "bar",
    nome: "Bar & Petiscaria",
    seoTitle: "Sistema para Bar e Petiscaria — Comanda por Mesa, Couvert e Dose | ComandaPRO",
    seoDescription:
      "Sistema para bar e petiscaria: comanda por mesa, controle de garçom, couvert por pessoa, dose e garrafa no estoque, divisão de conta e caixa. Testa o ComandaPRO.",
    heroH1: "Sistema pra bar que",
    heroAccent: "fecha a comanda sem erro.",
    heroSub: "Comanda por mesa, o garçom lança pelo celular, couvert e dose entram automático e a conta divide na hora — do primeiro chopp ao fechamento do caixa. Cada pedido vai roteado pra cozinha ou pro bar.",
    cardapioImg: "/site/cardapio-bar.jpg",
    cardapioCaption: "Cardápio real · Medellín Music Bar",
    destaques: ["Comanda por mesa", "App do garçom", "Couvert por pessoa", "Dose e garrafa no estoque", "Divisão de conta"],
    dores: ["Comanda de papel que some e some venda junto", "Garçom correndo pra somar a conta e o cliente esperando", "Dose e couvert que ninguém lança direito"],
    faqs: [
      { q: "Como funciona a comanda por mesa?", a: "Cada mesa tem uma comanda; o garçom lança os itens pelo celular e cada pedido já sai roteado pra cozinha ou pro bar. No fim, a conta fecha com a taxa de 10% (o cliente pode recusar) e divide entre as pessoas." },
      { q: "O sistema controla couvert e dose?", a: "Sim. O couvert entra por pessoa quando tem atração, e a dose/garrafa baixa certo do estoque — sem confundir dose com garrafa." },
      { q: "O garçom consegue ver o meu financeiro?", a: "Não. O garçom só lança e vê os pedidos dele; abrir comanda e lançar sim, fechar conta e ver dinheiro não — isso é do dono e da recepção." },
      { q: "Dá pra rotear pedido pra cozinha e pro bar separados?", a: "Sim. Cada item vai pra estação certa: o chopp e o drink caem no bar, o petisco na cozinha — cada um imprime na sua impressora, sem preço na via de preparo." },
      { q: "Quanto custa?", a: `A partir de R$ ${BILLING.planos.anual.equivMes}/mês no anual, com ${BILLING.trialDias} dias grátis e sem taxa de setup.` },
    ],
  },
  {
    // HAMBURGUERIA — comida casual: combos/adicionais, balcão+mesa+delivery próprio, FIDELIDADE pra
    // trazer o cliente de volta. NÃO tem couvert nem dose. Oposto do bar (por isso LP separada).
    slug: "hamburgueria",
    businessType: "hamburgueria",
    nome: "Hamburgueria",
    seoTitle: "Sistema para Hamburgueria — Cardápio, Combos, Delivery e Fidelidade | ComandaPRO",
    seoDescription:
      "Sistema para hamburgueria: cardápio digital com combos e adicionais, balcão, mesa e delivery próprio sem comissão, fidelidade por pontos, impressão na cozinha e caixa. Testa o ComandaPRO.",
    heroH1: "Sistema pra hamburgueria que",
    heroAccent: "não erra o adicional.",
    heroSub: "O cliente monta o combo e escolhe os adicionais no seu link, sem confusão. Balcão, mesa e delivery próprio sem comissão, com fidelidade por pontos pra ele voltar — do pedido ao caixa, num sistema só.",
    cardapioImg: "/site/cardapio-hamburgueria.jpg",
    cardapioCaption: "Cardápio real · smash e combos",
    destaques: ["Combos e adicionais", "Balcão, mesa e delivery", "Delivery 0% comissão", "Fidelidade por pontos", "Impressão na cozinha"],
    dores: ["Adicional anotado errado e lanche saindo trocado", "Marketplace levando até ~30% de cada lanche que você faz", "Cliente que pede uma vez e nunca mais volta"],
    faqs: [
      { q: "O cliente monta o combo e os adicionais sozinho?", a: "Sim. No seu link ele escolhe o lanche, os adicionais (bacon, cheddar, ponto da carne) com mínimo e máximo por grupo, e vê o preço certo — sem app pra baixar e sem erro de anotação." },
      { q: "Tem fidelidade pra trazer o cliente de volta?", a: "Sim. O cliente ganha pontos por compra e troca por um item seu (ex: um combo ou uma porção). Ele vê o saldo pelo telefone e o cupom imprime quanto falta pro prêmio. Pontos nunca viram dinheiro." },
      { q: "Preciso pagar comissão no delivery?", a: "Não. O pedido vem pelo seu link, com sua taxa por bairro e 0% de comissão — o valor é todo seu, sem marketplace no meio." },
      { q: "Atende balcão, mesa e delivery no mesmo sistema?", a: "Sim. Walk-in no balcão, comanda na mesa e pedido de entrega caem no mesmo caixa e no mesmo estoque — você não troca de sistema no meio do serviço." },
      { q: "Quanto custa?", a: `A partir de R$ ${BILLING.planos.anual.equivMes}/mês no anual, com ${BILLING.trialDias} dias grátis e sem taxa de setup.` },
    ],
  },
  {
    slug: "pizzaria",
    businessType: "pizzaria",
    nome: "Pizzaria",
    seoTitle: "Sistema para Pizzaria Delivery — Meio a Meio e Cardápio Digital | ComandaPRO",
    seoDescription:
      "Sistema para pizzaria: pizza meio a meio no cardápio digital, delivery próprio sem comissão, comanda, impressão na cozinha e caixa. Testa o ComandaPRO.",
    heroH1: "Sistema pra pizzaria com",
    heroAccent: "meio a meio de verdade.",
    heroSub: "Pizza meio a meio no cardápio — cobra o sabor mais caro ou a média, do seu jeito — combos e bordas no seu link. Delivery próprio sem comissão, impressão na cozinha e caixa integrado.",
    cardapioImg: "/site/cardapio-pizzaria.jpg",
    cardapioCaption: "Cardápio real · pizza meio a meio",
    destaques: ["Pizza meio a meio", "Combos e bordas", "Delivery 0% comissão", "Impressão na cozinha", "Fidelidade por pontos"],
    dores: ["Pedido de meio a meio anotado errado no WhatsApp", "Marketplace levando até ~30% da pizza que você fez", "Cozinha fazendo a pizza errada por comanda ilegível"],
    faqs: [
      { q: "O cardápio faz pizza meio a meio?", a: "Sim. O cliente escolhe dois sabores e o sistema cobra pela regra que você definir — o sabor mais caro ou a média dos dois. Também dá pra montar combos e escolher borda." },
      { q: "A cozinha recebe o pedido certo?", a: "Sim. A via de preparo imprime na cozinha sem preço, só com os sabores e observações — impressão térmica 80mm, roteada pra estação certa." },
      { q: "Preciso pagar comissão no delivery?", a: "Não. O pedido vem pelo seu link com sua taxa por bairro; o valor é todo seu, sem marketplace no meio." },
      { q: "Dá pra atender no salão e no delivery no mesmo sistema?", a: "Sim. Comanda de mesa, balcão e delivery caem no mesmo caixa — você não troca de sistema no meio do serviço." },
      { q: "Tem fidelidade pra trazer o cliente de volta?", a: "Sim. O cliente ganha pontos por compra e troca por um item seu (ex: uma pizza ou uma bebida). Ele vê o saldo pelo telefone e o cupom imprime quanto falta pro prêmio. Pontos nunca viram dinheiro." },
      { q: "Quanto custa?", a: `A partir de R$ ${BILLING.planos.anual.equivMes}/mês no anual, com ${BILLING.trialDias} dias grátis e sem taxa de setup.` },
    ],
  },
  {
    slug: "sushi",
    businessType: "sushi",
    nome: "Sushi & Japonês",
    seoTitle: "Sistema para Sushi e Restaurante Japonês — Combos, Mesa e Delivery | ComandaPRO",
    seoDescription:
      "Sistema para sushi e restaurante japonês: cardápio digital com combos e rodízio, comanda de mesa, delivery próprio sem comissão, cozinha e caixa. Testa o ComandaPRO.",
    heroH1: "Sistema pra sushi com",
    heroAccent: "combos e rodízio.",
    heroSub: "Combos, barcas e rodízio no cardápio do seu link, comanda por mesa e delivery próprio sem comissão. Do pedido ao caixa, num sistema só — sem gambiarra de planilha.",
    cardapioImg: "/site/cardapio-sushi.jpg",
    cardapioCaption: "Cardápio real · combos e barcas",
    destaques: ["Combos e barcas", "Rodízio", "Comanda por mesa", "Delivery 0% comissão", "Fidelidade por pontos"],
    dores: ["Barca e combo montados na mão, com erro de preço", "Comissão de marketplace comendo a margem do peixe", "Rodízio sem controle do que sai por mesa"],
    faqs: [
      { q: "O cardápio monta combo e barca?", a: "Sim. Você cria combos com itens obrigatórios e opcionais (mínimo e máximo por grupo), e o cliente monta a barca no seu link com o preço certo calculado pelo sistema." },
      { q: "Funciona pra rodízio?", a: "Sim. Cada mesa abre comanda, os pedidos vão roteados pra cozinha, e você controla o que sai por mesa sem perder o fio." },
      { q: "Preciso pagar comissão no delivery?", a: "Não. O pedido vem pelo seu link, com sua taxa por bairro e 0% de comissão de marketplace." },
      { q: "Atende salão e delivery no mesmo sistema?", a: "Sim. Comanda de mesa, balcão e delivery caem no mesmo caixa e no mesmo estoque — tudo integrado." },
      { q: "Tem fidelidade pra trazer o cliente de volta?", a: "Sim. O cliente ganha pontos por compra e troca por um item seu (ex: um temaki ou uma bebida). Ele vê o saldo pelo telefone e o cupom imprime quanto falta pro prêmio. Pontos nunca viram dinheiro." },
      { q: "Quanto custa?", a: `A partir de R$ ${BILLING.planos.anual.equivMes}/mês no anual, com ${BILLING.trialDias} dias grátis e sem taxa de setup.` },
    ],
  },
];

export const getNicho = (slug: string) => NICHOS.find((n) => n.slug === slug);

// Rotas do site institucional (pra sitemap). Não inclui o app (admin) nem os tenants (/<slug>).
export const MARKETING_ROUTES = [
  "/",
  "/funcionalidades",
  ...NICHOS.map((n) => `/segmentos/${n.slug}`),
];
