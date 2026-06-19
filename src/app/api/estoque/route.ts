import { NextResponse } from "next/server";
import { listStock, addItem, type NewStockItem, type StockCategory } from "@/lib/stock-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATS: StockCategory[] = [
  "sorvete", "picole", "bebida", "salgado", "doce",
  "polpa", "fruta", "cereal", "cobertura", "adicional",
  "embalagem", "limpeza", "outro",
];

export async function GET() {
  return NextResponse.json({ items: await listStock() });
}

export async function POST(req: Request) {
  let b: Partial<NewStockItem>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.name?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }
  const item = await addItem(
    {
      name: b.name.trim(),
      category: CATS.includes(b.category as StockCategory) ? (b.category as StockCategory) : "outro",
      qty: Math.max(0, Number(b.qty) || 0),
      unit: (b.unit || "un").trim(),
      minQty: Math.max(0, Number(b.minQty) || 0),
      expiry: b.expiry || undefined,
      sellPriceCents: b.sellPriceCents ? Math.max(0, Math.round(Number(b.sellPriceCents))) : undefined,
    },
    new Date().toISOString().slice(0, 10),
  );
  return NextResponse.json({ ok: true, item }, { status: 201 });
}
