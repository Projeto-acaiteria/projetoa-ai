import { cache } from "react";
import { db } from "@/lib/supabase";

export type SubStatus = "pending_payment" | "trial" | "active" | "past_due" | "cancelled" | "expired";

export type Subscription = {
  id: string;
  store_id: string;
  status: SubStatus;
  pago_ate: string | null;
  grace_ends_at: string | null;
  permanent_courtesy: boolean;
  refunded_at: string | null;
  pix_link_atual: string | null;
  plano: string | null;
};

export const getSubscription = cache(async (storeId: string): Promise<Subscription | null> => {
  const { data } = await db().from("subscriptions").select("*").eq("store_id", storeId).maybeSingle();
  return (data as Subscription) ?? null;
});

// Gate de billing — olha SÓ o status (lição AgendaPRO: quem EXPIRA é o cron, não o gate).
// permanent_courtesy isenta (ex: Cantinho). trial e active passam.
export function isBlocked(sub: Subscription | null): boolean {
  if (!sub) return true;
  if (sub.permanent_courtesy) return false;
  if (sub.refunded_at) return true;
  if (sub.status === "pending_payment" || sub.status === "cancelled" || sub.status === "expired") return true;
  if (sub.status === "past_due") {
    const grace = sub.grace_ends_at ? new Date(sub.grace_ends_at).getTime() : 0;
    return grace < Date.now();
  }
  return false;
}
