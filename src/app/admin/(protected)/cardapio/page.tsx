import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/lib/supabase";
import { getStore } from "@/lib/settings-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { resolveStoreId } from "@/lib/auth/current";
import { IconBowl } from "@/components/Icons";
import QRCardapio from "@/components/admin/QRCardapio";
import CardapioEditor from "@/components/admin/CardapioEditor";
import CardapioBarEditor from "@/components/admin/CardapioBarEditor";

export const dynamic = "force-dynamic";

export default async function CardapioAdminPage() {
  const storeId = await resolveStoreId();
  const [store, cfg] = await Promise.all([getStore(storeId), getStoreConfig(storeId)]);
  // bar E grid usam o schema relacional (menu_categories/menu_products) → CardapioBarEditor.
  // Só o açaí usa o editor de montagem-no-copo (blob).
  const isBar = cfg?.menu_template === "bar" || cfg?.menu_template === "grid";

  const { data: s } = await db().from("stores").select("slug").eq("id", storeId).maybeSingle();
  const slug = (s as { slug?: string } | null)?.slug;
  const publicHref = isBar && slug ? `/${slug}` : "/cardapio";

  return (
    <>
      <PageHeader
        title="Cardápio"
        sub={isBar
          ? "Categorias e produtos — a estação de cada categoria decide se o pedido vai pra cozinha ou pro bar"
          : "Você controla tudo: tamanhos, preços, adicionais e o que é grátis"}
        action={
          <Link href={publicHref} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink">
            <IconBowl width={17} height={17} className="text-brand-600" /> Ver cardápio público
          </Link>
        }
      />

      {isBar ? (
        <CardapioBarEditor />
      ) : (
        <>
          <QRCardapio storeName={store.name} storeTagline={store.tagline} slug={slug} />
          <CardapioEditor hasEstoque={!!cfg?.has_estoque} />
        </>
      )}
    </>
  );
}
