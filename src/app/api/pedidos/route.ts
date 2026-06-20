import { NextResponse } from "next/server";
import { addOrder, listOrders, type OrderItem } from "@/lib/orders-store";
import { readMenu } from "@/lib/menu-store";
import { getStore } from "@/lib/settings-store";
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { getCurrentStore } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resolve a loja do pedido público: pelo slug (cardápio /[slug]); sem slug = transição (Cantinho).
async function resolveOrderStore(slug?: string): Promise<string> {
  if (slug) {
    const { data } = await db().from("stores").select("id").eq("slug", slug).eq("active", true).maybeSingle();
    if (data) return (data as { id: string }).id;
  }
  return resolveStoreId();
}

export async function GET() {
  // listar pedidos = ADMIN (sem login não pode varrer os pedidos do tenant default)
  const loja = await getCurrentStore();
  if (!loja) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const orders = await listOrders(loja.id);
  return NextResponse.json({ orders });
}

type RecvItem = { group?: string; name?: string; qty?: number };
type RecvBody = {
  slug?: string; // loja (cardápio público por /[slug])
  customerName?: string;
  phone?: string;
  address?: string;
  mode?: string;
  sizeLabel?: string;
  bairro?: string;
  items?: RecvItem[];
};

type Calc =
  | { error: string }
  | { sizeLabel: string; items: OrderItem[]; subtotalCents: number; feeCents: number; totalCents: number; consumes: { stockId: string; qty: number }[] };

// Recalcula o pedido SÓ pelo menu/loja — descarta qualquer preço/consumo enviado
// pelo cliente (o link é público; não dá pra confiar no que vem do navegador).
async function recompute(body: RecvBody, storeId: string): Promise<Calc> {
  const menu = await readMenu(storeId);
  const store = await getStore(storeId);

  const size = menu.sizes.find((s) => s.label === body.sizeLabel);
  if (!size) return { error: "Tamanho inválido" };

  const recv = (body.items ?? []).filter((it) => Number(it.qty) > 0);
  const consumes: Record<string, number> = {};
  for (const ing of size.recipe ?? []) consumes[ing.stockId] = (consumes[ing.stockId] || 0) + ing.qty;

  // reaplica grátis-até-N na ordem do menu, com o preço REAL de cada modificador
  let modifiersCents = 0;
  const items: OrderItem[] = [];
  for (const g of menu.groups) {
    let freeLeft = g.paid ? 0 : g.freeUpTo;
    for (const mod of g.items) {
      const r = recv.find((x) => x.group === g.title && x.name === mod.name);
      const q = Math.max(0, Math.floor(Number(r?.qty) || 0));
      if (q === 0) continue;
      let paidCents = 0;
      for (let i = 0; i < q; i++) {
        if (freeLeft > 0) freeLeft--;
        else paidCents += mod.priceCents;
      }
      modifiersCents += paidCents;
      items.push({ group: g.title, name: mod.name, qty: q, paidCents });
      for (const ing of mod.recipe ?? []) consumes[ing.stockId] = (consumes[ing.stockId] || 0) + ing.qty * q;
    }
  }

  const subtotalCents = size.priceCents + modifiersCents;
  let feeCents = 0;
  if (body.mode === "entrega") {
    if (store.deliveryMode === "zones") {
      const zona = store.deliveryZones.find((z) => z.bairro === body.bairro);
      if (!zona) return { error: "Escolha um bairro de entrega válido" };
      feeCents = zona.feeCents;
    } else {
      feeCents = store.deliveryFeeCents;
    }
  }
  const totalCents = subtotalCents + feeCents;
  if (totalCents < store.minOrderCents) {
    return { error: `Pedido mínimo de R$ ${(store.minOrderCents / 100).toFixed(2).replace(".", ",")}` };
  }
  const consumesArr = Object.entries(consumes).map(([stockId, qty]) => ({ stockId, qty: +qty.toFixed(3) }));
  return { sizeLabel: size.label, items, subtotalCents, feeCents, totalCents, consumes: consumesArr };
}

export async function POST(req: Request) {
  let body: RecvBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.customerName?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: "Nome e telefone são obrigatórios" }, { status: 400 });
  }
  if (!body.sizeLabel || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "Pedido incompleto" }, { status: 400 });
  }
  if (body.mode === "entrega" && !body.address?.trim()) {
    return NextResponse.json({ error: "Endereço é obrigatório na entrega" }, { status: 400 });
  }

  const storeId = await resolveOrderStore(body.slug);

  // tudo recalculado no servidor — o preço do client é ignorado
  const calc = await recompute(body, storeId);
  if ("error" in calc) return NextResponse.json({ error: calc.error }, { status: 400 });

  const order = await addOrder(
    {
      customerName: body.customerName.trim(),
      phone: body.phone.trim(),
      address: body.address?.trim(),
      mode: body.mode === "entrega" ? "entrega" : "retirada",
      sizeLabel: calc.sizeLabel,
      items: calc.items,
      subtotalCents: calc.subtotalCents,
      feeCents: calc.feeCents,
      totalCents: calc.totalCents,
      consumes: calc.consumes,
      bairro: body.bairro,
    },
    new Date().toISOString(),
    "recebido",
    storeId,
  );

  return NextResponse.json({ ok: true, order }, { status: 201 });
}
