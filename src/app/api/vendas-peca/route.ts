import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { createPartsSale, type PartsSaleInput } from "@/lib/parts-sale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Venda de balcão da ASSISTÊNCIA TÉCNICA (peças/periféricos). Sessão do dono/recepção.
// Rota própria (não reusa /api/vendas de food): sem gate de caixa, sem fidelidade, sem taxa de
// cartão de food, e — por construção — sem comissão de técnico (vira Order, não OS).
export async function POST(req: Request) {
  const storeId = await resolveStoreId();
  let b: PartsSaleInput;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  try {
    const r = await createPartsSale(storeId, b, { deliver: true });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, display: r.order.display, stockWarning: r.stockWarning });
  } catch (e) {
    console.error("vendas-peca:", e);
    return NextResponse.json({ error: "Não consegui registrar a venda." }, { status: 500 });
  }
}
