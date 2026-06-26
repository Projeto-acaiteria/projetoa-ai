import { NextResponse } from "next/server";
import { saveCustomer, searchCustomers, getByPhone, listCustomers, normPhone } from "@/lib/customers-store";
import { listOrders } from "@/lib/orders-store";
import { getLoyalty } from "@/lib/loyalty-store";
import { validBalance } from "@/lib/loyalty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/clientes            -> todos, enriquecidos (último pedido, nº pedidos) p/ CRM
// GET /api/clientes?q=...       -> busca por nome/telefone (cru)
// GET /api/clientes?phone=...   -> um cliente exato
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const phone = sp.get("phone");
  if (phone) {
    const [customer, loy] = await Promise.all([getByPhone(phone), getLoyalty()]);
    if (customer) customer.points = validBalance(customer.history, loy.validityDays); // saldo válido ao vivo
    return NextResponse.json({ customer });
  }

  const q = sp.get("q");
  if (q !== null) return NextResponse.json({ customers: await searchCustomers(q) });

  // enriquecido: cruza com pedidos pra último pedido + contagem
  const [customers, orders, loy] = await Promise.all([listCustomers(), listOrders(), getLoyalty()]);
  const byPhone: Record<string, { last: string; count: number }> = {};
  for (const o of orders) {
    const ph = normPhone(o.phone || "");
    if (!ph) continue;
    const e = (byPhone[ph] ??= { last: "", count: 0 });
    e.count++;
    if (o.createdAt > e.last) e.last = o.createdAt;
  }
  const enriched = customers.map((c) => ({
    phone: c.phone,
    name: c.name,
    points: validBalance(c.history, loy.validityDays), // saldo válido (não o bruto)
    birthday: c.birthday ?? null,
    lastOrderDate: byPhone[c.phone]?.last || null,
    orderCount: byPhone[c.phone]?.count || 0,
  }));
  return NextResponse.json({ customers: enriched });
}

// POST /api/clientes { phone, name, birthday } -> cadastro rápido
export async function POST(req: Request) {
  let b: { phone?: string; name?: string; birthday?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.phone?.trim()) return NextResponse.json({ error: "Telefone obrigatório" }, { status: 400 });
  const customer = await saveCustomer(b.phone, b.name || "", b.birthday || undefined, new Date().toISOString());
  return NextResponse.json({ ok: true, customer }, { status: 201 });
}
