import { NextResponse } from "next/server";
import { addPayment } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/pagamento — registra um pagamento na comanda
export async function POST(req: Request) {
  let b: { tabId?: number; method?: string; amountCents?: number; feePercent?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof b.tabId !== "number" || !Number.isFinite(b.tabId)) {
    return NextResponse.json({ error: "tabId é obrigatório" }, { status: 400 });
  }
  if (!b.method?.trim()) {
    return NextResponse.json({ error: "method é obrigatório" }, { status: 400 });
  }
  if (typeof b.amountCents !== "number" || !Number.isFinite(b.amountCents)) {
    return NextResponse.json({ error: "amountCents é obrigatório" }, { status: 400 });
  }

  try {
    await addPayment(b.tabId, b.method.trim(), b.amountCents, b.feePercent ?? 0);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
