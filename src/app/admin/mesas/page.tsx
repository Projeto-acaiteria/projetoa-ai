import { PageHeader, Badge } from "@/components/admin/ui";
import { getStore } from "@/lib/settings-store";
import { readMenu } from "@/lib/menu-store";
import MesasClient from "./MesasClient";

export const dynamic = "force-dynamic";

export default async function MesasPage() {
  const [store, menu] = await Promise.all([getStore(), readMenu()]);
  const sizes = menu.sizes.map((s) => ({
    id: s.id,
    label: s.label,
    priceCents: s.priceCents,
    ml: s.ml,
  }));

  return (
    <>
      <PageHeader
        title="Mesas"
        sub="Salão · abra a comanda, lance itens e feche a conta"
        action={<Badge tone="lime">tempo real</Badge>}
      />
      <MesasClient pricePerKgCents={store.pricePerKgCents} sizes={sizes} />
    </>
  );
}
