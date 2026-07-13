import { NextResponse } from "next/server";
import { getCurrentStore, getCurrentRole } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import { testarConexao } from "@/lib/fiscal/focus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/fiscal — integração fiscal (Focus NFe). Guard: service + OWNER (financeiro/fiscal é do dono).
// Por ora só "testar" (checa se o token responde). Emissão será ligada após a reunião (certificado + regime).
async function guard() {
  const store = await getCurrentStore();
  if (!store) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const cfg = await getStoreConfig(store.id);
  if (familyOf(cfg?.business_type) !== "service") return { error: NextResponse.json({ error: "Indisponível neste tipo de loja" }, { status: 403 }) };
  const role = await getCurrentRole();
  if (role !== "owner") return { error: NextResponse.json({ error: "Só o dono acessa o fiscal" }, { status: 403 }) };
  return { store };
}

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  let b: { action?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "body inválido" }, { status: 400 }); }

  if (b.action === "testar") {
    const r = await testarConexao(g.store.id);
    return NextResponse.json({ ok: r.ok, status: r.status, httpStatus: r.httpStatus ?? null, message: r.message ?? null });
  }
  return NextResponse.json({ error: "ação inválida" }, { status: 400 });
}
