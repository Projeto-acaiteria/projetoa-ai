import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { createMontagemOS, type MontagemPart } from "@/lib/service-orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// API pública: o site posta o BUILD do cliente (lista de SKUs) → vira uma OS de montagem PENDENTE
// no ComandaPRO. Mesmo destino do montador do balcão (recepção atribui técnico → monta → quita).
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

  let b: { skus?: string[]; customerName?: string; customerPhone?: string; montagemFeeCents?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400, headers: CORS });
  }
  const skus = Array.isArray(b.skus) ? b.skus.map(String) : [];
  if (!skus.length) return NextResponse.json({ error: "nenhuma peça na montagem" }, { status: 400, headers: CORS });

  // resolve cada SKU no estoque da loja (preço é do sistema, não do que o site mandar — anti-fraude)
  const { data: items } = await db().from("stock_items").select("data").eq("store_id", storeId).in("id", skus);
  const bySku = new Map(((items ?? []) as { data: Record<string, unknown> }[]).map((r) => [String(r.data?.id ?? ""), r.data]));
  const parts: MontagemPart[] = skus
    .map((sku) => {
      const d = bySku.get(sku);
      return d ? { sku, name: String(d.name ?? sku), priceCents: Number(d.sellPriceCents ?? 0) } : null;
    })
    .filter((p): p is MontagemPart => !!p);
  if (!parts.length) return NextResponse.json({ error: "peças não encontradas no estoque da loja" }, { status: 400, headers: CORS });

  try {
    const os = await createMontagemOS({
      customerName: (b.customerName ?? "").trim() || "Cliente do site",
      customerPhone: b.customerPhone ? String(b.customerPhone) : undefined,
      parts,
      montagemFeeCents: b.montagemFeeCents != null ? Number(b.montagemFeeCents) : undefined,
    }, storeId);
    return NextResponse.json({ ok: true, osId: os.id, code: os.code }, { status: 201, headers: CORS });
  } catch (e) {
    console.error("loja/montagem:", e);
    return NextResponse.json({ error: "Não consegui gerar a OS." }, { status: 500, headers: CORS });
  }
}
