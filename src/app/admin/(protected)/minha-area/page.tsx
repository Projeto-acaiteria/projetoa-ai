import { redirect } from "next/navigation";
import { requireNavAccess } from "@/lib/auth/guard";
import Link from "next/link";
import { PageHeader, Badge, Card } from "@/components/admin/ui";
import { getCurrentMembership } from "@/lib/auth/store";
import { listByTechnician, osCommissionCents, type ServiceOrder } from "@/lib/service-orders-store";

export const dynamic = "force-dynamic";

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const potentialCommission = (o: ServiceOrder) => Math.round((o.serviceValueCents * o.commissionPercent) / 100);

// Área do TÉCNICO: só as OS dele + a comissão dele (λ.garcom-app-so-pedidos — vê o próprio trabalho
// e o próprio ganho, nunca o financeiro da loja). A fila é agrupada por etapa de bancada.
export default async function MinhaAreaPage() {
  await requireNavAccess("/admin/minha-area");
  const m = await getCurrentMembership();
  if (!m) redirect("/login");

  const isTec = m.role === "technician" && !!m.technicianId;
  const orders = isTec ? await listByTechnician(m.technicianId as string) : [];
  const aFazer = orders.filter((o) => o.status === "aguardando");
  const emReparo = orders.filter((o) => o.status === "em_reparo");
  const prontas = orders.filter((o) => o.status === "pronto");
  const abertas = aFazer.length + emReparo.length + prontas.length;
  const comissaoApurada = orders.filter((o) => o.paymentStatus === "quitada").reduce((s, o) => s + osCommissionCents(o), 0);
  const potencial = orders
    .filter((o) => o.paymentStatus !== "quitada" && o.status !== "cancelado")
    .reduce((s, o) => s + potentialCommission(o), 0);

  return (
    <>
      <PageHeader title="Minha área" sub="Suas ordens de serviço e sua comissão" action={<Badge tone="lime">técnico</Badge>} />

      {!isTec ? (
        <Card className="max-w-xl p-6 text-sm text-[var(--text-muted)]">Esta área é do técnico — seu usuário não está vinculado a um técnico.</Card>
      ) : (
        <div className="max-w-3xl space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="OS abertas" value={String(abertas)} />
            <Stat label="Comissão apurada" value={brl(comissaoApurada)} accent="ok" />
            <Stat label="A apurar (não quitadas)" value={brl(potencial)} />
          </div>

          {abertas === 0 ? (
            <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhuma OS aberta pra você agora. 🔧</Card>
          ) : (
            <div className="space-y-5">
              <Fila titulo="A fazer" tone="gold" orders={aFazer} />
              <Fila titulo="Em reparo" tone="brand" orders={emReparo} />
              <Fila titulo="Prontas p/ retirada" tone="ok" orders={prontas} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Fila({ titulo, tone, orders }: { titulo: string; tone: "gold" | "brand" | "ok"; orders: ServiceOrder[] }) {
  if (orders.length === 0) return null;
  const dot = tone === "ok" ? "bg-[var(--green-ok)]" : tone === "gold" ? "bg-gold" : "bg-brand-600";
  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {titulo} <span className="text-[var(--text-faded)]">· {orders.length}</span>
      </h2>
      {orders.map((o) => <OSRow key={o.id} os={o} />)}
    </div>
  );
}

function OSRow({ os }: { os: ServiceOrder }) {
  const com = os.paymentStatus === "quitada" ? osCommissionCents(os) : potentialCommission(os);
  return (
    <Link href={`/admin/minha-area/${os.id}`} className="block">
      <Card className="flex items-center justify-between gap-3 p-4 transition hover:border-brand-600">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-brand-600">{os.code ?? os.id.slice(0, 8)}</span>
            {os.photos.length > 0 && <span className="text-[10px] text-[var(--text-faded)]">📷 {os.photos.length}</span>}
          </div>
          <div className="truncate text-sm text-ink">{os.customerName || "—"} · {os.device || "—"}</div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className={`font-mono text-sm font-bold ${os.paymentStatus === "quitada" ? "text-[var(--green-ok)]" : "text-ink"}`}>{brl(com)}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{os.paymentStatus === "quitada" ? "paga/apurada" : "a apurar"}</div>
        </div>
      </Card>
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "ok" }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
      <div className={`mt-2 text-xl font-bold tabular-nums ${accent === "ok" ? "text-[var(--green-ok)]" : "text-ink"}`}>{value}</div>
    </Card>
  );
}
