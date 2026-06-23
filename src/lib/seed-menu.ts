// Seed de cardápio inicial por SEGMENTO, rodado no cadastro. Só para os templates RELACIONAIS
// (bar/grid) — eles nascem vazios (menu_categories/menu_products sem fallback). O template acai
// já mostra um cardápio default (SIZES/GROUPS de menu.ts via readMenu), então não precisa seed.
// Objetivo: o dono nunca encara uma tela em branco — vê a estrutura pronta e edita por cima.
import { db } from "@/lib/supabase";
import type { BusinessType } from "@/config/segments";

type SeedProduct = { name: string; price_cents: number; size_label?: string | null };
type SeedCategory = { name: string; station: string; description?: string; produtos: SeedProduct[] };

// Cardápio-semente por segmento (poucos itens — é ponto de partida, não cardápio final).
const STARTERS: Partial<Record<BusinessType, SeedCategory[]>> = {
  marmitaria: [
    {
      name: "Marmitas", station: "cozinha", description: "Monte o tamanho da fome",
      produtos: [
        { name: "Marmita P", size_label: "pequena", price_cents: 1500 },
        { name: "Marmita M", size_label: "média", price_cents: 1800 },
        { name: "Marmita G", size_label: "grande", price_cents: 2200 },
      ],
    },
    {
      name: "Bebidas", station: "cozinha", description: "Pra acompanhar",
      produtos: [
        { name: "Refrigerante lata", size_label: "350ml", price_cents: 600 },
        { name: "Suco natural", size_label: "copo", price_cents: 800 },
        { name: "Água mineral", size_label: null, price_cents: 400 },
      ],
    },
  ],
  restaurante: [
    {
      name: "Pratos", station: "cozinha", description: "Os carros-chefe da casa",
      produtos: [
        { name: "Prato do dia", size_label: null, price_cents: 2500 },
        { name: "Filé com fritas", size_label: "individual", price_cents: 3900 },
        { name: "Risoto de frango", size_label: null, price_cents: 3200 },
      ],
    },
    {
      name: "Bebidas", station: "bar", description: "Geladas",
      produtos: [
        { name: "Refrigerante lata", size_label: "350ml", price_cents: 600 },
        { name: "Suco natural", size_label: "copo", price_cents: 800 },
        { name: "Água mineral", size_label: null, price_cents: 400 },
      ],
    },
  ],
  petiscaria: [
    {
      name: "Petiscos", station: "cozinha", description: "Pra dividir na mesa",
      produtos: [
        { name: "Batata frita", size_label: "porção", price_cents: 3000 },
        { name: "Calabresa acebolada", size_label: "porção", price_cents: 3500 },
        { name: "Frango a passarinho", size_label: "porção", price_cents: 3500 },
      ],
    },
    {
      name: "Bebidas", station: "bar", description: "Geladas, direto do balcão",
      produtos: [
        { name: "Cerveja long neck", size_label: "355ml", price_cents: 1000 },
        { name: "Refrigerante lata", size_label: "350ml", price_cents: 600 },
        { name: "Água mineral", size_label: null, price_cents: 400 },
      ],
    },
  ],
  bar: [
    {
      name: "Petiscos", station: "cozinha", description: "Pra acompanhar a gelada",
      produtos: [
        { name: "Batata frita", size_label: "porção", price_cents: 3000 },
        { name: "Calabresa acebolada", size_label: "porção", price_cents: 3500 },
        { name: "Frango a passarinho", size_label: "porção", price_cents: 3500 },
      ],
    },
    {
      name: "Bebidas", station: "bar", description: "Direto do balcão",
      produtos: [
        { name: "Cerveja long neck", size_label: "355ml", price_cents: 1000 },
        { name: "Chopp", size_label: "300ml", price_cents: 1200 },
        { name: "Caipirinha", size_label: "dose", price_cents: 1800 },
        { name: "Refrigerante lata", size_label: "350ml", price_cents: 600 },
      ],
    },
  ],
};

/** Popula o cardápio inicial do segmento (só bar/grid). No-op pra acai (já tem default) ou
 *  segmento sem starter. Não lança — o cadastro não pode quebrar se o seed falhar. */
export async function seedStarterMenu(storeId: string, seg: BusinessType): Promise<number> {
  const cats = STARTERS[seg];
  if (!cats?.length) return 0;
  const d = db();
  // idempotente: se já tem categoria, não duplica (ex: re-seed)
  const { data: existing } = await d.from("menu_categories").select("id").eq("store_id", storeId).limit(1);
  if (existing?.length) return 0;

  let total = 0;
  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i];
    const { data: c, error: catE } = await d
      .from("menu_categories")
      .insert({ store_id: storeId, name: cat.name, station: cat.station, description: cat.description ?? null, sort: i, active: true })
      .select("id")
      .single();
    if (catE || !c) continue;
    const rows = cat.produtos.map((p, j) => ({
      store_id: storeId, category_id: c.id, name: p.name, price_cents: p.price_cents,
      size_label: p.size_label ?? null, sort: j, active: true,
    }));
    const { error: pE } = await d.from("menu_products").insert(rows);
    if (!pE) total += rows.length;
  }
  return total;
}
