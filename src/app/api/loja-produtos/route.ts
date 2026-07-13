import { NextResponse } from "next/server";
import { updateItem } from "@/lib/stock-store";
import { todayBR } from "@/lib/date-br";
import { getCurrentStore, getCurrentRole } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/loja-produtos — gestão da VITRINE (site headless) do vertical SERVICE (Starteq).
// Hoje só liga/desliga `published` de um produto (o editor completo vem depois). Endpoint DEDICADO
// (não toca a rota de estoque compartilhada com food) e blindado em 3 camadas:
//   1. family==="service" → food (Cantinho/Medellín) recebe 403 e nunca chega ao banco.
//   2. role==="owner" → recepção/técnico não publicam.
//   3. storeId vem da SESSÃO (updateItem→resolveStoreId) — nunca do body → não vaza entre tenants.
export async function PATCH(req: Request) {
  const store = await getCurrentStore();
  if (!store) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const cfg = await getStoreConfig(store.id);
  if (familyOf(cfg?.business_type) !== "service") {
    return NextResponse.json({ error: "Indisponível neste tipo de loja" }, { status: 403 });
  }
  const role = await getCurrentRole();
  if (role !== "owner") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  let b: { id?: string; published?: boolean };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.id || typeof b.published !== "boolean") {
    return NextResponse.json({ error: "id e published são obrigatórios" }, { status: 400 });
  }

  const item = await updateItem(b.id, { published: b.published }, todayBR());
  if (!item) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}
