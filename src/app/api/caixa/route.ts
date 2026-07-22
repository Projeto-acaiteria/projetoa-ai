import { NextResponse } from "next/server";
import { getOpenSession, openCash, addMovement, closeCash, type CashSession } from "@/lib/cash-store";
import { getCashPin } from "@/lib/settings-store";
import { getCurrentUser } from "@/lib/auth/store";
import { listOrders, getOrder, cancelOrder } from "@/lib/orders-store";
import { listServiceOrders } from "@/lib/service-orders-store";
import { moveStock } from "@/lib/stock-store";
import { reversePoints } from "@/lib/customers-store";
import { listMesaPayments, listMesaSales, cancelMesaSale } from "@/lib/tables-store";
import { weightSoldSince } from "@/lib/weight-report";
import { dateBR } from "@/lib/date-br";
import { inicioNoiteOperacionalISO } from "@/lib/events-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// JANELA DO CAIXA = NOITE OPERACIONAL (6h→6h), não "desde que a sessão abriu".
// O bar abre 18h e fecha até 06h: a venda das 02h é da noite anterior. Se ninguém fechou o caixa e a
// sessão é de uma noite passada, a tela mostra SÓ a noite de agora — não mistura as datas (e zera
// sozinha às 6h). Sessão aberta nesta noite: janela = a abertura dela (comportamento de sempre).
// Tudo comparado por TIMESTAMP (não string): paid_at vem "+00:00" e openedAt vem "Z".
function janela(session: CashSession) {
  return Math.max(new Date(session.openedAt).getTime(), new Date(inicioNoiteOperacionalISO()).getTime());
}

// resumo do caixa: vendas de balcão + pagamentos de mesa da noite operacional corrente
async function resumo(session: CashSession) {
  const winMs = janela(session);
  const winISO = new Date(winMs).toISOString();
  const orders = (await listOrders()).filter((o) => o.mode === "balcao" && !o.cancelled && new Date(o.createdAt).getTime() >= winMs);
  const mesas = (await listMesaPayments()).filter((m) => new Date(m.date).getTime() >= winMs);
  const mesaCashCents = mesas.filter((m) => m.method === "dinheiro").reduce((s, m) => s + m.grossCents, 0);
  const mesaTotalCents = mesas.reduce((s, m) => s + m.grossCents, 0);
  const salesTotalCents = orders.reduce((s, o) => s + o.totalCents, 0) + mesaTotalCents;
  // por método (conferência tripla): se a order tem split (payments[]), soma cada forma no seu balde;
  // senão cai no método único (o.paymentMethod). Backward-compat com vendas antigas.
  const isCard = (m?: string) => m === "debito" || m === "credito";
  const bucket = (o: (typeof orders)[number]) => {
    if (o.payments?.length) {
      let cash = 0, card = 0, pix = 0;
      for (const p of o.payments) { if (p.method === "dinheiro") cash += p.amountCents; else if (p.method === "pix") pix += p.amountCents; else card += p.amountCents; }
      return { cash, card, pix };
    }
    return { cash: o.paymentMethod === "dinheiro" ? o.totalCents : 0, card: isCard(o.paymentMethod) ? o.totalCents : 0, pix: o.paymentMethod === "pix" ? o.totalCents : 0 };
  };
  const ob = orders.map(bucket);
  const salesCashCents = ob.reduce((s, b) => s + b.cash, 0) + mesaCashCents;
  const salesCardCents = ob.reduce((s, b) => s + b.card, 0) + mesas.filter((m) => isCard(m.method)).reduce((s, m) => s + m.grossCents, 0);
  const salesPixCents = ob.reduce((s, b) => s + b.pix, 0) + mesas.filter((m) => m.method === "pix").reduce((s, m) => s + m.grossCents, 0);
  const cardFeeCents =
    orders.reduce((s, o) => s + (o.cardFeeCents ?? 0), 0) +
    mesas.filter((m) => isCard(m.method)).reduce((s, m) => s + (m.cardFeeCents ?? 0), 0);
  const cardNetCents = salesCardCents - cardFeeCents;
  // OS quitadas DENTRO da sessão (assistência técnica). Reconciliação da gaveta: SÓ o dinheiro
  // da OS entra no saldo físico; pix/cartão de OS aparecem no total mas não incham a gaveta (igual
  // às vendas de balcão). Food não tem OS → lista vazia → tudo zero (no-op, food intacto).
  // Compara paidAt >= openedAt por timestamp (não string): paid_at pode vir com "+00:00" e openedAt com "Z".
  const os = (await listServiceOrders()).filter(
    (o) => o.paymentStatus === "quitada" && o.status !== "cancelado" && o.paidAt != null && new Date(o.paidAt).getTime() >= winMs,
  );
  const osTotalCents = os.reduce((s, o) => s + o.totalCents, 0);
  const osCashCents = os.filter((o) => o.paymentMethod === "dinheiro").reduce((s, o) => s + o.totalCents, 0);
  const nOS = os.length;
  // sangria/suprimento também entram na janela da noite (senão movimento de ontem some no saldo de hoje)
  const movs = session.movements.filter((m) => new Date(m.at).getTime() >= winMs);
  const suprimentoCents = movs.filter((m) => m.type === "suprimento").reduce((s, m) => s + m.amountCents, 0);
  const sangriaCents = movs.filter((m) => m.type === "sangria").reduce((s, m) => s + m.amountCents, 0);
  const saldoCaixaCents = session.openingFloatCents + salesCashCents + osCashCents + suprimentoCents - sangriaCents;
  // nVendas: balcão (1 order = 1 venda) + comandas DISTINTAS (split em N parciais NÃO conta N vezes)
  const nMesas = new Set(mesas.map((m) => m.tabId)).size;
  // "quantos kg de açaí vendi hoje" (Vidal): polpa consumida nas vendas da sessão (copo + peso).
  // Reusa `orders` (balcão) já carregado acima; a função busca só os itens de mesa.
  const acai = await weightSoldSince(winISO, undefined, orders);
  return { salesCashCents, salesTotalCents, salesCardCents, salesPixCents, cardFeeCents, cardNetCents, suprimentoCents, sangriaCents, saldoCaixaCents, nVendas: orders.length + nMesas, osTotalCents, osCashCents, nOS, acai };
}

// vendas da sessão que ainda podem ser canceladas: balcão (orders) + MESA (comandas fechadas).
// `kind` diferencia o estorno no POST (cancelar-venda × cancelar-mesa). Mais recente primeiro.
async function vendasSessao(session: CashSession) {
  const winMs = janela(session);
  const balcao = (await listOrders())
    .filter((o) => o.mode === "balcao" && !o.cancelled && new Date(o.createdAt).getTime() >= winMs)
    .map((o) => ({
      kind: "balcao" as const, id: o.id, display: o.display, createdAt: o.createdAt, totalCents: o.totalCents,
      paymentMethod: o.paymentMethod ?? null, itens: o.items.reduce((s, it) => s + it.qty, 0),
    }));
  const mesa = (await listMesaSales(new Date(winMs).toISOString()))
    .map((m) => ({ kind: "mesa" as const, id: m.tabId, display: m.display, createdAt: m.closedAt, totalCents: m.totalCents, paymentMethod: m.method, itens: m.itens }));
  return [...balcao, ...mesa].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function GET() {
  const session = await getOpenSession();
  if (!session) return NextResponse.json({ session: null });
  return NextResponse.json({ session, resumo: await resumo(session), vendas: await vendasSessao(session) });
}

export async function POST(req: Request) {
  let b: { action?: string; floatCents?: number; amountCents?: number; reason?: string; countedCents?: number; cardCountedCents?: number; pixCountedCents?: number; operator?: string; pin?: string; orderId?: number; tabId?: number };
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
    // sangria exige PIN do caixa (se configurado) — gate de autorização validado no servidor
    if (b.action === "sangria") {
      const pin = await getCashPin();
      if (pin && (b.pin || "").trim() !== pin) return NextResponse.json({ error: "PIN incorreto" }, { status: 403 });
    }
    const session = await addMovement(b.action, b.amountCents, (b.reason || "").trim(), nowIso, b.operator);
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
      osCashCents: r.osCashCents,
      osTotalCents: r.osTotalCents,
    });
    return NextResponse.json({ ok: true, session, expectedCents: r.saldoCaixaCents });
  }

  if (b.action === "cancelar-venda") {
    const open = await getOpenSession();
    if (!open) return NextResponse.json({ error: "Nenhum caixa aberto" }, { status: 409 });
    const orderId = Number(b.orderId);
    if (!orderId) return NextResponse.json({ error: "Venda inválida" }, { status: 400 });
    const reason = (b.reason || "").trim();
    if (!reason) return NextResponse.json({ error: "Informe o motivo do cancelamento" }, { status: 400 });
    // mesmo gate da sangria: PIN do caixa (se configurado)
    const pin = await getCashPin();
    if (pin && (b.pin || "").trim() !== pin) return NextResponse.json({ error: "PIN incorreto" }, { status: 403 });

    const order = await getOrder(orderId);
    if (!order) return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });
    if (order.cancelled) return NextResponse.json({ error: "Essa venda já foi cancelada" }, { status: 409 });
    if (order.mode !== "balcao") return NextResponse.json({ error: "Só venda de balcão pode ser cancelada aqui" }, { status: 400 });
    if (order.createdAt < open.openedAt) return NextResponse.json({ error: "Essa venda é de um caixa anterior — não dá pra cancelar na sessão de agora" }, { status: 400 });

    const who = (await getCurrentUser())?.email ?? undefined;
    const warnings: string[] = [];

    // 1) devolve o estoque baixado (re-entrada) — NÃO-FATAL: falha não trava o estorno.
    // Balcão baixa NA HORA da venda (sem a flag `consumed`, que é do fluxo de delivery) → devolve
    // sempre que houver consumes; delivery só se já tinha consumido.
    if (order.consumes?.length && (order.mode === "balcao" || order.consumed)) {
      const dia = dateBR(nowIso);
      for (const c of order.consumes) {
        try { await moveStock(c.stockId, "entrada", c.qty, `Estorno venda ${order.display}`, dia); }
        catch { warnings.push(`estoque de ${c.stockId} não voltou`); }
      }
    }
    // 2) estorna os pontos creditados na venda — NÃO-FATAL
    if (order.pointsAwarded && order.pointsAwarded > 0 && order.phone) {
      try { await reversePoints(order.phone, order.customerName, order.pointsAwarded, `Estorno venda ${order.display}`, nowIso); }
      catch { warnings.push("pontos do cliente não estornaram"); }
    }
    // 3) marca a venda como cancelada (fonte da verdade — sai de caixa/receita/CMV/açaí)
    await cancelOrder(orderId, reason, who, nowIso);

    const s = await getOpenSession();
    return NextResponse.json({
      ok: true, session: s, resumo: s ? await resumo(s) : null, vendas: s ? await vendasSessao(s) : [],
      warning: warnings.length ? `Venda cancelada, mas: ${warnings.join("; ")}.` : undefined,
    });
  }

  // cancelar VENDA DE MESA (comanda fechada) — mesmo gate/PIN do cancelar-venda de balcão
  if (b.action === "cancelar-mesa") {
    const open = await getOpenSession();
    if (!open) return NextResponse.json({ error: "Nenhum caixa aberto" }, { status: 409 });
    const tabId = Number(b.tabId);
    if (!tabId) return NextResponse.json({ error: "Venda inválida" }, { status: 400 });
    const reason = (b.reason || "").trim();
    if (!reason) return NextResponse.json({ error: "Informe o motivo do cancelamento" }, { status: 400 });
    const pin = await getCashPin();
    if (pin && (b.pin || "").trim() !== pin) return NextResponse.json({ error: "PIN incorreto" }, { status: 403 });
    try {
      const who = (await getCurrentUser())?.email ?? undefined;
      const { warnings } = await cancelMesaSale(tabId, { reason, by: who });
      const s = await getOpenSession();
      return NextResponse.json({
        ok: true, session: s, resumo: s ? await resumo(s) : null, vendas: s ? await vendasSessao(s) : [],
        warning: warnings.length ? `Venda cancelada, mas: ${warnings.join("; ")}.` : undefined,
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
