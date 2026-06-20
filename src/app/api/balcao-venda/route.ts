import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { resolveOrderItems } from "@/lib/menu-bar-store";
import { addOrder, type OrderItem, type PaymentMethod } from "@/lib/orders-store";
import { getFees, feeCentsFor } from "@/lib/settings-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Venda de BALCÃO (operador logado) pro menu relacional (bar/grid/marmitaria). Fluxo a-quilo:
// item por peso (grams → peso×R$/kg) + itens fixos (bebida/sobremesa) → pagamento no caixa.
// Preço recalculado no SERVIDOR (resolveOrderItems). Cai no orders-store (mode balcao) → cupom.
const PAYMENTS: PaymentMethod[] = ["dinheiro", "pix", "debito", "credito"];

type Body = {
  items?: { productId: string; qty: number; grams?: number; modifierIds?: string[] }[];
  paymentMethod?: string;
  customerName?: string;
};

export async function POST(req: Request) {
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  const sel = Array.isArray(b.items) ? b.items : [];
  if (!sel.length) return NextResponse.json({ error: "venda vazia" }, { status: 400 });
  const method: PaymentMethod = PAYMENTS.includes(b.paymentMethod as PaymentMethod) ? (b.paymentMethod as PaymentMethod) : "dinheiro";

  const storeId = await resolveStoreId();

  try {
    const resolved = await resolveOrderItems(storeId, sel);
    if (!resolved.length) return NextResponse.json({ error: "itens indisponíveis" }, { status: 400 });

    const subtotalCents = resolved.reduce((s, it) => s + it.qty * it.unitPriceCents, 0);
    if (subtotalCents <= 0) return NextResponse.json({ error: "Confira os pesos/itens — total zerado." }, { status: 400 });

    const fees = await getFees(storeId);
    const cardFeeCents = feeCentsFor(method, subtotalCents, fees);

    // item: peso entra no nome (ex "Comida a quilo 500g"); senão tamanho do produto se houver
    const items: OrderItem[] = resolved.map((it) => ({
      group: "",
      name: it.name + (it.sizeLabel ? ` ${it.sizeLabel}` : "") + (it.mods?.length ? ` (${it.mods.map((m) => m.name).join(", ")})` : ""),
      qty: it.qty,
      paidCents: it.qty * it.unitPriceCents,
    }));

    const consumesMap: Record<string, number> = {};
    for (const it of resolved) for (const r of it.recipe) consumesMap[r.stockId] = (consumesMap[r.stockId] ?? 0) + r.qty * it.qty;
    const consumes = Object.entries(consumesMap).map(([stockId, qty]) => ({ stockId, qty: +qty.toFixed(3) }));

    const order = await addOrder(
      {
        customerName: b.customerName?.trim() || "Balcão",
        phone: "",
        mode: "balcao",
        sizeLabel: "",
        items,
        subtotalCents,
        feeCents: 0,
        totalCents: subtotalCents,
        consumes,
        paymentMethod: method,
        cardFeeCents,
      },
      new Date().toISOString(),
      "entregue", // venda de balcão já sai pronta (não passa pela fila de preparo do delivery)
      storeId,
    );

    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (e) {
    console.error("balcao-venda:", e);
    return NextResponse.json({ error: "Não consegui registrar a venda. Tente de novo." }, { status: 500 });
  }
}
