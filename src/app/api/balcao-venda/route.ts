import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { resolveOrderItems } from "@/lib/menu-bar-store";
import { addOrder, markPointsAwarded, type OrderItem, type PaymentMethod } from "@/lib/orders-store";
import { resolveCardFee, resolveSplitCardFee } from "@/lib/settings-store";
import { applyConsumes } from "@/lib/stock-store";
import { getOpenSession } from "@/lib/cash-store";
import { awardPoints, getByPhone } from "@/lib/customers-store";
import { pointsForSale } from "@/lib/loyalty";
import { getLoyalty } from "@/lib/loyalty-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Venda de BALCÃO (operador logado) pro menu relacional (bar/grid/marmitaria). Fluxo a-quilo:
// item por peso (grams → peso×R$/kg) + itens fixos (bebida/sobremesa) → pagamento no caixa.
// Preço recalculado no SERVIDOR (resolveOrderItems). Cai no orders-store (mode balcao) → cupom.
const PAYMENTS: PaymentMethod[] = ["dinheiro", "pix", "debito", "credito"];

type Body = {
  items?: { productId: string; qty: number; grams?: number; modifierIds?: string[]; note?: string }[];
  paymentMethod?: string;
  machineId?: string; // máquina do cartão (define a taxa)
  parcelas?: number; // parcelas no crédito
  customerName?: string;
  customerPhone?: string; // fidelidade: identifica o cliente p/ pontuar a venda
  discountCents?: number; // desconto do operador (R$ ou % já convertido em centavos)
  payments?: { method: PaymentMethod; amountCents: number }[]; // split de pagamento (>1 forma)
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

  // sem caixa aberto, não vende (regra de PDV — uniforme com /api/vendas; venda em dinheiro
  // precisa pertencer a uma sessão pra fechar a gaveta na conferência)
  if (!(await getOpenSession())) {
    return NextResponse.json({ error: "Abra o caixa antes de vender" }, { status: 409 });
  }

  try {
    const resolved = await resolveOrderItems(storeId, sel);
    if (!resolved.length) return NextResponse.json({ error: "itens indisponíveis" }, { status: 400 });

    const subtotalCents = resolved.reduce((s, it) => s + it.qty * it.unitPriceCents, 0);
    if (subtotalCents <= 0) return NextResponse.json({ error: "Confira os pesos/itens — total zerado." }, { status: 400 });

    // desconto do operador (clampa em [0, subtotal]); total = o que o cliente paga
    const discountCents = Math.max(0, Math.min(Math.round(b.discountCents ?? 0), subtotalCents));
    const totalCents = subtotalCents - discountCents;

    // split de pagamento: 2+ formas numa venda. Valida a soma; taxa do cartão só sobre a parte no cartão.
    const isCard = (m?: string) => m === "debito" || m === "credito";
    const rawPays = Array.isArray(b.payments) ? b.payments.filter((p) => p && PAYMENTS.includes(p.method) && Math.round(p.amountCents) > 0).map((p) => ({ method: p.method, amountCents: Math.round(p.amountCents) })) : [];
    const isSplit = rawPays.length >= 2;
    if (isSplit && rawPays.reduce((s, p) => s + p.amountCents, 0) !== totalCents) {
      return NextResponse.json({ error: "A soma das formas de pagamento não bate com o total." }, { status: 400 });
    }
    const effMethod: PaymentMethod = isSplit ? rawPays.slice().sort((a, b) => b.amountCents - a.amountCents)[0].method : method;
    // taxa: total (forma única) OU soma de TODAS as parcelas no cartão (split — ex: débito + crédito)
    const card = isSplit
      ? await resolveSplitCardFee(rawPays.filter((p) => isCard(p.method)), storeId, { machineId: b.machineId, parcelas: b.parcelas })
      : await resolveCardFee(method, totalCents, storeId, { machineId: b.machineId, parcelas: b.parcelas });

    // item: peso entra no nome (ex "Comida a quilo 500g"); senão tamanho do produto se houver
    const items: OrderItem[] = resolved.map((it) => ({
      group: "",
      name: it.name + (it.sizeLabel ? ` ${it.sizeLabel}` : "") + (it.mods?.length ? ` (${it.mods.map((m) => m.name).join(", ")})` : ""),
      qty: it.qty,
      paidCents: it.qty * it.unitPriceCents,
      note: it.note ?? undefined,
      earnsPoints: it.earnsPoints,
    }));

    const consumesMap: Record<string, number> = {};
    for (const it of resolved) for (const r of it.recipe) consumesMap[r.stockId] = (consumesMap[r.stockId] ?? 0) + r.qty * it.qty;
    const consumes = Object.entries(consumesMap).map(([stockId, qty]) => ({ stockId, qty: +qty.toFixed(3) }));

    // vias de PREPARO por estação (cozinha/bar/copa) — pro balcão imprimir como nas mesas.
    // station vem da CATEGORIA (resolveOrderItems). O cliente agrupa por estação e imprime sem preço.
    const prep = resolved.map((it) => ({ station: it.station || "cozinha", qty: it.qty, name: it.name, sizeLabel: it.sizeLabel, mods: it.mods, note: it.note ?? null }));

    const order = await addOrder(
      {
        customerName: b.customerName?.trim() || "Balcão",
        phone: "",
        mode: "balcao",
        sizeLabel: "",
        items,
        subtotalCents,
        feeCents: 0,
        totalCents,
        discountCents,
        consumes,
        paymentMethod: effMethod,
        payments: isSplit ? rawPays : undefined,
        cardFeeCents: card.feeCents,
        cardMachineId: card.machineId,
        cardMachineName: card.machineName,
        cardFeePercent: card.feePercent,
        parcelas: card.parcelas,
      },
      new Date().toISOString(),
      "entregue", // venda de balcão já sai pronta (não passa pela fila de preparo do delivery)
      storeId,
    );

    // baixa automática de estoque pela ficha técnica — NÃO-FATAL (a venda já está commitada acima;
    // uma falha de baixa não pode virar 500 → operador refaz → pedido duplicado).
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const stock = await applyConsumes(consumes, `Venda ${order.display}`, today, storeId);
    const stockWarning = stock.failed.length
      ? `Venda registrada, mas ${stock.failed.length} item(ns) não baixaram do estoque — confira o estoque.`
      : undefined;

    // fidelidade: pontua a venda se o operador identificou o cliente pelo telefone (espelha /api/vendas)
    let pointsAwarded = 0;
    const phone = b.customerPhone?.trim();
    if (phone) {
      const cfg = await getLoyalty(storeId);
      const existing = await getByPhone(phone);
      const isFirstPurchase = !existing || existing.history.length === 0;
      // pontua só sobre as categorias que dão pontos (fidelidade por categoria).
      // desconto rateado proporcionalmente sobre a parte elegível.
      const eligibleSubtotal = resolved.reduce((s, it) => s + (it.earnsPoints === false ? 0 : it.qty * it.unitPriceCents), 0);
      const eligibleCents = subtotalCents > 0 ? Math.round((eligibleSubtotal * totalCents) / subtotalCents) : 0;
      pointsAwarded = pointsForSale(eligibleCents, cfg, { isFirstPurchase });
      if (pointsAwarded > 0) {
        await awardPoints(phone, order.customerName, pointsAwarded, order.display, nowIso);
        await markPointsAwarded(order.id, pointsAwarded, storeId);
      }
    }

    return NextResponse.json({ ok: true, order, pointsAwarded, stockWarning, prep }, { status: 201 });
  } catch (e) {
    console.error("balcao-venda:", e);
    return NextResponse.json({ error: "Não consegui registrar a venda. Tente de novo." }, { status: 500 });
  }
}
