import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { resolveOrderItems } from "@/lib/menu-bar-store";
import { addTabItems } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Operador lança item do MENU RELACIONAL (bar/grid) numa comanda de mesa. Preço/estação/mods/recipe
// resolvidos no SERVIDOR (resolveOrderItems) — não confia no client. Roteia por estação (cozinha/bar).
export async function POST(req: Request) {
  let b: { tabId?: number; items?: { productId: string; qty: number; modifierIds?: string[]; grams?: number }[]; note?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (typeof b.tabId !== "number" || !Number.isFinite(b.tabId)) {
    return NextResponse.json({ error: "tabId é obrigatório" }, { status: 400 });
  }
  const sel = Array.isArray(b.items) ? b.items : [];
  if (!sel.length) return NextResponse.json({ error: "Nenhum item." }, { status: 400 });

  try {
    const storeId = await resolveStoreId();
    const resolved = await resolveOrderItems(storeId, sel);
    if (!resolved.length) return NextResponse.json({ error: "Itens indisponíveis." }, { status: 400 });
    const orders = await addTabItems(
      b.tabId,
      resolved.map((it) => ({ productId: it.productId, name: it.name, sizeLabel: it.sizeLabel, qty: it.qty, unitPriceCents: it.unitPriceCents, station: it.station, mods: it.mods })),
      storeId,
      (b.note ?? "").trim().slice(0, 200) || undefined,
    );
    return NextResponse.json({ ok: true, stations: [...new Set(orders.map((o) => o.station))] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
