import { NextResponse } from "next/server";
import { getOrCreateOpenTab } from "@/lib/tables-store";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/abrir — abre (ou recupera) a comanda da mesa
export async function POST(req: Request) {
  let b: { tableNumber?: number; label?: string; pax?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof b.tableNumber !== "number" || !Number.isFinite(b.tableNumber)) {
    return NextResponse.json({ error: "tableNumber é obrigatório" }, { status: 400 });
  }

  try {
    const { data: table, error } = await db()
      .from("tables")
      .select("id")
      .eq("number", b.tableNumber)
      .single();
    if (error || !table) {
      return NextResponse.json({ error: "Mesa não encontrada" }, { status: 400 });
    }
    const tab = await getOrCreateOpenTab(Number(table.id), b.label?.trim() || undefined, undefined, b.pax);
    return NextResponse.json({ tab });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
