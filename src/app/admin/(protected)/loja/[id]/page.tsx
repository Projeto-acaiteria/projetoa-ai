import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getCurrentStore } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import { listStock, type StockCategory } from "@/lib/stock-store";
import LojaEditorClient, { type EditorProduct } from "../LojaEditorClient";

export const dynamic = "force-dynamic";

// Editor de um produto EXISTENTE da vitrine. Espelha o guard + redirect de family da lista (page.tsx):
// nav access + family==="service" por URL → food nunca chega aqui.
export default async function EditLojaProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireNavAccess("/admin/loja");
  const store = await getCurrentStore();
  const cfg = store ? await getStoreConfig(store.id) : null;
  if (familyOf(cfg?.business_type) !== "service") redirect("/admin");

  const { id } = await params;
  const stock = await listStock(store?.id);
  const s = stock.find((x) => x.id === id);
  if (!s) redirect("/admin/loja");

  const gallery = Array.isArray(s.images) && s.images.length ? s.images : s.image ? [s.image] : [];
  const product: EditorProduct = {
    id: s.id,
    name: s.name,
    description: s.description ?? "",
    category: s.category as StockCategory,
    brand: s.brand ?? "",
    qty: Number(s.qty ?? 0),
    sellPriceCents: Number(s.sellPriceCents ?? 0),
    image: s.image ?? "",
    images: gallery,
    specs: (s.specs ?? {}) as EditorProduct["specs"],
    highlight: s.highlight === true,
    badge: s.badge ?? "",
    published: s.published === true,
  };

  return (
    <>
      <PageHeader title="Editar produto" sub={s.name} />
      <LojaEditorClient mode="edit" product={product} />
    </>
  );
}
