import { NextResponse } from "next/server";
import { getCurrentStore, getCurrentRole } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import { listPurchases, createPurchase, updatePurchase, receivePurchase, deletePurchase } from "@/lib/purchases-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/compras — compras/reposição do vertical SERVICE. Guard: autenticado + family service + owner/reception.
type Guard = { store: { id: string } } | { error: NextResponse };
async function guard(): Promise<Guard> {
  const store = await getCurrentStore();
  if (!store) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const cfg = await getStoreConfig(store.id);
  if (familyOf(cfg?.business_type) !== "service") return { error: NextResponse.json({ error: "Indisponível neste tipo de loja" }, { status: 403 }) };
  const role = await getCurrentRole();
  if (role !== "owner" && role !== "reception") return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  return { store };
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  return NextResponse.json({ purchases: await listPurchases(g.store.id) });
}

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const sid = g.store.id;
  let b: { action?: string; payload?: Record<string, unknown> };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  const p = b.payload ?? {};
  try {
    switch (b.action) {
      case "create": {
        const pur = await createPurchase(p as never, sid);
        return NextResponse.json({ ok: true, id: pur.id, code: pur.code });
      }
      case "update":
        await updatePurchase(String(p.id), p as never, sid);
        return NextResponse.json({ ok: true });
      case "receber":
        await receivePurchase(String(p.id), sid);
        return NextResponse.json({ ok: true });
      case "delete":
        await deletePurchase(String(p.id), sid);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    console.error("compras:", e);
    return NextResponse.json({ error: (e as Error).message || "Não consegui salvar." }, { status: 500 });
  }
}
