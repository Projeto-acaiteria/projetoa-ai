import { PageHeader, Badge } from "@/components/admin/ui";
import { getStations } from "@/lib/menu-bar-store";
import { getStore } from "@/lib/settings-store";
import KdsClient from "./KdsClient";

export const dynamic = "force-dynamic";

// KDS — telas de preparo (cozinha/bar). Cada pedido já vem roteado pra UMA estação pelo motor
// (addTabItems particiona). A loja vem do dono logado.
export default async function PreparoPage() {
  const [stations, store] = await Promise.all([getStations(), getStore()]);
  return (
    <>
      <PageHeader
        title="Preparo"
        sub="Pedidos das mesas caem aqui já separados por estação"
        action={<Badge tone="lime">atualiza sozinho</Badge>}
      />
      <KdsClient stations={stations} loja={store.name} />
    </>
  );
}
