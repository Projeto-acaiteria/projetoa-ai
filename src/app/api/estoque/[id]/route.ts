import { NextResponse } from "next/server";
import { updateItem, moveStock, removeItem } from "@/lib/stock-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH: ou movimenta ({ move: 'entrada'|'saida', qty, reason }) ou edita campos.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);

  if (b.move === "entrada" || b.move === "saida") {
    const item = await moveStock(id, b.move, Number(b.qty) || 0, String(b.reason || ""), today);
    if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  }

  const patch: Record<string, unknown> = {};
  for (const k of ["name", "category", "unit", "minQty", "expiry", "qty", "sellPriceCents"]) {
    if (k in b) patch[k] = b[k];
  }
  const item = await updateItem(id, patch, today);
  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await removeItem(id);
  return NextResponse.json({ ok: true });
}
