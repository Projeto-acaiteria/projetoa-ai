import { NextResponse } from "next/server";
import { addItem, updateItem, type NewStockItem, type StockCategory, type StockItem } from "@/lib/stock-store";
import { todayBR } from "@/lib/date-br";
import { getCurrentStore, getCurrentRole } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/loja-produtos — gestão da VITRINE (site headless) do vertical SERVICE (Starteq).
// Endpoint DEDICADO (NÃO toca /api/estoque, compartilhada com food). Duas operações:
//   PATCH = editar um produto (toggle "no site" + o editor completo).
//   POST  = criar um produto novo (entra como rascunho: published=false).
// Blindado em 3 camadas em TODA operação:
//   1. autenticado (senão 401).
//   2. family==="service" → food (Cantinho/Medellín) recebe 403 e nunca chega ao banco.
//   3. role==="owner" → recepção/técnico não editam a vitrine.
//   storeId vem SEMPRE da SESSÃO (addItem/updateItem → resolveStoreId) — nunca do body → não vaza tenant.

// Categorias hardware permitidas na vitrine (as 15 do vertical AT). Barra categoria de food por URL.
const HW_CATS: StockCategory[] = [
  "computadores", "cpu", "cooler", "mobo", "ram", "gpu", "ssd",
  "gabinete", "fonte", "mouse", "teclado", "mousepad", "monitor", "headset", "cadeira",
];
const BADGES = ["", "Lançamento", "Mais Vendido", "Promo", "OpenBox"];

type Guard = { store: { id: string } } | { error: NextResponse };

async function guard(): Promise<Guard> {
  const store = await getCurrentStore();
  if (!store) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const cfg = await getStoreConfig(store.id);
  if (familyOf(cfg?.business_type) !== "service") {
    return { error: NextResponse.json({ error: "Indisponível neste tipo de loja" }, { status: 403 }) };
  }
  const role = await getCurrentRole();
  if (role !== "owner") {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { store };
}

const isStr = (v: unknown): v is string => typeof v === "string";
const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isSpecs = (v: unknown): v is Record<string, string | number | boolean | string[]> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isImages = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

// Constrói um patch SANITIZADO a partir de um objeto cru. Só passa campos editáveis da vitrine,
// com tipo validado. Devolve { error } se algum campo veio com tipo errado. Chaves desconhecidas são
// ignoradas em silêncio. Usado tanto pelo PATCH quanto pra montar o corpo do POST.
function buildPatch(raw: Record<string, unknown>): { patch: Partial<StockItem> } | { error: string } {
  const patch: Partial<StockItem> = {};

  if ("name" in raw) {
    if (!isStr(raw.name) || !raw.name.trim()) return { error: "name inválido" };
    patch.name = raw.name.trim();
  }
  if ("description" in raw && raw.description !== undefined) {
    if (!isStr(raw.description)) return { error: "description inválida" };
    patch.description = raw.description;
  }
  if ("sellPriceCents" in raw && raw.sellPriceCents !== undefined) {
    if (!isFiniteNum(raw.sellPriceCents) || raw.sellPriceCents < 0) return { error: "sellPriceCents inválido" };
    patch.sellPriceCents = Math.round(raw.sellPriceCents);
  }
  if ("qty" in raw && raw.qty !== undefined) {
    if (!isFiniteNum(raw.qty) || raw.qty < 0) return { error: "qty inválido" };
    patch.qty = raw.qty;
  }
  if ("category" in raw && raw.category !== undefined) {
    if (!isStr(raw.category) || !HW_CATS.includes(raw.category as StockCategory)) return { error: "category inválida" };
    patch.category = raw.category as StockCategory;
  }
  if ("brand" in raw && raw.brand !== undefined) {
    if (!isStr(raw.brand)) return { error: "brand inválida" };
    patch.brand = raw.brand.trim();
  }
  if ("specs" in raw && raw.specs !== undefined) {
    if (!isSpecs(raw.specs)) return { error: "specs inválidas" };
    patch.specs = raw.specs;
  }
  if ("image" in raw && raw.image !== undefined) {
    if (!isStr(raw.image)) return { error: "image inválida" };
    patch.image = raw.image;
  }
  if ("images" in raw && raw.images !== undefined) {
    if (!isImages(raw.images)) return { error: "images inválidas" };
    patch.images = raw.images;
    // capa = 1ª foto da galeria (o site lê `image`); mantém os dois em sincronia
    if (!("image" in raw)) patch.image = raw.images[0] ?? "";
  }
  if ("highlight" in raw && raw.highlight !== undefined) {
    if (typeof raw.highlight !== "boolean") return { error: "highlight inválido" };
    patch.highlight = raw.highlight;
  }
  if ("badge" in raw && raw.badge !== undefined) {
    if (!isStr(raw.badge) || !BADGES.includes(raw.badge)) return { error: "badge inválido" };
    patch.badge = raw.badge;
  }
  if ("published" in raw && raw.published !== undefined) {
    if (typeof raw.published !== "boolean") return { error: "published inválido" };
    patch.published = raw.published;
  }
  return { patch };
}

// PATCH — editar produto. Aceita { id, patch } (editor completo) OU { id, published } (toggle legado).
export async function PATCH(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = b.id;
  if (!isStr(id) || !id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  // corpo novo { id, patch } ou legado { id, published } (togle da lista)
  const raw = isSpecs(b.patch) ? (b.patch as Record<string, unknown>) : b;
  const built = buildPatch(raw);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });
  if (Object.keys(built.patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const item = await updateItem(id, built.patch, todayBR());
  if (!item) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

// POST — criar produto novo. Entra sempre como rascunho (published=false); o dono publica depois.
export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isStr(b.name) || !b.name.trim()) return NextResponse.json({ error: "name obrigatório" }, { status: 400 });
  if (!isStr(b.category) || !HW_CATS.includes(b.category as StockCategory)) {
    return NextResponse.json({ error: "category inválida" }, { status: 400 });
  }

  const built = buildPatch(b);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const input: NewStockItem = {
    name: built.patch.name!,
    category: built.patch.category!,
    qty: built.patch.qty ?? 0,
    unit: "un",
    minQty: 0,
    sellPriceCents: built.patch.sellPriceCents,
    brand: built.patch.brand,
    specs: built.patch.specs,
    description: built.patch.description,
    image: built.patch.image,
    images: built.patch.images,
    highlight: built.patch.highlight,
    badge: built.patch.badge,
    published: false, // rascunho — o dono publica pelo toggle depois
  };

  const item = await addItem(input, todayBR());
  return NextResponse.json({ ok: true, item });
}
