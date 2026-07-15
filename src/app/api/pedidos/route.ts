import { NextResponse } from "next/server";
import { addOrder, listOrders, maxOrderId, ordersSince, type OrderItem } from "@/lib/orders-store";
import { readMenu } from "@/lib/menu-store";
import { getStore } from "@/lib/settings-store";
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { getCurrentStore } from "@/lib/auth/store";
import { snapshotConsumes } from "@/lib/stock-store";

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

export async function GET(req: Request) {
  // listar pedidos = ADMIN (sem login não pode varrer os pedidos do tenant default)
  const loja = await getCurrentStore();
  if (!loja) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  // baseline do vigia: só o maior id atual (não baixa o histórico)
  if (searchParams.has("maxid")) {
    return NextResponse.json({ maxId: await maxOrderId(loja.id) });
  }
  // delta do vigia: só o que entrou depois do último id visto (quase sempre vazio)
  const desde = searchParams.get("desde");
  if (desde !== null) {
    return NextResponse.json({ orders: await ordersSince(Number(desde) || 0, loja.id) });
  }
  // lista completa: tela Pedidos
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
  onlinePayMethod?: string; // forma declarada no pedido do link
  trocoParaCents?: number; // dinheiro: troco pra quanto
};

type Calc =
  | { error: string }
  | { sizeLabel: string; items: OrderItem[]; subtotalCents: number; feeCents: number; totalCents: number; consumes: { stockId: string; qty: number; costCents?: number }[] };

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
  // pedido mínimo é regra de ENTREGA (compensar a corrida) — não trava retirada no balcão
  if (body.mode === "entrega" && totalCents < store.minOrderCents) {
    return { error: `Pedido mínimo de R$ ${(store.minOrderCents / 100).toFixed(2).replace(".", ",")}` };
  }
  const consumesArr = await snapshotConsumes(Object.entries(consumes).map(([stockId, qty]) => ({ stockId, qty: +qty.toFixed(3) })), storeId);
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
      // forma de pagamento é declaração do cliente — não afeta o preço, só chega pra loja saber
      // como cobrar na entrega. Sanitiza pro union; troco só faz sentido no dinheiro.
      onlinePayMethod: (["pix", "cartao", "dinheiro"] as const).find((m) => m === body.onlinePayMethod),
      trocoParaCents:
        body.onlinePayMethod === "dinheiro" && Number(body.trocoParaCents) > 0
          ? Math.round(Number(body.trocoParaCents))
          : undefined,
    },
    new Date().toISOString(),
    // pedido do link já entra EM PREPARO (a loja começa a fazer na hora). A próxima ação é "saiu
    // p/ entrega", que dispara o aviso no WhatsApp pro cliente. Não há etapa "recebido" manual.
    "preparo",
    storeId,
  );

  return NextResponse.json({ ok: true, order }, { status: 201 });
}
