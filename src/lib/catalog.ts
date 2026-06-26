// Nomes dos itens do cardápio da loja, num lista plana — usado p/ sugerir prêmios de fidelidade
// (datalist). Universal: cobre os 2 mundos (açaí em blob + relacional menu_products) + revenda.
import { getStoreConfig } from "@/lib/auth/store-config";
import { readMenu } from "@/lib/menu-store";
import { readBarMenu } from "@/lib/menu-bar-store";
import { listStock } from "@/lib/stock-store";

export async function catalogItemNames(storeId: string): Promise<string[]> {
  const cfg = await getStoreConfig(storeId);
  const names = new Set<string>();
  const tpl = cfg?.menu_template;

  if (tpl === "bar" || tpl === "grid") {
    // mundo relacional: produtos das categorias
    for (const c of await readBarMenu(storeId)) for (const p of c.products) if (p.name) names.add(p.name);
  } else {
    // mundo açaí (default): copos + modificadores
    const menu = await readMenu(storeId);
    for (const s of menu.sizes) if (s.label) names.add(s.label);
    for (const g of menu.groups) for (const it of g.items) if (it.name) names.add(it.name);
  }
  // revenda (vale pros 2 mundos): itens de estoque com preço de venda
  for (const s of await listStock(storeId)) if (s.sellPriceCents && s.name) names.add(s.name);

  return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
