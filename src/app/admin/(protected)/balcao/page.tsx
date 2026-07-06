import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { readBarMenu } from "@/lib/menu-bar-store";
import { getStore, getCardMachines } from "@/lib/settings-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { resolveStoreId } from "@/lib/auth/current";
import BalcaoClient from "./BalcaoClient";

export const dynamic = "force-dynamic";

// Venda de balcão pro menu relacional (bar/grid/marmitaria). Operador pesa/lança e recebe.
export default async function BalcaoPage() {
  await requireNavAccess("/admin/balcao");
  const storeId = await resolveStoreId();
  const [categories, store, machines, cfg] = await Promise.all([readBarMenu(), getStore(), getCardMachines(), getStoreConfig(storeId)]);
  return (
    <>
      <PageHeader title="Balcão" sub="Pese, lance e receba — venda rápida no balcão" action={<Badge tone="lime">bar / a quilo</Badge>} />
      <BalcaoClient categories={categories} storeName={store.name} machines={machines} endereco={store.endereco} cnpj={store.cnpj} tel={store.whatsapp} cupomRodape={store.cupomRodape} loyaltyEnabled={!!cfg?.loyalty_enabled} />
    </>
  );
}
