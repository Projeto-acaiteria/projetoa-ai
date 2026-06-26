import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { resolveOrderItems } from "@/lib/menu-bar-store";
import { getOrCreateTableByNumber, getOrCreateOpenTab, addTabItems } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pedido PELA MESA (modelo bar, público via QR /[slug]/mesa/N). Resolve a loja pelo slug, abre/reusa
// a comanda da mesa e grava ROTEANDO por estação (cozinha/bar) — cai no KDS de cada estação.
// Preço/estação vêm do banco (server-authoritative), nunca do client.
export async function POST(req: Request) {
  let b: { slug?: string; tableNumber?: number; items?: { productId: string; qty: number; modifierIds?: string[] }[]; note?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const slug = (b.slug ?? "").trim().toLowerCase();
  const tableNumber = Number(b.tableNumber);
  const sel = Array.isArray(b.items) ? b.items : [];
  const note = (b.note ?? "").trim().slice(0, 200) || undefined;

  if (!slug) return NextResponse.json({ error: "loja não informada" }, { status: 400 });
  if (!Number.isInteger(tableNumber) || tableNumber < 1) return NextResponse.json({ error: "mesa inválida" }, { status: 400 });
  if (!sel.length) return NextResponse.json({ error: "pedido vazio" }, { status: 400 });

  const { data: loja } = await db().from("stores").select("id").eq("slug", slug).eq("active", true).maybeSingle();
  if (!loja) return NextResponse.json({ error: "loja não encontrada" }, { status: 404 });
  const storeId = (loja as { id: string }).id;

  try {
    const items = await resolveOrderItems(storeId, sel);
    if (!items.length) return NextResponse.json({ error: "itens indisponíveis" }, { status: 400 });

    const tableId = await getOrCreateTableByNumber(tableNumber, storeId);
    const tab = await getOrCreateOpenTab(tableId, `Mesa ${tableNumber}`, storeId);
    const orders = await addTabItems(
      tab.id,
      items.map((it) => ({ name: it.name, sizeLabel: it.sizeLabel, qty: it.qty, unitPriceCents: it.unitPriceCents, station: it.station, mods: it.mods, productId: it.productId, earnsPoints: it.earnsPoints })),
      storeId,
      note,
    );
    return NextResponse.json({ ok: true, stations: [...new Set(orders.map((o) => o.station))] });
  } catch (e) {
    console.error("mesa-pedido:", e);
    return NextResponse.json({ error: "Não consegui enviar o pedido. Tente de novo." }, { status: 500 });
  }
}
