"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/admin/ui";

type SaleLine = { name: string; qty: number; cents: number };
type Sale = { date: string; customer: string; total: number; lines: SaleLine[] };
type OsPaid = { date: string; customer: string; total: number; serviceCents: number; partsCents: number };
type ABCRow = { key: string; qty: number; receita: number; share: number; cum: number; classe: "A" | "B" | "C" };

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n * 100).toFixed(1).replace(".", ",") + "%";

const PERIODS = [
  { k: "30d", label: "30 dias", days: 30 },
  { k: "90d", label: "90 dias", days: 90 },
  { k: "ano", label: "12 meses", days: 365 },
  { k: "tudo", label: "Tudo", days: 0 },
] as const;

function cutoffStr(days: number): string {
  if (!days) return "0000-00-00";
  const d = new Date(); d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Curva ABC (Pareto): ordena por receita desc, acumula. A ≤80%, B ≤95%, C resto.
function buildABC(agg: Map<string, { qty: number; receita: number }>): ABCRow[] {
  const rows = [...agg.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.receita - a.receita);
  const total = rows.reduce((s, r) => s + r.receita, 0) || 1;
  let acc = 0;
  return rows.map((r) => {
    const share = r.receita / total;
    acc += share;
    const classe: ABCRow["classe"] = acc <= 0.8 ? "A" : acc <= 0.95 ? "B" : "C";
    return { key: r.key, qty: r.qty, receita: r.receita, share, cum: acc, classe };
  });
}

function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // separador ";" + BOM → abre certinho no Excel PT-BR com acentos
  return "﻿" + [headers, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}
function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosClient({ sales, osPaid }: { sales: Sale[]; osPaid: OsPaid[] }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["k"]>("90d");
  const cutoff = cutoffStr(PERIODS.find((p) => p.k === period)?.days ?? 0);

  const fSales = useMemo(() => sales.filter((s) => s.date >= cutoff), [sales, cutoff]);
  const fOs = useMemo(() => osPaid.filter((o) => o.date >= cutoff), [osPaid, cutoff]);

  // ABC de PRODUTOS (peças/periféricos vendidos no balcão)
  const produtoABC = useMemo(() => {
    const agg = new Map<string, { qty: number; receita: number }>();
    for (const s of fSales) for (const l of s.lines) {
      const cur = agg.get(l.name) ?? { qty: 0, receita: 0 };
      cur.qty += l.qty; cur.receita += l.cents;
      agg.set(l.name, cur);
    }
    return buildABC(agg);
  }, [fSales]);

  // ABC de CLIENTES (venda de peça + OS quitada)
  const clienteABC = useMemo(() => {
    const agg = new Map<string, { qty: number; receita: number }>();
    const add = (name: string, receita: number) => {
      const key = name || "(sem nome)";
      const cur = agg.get(key) ?? { qty: 0, receita: 0 };
      cur.qty += 1; cur.receita += receita;
      agg.set(key, cur);
    };
    for (const s of fSales) add(s.customer, s.total);
    for (const o of fOs) add(o.customer, o.total);
    return buildABC(agg);
  }, [fSales, fOs]);

  const receitaProdutos = produtoABC.reduce((s, r) => s + r.receita, 0);
  const receitaClientes = clienteABC.reduce((s, r) => s + r.receita, 0);
  const receitaServico = fOs.reduce((s, o) => s + o.serviceCents, 0);
  const receitaPecasOS = fOs.reduce((s, o) => s + o.partsCents, 0);

  return (
    <div className="max-w-4xl space-y-5">
      {/* período */}
      <div className="flex gap-1.5">
        {PERIODS.map((p) => (
          <button key={p.k} onClick={() => setPeriod(p.k)}
            className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${period === p.k ? "brand-gradient text-white" : "bg-bg-surface-2 text-ink-2"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Vendas de peça" value={brl(receitaProdutos)} hint={`${fSales.length} vendas`} />
        <Mini label="Serviço (OS)" value={brl(receitaServico)} hint={`${fOs.length} OS quitadas`} />
        <Mini label="Peças em OS" value={brl(receitaPecasOS)} />
        <Mini label="Total no período" value={brl(receitaProdutos + receitaServico + receitaPecasOS)} accent />
      </div>

      <ABCTable
        title="Curva ABC — Produtos"
        sub="Peças e periféricos mais vendidos (por receita). A = campeões (top 80%)."
        keyLabel="Produto"
        rows={produtoABC}
        total={receitaProdutos}
        onExport={() => downloadCSV(`abc-produtos-${period}.csv`, toCSV(
          ["Produto", "Qtd", "Receita (R$)", "% do total", "% acumulado", "Classe"],
          produtoABC.map((r) => [r.key, r.qty, (r.receita / 100).toFixed(2).replace(".", ","), pct(r.share), pct(r.cum), r.classe]),
        ))}
      />

      <ABCTable
        title="Curva ABC — Clientes"
        sub="Quem mais gasta (venda de peça + OS quitada). A = os que sustentam a loja."
        keyLabel="Cliente"
        qtyLabel="Compras"
        rows={clienteABC}
        total={receitaClientes}
        onExport={() => downloadCSV(`abc-clientes-${period}.csv`, toCSV(
          ["Cliente", "Compras", "Gasto (R$)", "% do total", "% acumulado", "Classe"],
          clienteABC.map((r) => [r.key, r.qty, (r.receita / 100).toFixed(2).replace(".", ","), pct(r.share), pct(r.cum), r.classe]),
        ))}
      />
    </div>
  );
}

const CLASS_CLS: Record<"A" | "B" | "C", string> = {
  A: "bg-green-100 text-green-700",
  B: "bg-amber-100 text-amber-700",
  C: "bg-bg-surface-2 text-[var(--text-muted)]",
};

function ABCTable({ title, sub, keyLabel, qtyLabel = "Qtd", rows, total, onExport }: { title: string; sub: string; keyLabel: string; qtyLabel?: string; rows: ABCRow[]; total: number; onExport: () => void }) {
  const counts = { A: rows.filter((r) => r.classe === "A").length, B: rows.filter((r) => r.classe === "B").length, C: rows.filter((r) => r.classe === "C").length };
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-ink">{title}</h2>
          <p className="text-xs text-[var(--text-muted)]">{sub}</p>
        </div>
        <button onClick={onExport} disabled={rows.length === 0} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-600 disabled:opacity-40">Exportar CSV</button>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">Sem dados no período.</p>
      ) : (
        <>
          <div className="mb-2 flex gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">A: {counts.A}</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">B: {counts.B}</span>
            <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-[var(--text-muted)]">C: {counts.C}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="py-2 pr-2 font-bold">{keyLabel}</th>
                  <th className="py-2 px-2 text-right font-bold">{qtyLabel}</th>
                  <th className="py-2 px-2 text-right font-bold">Receita</th>
                  <th className="py-2 px-2 text-right font-bold">% acum.</th>
                  <th className="py-2 pl-2 text-center font-bold">Classe</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.key} className="border-b border-line/60">
                    <td className="py-2 pr-2 font-semibold text-ink">{r.key}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-2">{r.qty}</td>
                    <td className="py-2 px-2 text-right font-bold tabular-nums text-ink">{brl(r.receita)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-[var(--text-muted)]">{pct(r.cum)}</td>
                    <td className="py-2 pl-2 text-center"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASS_CLS[r.classe]}`}>{r.classe}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-[11px] font-bold text-ink">
                  <td className="py-2 pr-2">Total{rows.length > 50 ? ` (${rows.length} itens)` : ""}</td>
                  <td /><td className="py-2 px-2 text-right tabular-nums">{brl(total)}</td><td /><td />
                </tr>
              </tfoot>
            </table>
          </div>
          {rows.length > 50 && <p className="mt-2 text-center text-[11px] text-[var(--text-faded)]">Mostrando os 50 primeiros. O CSV traz todos.</p>}
        </>
      )}
    </Card>
  );
}

function Mini({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card p-3.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className={`mt-1 text-lg font-extrabold tabular-nums ${accent ? "text-brand-600" : "text-ink"}`}>{value}</div>
      {hint && <div className="text-[11px] text-[var(--text-faded)]">{hint}</div>}
    </div>
  );
}
