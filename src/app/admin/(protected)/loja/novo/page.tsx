import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getCurrentStore } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import LojaEditorClient, { type EditorProduct } from "../LojaEditorClient";

export const dynamic = "force-dynamic";

// Editor de produto NOVO. Mesmo guard + redirect de family da lista. Produto entra como rascunho
// (o servidor força published=false no POST).
export default async function NovoLojaProductPage() {
  await requireNavAccess("/admin/loja");
  const store = await getCurrentStore();
  const cfg = store ? await getStoreConfig(store.id) : null;
  if (familyOf(cfg?.business_type) !== "service") redirect("/admin");

  const blank: EditorProduct = {
    id: null,
    name: "",
    description: "",
    category: "cpu",
    brand: "",
    qty: 0,
    sellPriceCents: 0,
    image: "",
    images: [],
    specs: {},
    highlight: false,
    badge: "",
    published: false,
  };

  return (
    <>
      <PageHeader title="Novo produto" sub="Cadastre um produto da vitrine do site" />
      <LojaEditorClient mode="new" product={blank} />
    </>
  );
}
