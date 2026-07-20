import { NextResponse } from "next/server";
import { cancelTabItem } from "@/lib/tables-store";
import { getCurrentUser, getCurrentMembership } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/cancelar-item — cancela unidade(s) de um item de comanda ABERTA.
// Gate: só caixa/admin (garçom lança mas NÃO cancela item já enviado). Estorno de estoque +
// log auditável (motivo/quem) vivem no cancelTabItem. { itemId, units?, reason }.
// units ausente = cancela a linha toda (lixeira); units=1 = tira 1 unidade (−).
export async function POST(req: Request) {
  const role = (await getCurrentMembership())?.role;
  if (role === "waiter") {
    return NextResponse.json({ error: "Garçom não cancela item já lançado — chame o caixa." }, { status: 403 });
  }

  let b: { itemId?: number; units?: number; reason?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const itemId = Number(b.itemId);
  if (!Number.isFinite(itemId) || itemId <= 0) return NextResponse.json({ error: "itemId inválido" }, { status: 400 });
  const reason = (b.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "Diga o motivo do cancelamento." }, { status: 400 });
  const units = Number.isFinite(Number(b.units)) && Number(b.units) > 0 ? Math.floor(Number(b.units)) : undefined;

  try {
    const by = (await getCurrentUser())?.email ?? undefined;
    const r = await cancelTabItem(itemId, { units, reason, by });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
