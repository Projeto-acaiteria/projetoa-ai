import { NextResponse } from "next/server";
import { getOpenSession, openCash, addMovement, closeCash, type CashSession } from "@/lib/cash-store";
import { getCurrentUser } from "@/lib/auth/store";
import { listOrders } from "@/lib/orders-store";
import { listMesaPayments } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// resumo do caixa aberto: vendas de balcão + pagamentos de mesa desde a abertura
async function resumo(session: CashSession) {
  const orders = (await listOrders()).filter((o) => o.mode === "balcao" && o.createdAt >= session.openedAt);
  const mesas = (await listMesaPayments()).filter((m) => m.date >= session.openedAt);
  const mesaCashCents = mesas.filter((m) => m.method === "dinheiro").reduce((s, m) => s + m.grossCents, 0);
  const mesaTotalCents = mesas.reduce((s, m) => s + m.grossCents, 0);
  const salesCashCents = orders.filter((o) => o.paymentMethod === "dinheiro").reduce((s, o) => s + o.totalCents, 0) + mesaCashCents;
  const salesTotalCents = orders.reduce((s, o) => s + o.totalCents, 0) + mesaTotalCents;
  // por método (conferência tripla): cartão (débito+crédito) e pix, com a taxa de maquininha
  const isCard = (m?: string) => m === "debito" || m === "credito";
  const salesCardCents =
    orders.filter((o) => isCard(o.paymentMethod)).reduce((s, o) => s + o.totalCents, 0) +
    mesas.filter((m) => isCard(m.method)).reduce((s, m) => s + m.grossCents, 0);
  const salesPixCents =
    orders.filter((o) => o.paymentMethod === "pix").reduce((s, o) => s + o.totalCents, 0) +
    mesas.filter((m) => m.method === "pix").reduce((s, m) => s + m.grossCents, 0);
  const cardFeeCents =
    orders.filter((o) => isCard(o.paymentMethod)).reduce((s, o) => s + (o.cardFeeCents ?? 0), 0) +
    mesas.filter((m) => isCard(m.method)).reduce((s, m) => s + (m.cardFeeCents ?? 0), 0);
  const cardNetCents = salesCardCents - cardFeeCents;
  const suprimentoCents = session.movements.filter((m) => m.type === "suprimento").reduce((s, m) => s + m.amountCents, 0);
  const sangriaCents = session.movements.filter((m) => m.type === "sangria").reduce((s, m) => s + m.amountCents, 0);
  const saldoCaixaCents = session.openingFloatCents + salesCashCents + suprimentoCents - sangriaCents;
  return { salesCashCents, salesTotalCents, salesCardCents, salesPixCents, cardFeeCents, cardNetCents, suprimentoCents, sangriaCents, saldoCaixaCents, nVendas: orders.length + mesas.length };
}

export async function GET() {
  const session = await getOpenSession();
  if (!session) return NextResponse.json({ session: null });
  return NextResponse.json({ session, resumo: await resumo(session) });
}

export async function POST(req: Request) {
  let b: { action?: string; floatCents?: number; amountCents?: number; reason?: string; countedCents?: number; cardCountedCents?: number; pixCountedCents?: number; operator?: string };
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
    const closedBy = (await getCurrentUser())?.email ?? undefined;
    const session = await closeCash({
      at: nowIso,
      closedBy,
      countedCents: b.countedCents || 0,
      cardCountedCents: b.cardCountedCents,
      pixCountedCents: b.pixCountedCents,
      expectedCents: r.saldoCaixaCents,
      salesCashCents: r.salesCashCents,
      salesCardCents: r.salesCardCents,
      salesPixCents: r.salesPixCents,
      salesTotalCents: r.salesTotalCents,
      cardFeeCents: r.cardFeeCents,
    });
    return NextResponse.json({ ok: true, session, expectedCents: r.saldoCaixaCents });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
