import { PageHeader, Badge } from "@/components/admin/ui";
import { getStations } from "@/lib/menu-bar-store";
import KdsClient from "./KdsClient";

export const dynamic = "force-dynamic";

// KDS — telas de preparo (cozinha/bar). Cada pedido já vem roteado pra UMA estação pelo motor
// (addTabItems particiona). A loja vem do dono logado.
export default async function PreparoPage() {
  const stations = await getStations();
  return (
    <>
      <PageHeader
        title="Preparo"
        sub="Pedidos das mesas caem aqui já separados por estação"
        action={<Badge tone="lime">atualiza sozinho</Badge>}
      />
      <KdsClient stations={stations} />
    </>
  );
}
