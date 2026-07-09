import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chamado PELA MESA (público via QR /[slug]/mesa/N): cliente chama o garçom ou pede a conta.
// Resolve a loja pelo slug (sem sessão) e cria o service_call → aparece no cockpit de Mesas
// (adm/garçom) via CallsAlert. Dedup: não empilha chamado do mesmo tipo pendente na mesma mesa.
const TYPES = ["conta", "atendente"] as const;

export async function POST(req: Request) {
  let b: { slug?: string; tableNumber?: number; type?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const slug = (b.slug ?? "").trim().toLowerCase();
  const tableNumber = Number(b.tableNumber);
  const type = b.type as (typeof TYPES)[number];

  if (!slug) return NextResponse.json({ error: "loja não informada" }, { status: 400 });
  if (!Number.isInteger(tableNumber) || tableNumber < 1) return NextResponse.json({ error: "mesa inválida" }, { status: 400 });
  if (!TYPES.includes(type)) return NextResponse.json({ error: "tipo inválido" }, { status: 400 });

  const { data: loja } = await db().from("stores").select("id").eq("slug", slug).eq("active", true).maybeSingle();
  if (!loja) return NextResponse.json({ error: "loja não encontrada" }, { status: 404 });
  const storeId = (loja as { id: string }).id;

  // dedup: já tem chamado pendente do mesmo tipo nessa mesa? não duplica (cliente tocou 2×)
  const { data: existing } = await db()
    .from("service_calls")
    .select("id")
    .eq("store_id", storeId)
    .eq("table_number", tableNumber)
    .eq("type", type)
    .eq("status", "pendente")
    .maybeSingle();

  if (!existing) {
    const { error } = await db()
      .from("service_calls")
      .insert({ store_id: storeId, table_number: tableNumber, type, status: "pendente" });
    if (error) return NextResponse.json({ error: "não consegui registrar o chamado" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
