import { NextResponse } from "next/server";
import { listOrders } from "@/lib/orders-store";
import { listExpenses } from "@/lib/expense-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vendas reais (pagas/entregues) + despesas, pro financeiro montar fluxo de caixa.
export async function GET() {
  const orders = (await listOrders()).filter((o) => o.status === "entregue");
  const vendas = orders.map((o) => ({
    display: o.display,
    date: o.createdAt,
    mode: o.mode,
    paymentMethod: o.paymentMethod ?? null,
    grossCents: o.totalCents,
    cardFeeCents: o.cardFeeCents ?? 0,
    netCents: o.totalCents - (o.cardFeeCents ?? 0),
    customerName: o.customerName,
  }));
  const despesas = await listExpenses();
  return NextResponse.json({ vendas, despesas });
}
