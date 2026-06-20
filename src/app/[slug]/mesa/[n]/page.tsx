import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { readBarMenu } from "@/lib/menu-bar-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { getStore, isOpenNow } from "@/lib/settings-store";
import TemplateBar from "@/components/bar/TemplateBar";
import TemplateGrid from "@/components/grid/TemplateGrid";

export const dynamic = "force-dynamic";

// Pedido PELA MESA (QR /[slug]/mesa/N). O cliente na mesa monta e envia — cai na comanda da mesa
// já roteado por estação (cozinha/bar) → KDS. Por ora só o modelo bar usa pedido pela mesa.
export default async function MesaCardapio({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params;
  const tableNumber = Number(n);
  if (!Number.isInteger(tableNumber) || tableNumber < 1) notFound();

  const { data: loja } = await db().from("stores").select("id").eq("slug", slug).eq("active", true).maybeSingle();
  if (!loja) notFound();
  const storeId = (loja as { id: string }).id;

  const tpl = (await getStoreConfig(storeId))?.menu_template;
  if (tpl !== "bar" && tpl !== "grid") notFound();

  const [categories, store] = await Promise.all([readBarMenu(storeId), getStore(storeId)]);
  const props = {
    storeName: store.name,
    tagline: store.tagline,
    aberto: isOpenNow(store.hours),
    categories,
    slug,
    tableNumber,
  };
  return tpl === "grid" ? <TemplateGrid {...props} /> : <TemplateBar {...props} />;
}
