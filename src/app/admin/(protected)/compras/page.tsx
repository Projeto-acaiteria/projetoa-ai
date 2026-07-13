import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { listStock } from "@/lib/stock-store";
import ComprasClient from "./ComprasClient";

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  await requireNavAccess("/admin/compras");
  // produtos do estoque pro seletor de itens (ligar a compra ao produto → dá entrada certo)
  const produtos = (await listStock()).map((s) => ({ id: s.id, name: s.name, costCents: s.costCents ?? 0 }));
  return (
    <>
      <PageHeader title="Compras" sub="Reposição de estoque — o pedido dá entrada no estoque e gera a conta a pagar" />
      <ComprasClient produtos={produtos} />
    </>
  );
}
