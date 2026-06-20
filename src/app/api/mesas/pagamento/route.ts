import { NextResponse } from "next/server";
import { addPayment } from "@/lib/tables-store";
import { getFees } from "@/lib/settings-store";
import { resolveStoreId } from "@/lib/auth/current";
import type { PaymentMethod } from "@/lib/orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/pagamento — registra um pagamento na comanda
export async function POST(req: Request) {
  let b: { tabId?: number; method?: string; amountCents?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof b.tabId !== "number" || !Number.isFinite(b.tabId)) {
    return NextResponse.json({ error: "tabId é obrigatório" }, { status: 400 });
  }
  const method = (b.method ?? "").trim();
  if (!method) {
    return NextResponse.json({ error: "method é obrigatório" }, { status: 400 });
  }
  if (typeof b.amountCents !== "number" || !Number.isFinite(b.amountCents)) {
    return NextResponse.json({ error: "amountCents é obrigatório" }, { status: 400 });
  }

  try {
    // taxa da maquininha vem da CONFIG da loja por método (server-authoritative) — não do client.
    const sid = await resolveStoreId();
    const fees = await getFees(sid);
    const feePercent = fees[method as PaymentMethod] ?? 0;
    await addPayment(b.tabId, method, b.amountCents, feePercent);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
