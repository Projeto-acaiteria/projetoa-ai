import { NextResponse } from "next/server";
import { inventoryDiff, adjustToCount } from "@/lib/stock-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Conferência de estoque (inventário). POST { counts: {id: realQty}, apply?: boolean }.
// Sem apply → só a FOTO do desvio (teórico×real×valor). Com apply → seta cada item ao real
// e loga "Ajuste inventário" (sobra=entrada, falta=saída), retornando o desvio aplicado.
export async function POST(req: Request) {
  let b: { counts?: Record<string, number>; apply?: boolean };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const counts = b.counts && typeof b.counts === "object" ? b.counts : {};
  if (!Object.keys(counts).length) return NextResponse.json({ error: "Sem contagem" }, { status: 400 });

  const diff = await inventoryDiff(counts);

  if (b.apply) {
    const today = new Date().toISOString().slice(0, 10);
    for (const line of diff.lines) {
      if (line.deltaQty !== 0) await adjustToCount(line.id, line.realQty, today);
    }
  }
  return NextResponse.json({ ok: true, applied: !!b.apply, diff });
}
