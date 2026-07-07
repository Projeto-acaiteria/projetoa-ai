import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireNavAccess } from "@/lib/auth/guard";
import { PageHeader, Badge, Card } from "@/components/admin/ui";
import { getCurrentMembership } from "@/lib/auth/store";
import { getServiceOrder, OS_STATUS_LABEL } from "@/lib/service-orders-store";
import TecOSWork from "./TecOSWork";

export const dynamic = "force-dynamic";

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Detalhe da OS na visão do TÉCNICO: só o trabalho de bancada (status, laudo, fotos) + a comissão
// DELE nessa OS. Sem total da loja, sem quitar, sem atribuir. Só a OS atribuída a ele.
export default async function TecOSPage({ params }: { params: Promise<{ id: string }> }) {
  await requireNavAccess("/admin/minha-area");
  const m = await getCurrentMembership();
  if (!m) redirect("/login");
  if (m.role !== "technician" || !m.technicianId) redirect("/admin/minha-area");

  const { id } = await params;
  const res = await getServiceOrder(id);
  if (!res) notFound();
  const { os, parts } = res;
  // dono da OS: só o técnico atribuído entra (a API tem o mesmo guard; aqui é a porta da UI)
  if (os.staffId !== m.technicianId) redirect("/admin/minha-area");

  const minhaComissao = Math.round((os.serviceValueCents * os.commissionPercent) / 100);

  return (
    <>
      <PageHeader
        title={os.code ?? "Ordem de serviço"}
        sub={`${os.customerName || "—"} · ${os.device || "—"}`}
        action={<Badge tone="lime">{OS_STATUS_LABEL[os.status]}</Badge>}
      />

      <div className="mb-3">
        <Link href="/admin/minha-area" className="text-xs font-bold text-[var(--text-muted)] hover:text-brand-600">← Minha área</Link>
      </div>

      <div className="grid max-w-4xl gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Aparelho</h3>
            <Row label="Cliente" value={os.customerName || "—"} />
            <Row label="Aparelho" value={os.device || "—"} />
            {os.imei && <Row label="IMEI / série" value={os.imei} mono />}
            {os.problem && <Row label="Defeito / pedido" value={os.problem} />}
          </Card>

          {parts.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Peças ({parts.length})</h3>
              <div className="divide-y divide-line">
                {parts.map((p) => (
                  <div key={p.id} className="py-2 text-sm text-ink">
                    {p.name}{p.qty > 1 ? ` · ${p.qty} un` : ""}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Sua comissão nessa OS</span>
              <span className={`font-mono text-sm font-bold ${os.paymentStatus === "quitada" ? "text-[var(--green-ok)]" : "text-ink"}`}>{brl(minhaComissao)}</span>
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-faded)]">
              {os.paymentStatus === "quitada" ? "apurada — OS quitada" : `a apurar (${os.commissionPercent}% do serviço, quando a recepção quitar)`}
            </p>
          </Card>
        </div>

        <TecOSWork id={os.id} status={os.status} diagnosis={os.diagnosis ?? ""} photos={os.photos} />
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className={`text-right text-sm text-ink-2 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
