import { NextResponse } from "next/server";
import { getStationOrders, advanceTabOrder } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Feed do KDS (telas de preparo). A loja vem do dono logado (resolveStoreId no contexto).
// GET ?stations=cozinha,bar → pedidos abertos das estações. POST {orderId,status} → avança.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const stations = (url.searchParams.get("stations") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!stations.length) return NextResponse.json({ orders: [] });
  const orders = await getStationOrders(stations);
  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  let b: { orderId?: number; status?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  if (!b.orderId || !b.status) return NextResponse.json({ error: "orderId e status obrigatórios" }, { status: 400 });
  await advanceTabOrder(b.orderId, b.status);
  return NextResponse.json({ ok: true });
}
