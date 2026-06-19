import { NextResponse } from "next/server";
import { readMenu, writeMenu, type Menu } from "@/lib/menu-store";
import type { Size, ModifierGroup } from "@/lib/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const menu = await readMenu();
  return NextResponse.json(menu);
}

export async function PUT(req: Request) {
  let body: Menu;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!Array.isArray(body.sizes) || !Array.isArray(body.groups)) {
    return NextResponse.json({ error: "Cardápio incompleto" }, { status: 400 });
  }
  // saneamento mínimo
  const cleanRecipe = (r: unknown) =>
    Array.isArray(r)
      ? r
          .map((x) => ({ stockId: String((x as { stockId?: string }).stockId || ""), qty: Math.max(0, Number((x as { qty?: number }).qty) || 0) }))
          .filter((x) => x.stockId && x.qty > 0)
      : undefined;

  const sizes: Size[] = body.sizes.map((s, i) => ({
    id: s.id || `s${Date.now()}${i}`,
    label: String(s.label || "Tamanho").slice(0, 40),
    ml: Math.max(0, Math.round(Number(s.ml) || 0)),
    priceCents: Math.max(0, Math.round(Number(s.priceCents) || 0)),
    img: s.img || "/menu/copo-500.jpg",
    recipe: cleanRecipe(s.recipe),
  }));
  const groups: ModifierGroup[] = body.groups.map((g, i) => ({
    id: g.id || `g${Date.now()}${i}`,
    title: String(g.title || "Grupo").slice(0, 40),
    freeUpTo: Math.max(0, Math.round(Number(g.freeUpTo) || 0)),
    max: Math.max(0, Math.round(Number(g.max) || 0)),
    paid: Boolean(g.paid),
    items: (g.items || []).map((it, j) => ({
      id: it.id || `i${Date.now()}${i}${j}`,
      name: String(it.name || "Item").slice(0, 40),
      priceCents: Math.max(0, Math.round(Number(it.priceCents) || 0)),
      recipe: cleanRecipe(it.recipe),
    })),
  }));

  const saved = await writeMenu({ sizes, groups });
  return NextResponse.json({ ok: true, menu: saved });
}
