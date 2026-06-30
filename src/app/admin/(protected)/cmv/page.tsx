import { PageHeader, Badge } from "@/components/admin/ui";
import { IconAlert } from "@/components/Icons";
import { cmvReport } from "@/lib/cmv-store";

export const dynamic = "force-dynamic";

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");

type Range = "mes" | "7d" | "tudo";
const LABEL: Record<Range, string> = { mes: "Este mês", "7d": "Últimos 7 dias", tudo: "Tudo" };

function rangeISO(r: Range): { from?: string; to?: string } {
  const now = new Date();
  if (r === "tudo") return {};
  if (r === "7d") {
    const f = new Date(now);
    f.setDate(f.getDate() - 7);
    return { from: f.toISOString() };
  }
  const f = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: f.toISOString() };
}

export default async function CmvPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const sp = await searchParams;
  const r: Range = sp.r === "7d" || sp.r === "tudo" ? sp.r : "mes";
  const { from, to } = rangeISO(r);
  const rep = await cmvReport(from, to);

  return (
    <>
      <PageHeader title="CMV & margem" sub="Custo dos insumos vendidos × receita (balcão, mesa e delivery) — vem da ficha técnica de cada produto" action={<Badge tone="lime">todos os canais</Badge>} />

      <div className="mb-4 flex gap-2">
        {(["mes", "7d", "tudo"] as Range[]).map((k) => (
          <a key={k} href={`?r=${k}`} className={`rounded-full px-3 py-1.5 text-sm font-bold ${k === r ? "brand-gradient text-white" : "border border-line text-[var(--text-muted)]"}`}>
            {LABEL[k]}
          </a>
        ))}
      </div>

      {rep.missingCostItems.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[var(--gold)] bg-[#FFF8E6] p-3.5">
          <IconAlert width={18} height={18} className="mt-0.5 shrink-0 text-[var(--gold)]" />
          <div>
            <p className="text-sm font-bold text-ink">{rep.missingCostItems.length} insumo{rep.missingCostItems.length > 1 ? "s" : ""} vendido{rep.missingCostItems.length > 1 ? "s" : ""} sem custo cadastrado</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              A margem abaixo está <b>inflada</b> — esses insumos entram com custo zero. Cadastre o custo deles em Estoque pra o CMV ficar real: {rep.missingCostItems.join(", ")}.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Receita" value={brl(rep.revenueCents)} />
        <Stat label="CMV (custo)" value={brl(rep.cmvCents)} tone="red" />
        <Stat label="Margem bruta" value={brl(rep.marginCents)} tone="lime" />
        <Stat label="Margem %" value={`${rep.marginPct}%`} tone="lime" sub={`CMV ${rep.cmvPct}%`} />
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-bg-elevated p-4">
        <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-[var(--text-muted)]">Por produto</h3>
        {rep.lines.length === 0 ? (
          <p className="text-sm text-[var(--text-faded)]">Sem vendas com ficha técnica no período. Cadastre o custo dos insumos e a ficha técnica dos produtos pra ver o CMV.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-[var(--text-faded)]">
                  <th className="pb-2">Produto</th>
                  <th className="pb-2 text-right">Qtd</th>
                  <th className="pb-2 text-right">Receita</th>
                  <th className="pb-2 text-right">CMV</th>
                  <th className="pb-2 text-right">Margem</th>
                  <th className="pb-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rep.lines.map((l) => {
                  const pct = l.revenueCents ? Math.round((l.marginCents / l.revenueCents) * 100) : 0;
                  return (
                    <tr key={l.name}>
                      <td className="py-2 font-semibold text-ink">{l.name}</td>
                      <td className="py-2 text-right text-[var(--text-muted)]">{l.qty}</td>
                      <td className="py-2 text-right text-ink">{brl(l.revenueCents)}</td>
                      <td className="py-2 text-right text-red-500">{brl(l.cmvCents)}</td>
                      <td className="py-2 text-right font-bold text-lime">{brl(l.marginCents)}</td>
                      <td className="py-2 text-right text-[var(--text-muted)]">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-[var(--text-faded)]">Produtos sem ficha técnica entram com CMV zero (margem aparece cheia). Configure a ficha técnica no editor do cardápio.</p>
      </div>
    </>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "red" | "lime"; sub?: string }) {
  const color = tone === "red" ? "text-red-500" : tone === "lime" ? "text-lime" : "text-ink";
  return (
    <div className="rounded-2xl border border-line bg-bg-elevated p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faded)]">{label}</div>
      <div className={`mt-1 text-xl font-extrabold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--text-faded)]">{sub}</div>}
    </div>
  );
}
