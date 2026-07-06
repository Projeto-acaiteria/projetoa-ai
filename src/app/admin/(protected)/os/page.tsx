import { PageHeader, Badge, Card } from "@/components/admin/ui";
import { listServiceOrders, OS_STATUS_LABEL, type OSStatus } from "@/lib/service-orders-store";
import Link from "next/link";
import NovaOSButton from "./NovaOSButton";

export const dynamic = "force-dynamic";

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");

const STATUS_CLS: Record<OSStatus, string> = {
  aguardando: "bg-bg-surface-2 text-[var(--text-muted)]",
  em_reparo: "bg-bg-surface-2 text-brand-600",
  pronto: "bg-bg-surface-2 text-[var(--green-ok)]",
  entregue: "bg-bg-surface-2 text-[var(--text-faded)]",
  cancelado: "bg-bg-surface-2 text-red-500",
};

export default async function OSPage() {
  const orders = await listServiceOrders();
  const abertas = orders.filter((o) => o.status !== "entregue" && o.status !== "cancelado");
  const fechadas = orders.filter((o) => o.status === "entregue" || o.status === "cancelado");

  return (
    <>
      <PageHeader
        title="Ordens de Serviço"
        sub="Recebimento do aparelho → orçamento → reparo → entrega"
        action={<div className="flex items-center gap-2"><Link href="/admin/os/montar" className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink hover:border-brand-600">Montar PC</Link><NovaOSButton /></div>}
      />

      {orders.length === 0 ? (
        <Card className="max-w-xl p-6 text-center text-sm text-[var(--text-muted)]">
          Nenhuma OS ainda. O check-in de aparelho entra no próximo passo.
        </Card>
      ) : (
        <div className="max-w-3xl space-y-4">
          {abertas.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Em aberto ({abertas.length})</h2>
              {abertas.map((o) => <OSRow key={o.id} os={o} />)}
            </section>
          )}
          {fechadas.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-faded)]">Fechadas ({fechadas.length})</h2>
              {fechadas.map((o) => <OSRow key={o.id} os={o} />)}
            </section>
          )}
        </div>
      )}
    </>
  );
}

function OSRow({ os }: { os: Awaited<ReturnType<typeof listServiceOrders>>[number] }) {
  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-brand-600">{os.code ?? os.id.slice(0, 8)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[os.status]}`}>{OS_STATUS_LABEL[os.status]}</span>
        </div>
        <div className="truncate text-sm text-ink">{os.customerName || "—"} · {os.device || "—"}</div>
        {os.problem && <div className="truncate text-xs text-[var(--text-muted)]">{os.problem}</div>}
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="font-mono text-sm font-bold text-ink">{brl(os.totalCents)}</div>
        <div className="text-[10px] text-[var(--text-muted)]">{os.paymentStatus}</div>
      </div>
    </Card>
  );
}
