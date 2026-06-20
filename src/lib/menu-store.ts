// Store do cardápio · editável pelo adm (arquivo JSON, vira tabelas no Supabase).
// Default (seed) = SIZES/GROUPS de menu.ts. Quando o adm salva, passa a valer o JSON.
// Multi-tenant: por store_id (default Cantinho na transição — ver src/lib/tenant.ts).
import { db } from "@/lib/supabase";
import { CANTINHO_STORE_ID } from "@/lib/tenant";
import { SIZES, GROUPS, type Size, type ModifierGroup } from "@/lib/menu";

export type Menu = { sizes: Size[]; groups: ModifierGroup[] };

export async function readMenu(storeId: string = CANTINHO_STORE_ID): Promise<Menu> {
  const { data } = await db().from("app_menu").select("data").eq("store_id", storeId).maybeSingle();
  const m = data?.data as Menu | undefined;
  if (m && Array.isArray(m.sizes) && Array.isArray(m.groups)) return m;
  // clone do default — nunca devolver a referência de SIZES/GROUPS
  return JSON.parse(JSON.stringify({ sizes: SIZES, groups: GROUPS })) as Menu;
}

export async function writeMenu(menu: Menu, storeId: string = CANTINHO_STORE_ID): Promise<Menu> {
  await db().from("app_menu").upsert({ store_id: storeId, data: menu }, { onConflict: "store_id" });
  return readMenu(storeId); // read-after-write
}
