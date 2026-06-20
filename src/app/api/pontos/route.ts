import { NextResponse } from "next/server";
import { getByPhone, listCustomers, redeem, normPhone } from "@/lib/customers-store";
import { getLoyalty } from "@/lib/loyalty-store";
import { getCurrentStore } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pontos            -> lista todos (ADMIN — exige login; vaza base de clientes/PII)
// GET /api/pontos?phone=...  -> saldo de um cliente (PÚBLICO — página meus-pontos)
export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone");
  const { rewards } = await getLoyalty();
  if (phone) {
    const customer = await getByPhone(phone);
    return NextResponse.json({ customer, rewards });
  }
  // listar TODOS = admin
  if (!(await getCurrentStore())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const customers = await listCustomers();
  return NextResponse.json({ customers, rewards });
}

// POST /api/pontos  { phone, rewardPoints }  -> resgate (confirmado pelo operador)
export async function POST(req: Request) {
  let body: { phone?: string; rewardPoints?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { rewards } = await getLoyalty();
  const reward = rewards.find((r) => r.points === body.rewardPoints);
  if (!body.phone || !reward) {
    return NextResponse.json({ error: "Telefone ou recompensa inválidos" }, { status: 400 });
  }
  const customer = await getByPhone(body.phone);
  if (!customer || customer.points < reward.points) {
    return NextResponse.json({ error: "Pontos insuficientes" }, { status: 400 });
  }
  const updated = await redeem(normPhone(body.phone), reward.points, reward.label, new Date().toISOString());
  return NextResponse.json({ ok: true, customer: updated, redeemed: reward.label });
}
