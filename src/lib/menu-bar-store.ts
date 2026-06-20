// Store do cardápio modelo BAR (categoria → produto, espelha o Medellín). Server-side, Supabase
// via db(), multi-tenant por store_id. Tabelas relacionais menu_categories + menu_products
// (migration mt-10). station mora na CATEGORIA e roteia cozinha/bar/copa (herda pro item).
// Valores em CENTAVOS. Convive com o modelo açaí (menu-store/blob); menu_template decide qual a loja usa.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

const num = (v: unknown) => Number(v ?? 0);

// ── Tipos ──────────────────────────────────────────────────────────────────
export type Station = string; // 'cozinha' | 'bar' | 'copa' ... (aberto por segmento)

export type Modifier = {
  id: string;
  group_id: string;
  name: string;
  price_cents: number;
  sort: number;
  active: boolean;
};

export type PriceMode = "sum" | "highest" | "average"; // sum=adicionais · highest=pizza meio-a-meio · average
export type ModifierGroup = {
  id: string;
  product_id: string;
  title: string;
  min_select: number; // 0 = opcional · >=1 = obrigatório
  max_select: number; // 0 = ilimitado
  free_up_to: number; // N primeiros grátis
  price_mode: PriceMode;
  sort: number;
  modifiers: Modifier[];
};

// Ficha técnica: insumo do estoque consumido por unidade vendida (baixa automática + CMV)
export type RecipeLine = { stockId: string; qty: number };

export type BarProduct = {
  id: string;
  category_id: string;
  name: string;
  price_cents: number; // preço fixo OU, se by_weight, preço por KG
  size_label: string | null;
  img: string | null;
  sort: number;
  active: boolean;
  by_weight: boolean; // vendido por peso (marmita/a quilo): price_cents = R$/kg
  tare_grams: number; // tara (g) descontada do peso bruto
  recipe: RecipeLine[]; // ficha técnica (baixa automática de estoque na venda)
  groups: ModifierGroup[]; // personalização (adicionais, ponto, remover, meio-a-meio...)
};

function toRecipe(v: unknown): RecipeLine[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r) => ({ stockId: String((r as RecipeLine)?.stockId ?? ""), qty: num((r as RecipeLine)?.qty) }))
    .filter((r) => r.stockId && r.qty > 0);
}

export type BarCategory = {
  id: string;
  name: string;
  station: Station;
  description: string | null;
  img: string | null;
  sort: number;
  active: boolean;
  products: BarProduct[];
};

const toProduct = (r: Record<string, unknown>): BarProduct => ({
  id: String(r.id),
  category_id: String(r.category_id),
  name: String(r.name ?? ""),
  price_cents: num(r.price_cents),
  size_label: (r.size_label as string) ?? null,
  img: (r.img as string) ?? null,
  sort: num(r.sort),
  active: Boolean(r.active),
  by_weight: Boolean(r.by_weight),
  tare_grams: num(r.tare_grams),
  recipe: toRecipe(r.recipe),
  groups: [],
});

const toCategory = (r: Record<string, unknown>, products: BarProduct[]): BarCategory => ({
  id: String(r.id),
  name: String(r.name ?? ""),
  station: String(r.station ?? "cozinha"),
  description: (r.description as string) ?? null,
  img: (r.img as string) ?? null,
  sort: num(r.sort),
  active: Boolean(r.active),
  products,
});

const toModifier = (r: Record<string, unknown>): Modifier => ({
  id: String(r.id),
  group_id: String(r.group_id),
  name: String(r.name ?? ""),
  price_cents: num(r.price_cents),
  sort: num(r.sort),
  active: Boolean(r.active),
});

const toGroup = (r: Record<string, unknown>, modifiers: Modifier[]): ModifierGroup => ({
  id: String(r.id),
  product_id: String(r.product_id),
  title: String(r.title ?? ""),
  min_select: num(r.min_select),
  max_select: num(r.max_select),
  free_up_to: num(r.free_up_to),
  price_mode: (["sum", "highest", "average"].includes(String(r.price_mode)) ? String(r.price_mode) : "sum") as PriceMode,
  sort: num(r.sort),
  modifiers,
});

// ── Leitura ──────────────────────────────────────────────────────────────────
/** Cardápio completo da loja, categorias com produtos aninhados, ordenados por sort.
 *  includeInactive=true (editor admin) traz escondidos; default false (cardápio público). */
export async function readBarMenu(storeId?: string, includeInactive = false): Promise<BarCategory[]> {
  const sid = storeId ?? (await resolveStoreId());
  const d = db();

  let catQ = d.from("menu_categories").select("*").eq("store_id", sid);
  let prodQ = d.from("menu_products").select("*").eq("store_id", sid);
  let modQ = d.from("menu_modifiers").select("*").eq("store_id", sid);
  if (!includeInactive) {
    catQ = catQ.eq("active", true);
    prodQ = prodQ.eq("active", true);
    modQ = modQ.eq("active", true);
  }
  const [{ data: cats }, { data: prods }, { data: groups }, { data: mods }] = await Promise.all([
    catQ.order("sort"),
    prodQ.order("sort"),
    d.from("menu_modifier_groups").select("*").eq("store_id", sid).order("sort"),
    modQ.order("sort"),
  ]);

  // modifiers por grupo → grupos por produto
  const modsByGroup = new Map<string, Modifier[]>();
  for (const r of (mods ?? []) as Record<string, unknown>[]) {
    const m = toModifier(r);
    (modsByGroup.get(m.group_id) ?? modsByGroup.set(m.group_id, []).get(m.group_id)!).push(m);
  }
  const groupsByProduct = new Map<string, ModifierGroup[]>();
  for (const r of (groups ?? []) as Record<string, unknown>[]) {
    const g = toGroup(r, modsByGroup.get(String(r.id)) ?? []);
    (groupsByProduct.get(g.product_id) ?? groupsByProduct.set(g.product_id, []).get(g.product_id)!).push(g);
  }

  const byCat = new Map<string, BarProduct[]>();
  for (const r of (prods ?? []) as Record<string, unknown>[]) {
    const p = toProduct(r);
    p.groups = groupsByProduct.get(p.id) ?? [];
    const arr = byCat.get(p.category_id) ?? [];
    arr.push(p);
    byCat.set(p.category_id, arr);
  }
  return ((cats ?? []) as Record<string, unknown>[]).map((c) =>
    toCategory(c, byCat.get(String(c.id)) ?? [])
  );
}

/** Resolve itens de um pedido a partir de {productId, qty} — preço, nome, size_label e ESTAÇÃO
 *  vêm do BANCO (nunca do client). station = da categoria do produto. Ignora produto inativo. */
export type ResolvedMod = { name: string; price_cents: number };
export type ResolvedItem = { productId: string; name: string; sizeLabel: string | null; qty: number; unitPriceCents: number; station: string; mods: ResolvedMod[] | null; recipe: RecipeLine[] };

export async function resolveOrderItems(
  storeId: string,
  sel: { productId: string; qty: number; modifierIds?: string[]; grams?: number }[],
): Promise<ResolvedItem[]> {
  const ids = sel.map((s) => s.productId).filter(Boolean);
  if (!ids.length) return [];
  const d = db();
  const [{ data: prods }, { data: cats }, { data: mods }, { data: groups }] = await Promise.all([
    d.from("menu_products").select("id, name, size_label, price_cents, category_id, recipe, by_weight, tare_grams").eq("store_id", storeId).eq("active", true).in("id", ids),
    d.from("menu_categories").select("id, station").eq("store_id", storeId),
    d.from("menu_modifiers").select("id, group_id, name, price_cents").eq("store_id", storeId).eq("active", true),
    d.from("menu_modifier_groups").select("id, free_up_to, price_mode").eq("store_id", storeId),
  ]);
  const stationByCat = new Map(((cats ?? []) as { id: string; station: string }[]).map((c) => [String(c.id), String(c.station)]));
  const pById = new Map(((prods ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p]));
  const modById = new Map(((mods ?? []) as Record<string, unknown>[]).map((m) => [String(m.id), m]));
  const cfgByGroup = new Map(((groups ?? []) as { id: string; free_up_to: number; price_mode: string }[]).map((g) => [String(g.id), { free: num(g.free_up_to), mode: String(g.price_mode || "sum") }]));

  const out: ResolvedItem[] = [];
  for (const s of sel) {
    const p = pById.get(s.productId);
    if (!p) continue;
    const qty = Math.max(1, Math.round(Number(s.qty) || 0));

    // modificadores escolhidos resolvidos no SERVIDOR (preço nunca vem do client). free_up_to por grupo.
    const chosen = (s.modifierIds ?? []).map((id) => modById.get(id)).filter(Boolean) as Record<string, unknown>[];
    const byGroup = new Map<string, Record<string, unknown>[]>();
    for (const m of chosen) {
      const g = String(m.group_id);
      (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(m);
    }
    let modsTotal = 0;
    const modsOut: ResolvedMod[] = [];
    for (const [gid, list] of byGroup) {
      const cfg = cfgByGroup.get(gid) ?? { free: 0, mode: "sum" };
      if (cfg.mode === "highest") {
        // pizza meio-a-meio: paga só o sabor mais caro; os outros aparecem com 0 (espelham no KDS)
        const maxP = Math.max(0, ...list.map((m) => num(m.price_cents)));
        let cobrou = false;
        for (const m of list) {
          const charged = !cobrou && num(m.price_cents) === maxP ? maxP : 0;
          if (charged) cobrou = true;
          modsTotal += charged;
          modsOut.push({ name: String(m.name), price_cents: charged });
        }
      } else if (cfg.mode === "average") {
        const sum = list.reduce((s, m) => s + num(m.price_cents), 0);
        const avg = list.length ? Math.round(sum / list.length) : 0;
        modsTotal += avg;
        list.forEach((m, i) => modsOut.push({ name: String(m.name), price_cents: i === 0 ? avg : 0 }));
      } else {
        list.forEach((m, idx) => {
          const charged = idx < cfg.free ? 0 : num(m.price_cents); // os 'free' primeiros não somam
          modsTotal += charged;
          modsOut.push({ name: String(m.name), price_cents: charged });
        });
      }
    }

    // por peso (marmita/a quilo): preço-base = (peso bruto - tara)/1000 × R$/kg (price_cents). Senão, preço fixo.
    let baseCents = num(p.price_cents);
    let sizeLabel = (p.size_label as string) ?? null;
    if (p.by_weight) {
      const bruto = Math.max(0, Math.round(Number(s.grams) || 0));
      const liquido = Math.max(0, bruto - num(p.tare_grams));
      // sem peso válido (ausente/menor que a tara) NÃO entra — senão o item sai de graça (P0)
      if (liquido <= 0) continue;
      baseCents = Math.round((liquido / 1000) * num(p.price_cents));
      sizeLabel = `${liquido}g`;
    }

    out.push({
      productId: String(p.id),
      name: String(p.name),
      sizeLabel,
      qty,
      unitPriceCents: baseCents + modsTotal,
      station: stationByCat.get(String(p.category_id)) ?? "cozinha",
      mods: modsOut.length ? modsOut : null,
      recipe: toRecipe(p.recipe),
    });
  }
  return out;
}

/** Estações distintas usadas pelas categorias da loja (pro KDS/impressão). Default ['cozinha']. */
export async function getStations(storeId?: string): Promise<string[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("menu_categories").select("station").eq("store_id", sid).eq("active", true);
  const set = new Set(((data ?? []) as { station: string }[]).map((r) => String(r.station)));
  return set.size ? [...set] : ["cozinha"];
}

// ── Categorias (CRUD admin) ───────────────────────────────────────────────────
export type CategoryInput = {
  name: string;
  station?: Station;
  description?: string | null;
  img?: string | null;
  sort?: number;
  active?: boolean;
};

export async function createCategory(input: CategoryInput, storeId?: string): Promise<BarCategory> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db()
    .from("menu_categories")
    .insert({
      store_id: sid,
      name: input.name.trim(),
      station: input.station ?? "cozinha",
      description: input.description ?? null,
      img: input.img ?? null,
      sort: input.sort ?? 0,
      active: input.active ?? true,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar categoria.");
  return toCategory(data, []);
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("menu_categories").update(patch).eq("id", id).eq("store_id", sid);
}

export async function deleteCategory(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  // produtos caem por ON DELETE CASCADE (FK category_id).
  await db().from("menu_categories").delete().eq("id", id).eq("store_id", sid);
}

// ── Produtos (CRUD admin) ─────────────────────────────────────────────────────
export type ProductInput = {
  category_id: string;
  name: string;
  price_cents: number;
  size_label?: string | null;
  img?: string | null;
  sort?: number;
  active?: boolean;
  by_weight?: boolean; // vendido por peso (R$/kg)
  tare_grams?: number;
  recipe?: RecipeLine[]; // ficha técnica (baixa automática)
};

export async function createProduct(input: ProductInput, storeId?: string): Promise<BarProduct> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db()
    .from("menu_products")
    .insert({
      store_id: sid,
      category_id: input.category_id,
      name: input.name.trim(),
      price_cents: Math.max(0, Math.round(input.price_cents)),
      size_label: input.size_label ?? null,
      img: input.img ?? null,
      sort: input.sort ?? 0,
      active: input.active ?? true,
      by_weight: input.by_weight ?? false,
      tare_grams: Math.max(0, Math.round(input.tare_grams ?? 0)),
      recipe: toRecipe(input.recipe),
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar produto.");
  return toProduct(data);
}

export async function updateProduct(id: string, patch: Partial<ProductInput>, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const clean = "recipe" in patch ? { ...patch, recipe: toRecipe(patch.recipe) } : patch;
  await db().from("menu_products").update(clean).eq("id", id).eq("store_id", sid);
}

export async function deleteProduct(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("menu_products").delete().eq("id", id).eq("store_id", sid);
}

// ── Modificadores: grupos + opções (CRUD admin) ──────────────────────────────
export type GroupInput = { product_id: string; title: string; min_select?: number; max_select?: number; free_up_to?: number; price_mode?: PriceMode; sort?: number };
export async function createGroup(input: GroupInput, storeId?: string): Promise<ModifierGroup> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("menu_modifier_groups").insert({
    store_id: sid, product_id: input.product_id, title: input.title.trim(),
    min_select: input.min_select ?? 0, max_select: input.max_select ?? 0, free_up_to: input.free_up_to ?? 0, price_mode: input.price_mode ?? "sum", sort: input.sort ?? 0,
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar grupo.");
  return toGroup(data, []);
}
export async function updateGroup(id: string, patch: Partial<GroupInput>, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("menu_modifier_groups").update(patch).eq("id", id).eq("store_id", sid);
}
export async function deleteGroup(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("menu_modifier_groups").delete().eq("id", id).eq("store_id", sid);
}

export type ModifierInput = { group_id: string; name: string; price_cents?: number; sort?: number; active?: boolean };
export async function createModifier(input: ModifierInput, storeId?: string): Promise<Modifier> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("menu_modifiers").insert({
    store_id: sid, group_id: input.group_id, name: input.name.trim(),
    price_cents: Math.max(0, Math.round(input.price_cents ?? 0)), sort: input.sort ?? 0, active: input.active ?? true,
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar opção.");
  return toModifier(data);
}
export async function updateModifier(id: string, patch: Partial<ModifierInput>, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("menu_modifiers").update(patch).eq("id", id).eq("store_id", sid);
}
export async function deleteModifier(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("menu_modifiers").delete().eq("id", id).eq("store_id", sid);
}
