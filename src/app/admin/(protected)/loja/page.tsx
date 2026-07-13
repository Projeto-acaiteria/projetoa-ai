import { redirect } from "next/navigation";
import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getCurrentStore } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { getStore } from "@/lib/settings-store";
import { familyOf } from "@/config/segments";
import { listStock } from "@/lib/stock-store";
import LojaClient, { type LojaProduct } from "./LojaClient";

export const dynamic = "force-dynamic";

// Loja Online — gestão dos produtos do SITE (vitrine headless), estilo Shopify. SÓ vertical service (AT).
// Gate em 2 camadas: nav (family==="service" no AdminShell) + guard (requireNavAccess) + este redirect
// de family por URL. Food (Cantinho/Medellín) nunca chega aqui.
export default async function LojaPage() {
  await requireNavAccess("/admin/loja");
  const store = await getCurrentStore();
  const cfg = store ? await getStoreConfig(store.id) : null;
  if (familyOf(cfg?.business_type) !== "service") redirect("/admin");

  const [stock, settings] = await Promise.all([listStock(), getStore(store?.id)]);
  const pixDiscountPercent = Math.max(0, Math.min(100, Number(settings.pixDiscountPercent ?? 0)));

  const products: LojaProduct[] = stock.map((s) => ({
    id: s.id,
    name: s.name,
    brand: s.brand ?? "",
    category: String(s.category),
    qty: Number(s.qty ?? 0),
    sellPriceCents: Number(s.sellPriceCents ?? 0),
    image: s.image ?? "",
    badge: s.badge ?? "",
    published: s.published === true,
  }));
  const publishedCount = products.filter((p) => p.published).length;

  return (
    <>
      <PageHeader
        title="Loja Online"
        sub="Os produtos que aparecem no seu site"
        action={<Badge tone="lime">{publishedCount} no site</Badge>}
      />
      <LojaClient products={products} pixDiscountPercent={pixDiscountPercent} />
    </>
  );
}
