import { NextResponse } from "next/server";
import { listStock, addItem, type NewStockItem, type StockCategory } from "@/lib/stock-store";
import { todayBR } from "@/lib/date-br";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATS: StockCategory[] = [
  "sorvete", "picole", "bebida", "bebida_alcoolica", "salgado", "doce",
  "polpa", "fruta", "cereal", "cobertura", "adicional",
  "proteina", "paes_massas", "laticinio", "mercearia",
  "embalagem", "limpeza", "outro",
  // vertical AT (hardware/informática)
  "computadores", "cpu", "cooler", "mobo", "ram", "gpu", "ssd",
  "gabinete", "fonte", "mouse", "teclado", "mousepad", "monitor", "headset", "cadeira",
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
      maxQty: b.maxQty ? Math.max(0, Number(b.maxQty)) || undefined : undefined,
      expiry: b.expiry || undefined,
      sellPriceCents: b.sellPriceCents ? Math.max(0, Math.round(Number(b.sellPriceCents))) : undefined,
      dosesPerBottle: b.dosesPerBottle ? Math.max(1, Math.round(Number(b.dosesPerBottle))) : undefined,
      costPerBottleCents: b.costPerBottleCents ? Math.max(0, Math.round(Number(b.costPerBottleCents))) : undefined,
      costCents: b.costCents ? Math.max(0, Math.round(Number(b.costCents))) : undefined,
      barcode: b.barcode?.trim() || undefined,
      ncm: b.ncm?.replace(/\D+/g, "").slice(0, 8) || undefined,
      cest: b.cest?.replace(/\D+/g, "").slice(0, 7) || undefined,
      cfop: b.cfop?.replace(/\D+/g, "").slice(0, 4) || undefined,
      origem: b.origem != null && String(b.origem).trim() !== "" ? String(b.origem).replace(/\D+/g, "").slice(0, 1) : undefined,
      supplier: b.supplier?.trim() || undefined,
      purchaseUnit: b.purchaseUnit?.trim() || undefined,
      purchaseFactor: b.purchaseFactor ? Math.max(0, Number(b.purchaseFactor)) || undefined : undefined,
      // vertical AT: specs do montador + vitrine (marca/selo/destaque/foto)
      specs: b.specs && typeof b.specs === "object" ? b.specs : undefined,
      brand: b.brand?.trim() || undefined,
      badge: b.badge?.trim() || undefined,
      highlight: b.highlight === true || undefined,
      image: b.image?.trim() || undefined,
    },
    todayBR(),
  );
  return NextResponse.json({ ok: true, item }, { status: 201 });
}
