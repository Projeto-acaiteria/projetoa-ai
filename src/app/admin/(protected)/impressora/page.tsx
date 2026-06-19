import { PageHeader } from "@/components/admin/ui";
import { getStore } from "@/lib/settings-store";
import ImpressoraClient from "./ImpressoraClient";

export const dynamic = "force-dynamic";

export default async function ImpressoraPage() {
  const store = await getStore();
  return (
    <>
      <PageHeader title="Impressora" sub="Impressão térmica 80mm — cupom do caixa e dos pedidos do link" />
      <ImpressoraClient storeName={store.name} />
    </>
  );
}
