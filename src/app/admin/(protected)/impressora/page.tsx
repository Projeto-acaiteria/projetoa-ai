import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getStore } from "@/lib/settings-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { getStations } from "@/lib/menu-bar-store";
import { resolveStoreId } from "@/lib/auth/current";
import ImpressoraClient from "./ImpressoraClient";

export const dynamic = "force-dynamic";

export default async function ImpressoraPage() {
  await requireNavAccess("/admin/impressora");
  const storeId = await resolveStoreId();
  const [store, cfg] = await Promise.all([getStore(storeId), getStoreConfig(storeId)]);
  // lojas com estações (bar/restaurante) configuram 1 impressora por estação (cozinha/bar)
  const stations = cfg?.has_stations ? await getStations(storeId) : [];
  return (
    <>
      <PageHeader title="Impressora" sub="Impressão térmica 80mm — cupom do caixa e vias de preparo por estação" />
      <ImpressoraClient storeName={store.name} stations={stations} />
    </>
  );
}
