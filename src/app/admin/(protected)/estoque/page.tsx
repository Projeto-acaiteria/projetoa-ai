import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import EstoqueClient from "./EstoqueClient";

export default async function EstoquePage() {
  await requireNavAccess("/admin/estoque");
  return (
    <>
      <PageHeader
        title="Estoque"
        sub="Insumos e produtos · validade e estoque mínimo"
        action={<Badge tone="lime">alertas ativos</Badge>}
      />
      <EstoqueClient />
    </>
  );
}
