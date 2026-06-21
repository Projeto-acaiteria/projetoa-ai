import { PageHeader, Badge } from "@/components/admin/ui";
import { getStore } from "@/lib/settings-store";
import { readMenu } from "@/lib/menu-store";
import { readBarMenu } from "@/lib/menu-bar-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { getActiveEvent } from "@/lib/events-store";
import { listStaff } from "@/lib/staff-store";
import { resolveStoreId } from "@/lib/auth/current";
import MesasClient from "./MesasClient";
import MesasBarClient from "./MesasBarClient";

export const dynamic = "force-dynamic";

export default async function MesasPage() {
  const storeId = await resolveStoreId();
  const cfg = await getStoreConfig(storeId);
  const isRelacional = cfg?.menu_template === "bar" || cfg?.menu_template === "grid";

  // show de hoje (couvert): só pergunta nº de pessoas ao abrir mesa se a loja tem cover + atração ao vivo hoje
  const ev = cfg?.cover_enabled ? await getActiveEvent(storeId) : null;
  const coverShow = ev ? { artist: ev.artist, coverCents: ev.cover_cents } : null;
  const staff = (await listStaff(storeId)).filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }));

  const header = (
    <PageHeader title="Mesas" sub="Salão · abra a comanda, lance itens e feche a conta" action={<Badge tone="lime">tempo real</Badge>} />
  );

  // bar/grid (menu relacional): comanda do operador espelhada do Medellín
  if (isRelacional) {
    const [categories, store] = await Promise.all([readBarMenu(storeId), getStore(storeId)]);
    return <>{header}<MesasBarClient categories={categories} coverShow={coverShow} staff={staff} storeName={store.name} /></>;
  }

  // açaí (copo/peso): fluxo existente
  const [store, menu] = await Promise.all([getStore(storeId), readMenu(storeId)]);
  const sizes = menu.sizes.map((s) => ({ id: s.id, label: s.label, priceCents: s.priceCents, ml: s.ml }));
  return <>{header}<MesasClient pricePerKgCents={store.pricePerKgCents} sizes={sizes} coverShow={coverShow} staff={staff} /></>;
}
