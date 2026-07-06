import { NextResponse } from "next/server";
import { listOrders } from "@/lib/orders-store";
import { listExpenses } from "@/lib/expense-store";
import { listMesaPayments } from "@/lib/tables-store";
import { listServiceOrders } from "@/lib/service-orders-store";

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
  return NextResponse.json({ vendas, despesas });
}
