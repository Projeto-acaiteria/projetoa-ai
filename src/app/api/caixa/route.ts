import { NextResponse } from "next/server";
import { getOpenSession, openCash, addMovement, closeCash, type CashSession } from "@/lib/cash-store";
import { getCashPin } from "@/lib/settings-store";
import { getCurrentUser } from "@/lib/auth/store";
import { listOrders, getOrder, cancelOrder } from "@/lib/orders-store";
import { moveStock } from "@/lib/stock-store";
import { reversePoints } from "@/lib/customers-store";
import { listMesaSales, cancelMesaSale } from "@/lib/tables-store";
import { dateBR } from "@/lib/date-br";
import { resumoJanela, janelaNoite, virarNoiteSePreciso } from "@/lib/cash-resumo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resumo/janela vivem em lib/cash-resumo (compartilhados com a VIRADA AUTOMÁTICA da noite).
// Janela da tela = noite operacional corrente (6h→6h): não mistura datas e zera às 6h.
const resumo = (session: CashSession) => resumoJanela(session, janelaNoite(session));

// vendas da sessão que ainda podem ser canceladas: balcão (orders) + MESA (comandas fechadas).
// `kind` diferencia o estorno no POST (cancelar-venda × cancelar-mesa). Mais recente primeiro.
async function vendasSessao(session: CashSession) {
  const winMs = janelaNoite(session);
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
  // 1ª interação com o caixa depois das 6h vira a noite: fecha a anterior (vira registro no
  // Histórico) e abre a nova. Sem cron — o gatilho é o próprio uso.
  await virarNoiteSePreciso();
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
  // vira a noite antes de qualquer ação (sangria, fechar, cancelar…) pra não mexer na sessão de ontem
  if (b.action !== "abrir") await virarNoiteSePreciso();

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
