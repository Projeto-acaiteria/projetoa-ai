import { NextResponse } from "next/server";
import { transferTab } from "@/lib/tables-store";
import { getCurrentMembership } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/transferir — move a comanda pra outra mesa (cliente trocou de lugar).
// Gate: só caixa/admin (garçom não transfere). Destino LIVRE = move; destino OCUPADO + merge:true
// = funde as comandas numa só. { tabId, toTableNumber, merge? }.
export async function POST(req: Request) {
  const role = (await getCurrentMembership())?.role;
  if (role === "waiter") {
    return NextResponse.json({ error: "Garçom não transfere comanda — chame o caixa." }, { status: 403 });
  }

  let b: { tabId?: number; toTableNumber?: number; merge?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const tabId = Number(b.tabId);
  const toTableNumber = Number(b.toTableNumber);
  if (!Number.isFinite(tabId) || tabId <= 0) return NextResponse.json({ error: "tabId inválido" }, { status: 400 });
  if (!Number.isFinite(toTableNumber) || toTableNumber <= 0) return NextResponse.json({ error: "Mesa destino inválida" }, { status: 400 });

  try {
    const r = await transferTab(tabId, toTableNumber, { merge: !!b.merge });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
