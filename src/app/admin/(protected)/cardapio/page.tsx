import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { getStore } from "@/lib/settings-store";
import { IconBowl } from "@/components/Icons";
import QRCardapio from "@/components/admin/QRCardapio";
import CardapioEditor from "@/components/admin/CardapioEditor";

export const dynamic = "force-dynamic";

export default async function CardapioAdminPage() {
  const store = await getStore();
  return (
    <>
      <PageHeader
        title="Cardápio"
        sub="Você controla tudo: tamanhos, preços, adicionais e o que é grátis"
        action={
          <Link
            href="/cardapio"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink"
          >
            <IconBowl width={17} height={17} className="text-brand-600" /> Ver cardápio público
          </Link>
        }
      />

      <QRCardapio storeName={store.name} storeTagline={store.tagline} />
      <CardapioEditor />
    </>
  );
}
