// Store do cardápio · editável pelo adm (arquivo JSON, vira tabelas no Supabase).
// Default (seed) = SIZES/GROUPS de menu.ts. Quando o adm salva, passa a valer o JSON.
import { db } from "@/lib/supabase";
import { SIZES, GROUPS, type Size, type ModifierGroup } from "@/lib/menu";

export type Menu = { sizes: Size[]; groups: ModifierGroup[] };

export async function readMenu(): Promise<Menu> {
  const { data } = await db().from("app_menu").select("data").eq("id", 1).maybeSingle();
  const m = data?.data as Menu | undefined;
  if (m && Array.isArray(m.sizes) && Array.isArray(m.groups)) return m;
  // clone do default — nunca devolver a referência de SIZES/GROUPS
  return JSON.parse(JSON.stringify({ sizes: SIZES, groups: GROUPS })) as Menu;
}

export async function writeMenu(menu: Menu): Promise<Menu> {
  await db().from("app_menu").upsert({ id: 1, data: menu });
  return readMenu(); // read-after-write
}
