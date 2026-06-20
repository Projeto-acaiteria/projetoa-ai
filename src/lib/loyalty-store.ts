// Config de fidelidade editável pelo dono. Multi-tenant: por store_id (default Cantinho na
// transição — ver src/lib/tenant.ts).
import { db } from "@/lib/supabase";
import { CANTINHO_STORE_ID } from "@/lib/tenant";
import { DEFAULT_LOYALTY, type LoyaltyConfig, type Reward } from "@/lib/loyalty";

export async function getLoyalty(storeId: string = CANTINHO_STORE_ID): Promise<LoyaltyConfig> {
  const { data } = await db().from("app_loyalty").select("data").eq("store_id", storeId).maybeSingle();
  const raw = (data?.data as Partial<LoyaltyConfig>) ?? {};
  return {
    ...DEFAULT_LOYALTY,
    ...raw,
    rewards: Array.isArray(raw.rewards) && raw.rewards.length ? raw.rewards : DEFAULT_LOYALTY.rewards,
  };
}

export async function setLoyalty(
  input: Partial<LoyaltyConfig>,
  storeId: string = CANTINHO_STORE_ID,
): Promise<LoyaltyConfig> {
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
      .map((r) => ({ points: Math.max(1, Math.round(Number(r.points) || 0)), label: String(r.label || "").slice(0, 60), sizeId: String(r.sizeId || "") }))
      .filter((r) => r.label && r.sizeId)
      .sort((a, b) => a.points - b.points);
    if (!clean.rewards.length) clean.rewards = cur.rewards;
  }

  await db().from("app_loyalty").upsert({ store_id: storeId, data: clean }, { onConflict: "store_id" });
  return clean;
}
