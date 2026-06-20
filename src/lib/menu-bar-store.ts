// Store do cardápio modelo BAR (categoria → produto, espelha o Medellín). Server-side, Supabase
// via db(), multi-tenant por store_id. Tabelas relacionais menu_categories + menu_products
// (migration mt-10). station mora na CATEGORIA e roteia cozinha/bar/copa (herda pro item).
// Valores em CENTAVOS. Convive com o modelo açaí (menu-store/blob); menu_template decide qual a loja usa.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

const num = (v: unknown) => Number(v ?? 0);

// ── Tipos ──────────────────────────────────────────────────────────────────
export type Station = string; // 'cozinha' | 'bar' | 'copa' ... (aberto por segmento)

export type BarProduct = {
  id: string;
  category_id: string;
  name: string;
  price_cents: number;
  size_label: string | null;
  img: string | null;
  sort: number;
  active: boolean;
};

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

// ── Leitura ──────────────────────────────────────────────────────────────────
/** Cardápio completo da loja, categorias com produtos aninhados, ordenados por sort.
 *  includeInactive=true (editor admin) traz escondidos; default false (cardápio público). */
export async function readBarMenu(storeId?: string, includeInactive = false): Promise<BarCategory[]> {
  const sid = storeId ?? (await resolveStoreId());
  const d = db();

  let catQ = d.from("menu_categories").select("*").eq("store_id", sid);
  let prodQ = d.from("menu_products").select("*").eq("store_id", sid);
  if (!includeInactive) {
    catQ = catQ.eq("active", true);
    prodQ = prodQ.eq("active", true);
  }
  const [{ data: cats }, { data: prods }] = await Promise.all([
    catQ.order("sort"),
    prodQ.order("sort"),
  ]);

  const byCat = new Map<string, BarProduct[]>();
  for (const r of (prods ?? []) as Record<string, unknown>[]) {
    const p = toProduct(r);
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
export async function resolveOrderItems(
  storeId: string,
  sel: { productId: string; qty: number }[],
): Promise<{ name: string; sizeLabel: string | null; qty: number; unitPriceCents: number; station: string }[]> {
  const ids = sel.map((s) => s.productId).filter(Boolean);
  if (!ids.length) return [];
  const d = db();
  const [{ data: prods }, { data: cats }] = await Promise.all([
    d.from("menu_products").select("id, name, size_label, price_cents, category_id").eq("store_id", storeId).eq("active", true).in("id", ids),
    d.from("menu_categories").select("id, station").eq("store_id", storeId),
  ]);
  const stationByCat = new Map(((cats ?? []) as { id: string; station: string }[]).map((c) => [String(c.id), String(c.station)]));
  const pById = new Map(((prods ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p]));
  const out: { name: string; sizeLabel: string | null; qty: number; unitPriceCents: number; station: string }[] = [];
  for (const s of sel) {
    const p = pById.get(s.productId);
    if (!p) continue;
    const qty = Math.max(1, Math.round(Number(s.qty) || 0));
    out.push({
      name: String(p.name),
      sizeLabel: (p.size_label as string) ?? null,
      qty,
      unitPriceCents: num(p.price_cents),
      station: stationByCat.get(String(p.category_id)) ?? "cozinha",
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
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar produto.");
  return toProduct(data);
}

export async function updateProduct(id: string, patch: Partial<ProductInput>, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("menu_products").update(patch).eq("id", id).eq("store_id", sid);
}

export async function deleteProduct(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("menu_products").delete().eq("id", id).eq("store_id", sid);
}
