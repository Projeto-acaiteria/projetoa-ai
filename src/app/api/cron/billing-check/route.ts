import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { BILLING } from "@/config/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron de billing (ComandaPRO 3.6) — roda 1x/dia (Vercel Cron). Auth: Bearer CRON_SECRET.
// Quem EXPIRA é o cron, não o gate (lição AgendaPRO). permanent_courtesy isenta (Cantinho seguro).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const now = new Date();
  const out = { trial_expirados: 0, past_due: 0 };

  // 1. Trial vencido (created_at + trialDias < agora) → pending_payment (bloqueia → /bloqueado).
  const limiteTrial = new Date(now);
  limiteTrial.setDate(limiteTrial.getDate() - BILLING.trialDias);
  const { data: trials } = await db()
    .from("subscriptions")
    .select("store_id")
    .eq("status", "trial")
    .eq("permanent_courtesy", false)
    .lt("created_at", limiteTrial.toISOString());
  for (const t of trials ?? []) {
    await db().from("subscriptions").update({ status: "pending_payment" }).eq("store_id", t.store_id);
    out.trial_expirados++;
  }

  // 2. Fallback: active com pago_ate vencido (caso o webhook OVERDUE não chegue) → past_due + 3d.
  const grace = new Date(now);
  grace.setDate(grace.getDate() + 3);
  const { data: vencidos } = await db()
    .from("subscriptions")
    .select("store_id")
    .eq("status", "active")
    .eq("permanent_courtesy", false)
    .not("pago_ate", "is", null)
    .lt("pago_ate", now.toISOString());
  for (const v of vencidos ?? []) {
    await db()
      .from("subscriptions")
      .update({ status: "past_due", grace_ends_at: grace.toISOString() })
      .eq("store_id", v.store_id);
    out.past_due++;
  }

  return NextResponse.json({ ok: true, ...out });
}
