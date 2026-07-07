import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getCurrentStore } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import EstoqueClient from "./EstoqueClient";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  await requireNavAccess("/admin/estoque");
  const store = await getCurrentStore();
  const cfg = store ? await getStoreConfig(store.id) : null;
  const family = familyOf(cfg?.business_type); // "service" (AT) libera specs do montador; food segue igual
  return (
    <>
      <PageHeader
        title="Estoque"
        sub={family === "service" ? "Produtos, specs e vitrine" : "Insumos e produtos · validade e estoque mínimo"}
        action={<Badge tone="lime">alertas ativos</Badge>}
      />
      <EstoqueClient family={family} />
    </>
  );
}
