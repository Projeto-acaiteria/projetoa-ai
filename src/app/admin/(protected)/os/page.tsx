import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { listServiceOrders } from "@/lib/service-orders-store";
import Link from "next/link";
import NovaOSButton from "./NovaOSButton";
import OSListClient from "./OSListClient";

export const dynamic = "force-dynamic";

export default async function OSPage() {
  await requireNavAccess("/admin/os");
  const orders = (await listServiceOrders()).map((o) => ({
    id: o.id, code: o.code, customerName: o.customerName, device: o.device, problem: o.problem,
    status: o.status, totalCents: o.totalCents, paymentStatus: o.paymentStatus, createdAt: o.createdAt,
  }));

  return (
    <>
      <PageHeader
        title="Ordens de Serviço"
        sub="Recebimento do aparelho → orçamento → reparo → entrega"
        action={<div className="flex items-center gap-2"><Link href="/admin/os/montar" className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink hover:border-brand-600">Montar PC</Link><NovaOSButton /></div>}
      />
      {orders.length === 0 ? (
        <p className="max-w-xl rounded-xl border border-line bg-bg-elevated p-6 text-center text-sm text-[var(--text-muted)]">Nenhuma OS ainda. Clique em <b>+ Nova OS</b> pra fazer o check-in do primeiro aparelho.</p>
      ) : (
        <OSListClient orders={orders} />
      )}
    </>
  );
}
