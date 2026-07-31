import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fila de impressão do CAIXA. Celular do garçom NÃO imprime — quando ele pede "Imprimir conta",
// o HTML do cupom entra aqui e o vigia do Caixa (CaixaPrintQueue) imprime na impressora do balcão.
// POST {html, kind?} → enfileira | POST {done:[ids]} → marca impresso | GET ?station= → pendentes.
export async function POST(req: Request) {
  let b: { html?: string; kind?: string; station?: string; done?: number[] };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const sid = await resolveStoreId();

  if (Array.isArray(b.done) && b.done.length) {
    const ids = b.done.filter((n) => Number.isFinite(n));
    if (ids.length) await db().from("print_jobs").update({ status: "done" }).eq("store_id", sid).in("id", ids);
    return NextResponse.json({ ok: true });
  }

  if (!b.html || typeof b.html !== "string") return NextResponse.json({ error: "html é obrigatório" }, { status: 400 });
  const { error } = await db().from("print_jobs").insert({
    store_id: sid, station: b.station || "caixa", kind: b.kind || "conferencia", html: b.html.slice(0, 20000), status: "pending",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const sid = await resolveStoreId();
  const station = new URL(req.url).searchParams.get("station") || "caixa";
  const { data } = await db()
    .from("print_jobs")
    .select("id, html, kind")
    .eq("store_id", sid).eq("station", station).eq("status", "pending")
    .order("created_at")
    .limit(20);
  return NextResponse.json({ jobs: data ?? [] });
}
