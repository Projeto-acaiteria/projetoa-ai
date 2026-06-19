import { NextResponse } from "next/server";
import { closeTab } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/fechar — fecha a comanda e pontua fidelidade (se houver telefone)
export async function POST(req: Request) {
  let b: {
    tabId?: number;
    serviceFeeCents?: number;
    customerPhone?: string;
    customerName?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof b.tabId !== "number" || !Number.isFinite(b.tabId)) {
    return NextResponse.json({ error: "tabId é obrigatório" }, { status: 400 });
  }

  try {
    const r = await closeTab(b.tabId, {
      serviceFeeCents: b.serviceFeeCents,
      customerPhone: b.customerPhone,
      customerName: b.customerName,
    });
    return NextResponse.json({ ok: true, pointsAwarded: r.pointsAwarded });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
