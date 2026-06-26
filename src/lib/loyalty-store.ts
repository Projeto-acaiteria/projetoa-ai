// Config de fidelidade editável pelo dono. Multi-tenant: por store_id (default Cantinho na
// transição — ver src/lib/tenant.ts).
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { DEFAULT_LOYALTY, type LoyaltyConfig, type Reward } from "@/lib/loyalty";

export async function getLoyalty(storeId?: string): Promise<LoyaltyConfig> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("app_loyalty").select("data").eq("store_id", sid).maybeSingle();
  const raw = (data?.data as Partial<LoyaltyConfig>) ?? {};
  return {
    ...DEFAULT_LOYALTY,
    ...raw,
    rewards: Array.isArray(raw.rewards) && raw.rewards.length ? raw.rewards : DEFAULT_LOYALTY.rewards,
  };
}

export async function setLoyalty(
  input: Partial<LoyaltyConfig>,
  storeId?: string,
): Promise<LoyaltyConfig> {
  storeId = storeId ?? (await resolveStoreId());
  const cur = await getLoyalty(storeId);
  const clean: LoyaltyConfig = { ...cur };

  if (input.pointsPerBrl != null) clean.pointsPerBrl = Math.max(0.1, Math.min(100, Number(input.pointsPerBrl) || 1));
  if (input.validityDays != null) clean.validityDays = Math.max(7, Math.min(3650, Math.round(Number(input.validityDays) || 60)));
  if (input.doubleMultiplier != null) clean.doubleMultiplier = Math.max(1, Math.min(10, Number(input.doubleMultiplier) || 2));
  if (input.firstPurchaseBonus != null) clean.firstPurchaseBonus = Math.max(0, Math.min(10000, Math.round(Number(input.firstPurchaseBonus) || 0)));
  if ("doubleDay" in input) {
    const d = input.doubleDay;
    clean.doubleDay = d == null || d === ("" as unknown) ? null : Math.max(0, Math.min(6, Math.round(Number(d))));
  }
  if (Array.isArray(input.rewards)) {
    clean.rewards = (input.rewards as Reward[])
      .map((r) => ({ points: Math.max(1, Math.round(Number(r.points) || 0)), label: String(r.label || "").trim().slice(0, 60), ...(r.sizeId ? { sizeId: String(r.sizeId) } : {}) }))
      .filter((r) => r.label) // prêmio genérico: basta um nome (sizeId não é mais exigido)
      .sort((a, b) => a.points - b.points);
    if (!clean.rewards.length) clean.rewards = cur.rewards;
  }

  await db().from("app_loyalty").upsert({ store_id: storeId, data: clean }, { onConflict: "store_id" });
  return clean;
}
