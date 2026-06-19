import { PageHeader, Badge } from "@/components/admin/ui";
import EstoqueClient from "./EstoqueClient";

export default function EstoquePage() {
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
