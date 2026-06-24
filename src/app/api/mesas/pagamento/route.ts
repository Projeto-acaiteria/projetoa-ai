import { NextResponse } from "next/server";
import { addPayment } from "@/lib/tables-store";
import { resolveCardFee } from "@/lib/settings-store";
import { resolveStoreId } from "@/lib/auth/current";
import type { PaymentMethod } from "@/lib/orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/pagamento — registra um pagamento na comanda
export async function POST(req: Request) {
  let b: { tabId?: number; method?: string; amountCents?: number; machineId?: string; parcelas?: number };
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
    // taxa do cartão: máquina escolhida (snapshot) ou flat por método — server-authoritative
    const sid = await resolveStoreId();
    const card = await resolveCardFee(method as PaymentMethod, b.amountCents, sid, { machineId: b.machineId, parcelas: b.parcelas });
    await addPayment(b.tabId, method, b.amountCents, card.feePercent);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
