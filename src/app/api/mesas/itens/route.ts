import { NextResponse } from "next/server";
import { addTabItems, type NewTabItem } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/itens — lança itens numa comanda
export async function POST(req: Request) {
  let b: { tabId?: number; items?: NewTabItem[] };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof b.tabId !== "number" || !Number.isFinite(b.tabId)) {
    return NextResponse.json({ error: "tabId é obrigatório" }, { status: 400 });
  }
  if (!Array.isArray(b.items) || !b.items.length) {
    return NextResponse.json({ error: "items é obrigatório" }, { status: 400 });
  }

  try {
    await addTabItems(b.tabId, b.items);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
