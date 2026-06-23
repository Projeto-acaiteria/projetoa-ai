import { NextResponse } from "next/server";
import { addOrder, markPointsAwarded, type OrderItem } from "@/lib/orders-store";
import { applyConsumes } from "@/lib/stock-store";
import { awardPoints, getByPhone } from "@/lib/customers-store";
import { pointsForSale } from "@/lib/loyalty";
import { getLoyalty } from "@/lib/loyalty-store";
import { getOpenSession } from "@/lib/cash-store";
import { getFees, feeCentsFor } from "@/lib/settings-store";
import type { PaymentMethod } from "@/lib/orders-store";

const METHODS: PaymentMethod[] = ["dinheiro", "pix", "debito", "credito"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartItem = { name: string; qty: number; unitCents: number; group?: string; stockId?: string };
type Consume = { stockId: string; qty: number };

// POST /api/vendas — venda de balcão (imediata, já paga)
export async function POST(req: Request) {
  let b: {
    items?: CartItem[];
    consumes?: Consume[];
    paymentMethod?: PaymentMethod;
    amountPaidCents?: number;
    customerPhone?: string;
    customerName?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // sem caixa aberto, não vende (regra de PDV)
  if (!(await getOpenSession())) {
    return NextResponse.json({ error: "Abra o caixa antes de vender" }, { status: 409 });
  }

  const items = (b.items || []).filter((i) => i.qty > 0);
  if (!items.length) return NextResponse.json({ error: "Comanda vazia" }, { status: 400 });
  if (!b.paymentMethod || !METHODS.includes(b.paymentMethod)) {
    return NextResponse.json({ error: "Forma de pagamento inválida" }, { status: 400 });
  }

  const subtotalCents = items.reduce((s, i) => s + i.unitCents * i.qty, 0);
  // taxa da maquininha (calculada no servidor pela config — não confia no client)
  const fees = await getFees();
  const feeCents = feeCentsFor(b.paymentMethod, subtotalCents, fees);
  const orderItems: OrderItem[] = items.map((i) => ({
    group: i.group || "Venda",
    name: i.name,
    qty: i.qty,
    paidCents: i.unitCents * i.qty,
  }));
  const nowIso = new Date().toISOString();

  const order = await addOrder(
    {
      customerName: b.customerName?.trim() || "Balcão",
      phone: b.customerPhone?.trim() || "",
      mode: "balcao",
      sizeLabel: `${items.length} ${items.length === 1 ? "item" : "itens"}`,
      items: orderItems,
      subtotalCents,
      feeCents: 0, // sem taxa de entrega no balcão
      totalCents: subtotalCents,
      paymentMethod: b.paymentMethod,
      cardFeeCents: feeCents, // taxa da maquininha
    },
    nowIso,
    "entregue", // balcão = já entregue/pago
  );

  // baixa automática de estoque pela ficha técnica — NÃO-FATAL (a venda já está commitada).
  await applyConsumes(b.consumes || [], `Venda ${order.display}`, nowIso.slice(0, 10));

  // pontos (só se identificou o cliente por telefone)
  let pointsAwarded = 0;
  if (b.customerPhone?.trim()) {
    const phone = b.customerPhone.trim();
    const cfg = await getLoyalty();
    const existing = await getByPhone(phone);
    const isFirstPurchase = !existing || existing.history.length === 0;
    pointsAwarded = pointsForSale(subtotalCents, cfg, { isFirstPurchase });
    if (pointsAwarded > 0) {
      await awardPoints(phone, order.customerName, pointsAwarded, order.display, nowIso);
      await markPointsAwarded(order.id, pointsAwarded);
    }
  }

  const changeCents =
    b.paymentMethod === "dinheiro" && b.amountPaidCents
      ? Math.max(0, b.amountPaidCents - subtotalCents)
      : 0;

  return NextResponse.json(
    { ok: true, order, pointsAwarded, changeCents, feeCents, netCents: subtotalCents - feeCents },
    { status: 201 },
  );
}
