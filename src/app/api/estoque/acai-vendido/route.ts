import { NextResponse } from "next/server";
import { getCurrentStore } from "@/lib/auth/store";
import { weightSoldPeriods } from "@/lib/weight-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Açaí vendido (kg) por HOJE / 7 DIAS / MÊS — o que o Vidal quer bater o olho.
export async function GET() {
  const loja = await getCurrentStore();
  if (!loja) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  return NextResponse.json(await weightSoldPeriods(loja.id));
}
