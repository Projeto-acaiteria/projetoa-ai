import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getCurrentStore } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import FinanceiroClient from "./FinanceiroClient";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  await requireNavAccess("/admin/financeiro");
  // family decide as categorias de despesa (service = peças/frete; food = insumos/embalagens).
  const store = await getCurrentStore();
  const cfg = store ? await getStoreConfig(store.id) : null;
  const family = familyOf(cfg?.business_type);
  return (
    <>
      <PageHeader title="Financeiro" sub="Fluxo de caixa, despesas e resultado" />
      <FinanceiroClient family={family} />
    </>
  );
}
