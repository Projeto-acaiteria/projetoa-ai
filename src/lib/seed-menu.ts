// Seed de cardápio inicial por SEGMENTO, rodado no cadastro. Só para os templates RELACIONAIS
// (bar/grid) — eles nascem vazios (menu_categories/menu_products sem fallback). O template acai
// já mostra um cardápio default (SIZES/GROUPS de menu.ts via readMenu), então não precisa seed.
// Objetivo: o dono nunca encara uma tela em branco — vê a estrutura pronta e edita por cima.
import { db } from "@/lib/supabase";
import type { BusinessType } from "@/config/segments";

type SeedProduct = { name: string; price_cents: number; size_label?: string | null };
type SeedOption = { name: string; price_cents: number };
// Grupo de modificador aplicado a TODOS os produtos da categoria (turnkey por nicho).
// single=escolha 1 · required=obrigatório · price_mode sum(adicionais)/highest(meio-a-meio)/average.
// single=escolha 1 (max 1) · max=teto explícito (ex: meio-a-meio = max 2) · required=min 1
type SeedGroup = { title: string; required?: boolean; single?: boolean; max?: number; price_mode?: "sum" | "highest" | "average"; free_up_to?: number; options: SeedOption[] };
type SeedCategory = { name: string; station: string; description?: string; groups?: SeedGroup[]; produtos: SeedProduct[] };

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
  // Pizza = MODELO B (builder real, ref. Dom João/pedido.app): 1 produto-base R$0 + grupo "Sabores"
  // (min 1, máx 2, price_mode "highest" = meio-a-meio PAGA A MAIS CARA, confirmado ao vivo). Inteira
  // = 1 sabor. Sabores em 3 faixas (45/50/55). Borda opcional (a ref não usa, mas o schema cobre).
  pizzaria: [
    {
      name: "Pizzas", station: "cozinha", description: "Monte: 1 sabor (inteira) ou 2 (meio a meio) — paga a mais cara",
      groups: [
        { title: "Sabores (escolha 1 ou 2 — meio a meio)", required: true, max: 2, price_mode: "highest", options: [
          { name: "Mussarela", price_cents: 4500 },
          { name: "Calabresa", price_cents: 4500 },
          { name: "Marguerita", price_cents: 4500 },
          { name: "Bacon Crocante", price_cents: 4500 },
          { name: "Frango com Catupiry", price_cents: 5000 },
          { name: "Quatro Queijos", price_cents: 5000 },
          { name: "Portuguesa", price_cents: 5500 },
          { name: "A Moda da Casa", price_cents: 5500 },
        ] },
        { title: "Borda recheada", single: true, price_mode: "sum", options: [
          { name: "Sem borda", price_cents: 0 }, { name: "Catupiry", price_cents: 800 }, { name: "Cheddar", price_cents: 800 },
        ] },
      ],
      produtos: [
        { name: "Pizza Grande (8 fatias)", size_label: "8 fatias", price_cents: 0 },
      ],
    },
    {
      name: "Bebidas", station: "cozinha", description: "Geladas",
      produtos: [
        { name: "Refrigerante lata", size_label: "350ml", price_cents: 600 },
        { name: "Refrigerante 2L", size_label: "2L", price_cents: 1200 },
        { name: "Suco natural", size_label: "copo", price_cents: 1100 },
        { name: "Água mineral", size_label: null, price_cents: 500 },
      ],
    },
  ],
  // Sushi = catálogo PLANO (item → preço + porção). Sem engine de modificador: extras (hashi,
  // shoyu…) são ITENS avulsos em "Porções Extra", e variação "Sem Arroz" é SKU separado.
  // Anatomia baseada em cardápio real (Ichiban) — ponto de partida, o dono edita/expande.
  sushi: [
    {
      name: "Combinados", station: "cozinha", description: "Composição fixa, pra dividir",
      produtos: [
        { name: "Combinado 17 peças", size_label: "17 peças", price_cents: 5100 },
        { name: "Combinado 30 peças", size_label: "30 peças", price_cents: 9000 },
        { name: "Combinado 52 peças", size_label: "52 peças", price_cents: 15000 },
      ],
    },
    {
      name: "Temaki", station: "cozinha", description: "Cone de alga (200g)",
      produtos: [
        { name: "Temaki Salmão", size_label: "200g", price_cents: 3000 },
        { name: "Temaki Salmão Sem Arroz", size_label: "200g", price_cents: 3000 },
        { name: "Temaki Hot", size_label: "200g", price_cents: 3500 },
        { name: "Temaki Califórnia", size_label: "200g", price_cents: 2800 },
      ],
    },
    {
      name: "Hossomaki", station: "cozinha", description: "Enrolado fino — porção",
      produtos: [
        { name: "Sakemaki (salmão)", size_label: "10 peças", price_cents: 4000 },
        { name: "Pepino", size_label: "10 peças", price_cents: 2200 },
      ],
    },
    {
      name: "Uramaki", station: "cozinha", description: "Enrolado invertido — porção",
      produtos: [
        { name: "Califórnia", size_label: "10 peças", price_cents: 3500 },
        { name: "Salmão", size_label: "10 peças", price_cents: 3800 },
        { name: "Ebiten (camarão)", size_label: "10 peças", price_cents: 4000 },
      ],
    },
    {
      name: "Niguiri", station: "cozinha", description: "Bolinho de arroz coberto — porção",
      produtos: [
        { name: "Niguiri Salmão", size_label: "5 peças", price_cents: 2500 },
        { name: "Niguiri Tilápia", size_label: "5 peças", price_cents: 2000 },
      ],
    },
    {
      name: "Sashimi", station: "cozinha", description: "Fatias do peixe — porção",
      produtos: [
        { name: "Sashimi Salmão", size_label: "10 fatias", price_cents: 4500 },
        { name: "Sashimi Tilápia", size_label: "5 fatias", price_cents: 2800 },
      ],
    },
    {
      name: "Hot", station: "cozinha", description: "Empanado e frito (inclui doces)",
      produtos: [
        { name: "Hot Roll", size_label: "8 peças", price_cents: 2500 },
        { name: "Hot Philadelphia", size_label: "8 peças", price_cents: 2800 },
        { name: "Hot Doce de Banana", size_label: "sobremesa", price_cents: 2000 },
      ],
    },
    {
      name: "Entradas", station: "cozinha", description: "Quentes e frias",
      produtos: [
        { name: "Gyoza", size_label: "6 un", price_cents: 2200 },
        { name: "Sunomono", size_label: null, price_cents: 1800 },
        { name: "Ceviche de Salmão", size_label: null, price_cents: 3500 },
      ],
    },
    {
      name: "Bebidas", station: "cozinha", description: "Geladas",
      produtos: [
        { name: "Refrigerante lata", size_label: "350ml", price_cents: 600 },
        { name: "Chá gelado", size_label: "copo", price_cents: 800 },
        { name: "Água mineral", size_label: null, price_cents: 500 },
      ],
    },
    {
      name: "Porções Extra", station: "cozinha", description: "Hashi, molhos e adicionais avulsos",
      produtos: [
        { name: "Hashi (par)", size_label: null, price_cents: 100 },
        { name: "Shoyu", size_label: null, price_cents: 500 },
        { name: "Gengibre", size_label: null, price_cents: 500 },
        { name: "Wasabi", size_label: null, price_cents: 500 },
        { name: "Cream Cheese", size_label: null, price_cents: 500 },
        { name: "Tarê", size_label: null, price_cents: 800 },
      ],
    },
  ],
  hamburgueria: [
    {
      name: "Hambúrgueres", station: "cozinha", description: "Artesanais",
      groups: [
        { title: "Ponto da carne", required: true, single: true, options: [
          { name: "Mal passado", price_cents: 0 }, { name: "Ao ponto", price_cents: 0 }, { name: "Bem passado", price_cents: 0 },
        ] },
        { title: "Adicionais", price_mode: "sum", options: [
          { name: "Bacon", price_cents: 500 }, { name: "Cheddar", price_cents: 400 }, { name: "Ovo", price_cents: 300 }, { name: "Salada extra", price_cents: 200 },
        ] },
      ],
      produtos: [
        { name: "X-Burger", size_label: null, price_cents: 2200 },
        { name: "X-Salada", size_label: null, price_cents: 2500 },
        { name: "X-Bacon", size_label: null, price_cents: 2900 },
        { name: "X-Tudo", size_label: null, price_cents: 3500 },
      ],
    },
    {
      name: "Combos", station: "cozinha", description: "Lanche + fritas + bebida",
      produtos: [
        { name: "Combo X-Burger", size_label: null, price_cents: 3200 },
        { name: "Combo X-Bacon", size_label: null, price_cents: 3900 },
      ],
    },
    {
      name: "Acompanhamentos", station: "cozinha", description: "Pra dividir",
      produtos: [
        { name: "Batata frita", size_label: "porção", price_cents: 1800 },
        { name: "Batata com cheddar e bacon", size_label: "porção", price_cents: 2600 },
      ],
    },
    {
      name: "Bebidas", station: "cozinha", description: "Geladas",
      produtos: [
        { name: "Refrigerante lata", size_label: "350ml", price_cents: 600 },
        { name: "Milkshake", size_label: "400ml", price_cents: 1600 },
        { name: "Suco", size_label: "copo", price_cents: 800 },
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
    const { data: prods, error: pE } = await d.from("menu_products").insert(rows).select("id");
    if (pE || !prods) continue;
    total += prods.length;
    // Modificadores turnkey: cada grupo da categoria é criado pra CADA produto dela.
    if (cat.groups?.length) {
      for (const prod of prods) {
        for (let gi = 0; gi < cat.groups.length; gi++) {
          const g = cat.groups[gi];
          const { data: grp } = await d.from("menu_modifier_groups").insert({
            store_id: storeId, product_id: (prod as { id: string }).id, title: g.title,
            min_select: g.required ? 1 : 0, max_select: g.max ?? (g.single ? 1 : 0),
            free_up_to: g.free_up_to ?? 0, price_mode: g.price_mode ?? "sum", sort: gi,
          }).select("id").single();
          if (!grp) continue;
          const modRows = g.options.map((o, oi) => ({ store_id: storeId, group_id: (grp as { id: string }).id, name: o.name, price_cents: o.price_cents, sort: oi, active: true }));
          await d.from("menu_modifiers").insert(modRows);
        }
      }
    }
  }
  return total;
}
