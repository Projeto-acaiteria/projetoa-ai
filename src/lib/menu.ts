// Modelagem canônica de cardápio de açaí (§5 do ESTUDO):
// Tamanho = preço-base · Grupos de modificador (grátis-até-N) · Adicionais pagos.
// Mock editável — vira tabelas product_variants + modifier_groups + modifiers no back.

// Ficha técnica: insumos que o item consome do estoque ao ser vendido.
export type Ingredient = { stockId: string; qty: number };

export type Size = { id: string; label: string; ml: number; priceCents: number; img: string; recipe?: Ingredient[] };

export type Modifier = { id: string; name: string; priceCents: number; recipe?: Ingredient[] };

export type ModifierGroup = {
  id: string;
  title: string;
  /** quantos itens deste grupo entram SEM custo */
  freeUpTo: number;
  /** teto de seleção (0 = ilimitado) */
  max: number;
  paid: boolean; // true = todo item é pago (ex: adicionais premium)
  items: Modifier[];
};

export const BRAND = {
  name: "Açaí do Vidal",
  tagline: "Cremoso de verdade. Monte do seu jeito.",
  whatsapp: "5599810420160", // placeholder — número do Vidal (confirmar na call)
  deliveryFeeCents: 500,
  minOrderCents: 1500,
  heroImg: "/menu/hero.jpg",
};

export const SIZES: Size[] = [
  { id: "s300", label: "Copo 300ml", ml: 300, priceCents: 1000, img: "/menu/copo-300.jpg", recipe: [{ stockId: "polpa", qty: 0.15 }] },
  { id: "s500", label: "Copo 500ml", ml: 500, priceCents: 1600, img: "/menu/copo-500.jpg", recipe: [{ stockId: "polpa", qty: 0.25 }] },
  { id: "s700", label: "Copo 700ml", ml: 700, priceCents: 2000, img: "/menu/copo-700.jpg", recipe: [{ stockId: "polpa", qty: 0.35 }] },
];

export const GROUPS: ModifierGroup[] = [
  {
    id: "cereais",
    title: "Acompanhamentos",
    freeUpTo: 3,
    max: 6,
    paid: false,
    items: [
      { id: "granola", name: "Granola", priceCents: 200, recipe: [{ stockId: "granola", qty: 0.03 }] },
      { id: "sucrilhos", name: "Sucrilhos", priceCents: 200 },
      { id: "pacoca", name: "Paçoca", priceCents: 200 },
      { id: "farinha-lactea", name: "Farinha láctea", priceCents: 200 },
      { id: "amendoim", name: "Amendoim", priceCents: 200 },
      { id: "castanha", name: "Castanha granulada", priceCents: 250 },
    ],
  },
  {
    id: "frutas",
    title: "Frutas",
    freeUpTo: 2,
    max: 4,
    paid: false,
    items: [
      { id: "banana", name: "Banana", priceCents: 200, recipe: [{ stockId: "banana", qty: 0.05 }] },
      { id: "morango", name: "Morango", priceCents: 300 },
      { id: "kiwi", name: "Kiwi", priceCents: 300 },
      { id: "uva", name: "Uva", priceCents: 250 },
    ],
  },
  {
    id: "caldas",
    title: "Coberturas e caldas",
    freeUpTo: 2,
    max: 4,
    paid: false,
    items: [
      { id: "chocolate", name: "Calda de chocolate", priceCents: 200 },
      { id: "morango-calda", name: "Calda de morango", priceCents: 200 },
      { id: "leite-cond", name: "Leite condensado", priceCents: 250 },
      { id: "mel", name: "Mel", priceCents: 200 },
    ],
  },
  {
    id: "premium",
    title: "Adicionais especiais",
    freeUpTo: 0,
    max: 0,
    paid: true,
    items: [
      { id: "ninho", name: "Leite Ninho", priceCents: 400, recipe: [{ stockId: "ninho", qty: 0.02 }] },
      { id: "nutella", name: "Nutella", priceCents: 500 },
      { id: "ovomaltine", name: "Ovomaltine", priceCents: 400 },
      { id: "brigadeiro", name: "Brigadeiro", priceCents: 400 },
      { id: "kitkat", name: "KitKat", priceCents: 500 },
      { id: "chantilly", name: "Chantilly", priceCents: 300 },
    ],
  },
];
