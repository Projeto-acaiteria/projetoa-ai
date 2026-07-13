import Link from "next/link";
import { requireNavAccess } from "@/lib/auth/guard";
import { PageHeader, Card } from "@/components/admin/ui";
import { listServiceOrders, OS_STATUS_LABEL, type OSStatus } from "@/lib/service-orders-store";
import { getStore } from "@/lib/settings-store";
import { listStaff } from "@/lib/staff-store";
import { dateBR, todayBR } from "@/lib/date-br";
import { OS_PRIORITY_ORDER, OS_PRIORITY_META } from "@/lib/os-priority";

// Painel de OS (visão geral) — inspirado no "Painel" do GestãoClick: prazos, situação e faturamento
// por técnico. Tudo com o dado que já temos (estimated_at, status, OS quitadas). Service-only.
export const dynamic = "force-dynamic";

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function OSPainelPage() {
  await requireNavAccess("/admin/os");
  const [orders, staff, store] = await Promise.all([listServiceOrders(), listStaff(), getStore()]);

  const today = todayBR();
  const tomorrow = dateBR(new Date(Date.now() + 86_400_000).toISOString());

  // PRAZOS — só OS ativas (aguardando/em reparo/pronto), pela data estimada de conclusão
  const ativas = orders.filter((o) => ["aguardando", "em_reparo", "pronto"].includes(o.status));
  let atrasadas = 0, hoje = 0, amanha = 0, futuras = 0, semPrazo = 0;
  for (const o of ativas) {
    if (!o.estimatedAt) { semPrazo++; continue; }
    const d = dateBR(o.estimatedAt);
    if (d < today) atrasadas++;
    else if (d === today) hoje++;
    else if (d === tomorrow) amanha++;
    else futuras++;
  }

  // SITUAÇÃO — contagem por status (exclui canceladas)
  const naoCanc = orders.filter((o) => o.status !== "cancelado");
  const cont = (s: OSStatus) => naoCanc.filter((o) => o.status === s).length;

  // SITUAÇÕES personalizadas da loja (ex: "Aguardando peça") — contagem entre OS ativas
  const situCount = new Map<string, number>();
  for (const o of ativas) if (o.situacao) situCount.set(o.situacao, (situCount.get(o.situacao) ?? 0) + 1);
  // ordem: as configuradas em Ajustes primeiro; depois qualquer situação órfã ainda em uso
  const configuradas = store.situacoesOS ?? [];
  const orfas = [...situCount.keys()].filter((s) => !configuradas.includes(s));
  const situacoes = [...configuradas, ...orfas].filter((s, i, a) => a.indexOf(s) === i);

  // FATURAMENTO por técnico (OS quitadas)
  const quitadas = orders.filter((o) => o.paymentStatus === "quitada" && o.status !== "cancelado");
  const byTec = new Map<string, { name: string; total: number; count: number }>();
  for (const o of quitadas) {
    const id = o.staffId ?? "sem";
    const name = staff.find((s) => s.id === o.staffId)?.name ?? "Sem técnico";
    const e = byTec.get(id) ?? { name, total: 0, count: 0 };
    e.total += o.totalCents; e.count++;
    byTec.set(id, e);
  }
  const tecs = [...byTec.values()].sort((a, b) => b.total - a.total);
  const maxTec = Math.max(1, ...tecs.map((t) => t.total));
  const fatTotal = quitadas.reduce((s, o) => s + o.totalCents, 0);

  return (
    <>
      <PageHeader title="Painel de OS" sub="Prazos, situação e faturamento" action={<Link href="/admin/os" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink">Ver lista</Link>} />

      <div className="max-w-5xl space-y-5">
        {/* PRAZOS */}
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">⏱ Prazos <span className="normal-case text-[var(--text-faded)]">· das OS em aberto</span></h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Tile n={atrasadas} label="Atrasadas" color="#ef4444" />
            <Tile n={hoje} label="Vencem hoje" color="#f59e0b" />
            <Tile n={amanha} label="Amanhã" color="#3b82f6" />
            <Tile n={futuras} label="Futuras" color="#22c55e" />
            <Tile n={semPrazo} label="Sem prazo" color="#64748b" />
          </div>
        </div>

        {/* PRIORIDADE */}
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">🔺 Prioridade <span className="normal-case text-[var(--text-faded)]">· das OS em aberto</span></h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {OS_PRIORITY_ORDER.map((k) => (
              <Tile key={k} n={ativas.filter((o) => o.priority === k).length} label={OS_PRIORITY_META[k].label} color={OS_PRIORITY_META[k].color} />
            ))}
          </div>
        </div>

        {/* SITUAÇÃO */}
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">📋 Situação</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile n={cont("aguardando")} label={OS_STATUS_LABEL.aguardando} color="#eab308" />
            <Tile n={cont("em_reparo")} label={OS_STATUS_LABEL.em_reparo} color="#3b82f6" />
            <Tile n={cont("pronto")} label="Prontas p/ retirada" color="#22c55e" />
            <Tile n={cont("entregue")} label={OS_STATUS_LABEL.entregue} color="#64748b" />
          </div>
        </div>

        {/* SITUAÇÕES DA LOJA (personalizadas) */}
        {situacoes.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">🏷 Situações da loja <span className="normal-case text-[var(--text-faded)]">· das OS em aberto</span></h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {situacoes.map((s) => <Tile key={s} n={situCount.get(s) ?? 0} label={s} color="#7c3aed" />)}
            </div>
          </div>
        )}

        {/* FATURAMENTO POR TÉCNICO */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">📊 Faturamento por técnico <span className="normal-case text-[var(--text-faded)]">· OS quitadas</span></h2>
            <span className="text-sm font-extrabold text-ink">{brl(fatTotal)}</span>
          </div>
          {tecs.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma OS quitada ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {tecs.map((t) => (
                <div key={t.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold text-ink">{t.name} <span className="text-xs font-normal text-[var(--text-muted)]">· {t.count} OS</span></span>
                    <span className="font-bold text-ink">{brl(t.total)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-bg-surface-2">
                    <div className="h-full rounded-full brand-gradient" style={{ width: `${Math.round((t.total / maxTec) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Tile({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="rounded-xl p-4 text-white" style={{ background: color }}>
      <div className="text-3xl font-extrabold leading-none tabular-nums">{n}</div>
      <div className="mt-1.5 text-xs font-semibold opacity-95">{label}</div>
    </div>
  );
}
