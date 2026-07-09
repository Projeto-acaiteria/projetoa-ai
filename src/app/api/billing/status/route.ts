import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getCurrentStore } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/billing/status — o checkout inline faz polling aqui a cada 5s. Quando o webhook do Asaas
// confirma o pagamento e vira status='active', o painel libera sozinho (sem refresh manual). — ComandaPRO 3.8
export async function GET() {
  const loja = await getCurrentStore();
  if (!loja) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: sub } = await db()
    .from("subscriptions")
    .select("status, pago_ate")
    .eq("store_id", loja.id)
    .maybeSingle();

  return NextResponse.json({ subscription: sub ?? null });
}
