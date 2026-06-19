import { NextResponse } from "next/server";
import { getOpenSession, openCash, addMovement, closeCash, type CashSession } from "@/lib/cash-store";
import { listOrders } from "@/lib/orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// resumo do caixa aberto a partir das vendas registradas desde a abertura
async function resumo(session: CashSession) {
  const orders = (await listOrders()).filter((o) => o.mode === "balcao" && o.createdAt >= session.openedAt);
  const salesCashCents = orders.filter((o) => o.paymentMethod === "dinheiro").reduce((s, o) => s + o.totalCents, 0);
  const salesTotalCents = orders.reduce((s, o) => s + o.totalCents, 0);
  const suprimentoCents = session.movements.filter((m) => m.type === "suprimento").reduce((s, m) => s + m.amountCents, 0);
  const sangriaCents = session.movements.filter((m) => m.type === "sangria").reduce((s, m) => s + m.amountCents, 0);
  const saldoCaixaCents = session.openingFloatCents + salesCashCents + suprimentoCents - sangriaCents;
  return { salesCashCents, salesTotalCents, suprimentoCents, sangriaCents, saldoCaixaCents, nVendas: orders.length };
}

export async function GET() {
  const session = await getOpenSession();
  if (!session) return NextResponse.json({ session: null });
  return NextResponse.json({ session, resumo: await resumo(session) });
}

export async function POST(req: Request) {
  let b: { action?: string; floatCents?: number; amountCents?: number; reason?: string; countedCents?: number; operator?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const nowIso = new Date().toISOString();

  if (b.action === "abrir") {
    try {
      const session = await openCash(b.floatCents || 0, nowIso, b.operator);
      return NextResponse.json({ ok: true, session, resumo: await resumo(session) }, { status: 201 });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 409 });
    }
  }

  if (b.action === "sangria" || b.action === "suprimento") {
    if (!b.amountCents || b.amountCents <= 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    const session = await addMovement(b.action, b.amountCents, (b.reason || "").trim(), nowIso);
    if (!session) return NextResponse.json({ error: "Nenhum caixa aberto" }, { status: 409 });
    return NextResponse.json({ ok: true, session, resumo: await resumo(session) });
  }

  if (b.action === "fechar") {
    const open = await getOpenSession();
    if (!open) return NextResponse.json({ error: "Nenhum caixa aberto" }, { status: 409 });
    const r = await resumo(open);
    const session = await closeCash(b.countedCents || 0, r.saldoCaixaCents, r.salesCashCents, r.salesTotalCents, nowIso);
    return NextResponse.json({ ok: true, session, expectedCents: r.saldoCaixaCents });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
