import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getStore } from "@/lib/settings-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// API pública de VITRINE (headless): o site lê o catálogo da loja direto do ComandaPRO (fonte única).
// Resolve a loja pelo slug (como o /[slug] do cardápio). CORS liberado (o site é outro domínio).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: store } = await db().from("stores").select("id, name").eq("slug", slug).eq("active", true).maybeSingle();
  if (!store) return NextResponse.json({ error: "loja não encontrada" }, { status: 404, headers: CORS });
  const s = store as { id: string; name: string };

  // % de desconto no PIX é config do Adm (settings) — o site mostra o preço PIX JÁ descontado.
  const pixPct = Math.max(0, Math.min(100, Number((await getStore(s.id)).pixDiscountPercent ?? 0)));

  const { data } = await db().from("stock_items").select("data").eq("store_id", s.id);
  const products = ((data ?? []) as { data: Record<string, unknown> }[])
    .filter((r) => (r.data ?? {}).published === true) // VITRINE: só produtos publicados vão pro site
    .map((r) => {
      const d = r.data ?? {};
      const priceCents = Number(d.sellPriceCents ?? 0);
      return {
        sku: String(d.id ?? ""),
        name: String(d.name ?? ""),
        category: String(d.category ?? "outro"),
        brand: d.brand ?? null,
        priceCents,
        pixPriceCents: Math.round(priceCents * (1 - pixPct / 100)),
        stock: Number(d.qty ?? 0),
        specs: (d.specs as Record<string, unknown>) ?? {},
        badge: (d.badge as string | null) ?? null,
        highlight: Boolean(d.highlight),
        image: (d.image as string) || null, // foto real (Storage/site) — senão o site usa SVG por categoria
        images: Array.isArray(d.images) ? (d.images as string[]) : undefined,
        description: (d.description as string) || null, // pro site/SEO
      };
    })
    .filter((p) => p.sku && p.priceCents > 0); // só o que tem preço de venda

  return NextResponse.json({ slug, store: s.name, count: products.length, pixDiscountPercent: pixPct, products }, { headers: CORS });
}
