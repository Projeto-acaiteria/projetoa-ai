import { NextResponse } from "next/server";
import { getOrCreateOpenTab } from "@/lib/tables-store";
import { setTabWaiter } from "@/lib/staff-store";
import { resolveStoreId } from "@/lib/auth/current";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/abrir — abre (ou recupera) a comanda da mesa
export async function POST(req: Request) {
  let b: { tableNumber?: number; label?: string; pax?: number; waiterId?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof b.tableNumber !== "number" || !Number.isFinite(b.tableNumber)) {
    return NextResponse.json({ error: "tableNumber é obrigatório" }, { status: 400 });
  }

  try {
    const storeId = await resolveStoreId();
    const { data: table, error } = await db()
      .from("tables")
      .select("id")
      .eq("store_id", storeId) // multi-tenant: a mesa N é da LOJA logada (várias lojas têm mesa N)
      .eq("number", b.tableNumber)
      .maybeSingle();
    if (error || !table) {
      return NextResponse.json({ error: "Mesa não encontrada" }, { status: 400 });
    }
    // label default "Mesa N" — senão a comanda fica sem rótulo e o KDS mostra "Balcão" (bug do teste)
    const tab = await getOrCreateOpenTab(Number(table.id), b.label?.trim() || `Mesa ${b.tableNumber}`, storeId, b.pax);
    if (b.waiterId) await setTabWaiter(Number(tab.id), b.waiterId, storeId);
    return NextResponse.json({ tab });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
