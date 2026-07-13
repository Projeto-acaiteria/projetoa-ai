import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getCurrentStore } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import { listOrders } from "@/lib/orders-store";
import { listServiceOrders } from "@/lib/service-orders-store";
import { dateBR } from "@/lib/date-br";
import RelatoriosClient from "./RelatoriosClient";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  await requireNavAccess("/admin/relatorios");
  const store = await getCurrentStore();
  const cfg = store ? await getStoreConfig(store.id) : null;
  if (familyOf(cfg?.business_type) !== "service") redirect("/admin");

  const [orders, os] = await Promise.all([listOrders(), listServiceOrders()]);

  // vendas de peça no balcão (entregues, não canceladas) → linhas de produto
  const sales = orders
    .filter((o) => o.mode === "balcao" && o.status === "entregue" && !o.cancelled)
    .map((o) => ({
      date: dateBR(o.createdAt),
      customer: (o.customerName || "").trim(),
      total: o.totalCents,
      lines: o.items.map((i) => ({ name: i.name, qty: i.qty, cents: i.paidCents })),
    }));

  // OS quitadas → receita por cliente (serviço + peças da OS)
  const osPaid = os
    .filter((o) => o.paymentStatus === "quitada" && o.paidAt && !["cancelado"].includes(o.status))
    .map((o) => ({ date: dateBR(o.paidAt as string), customer: (o.customerName || "").trim(), total: o.totalCents, serviceCents: o.serviceValueCents, partsCents: o.partsValueCents }));

  return (
    <>
      <PageHeader title="Relatórios" sub="Curva ABC de produtos e clientes — o que mais rende — com exportação" />
      <RelatoriosClient sales={sales} osPaid={osPaid} />
    </>
  );
}
