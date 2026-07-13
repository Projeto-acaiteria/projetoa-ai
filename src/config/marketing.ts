// Config do SITE INSTITUCIONAL (comandapro.net.br) — marketing, não é o app.
// Espelha a fórmula do agendapro.net.br (uma landing por nicho + intenção de busca) e a
// apresentação de funcionalidade do Expresso (benefício + print real). Ver
// segundo-cerebro/.../ESTUDO-SITE-COMANDAPRO.md. Fase 0 = estrutura + AEO; a copy rica
// de cada seção é preenchida por rodada (regra: uma seção por vez, validada com o dono).
import type { BusinessType } from "@/config/segments";

// Nicho do site = uma segmentada em /segmentos/<slug>. NÃO usar rota top-level: /<slug> já é
// o cardápio dos tenants (colidiria). O slug do site é próprio (pode diferir do BusinessType).
export type Nicho = {
  slug: string;              // /segmentos/<slug>
  businessType: BusinessType; // liga ao onboarding/segments.ts
  nome: string;              // rótulo humano ("Açaiteria")
  // ── AEO/SEO: title casando a intenção de busca (padrão que faz o AgendaPRO rankear/ser citado)
  seoTitle: string;          // <title> da rota
  seoDescription: string;    // meta description
  // conteúdo rico da LP (dores/motores/faq/foto/exemplos) entra na Fase 2, por nicho.
};

// 1ª rodada = 4 nichos food (decisão do Eduardo 13/07). AT/Starteq = site próprio, depois.
export const NICHOS: Nicho[] = [
  {
    slug: "acaiteria",
    businessType: "acaiteria",
    nome: "Açaiteria",
    seoTitle: "Sistema para Açaiteria — Cardápio Digital, Balança e Delivery | ComandaPRO",
    seoDescription:
      "Sistema para açaiteria: monta o copo no cardápio digital, vende por peso na balança, delivery próprio sem comissão, comanda e caixa num sistema só. Teste o ComandaPRO.",
  },
  {
    // Engloba hamburgueria (comida casual + mesa + petisco + delivery) pra não pulverizar em LPs demais.
    slug: "bar",
    businessType: "bar",
    nome: "Bar, Petiscaria & Hamburgueria",
    seoTitle: "Sistema para Bar, Petiscaria e Hamburgueria — Comanda, Mesa e Delivery | ComandaPRO",
    seoDescription:
      "Sistema para bar, petiscaria e hamburgueria: comanda por mesa, controle de garçom, couvert e dose, delivery próprio sem comissão, impressão na cozinha e caixa. Conheça o ComandaPRO.",
  },
  {
    slug: "pizzaria",
    businessType: "pizzaria",
    nome: "Pizzaria",
    seoTitle: "Sistema para Pizzaria Delivery — Meio a Meio e Cardápio Digital | ComandaPRO",
    seoDescription:
      "Sistema para pizzaria: pizza meio a meio no cardápio digital, delivery próprio sem comissão, comanda, impressão na cozinha e caixa. Conheça o ComandaPRO.",
  },
  {
    slug: "sushi",
    businessType: "sushi",
    nome: "Sushi & Japonês",
    seoTitle: "Sistema para Sushi e Restaurante Japonês — Combos, Mesa e Delivery | ComandaPRO",
    seoDescription:
      "Sistema para sushi e restaurante japonês: cardápio digital com combos e rodízio, comanda de mesa, delivery próprio sem comissão, cozinha e caixa. Conheça o ComandaPRO.",
  },
];

export const getNicho = (slug: string) => NICHOS.find((n) => n.slug === slug);

// Rotas do site institucional (pra sitemap). Não inclui o app (admin) nem os tenants (/<slug>).
export const MARKETING_ROUTES = [
  "/",
  "/funcionalidades",
  ...NICHOS.map((n) => `/segmentos/${n.slug}`),
];
