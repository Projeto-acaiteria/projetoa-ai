import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { readBarMenu } from "@/lib/menu-bar-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { getActiveEvent } from "@/lib/events-store";
import { getStore, isOpenNow } from "@/lib/settings-store";
import TemplateBar from "@/components/bar/TemplateBar";
import TemplateGrid from "@/components/grid/TemplateGrid";

// ISR 30s (era force-dynamic): cada scan de QR de mesa relia o cardápio inteiro do banco.
// Agora cacheia por (loja, mesa) por 30s. Cardápio é igual em toda mesa; edição aparece em ≤30s.
export const revalidate = 30;
// habilita ISR on-demand (cacheia o render por loja+mesa por 30s). Sem generateStaticParams o
// Next ignora o revalidate e relê o cardápio do banco a cada scan de QR. dynamicParams=true.
export function generateStaticParams() {
  return [];
}

// Pedido PELA MESA (QR /[slug]/mesa/N). O cliente na mesa monta e envia — cai na comanda da mesa
// já roteado por estação (cozinha/bar) → KDS. Por ora só o modelo bar usa pedido pela mesa.
export default async function MesaCardapio({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params;
  const tableNumber = Number(n);
  if (!Number.isInteger(tableNumber) || tableNumber < 1) notFound();

  const { data: loja } = await db().from("stores").select("id").eq("slug", slug).eq("active", true).maybeSingle();
  if (!loja) notFound();
  const storeId = (loja as { id: string }).id;

  const cfg = await getStoreConfig(storeId);
  const tpl = cfg?.menu_template;
  if (tpl !== "bar" && tpl !== "grid") notFound();

  const [categories, store, ev] = await Promise.all([
    readBarMenu(storeId),
    getStore(storeId),
    cfg?.cover_enabled ? getActiveEvent(storeId) : Promise.resolve(null),
  ]);
  const coverNotice = ev ? { artist: ev.artist, coverCents: ev.cover_cents } : null;
  const props = {
    storeName: store.name,
    tagline: store.tagline,
    aberto: isOpenNow(store.hours),
    categories,
    slug,
    tableNumber,
    coverNotice,
    branding: { logoUrl: store.logoUrl, bannerUrl: store.bannerUrl, primaryColor: store.primaryColor },
  };
  return tpl === "grid" ? <TemplateGrid {...props} /> : <TemplateBar {...props} />;
}
