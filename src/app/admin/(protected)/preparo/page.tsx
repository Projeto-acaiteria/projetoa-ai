import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getStations } from "@/lib/menu-bar-store";
import { getStore } from "@/lib/settings-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { resolveStoreId } from "@/lib/auth/current";
import KdsClient from "./KdsClient";

export const dynamic = "force-dynamic";

// KDS — telas de preparo (cozinha/bar). Cada pedido já vem roteado pra UMA estação pelo motor
// (addTabItems particiona). A loja vem do dono logado.
export default async function PreparoPage() {
  await requireNavAccess("/admin/preparo");
  const storeId = await resolveStoreId();
  const [stations, store, cfg] = await Promise.all([getStations(storeId), getStore(storeId), getStoreConfig(storeId)]);
  return (
    <>
      <PageHeader
        title="Preparo"
        sub={cfg?.kitchen_screen ? "Pedidos das mesas caem aqui já separados por estação" : "O que foi pedido e ainda não saiu — a cozinha trabalha pelo ticket impresso"}
        action={<Badge tone="lime">atualiza sozinho</Badge>}
      />
      <KdsClient stations={stations} loja={store.name} kitchenScreen={!!cfg?.kitchen_screen} />
    </>
  );
}
