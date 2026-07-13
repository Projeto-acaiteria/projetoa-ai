import { notFound } from "next/navigation";
import { requireNavAccess } from "@/lib/auth/guard";
import { PageHeader, Badge, Card } from "@/components/admin/ui";
import { getServiceOrder, osCommissionCents, OS_STATUS_LABEL } from "@/lib/service-orders-store";
import { listStaff } from "@/lib/staff-store";
import OSActions from "./OSActions";

export const dynamic = "force-dynamic";

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function OSDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireNavAccess("/admin/os");
  const { id } = await params;
  const [res, staff] = await Promise.all([getServiceOrder(id), listStaff()]);
  if (!res) notFound();
  const { os, parts } = res;
  const commission = osCommissionCents(os);
  const tecnico = staff.find((s) => s.id === os.staffId);

  return (
    <>
      <PageHeader
        title={os.code ?? "Ordem de serviço"}
        sub={`${os.customerName || "—"} · ${os.device || "—"}`}
        action={<Badge tone="lime">{OS_STATUS_LABEL[os.status]}</Badge>}
      />

      <div className="grid max-w-4xl gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Cliente e aparelho</h3>
            <Row label="Cliente" value={os.customerName || "—"} />
            {os.customerPhone && <Row label="WhatsApp" value={os.customerPhone} />}
            <Row label="Aparelho" value={os.device || "—"} />
            {os.imei && <Row label="IMEI / série" value={os.imei} mono />}
            {os.condicoes && <Row label="Condições na entrada" value={os.condicoes} />}
            {os.acessorios && <Row label="Acessórios" value={os.acessorios} />}
            {os.problem && <Row label="Defeito / pedido" value={os.problem} />}
            {os.diagnosis && <Row label="Laudo" value={os.diagnosis} />}
          </Card>

          {parts.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Peças ({parts.length})</h3>
              <div className="divide-y divide-line">
                {parts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink">{p.name}</div>
                      {p.sku && <div className="font-mono text-[10px] text-[var(--text-muted)]">{p.sku} · {p.qty} un</div>}
                    </div>
                    <div className="font-mono text-sm text-ink">{brl(p.qty * p.unitCostCents)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Valores</h3>
            <Row label="Serviço (mão de obra)" value={brl(os.serviceValueCents)} />
            <Row label="Peças" value={brl(os.partsValueCents)} />
            {os.discountCents > 0 && <Row label="Desconto" value={`− ${brl(os.discountCents)}`} />}
            <div className="mt-2 border-t border-line pt-2">
              <Row label="Total" value={brl(os.totalCents)} strong />
            </div>
            <div className="mt-3 rounded-lg bg-bg-surface-2 p-3 text-xs">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Técnico</span>
                <span className="font-semibold text-ink">{tecnico?.name ?? "não atribuído"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Comissão ({os.commissionPercent}% do serviço)</span>
                <span className="font-mono font-bold text-ink">{os.paymentStatus === "quitada" ? brl(commission) : "—"}</span>
              </div>
              <div className="mt-1 text-[10px] text-[var(--text-faded)]">
                {os.paymentStatus === "quitada" ? "apurada (OS quitada)" : "nasce quando a OS for quitada"}
              </div>
            </div>
          </Card>

          <OSActions id={os.id} status={os.status} paymentStatus={os.paymentStatus} staffId={os.staffId} staff={staff.map((s) => ({ id: s.id, name: s.name }))} />
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className={`text-right text-sm ${strong ? "font-extrabold text-ink" : "text-ink-2"} ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
