import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { resolveOrderItems } from "@/lib/menu-bar-store";
import { addOrder, type OrderItem, type PaymentMethod } from "@/lib/orders-store";
import { getStore } from "@/lib/settings-store";
import { getStoreConfig } from "@/lib/auth/store-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pedido de DELIVERY/RETIRADA pelo cardápio público (modelos bar/grid). Diferente de /api/mesa-pedido
// (que abre comanda de mesa): aqui o pedido cai no pipeline de PEDIDOS (orders-store) → painel + KDS +
// impressão, igual o delivery do açaí. Preço/itens recalculados no SERVIDOR (link público, não confia no client).
// NÃO processa pagamento — só registra como o cliente vai pagar (a loja recebe na entrega).

const PAYMENTS: PaymentMethod[] = ["dinheiro", "pix", "debito", "credito"];

type Body = {
  slug?: string;
  customerName?: string;
  phone?: string;
  mode?: string; // 'entrega' | 'retirada'
  address?: string;
  bairro?: string;
  paymentMethod?: string; // informativo (não cobramos)
  note?: string;
  items?: { productId: string; qty: number; modifierIds?: string[] }[];
};

export async function POST(req: Request) {
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const slug = (b.slug ?? "").trim().toLowerCase();
  const mode: "entrega" | "retirada" = b.mode === "entrega" ? "entrega" : "retirada";
  const sel = Array.isArray(b.items) ? b.items : [];

  if (!slug) return NextResponse.json({ error: "loja não informada" }, { status: 400 });
  if (!b.customerName?.trim() || !b.phone?.trim()) return NextResponse.json({ error: "Nome e telefone são obrigatórios" }, { status: 400 });
  if (!sel.length) return NextResponse.json({ error: "pedido vazio" }, { status: 400 });
  if (mode === "entrega" && !b.address?.trim()) return NextResponse.json({ error: "Endereço é obrigatório na entrega" }, { status: 400 });

  const { data: loja } = await db().from("stores").select("id").eq("slug", slug).eq("active", true).maybeSingle();
  if (!loja) return NextResponse.json({ error: "loja não encontrada" }, { status: 404 });
  const storeId = (loja as { id: string }).id;

  // gate do módulo: delivery só se a loja ligou (retirada é sempre permitida)
  const cfg = await getStoreConfig(storeId);
  if (mode === "entrega" && cfg?.has_delivery === false) {
    return NextResponse.json({ error: "Esta loja não está aceitando entrega no momento." }, { status: 400 });
  }

  try {
    const resolved = await resolveOrderItems(storeId, sel);
    if (!resolved.length) return NextResponse.json({ error: "itens indisponíveis" }, { status: 400 });

    const store = await getStore(storeId);
    const subtotalCents = resolved.reduce((s, it) => s + it.qty * it.unitPriceCents, 0);

    // taxa de entrega: por bairro (zonas) ou taxa única; retirada = 0
    let feeCents = 0;
    if (mode === "entrega") {
      if (store.deliveryMode === "zones") {
        const zona = store.deliveryZones.find((z) => z.bairro === b.bairro);
        if (!zona) return NextResponse.json({ error: "Escolha um bairro de entrega válido" }, { status: 400 });
        feeCents = zona.feeCents;
      } else {
        feeCents = store.deliveryFeeCents;
      }
    }
    const totalCents = subtotalCents + feeCents;
    if (totalCents < store.minOrderCents) {
      return NextResponse.json({ error: `Pedido mínimo de R$ ${(store.minOrderCents / 100).toFixed(2).replace(".", ",")}` }, { status: 400 });
    }

    // mapeia pro shape do orders-store (1 OrderItem por linha; mods entram no nome)
    const items: OrderItem[] = resolved.map((it) => ({
      group: "",
      name: it.name + (it.mods?.length ? ` (${it.mods.map((m) => m.name).join(", ")})` : ""),
      qty: it.qty,
      paidCents: it.qty * it.unitPriceCents,
    }));

    // ficha técnica agregada → baixa de estoque (mesma lógica do delivery do açaí)
    const consumesMap: Record<string, number> = {};
    for (const it of resolved) for (const r of it.recipe) consumesMap[r.stockId] = (consumesMap[r.stockId] ?? 0) + r.qty * it.qty;
    const consumes = Object.entries(consumesMap).map(([stockId, qty]) => ({ stockId, qty: +qty.toFixed(3) }));

    const paymentMethod = PAYMENTS.includes(b.paymentMethod as PaymentMethod) ? (b.paymentMethod as PaymentMethod) : undefined;

    const order = await addOrder(
      {
        customerName: b.customerName.trim(),
        phone: b.phone.trim(),
        address: mode === "entrega" ? b.address?.trim() : undefined,
        mode,
        sizeLabel: mode === "entrega" ? "Delivery" : "Retirada",
        items,
        subtotalCents,
        feeCents,
        totalCents,
        consumes,
        bairro: mode === "entrega" ? b.bairro : undefined,
        paymentMethod, // só registro — não processamos pagamento
      },
      new Date().toISOString(),
      "recebido",
      storeId,
    );

    return NextResponse.json({ ok: true, order: { display: order.display, totalCents, code: order.code } }, { status: 201 });
  } catch (e) {
    console.error("delivery-pedido:", e);
    return NextResponse.json({ error: "Não consegui enviar o pedido. Tente de novo." }, { status: 500 });
  }
}
