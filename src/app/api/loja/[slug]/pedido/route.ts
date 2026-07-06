import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { createPartsSale, type PartsSaleInput } from "@/lib/parts-sale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PEDIDO do SITE (headless): o cliente monta o carrinho na vitrine e "pede". Vira um pedido
// RECEBIDO (não paga ainda, SEM baixa de estoque) que o balcão confirma. Resolve a loja pelo slug.
// CORS liberado (o site é outro domínio). Preço é resolvido no servidor (anti-fraude).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: store } = await db().from("stores").select("id").eq("slug", slug).eq("active", true).maybeSingle();
  if (!store) return NextResponse.json({ error: "loja não encontrada" }, { status: 404, headers: CORS });
  const storeId = (store as { id: string }).id;

  let b: PartsSaleInput;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400, headers: CORS });
  }
  try {
    const r = await createPartsSale(storeId, b, { deliver: false });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400, headers: CORS });
    return NextResponse.json({ ok: true, display: r.order.display, code: r.order.code }, { status: 201, headers: CORS });
  } catch (e) {
    console.error("pedido:", e);
    return NextResponse.json({ error: "Não consegui registrar o pedido." }, { status: 500, headers: CORS });
  }
}
