import { NextResponse } from "next/server";
import { setTabPeople } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/pessoas — ajusta nº de pessoas da comanda aberta e re-faz o snapshot do couvert.
export async function POST(req: Request) {
  let b: { tabId?: number; pax?: number };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  if (typeof b.tabId !== "number" || !Number.isFinite(b.tabId)) {
    return NextResponse.json({ error: "tabId é obrigatório" }, { status: 400 });
  }
  if (typeof b.pax !== "number" || !Number.isFinite(b.pax) || b.pax < 1) {
    return NextResponse.json({ error: "pax inválido" }, { status: 400 });
  }
  try {
    const out = await setTabPeople(b.tabId, b.pax);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
