import { NextResponse } from "next/server";
import { getTabFull } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mesas/comanda?tabId=N — comanda completa
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tabIdRaw = searchParams.get("tabId");
  const tabId = Number(tabIdRaw);
  if (!tabIdRaw || !Number.isFinite(tabId)) {
    return NextResponse.json({ error: "tabId inválido" }, { status: 400 });
  }

  try {
    const full = await getTabFull(tabId);
    // mapeia snake_case do banco → camelCase que a UI lê (senão preço/pagamento viram "R$ NaN")
    return NextResponse.json({
      tab: { id: full.tab.id, label: full.tab.label, people_count: full.tab.people_count },
      orders: full.orders.map((o) => ({
        items: o.items.map((i) => ({ name: i.name, sizeLabel: i.size_label, qty: i.qty, unitPriceCents: i.unit_price_cents, note: i.note ?? null })),
      })),
      payments: full.payments.map((p) => ({ method: p.method, amountCents: p.amount_cents })),
      consumoCents: full.consumoCents,
      coverCents: full.coverCents,
      totalCents: full.totalCents,
      paidCents: full.paidCents,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
