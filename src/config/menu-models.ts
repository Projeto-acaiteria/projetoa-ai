// MOTOR DE CRIAÇÃO DE CARDÁPIO SEGMENTADO — os "cardápios-modelo" por nicho, destilados da pesquisa
// de campo (9 agentes + Ichiban/Medellín/Comanda10). O modal "Montar a partir do modelo" consome
// isto: mostra as categorias/produtos, o dono ajusta preço (sugestão de mercado — editável), desmarca
// o que não vende, e cria tudo em lote. Preços = mercado BR/Palmas-TO — REFERÊNCIA, o dono manda.
import type { PriceMode, Station } from "@/lib/menu-bar-store";
import type { BusinessType } from "@/config/segments";

export type ModelOption = { name: string; price_cents: number; tier_label?: string };
// FAIXA de preço nomeada (pizza: Tradicional/Especial/Premium). O dono renomeia, muda o preço da faixa
// uma vez, e os sabores herdam. Vira N opções do grupo (uma por sabor) com o preço da faixa.
export type ModelTier = { name: string; price_cents: number; flavors: string[] };
// Grupo de modificador do produto. `pick` = no modal o dono escolhe quais opções tem. `options` OU
// `tiers` (faixas). `editablePrice` = o dono ajusta o preço no modal (tamanho, faixa, produto simples).
export type ModelGroup = {
  title: string;
  min_select?: number;
  max_select?: number;
  free_up_to?: number;
  price_mode?: PriceMode;
  pick?: boolean;
  editablePrice?: boolean;
  options?: ModelOption[];
  tiers?: ModelTier[];
};
export type ModelProduct = {
  name: string;
  price_cents: number;
  size_label?: string;
  img_key?: string;
  img?: string; // URL escolhida pelo dono no montador (banco/upload); tem prioridade sobre img_key
  groups?: ModelGroup[];
};
export type ModelCategory = {
  name: string;
  station: Station;
  description?: string;
  no_prep?: boolean;
  img_key?: string;
  products: ModelProduct[];
};
export type MenuModel = { segment: BusinessType; label: string; categories: ModelCategory[] };

const R = (reais: number) => Math.round(reais * 100);

// ─────────────────────────────────────────────────────────────────────────────
// PIZZARIA
// ─────────────────────────────────────────────────────────────────────────────
const TAMANHO: ModelGroup = {
  title: "Tamanho", min_select: 1, max_select: 1, price_mode: "sum", editablePrice: true,
  options: [
    { name: "Broto (4 fatias)", price_cents: R(25) },
    { name: "Média (6 fatias)", price_cents: R(35) },
    { name: "Grande (8 fatias)", price_cents: R(45) },
    { name: "Família (12 fatias)", price_cents: R(58) },
  ],
};
// Sabores em FAIXAS (o preço é da faixa; highest = meio-a-meio paga a faixa mais cara).
const SABORES_SALGADOS: ModelGroup = {
  title: "Sabores (1, ou 2 = meio a meio)",
  min_select: 1, max_select: 2, price_mode: "highest", pick: true, editablePrice: true,
  tiers: [
    { name: "Tradicionais", price_cents: R(0), flavors: ["Mussarela", "Calabresa", "Marguerita", "Frango com Catupiry"] },
    { name: "Especiais", price_cents: R(7), flavors: ["Quatro Queijos", "Portuguesa", "À Moda da Casa", "Bacon com Cheddar"] },
    { name: "Premium", price_cents: R(25), flavors: ["Camarão com Catupiry", "Picanha com Catupiry"] },
  ],
};
const SABORES_DOCES: ModelGroup = {
  title: "Sabores doces (1, ou 2 = meio a meio)",
  min_select: 1, max_select: 2, price_mode: "highest", pick: true, editablePrice: true,
  tiers: [
    { name: "Doces", price_cents: R(0), flavors: ["Chocolate com Morango", "Banana com Canela", "Prestígio", "Romeu e Julieta"] },
  ],
};
const BORDA: ModelGroup = {
  title: "Borda recheada", min_select: 1, max_select: 1, price_mode: "sum", pick: true, editablePrice: true,
  options: [
    { name: "Sem borda", price_cents: R(0) },
    { name: "Catupiry", price_cents: R(8) },
    { name: "Cheddar", price_cents: R(8) },
    { name: "Chocolate", price_cents: R(9) },
  ],
};

const PIZZARIA: MenuModel = {
  segment: "pizzaria",
  label: "Pizzaria",
  categories: [
    {
      name: "Pizzas Salgadas", station: "cozinha", img_key: "pizza",
      description: "Escolha o tamanho e 1 sabor (ou 2, meio a meio — paga o mais caro).",
      products: [{ name: "Pizza Salgada", price_cents: R(0), img_key: "pizza", groups: [TAMANHO, SABORES_SALGADOS, BORDA] }],
    },
    {
      name: "Pizzas Doces", station: "cozinha", img_key: "pizza_doce",
      description: "Pra fechar — inteira ou meio a meio.",
      products: [{ name: "Pizza Doce", price_cents: R(0), img_key: "pizza_doce", groups: [TAMANHO, SABORES_DOCES, BORDA] }],
    },
    {
      name: "Esfihas", station: "cozinha", img_key: "esfiha", description: "Por unidade.",
      products: [
        { name: "Esfiha de Carne", price_cents: R(5.5), size_label: "unidade", img_key: "esfiha" },
        { name: "Esfiha de Frango com Catupiry", price_cents: R(6), size_label: "unidade", img_key: "esfiha" },
        { name: "Esfiha de Queijo", price_cents: R(5), size_label: "unidade", img_key: "esfiha" },
        { name: "Esfiha Doce (chocolate)", price_cents: R(5.5), size_label: "unidade", img_key: "esfiha" },
      ],
    },
    {
      name: "Bebidas", station: "bar", no_prep: true, img_key: "refrigerante",
      products: [
        { name: "Refrigerante lata", price_cents: R(6), size_label: "350ml", img_key: "refrigerante" },
        { name: "Refrigerante 2L", price_cents: R(15), size_label: "2L", img_key: "refrigerante" },
        { name: "Suco natural", price_cents: R(11), size_label: "copo", img_key: "suco" },
        { name: "Água mineral", price_cents: R(4), size_label: "500ml", img_key: "agua" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
export const MENU_MODELS: Partial<Record<BusinessType, MenuModel>> = {
  pizzaria: PIZZARIA,
};

export const getMenuModel = (seg: BusinessType): MenuModel | null => MENU_MODELS[seg] ?? null;

// Expande as FAIXAS de um grupo em opções concretas (sabor herda o preço da faixa). Grupos sem
// tiers passam direto. Usado antes de gravar (applyMenuModel) — o banco só conhece opções.
export function flattenGroupOptions(g: ModelGroup): ModelOption[] {
  if (g.tiers?.length) return g.tiers.flatMap((t) => t.flavors.map((name) => ({ name, price_cents: t.price_cents, tier_label: t.name })));
  return g.options ?? [];
}
