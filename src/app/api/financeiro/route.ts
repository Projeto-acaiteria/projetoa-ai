import { NextResponse } from "next/server";
import { listOrders } from "@/lib/orders-store";
import { listExpenses } from "@/lib/expense-store";
import { listMesaPayments, listItemCancellations } from "@/lib/tables-store";
import { listStaffPayments } from "@/lib/staff-store";
import { listServiceOrders } from "@/lib/service-orders-store";
import { listCommissionPayments } from "@/lib/commission-payments-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vendas reais (balcão/delivery entregues + comandas de mesa pagas) + despesas.
export async function GET() {
  const orders = (await listOrders()).filter((o) => o.status === "entregue" && !o.cancelled);
  const vendasOrders = orders.map((o) => ({
    display: o.display,
    date: o.createdAt,
    mode: o.mode,
    paymentMethod: o.paymentMethod ?? null,
    grossCents: o.totalCents,
    cardFeeCents: o.cardFeeCents ?? 0,
    netCents: o.totalCents - (o.cardFeeCents ?? 0),
    customerName: o.customerName,
    items: (o.items ?? []).map((it) => ({ name: it.name, qty: it.qty, paidCents: it.paidCents })),
    discountCents: o.discountCents ?? 0,
    payments: o.payments ?? null,
  }));
  // receita das MESAS (tab_payments) — antes invisível no financeiro
  const vendasMesa = (await listMesaPayments()).map((m) => ({
    display: m.display,
    date: m.date,
    mode: "mesa",
    paymentMethod: m.method,
    grossCents: m.grossCents,
    cardFeeCents: m.cardFeeCents,
    netCents: m.grossCents - m.cardFeeCents,
    customerName: m.customerName,
    items: [] as { name: string; qty: number; paidCents: number }[],
    discountCents: 0,
    payments: null,
  }));
  // receita das ORDENS DE SERVIÇO quitadas (assistência técnica) — antes só aparecia no dashboard AT.
  // Data = quitação (paidAt), não abertura, pra bater com o dia que o dinheiro entrou.
  const vendasOS = (await listServiceOrders())
    .filter((o) => o.paymentStatus === "quitada" && o.status !== "cancelado")
    .map((o) => ({
      display: "OS " + (o.code ?? o.id.slice(0, 8)),
      date: o.paidAt ?? o.createdAt,
      mode: "os",
      paymentMethod: o.paymentMethod,
      grossCents: o.totalCents,
      cardFeeCents: 0,
      netCents: o.totalCents,
      customerName: o.customerName,
      items: [{ name: o.device || "Serviço", qty: 1, paidCents: o.totalCents }],
      discountCents: o.discountCents ?? 0,
      payments: null,
    }));

  const vendas = [...vendasOrders, ...vendasMesa, ...vendasOS];
  const despesas = await listExpenses();

  // Comissão/bônus PAGOS ao técnico = saída real de caixa (aprendizado Palace: sem isso o lucro fica
  // falso-alto). Sintéticas (só service tem commission_payments; food volta vazio), por DATA de pagamento.
  // NÃO entram na aba Despesas (não são editáveis/deletáveis) — só no cálculo do resultado e no fluxo.
  const pays = await listCommissionPayments();
  const comissoes = pays.flatMap((p) => {
    const date = (p.paidAt || "").slice(0, 10);
    const rows: { id: string; description: string; category: string; amountCents: number; date: string }[] = [];
    if (p.paidCents > 0) rows.push({ id: "com_" + p.id, description: "Comissão paga", category: "comissao", amountCents: p.paidCents, date });
    if (p.bonusCents > 0) rows.push({ id: "bon_" + p.id, description: "Bônus" + (p.bonusReason ? ` · ${p.bonusReason}` : ""), category: "bonus", amountCents: p.bonusCents, date });
    return rows;
  });
  // DIÁRIAS PAGAS (mt-34) — custo de pessoal do bar entra no resultado, igual as comissões.
  // Sintéticas também: o recibo é a fonte da verdade, não editável na aba Despesas.
  for (const dp of await listStaffPayments()) {
    comissoes.push({
      id: "dia_" + dp.id,
      description: `Diárias · ${dp.name} (${dp.noites} noite${dp.noites === 1 ? "" : "s"})`,
      category: "diaria",
      amountCents: dp.totalCents,
      date: (dp.paidAt || "").slice(0, 10),
    });
  }

  // cancelamentos de item (relatorio de auditoria do Financeiro) — a casa pediu registro consultavel
  const cancelamentos = await listItemCancellations();
  return NextResponse.json({ vendas, despesas, comissoes, cancelamentos });
}
