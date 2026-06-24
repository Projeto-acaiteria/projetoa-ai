import { PageHeader, Badge } from "@/components/admin/ui";
import { getStore } from "@/lib/settings-store";
import { getCurrentStore } from "@/lib/auth/store";
import PedidosClient from "./PedidosClient";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const [store, cur] = await Promise.all([getStore(), getCurrentStore()]);
  return (
    <>
      <PageHeader
        title="Pedidos"
        sub="Pedidos do cardápio público caem aqui em tempo real"
        action={<Badge tone="lime">atualiza sozinho</Badge>}
      />
      <PedidosClient storeName={store.name} storeSlug={cur?.slug ?? ""} endereco={store.endereco} cnpj={store.cnpj} tel={store.whatsapp} waMsgs={store.waMsgs} />
    </>
  );
}
