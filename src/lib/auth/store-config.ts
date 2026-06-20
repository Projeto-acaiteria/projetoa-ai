import { cache } from "react";
import { db } from "@/lib/supabase";
import type { BusinessType, MenuTemplate } from "@/config/segments";

// Config multi-segmento da loja (Fase 4). As telas/módulos liam estas flags pra mostrar/esconder
// features (peso, mesas, cover, dose/garrafa, estações, fidelidade) conforme o tipo de negócio.
export type StoreConfig = {
  store_id: string;
  business_type: BusinessType;
  menu_template: MenuTemplate;
  sells_by_weight: boolean;
  has_balcao: boolean;
  has_tables: boolean;
  has_delivery: boolean;
  cover_enabled: boolean;
  stock_dose: boolean;
  has_stations: boolean;
  loyalty_enabled: boolean;
};

export const getStoreConfig = cache(async (storeId: string): Promise<StoreConfig | null> => {
  const { data } = await db().from("store_config").select("*").eq("store_id", storeId).maybeSingle();
  return (data as StoreConfig) ?? null;
});

// Flags que o DONO pode ligar/desligar no painel (as outras vêm do segmento e não mudam pela UI).
const TOGGLEABLE: (keyof StoreConfig)[] = ["has_delivery", "loyalty_enabled", "cover_enabled", "stock_dose"];

export async function setStoreConfig(patch: Partial<StoreConfig>, storeId: string): Promise<void> {
  const clean: Record<string, boolean> = {};
  for (const k of TOGGLEABLE) if (k in patch) clean[k] = Boolean(patch[k]);
  if (!Object.keys(clean).length) return;
  const { error } = await db().from("store_config").update(clean).eq("store_id", storeId);
  if (error) throw new Error("Falha ao salvar configuração da loja: " + error.message);
}
