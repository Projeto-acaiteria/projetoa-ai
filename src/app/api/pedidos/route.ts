import { NextResponse } from "next/server";
import { addOrder, listOrders, type NewOrder } from "@/lib/orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const orders = await listOrders();
  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  let body: Partial<NewOrder>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // validação mínima
  if (!body.customerName?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: "Nome e telefone são obrigatórios" }, { status: 400 });
  }
  if (!body.sizeLabel || !Array.isArray(body.items) || typeof body.totalCents !== "number") {
    return NextResponse.json({ error: "Pedido incompleto" }, { status: 400 });
  }
  if (body.mode === "entrega" && !body.address?.trim()) {
    return NextResponse.json({ error: "Endereço é obrigatório na entrega" }, { status: 400 });
  }

  const order = await addOrder(
    {
      customerName: body.customerName.trim(),
      phone: body.phone.trim(),
      address: body.address?.trim(),
      mode: body.mode === "entrega" ? "entrega" : "retirada",
      sizeLabel: body.sizeLabel,
      items: body.items,
      subtotalCents: body.subtotalCents ?? 0,
      feeCents: body.feeCents ?? 0,
      totalCents: body.totalCents,
      consumes: Array.isArray(body.consumes) ? body.consumes : undefined,
      bairro: body.bairro,
    },
    new Date().toISOString(),
  );

  return NextResponse.json({ ok: true, order }, { status: 201 });
}
