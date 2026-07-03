import { NextResponse } from "next/server";
import { updateItem, moveStock, removeItem, reweightCost } from "@/lib/stock-store";
import { todayBR } from "@/lib/date-br";

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
  const today = todayBR();

  if (b.move === "entrada" || b.move === "saida") {
    const qty = Number(b.qty) || 0;
    let item = await moveStock(id, b.move, qty, String(b.reason || ""), today);
    if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    if (b.move === "entrada") {
      // validade do lote que chegou (alimenta o alerta de vencimento)
      if (typeof b.expiry === "string" && b.expiry) item = (await updateItem(id, { expiry: b.expiry }, today)) ?? item;
      // custo médio ponderado: custo unitário desta compra recalcula o custo do CMV
      if (Number(b.costCents) > 0) item = (await reweightCost(id, item.qty, qty, Number(b.costCents), today)) ?? item;
    }
    return NextResponse.json({ ok: true, item });
  }

  const patch: Record<string, unknown> = {};
  for (const k of ["name", "category", "unit", "minQty", "expiry", "qty", "sellPriceCents", "costCents", "costPerBottleCents", "dosesPerBottle", "supplier", "purchaseUnit", "purchaseFactor"]) {
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
