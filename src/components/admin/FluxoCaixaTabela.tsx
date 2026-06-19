"use client";

import { useMemo, useState } from "react";
import { brl } from "@/lib/format";
import { IconArrowRight } from "@/components/Icons";

export type Venda = { display: string; date: string; mode: string; paymentMethod: string | null; grossCents: number; cardFeeCents: number; netCents: number; customerName: string };
export type Despesa = { id: string; description: string; category: string; amountCents: number; date: string };

const PAY_LABEL: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito" };
const CAT_LABEL: Record<string, string> = {
  insumos: "Insumos", aluguel: "Aluguel", salarios: "Salários", utilidades: "Energia / Água",
  embalagens: "Embalagens", marketing: "Marketing", manutencao: "Manutenção", impostos: "Impostos", outros: "Outros",
  taxa_maquininha: "Taxa de maquininha",
};
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dd = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

type View = "dia" | "semana" | "mes" | "ano";
type Period = { from: string; to: string; label: string };

function buildPeriods(view: View): Period[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const res: Period[] = [];
  if (view === "ano") {
    for (let i = 2; i >= 0; i--) {
      const y = now.getFullYear() - i;
      res.push({ from: `${y}-01-01`, to: `${y + 1}-01-01`, label: String(y) });
    }
  } else if (view === "mes") {
    for (let i = 5; i >= 0; i--) {
      const f = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const t = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      res.push({ from: ymd(f), to: ymd(t), label: `${MONTHS[f.getMonth()]}/${String(f.getFullYear()).slice(2)}` });
    }
  } else if (view === "semana") {
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((day + 6) % 7));
    for (let i = 7; i >= 0; i--) {
      const f = new Date(mon);
      f.setDate(mon.getDate() - i * 7);
      const t = new Date(f);
      t.setDate(f.getDate() + 7);
      const last = new Date(t);
      last.setDate(t.getDate() - 1);
      res.push({ from: ymd(f), to: ymd(t), label: `${dd(f)}–${dd(last)}` });
    }
  } else {
    for (let i = 13; i >= 0; i--) {
      const f = new Date(now);
      f.setDate(now.getDate() - i);
      const t = new Date(f);
      t.setDate(f.getDate() + 1);
      res.push({ from: ymd(f), to: ymd(t), label: dd(f) });
    }
  }
  return res;
}

export default function FluxoCaixaTabela({ vendas, despesas }: { vendas: Venda[]; despesas: Despesa[] }) {
  const [view, setView] = useState<View>("dia");
  const [recOpen, setRecOpen] = useState(true);
  const [despOpen, setDespOpen] = useState(true);
  const [drill, setDrill] = useState<null | { title: string; vendas?: Venda[]; despesas?: Despesa[] }>(null);

  const periods = useMemo(() => buildPeriods(view), [view]);

  const cols = useMemo(() => {
    const inRange = (day: string, p: Period) => day >= p.from && day < p.to;
    const before0 = periods[0]?.from ?? "9999";
    let saldoCarry =
      vendas.filter((v) => v.date.slice(0, 10) < before0).reduce((s, v) => s + v.netCents, 0) -
      despesas.filter((e) => e.date < before0).reduce((s, e) => s + e.amountCents, 0);

    return periods.map((p) => {
      const vP = vendas.filter((v) => inRange(v.date.slice(0, 10), p));
      const dP = despesas.filter((e) => inRange(e.date, p));
      // Receitas BRUTAS por forma (padrão Palace); a taxa do cartão vira despesa.
      const recByMethod: Record<string, number> = {};
      for (const v of vP) recByMethod[v.paymentMethod || "dinheiro"] = (recByMethod[v.paymentMethod || "dinheiro"] || 0) + v.grossCents;
      const taxaCents = vP.reduce((s, v) => s + v.cardFeeCents, 0);
      const despByCat: Record<string, number> = {};
      for (const e of dP) despByCat[e.category] = (despByCat[e.category] || 0) + e.amountCents;
      if (taxaCents > 0) despByCat["taxa_maquininha"] = taxaCents;
      const recTotal = vP.reduce((s, v) => s + v.grossCents, 0);
      const despTotal = dP.reduce((s, e) => s + e.amountCents, 0) + taxaCents;
      const saldoInicial = saldoCarry;
      const resultado = recTotal - despTotal;
      const saldoFinal = saldoInicial + resultado;
      saldoCarry = saldoFinal;
      return { p, vP, dP, recByMethod, despByCat, recTotal, despTotal, saldoInicial, resultado, saldoFinal };
    });
  }, [periods, vendas, despesas]);

  const methodKeys = ["dinheiro", "pix", "debito", "credito"].filter((k) => cols.some((c) => c.recByMethod[k]));
  const catKeys = Array.from(new Set(cols.flatMap((c) => Object.keys(c.despByCat))));

  function exportCSV() {
    const sep = ";";
    const head = ["Linha", ...periods.map((p) => p.label)].join(sep);
    const money = (c: number) => (c / 100).toFixed(2).replace(".", ",");
    const lines = [head];
    lines.push(["Saldo inicial", ...cols.map((c) => money(c.saldoInicial))].join(sep));
    lines.push(["Receitas", ...cols.map((c) => money(c.recTotal))].join(sep));
    methodKeys.forEach((k) => lines.push([`  ${PAY_LABEL[k]}`, ...cols.map((c) => money(c.recByMethod[k] || 0))].join(sep)));
    lines.push(["Despesas", ...cols.map((c) => money(c.despTotal))].join(sep));
    catKeys.forEach((k) => lines.push([`  ${CAT_LABEL[k]}`, ...cols.map((c) => money(c.despByCat[k] || 0))].join(sep)));
    lines.push(["Resultado", ...cols.map((c) => money(c.resultado))].join(sep));
    lines.push(["Saldo final", ...cols.map((c) => money(c.saldoFinal))].join(sep));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fluxo-caixa-${view}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cell = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";
  const VIEWS: { k: View; label: string }[] = [
    { k: "dia", label: "Diário" },
    { k: "semana", label: "Semanal" },
    { k: "mes", label: "Mensal" },
    { k: "ano", label: "Anual" },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-line bg-bg-elevated p-1">
          {VIEWS.map((v) => (
            <button key={v.k} onClick={() => setView(v.k)} className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${view === v.k ? "brand-gradient text-white" : "text-ink-2"}`}>
              {v.label}
            </button>
          ))}
        </div>
        <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink">
          Exportar CSV
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                <th className="sticky left-0 z-10 bg-bg-elevated px-4 py-3 text-left" style={{ minWidth: 180 }}>Período</th>
                {periods.map((p) => <th key={p.from} className="px-3 py-3 text-right">{p.label}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--line)]">
                <td className="sticky left-0 z-10 bg-bg-elevated px-4 py-2.5 font-semibold text-ink-2">Saldo inicial</td>
                {cols.map((c) => <td key={c.p.from} className={`${cell} font-semibold ${c.saldoInicial < 0 ? "text-[var(--red-no)]" : "text-ink-2"}`}>{brl(c.saldoInicial)}</td>)}
              </tr>

              {/* Receitas */}
              <tr className="border-b border-[var(--line)] bg-[#F3FAEC]">
                <td className="sticky left-0 z-10 cursor-pointer bg-[#F3FAEC] px-4 py-2.5 font-bold text-lime" onClick={() => setRecOpen((o) => !o)}>
                  <span className="inline-flex items-center gap-1">{recOpen ? "▾" : "▸"} Receitas</span>
                </td>
                {cols.map((c) => (
                  <td key={c.p.from} className={`${cell} font-bold text-lime`}>
                    {c.recTotal > 0 ? <button onClick={() => setDrill({ title: `Receitas · ${c.p.label}`, vendas: c.vP })} className="hover:underline">{brl(c.recTotal)}</button> : <span className="opacity-40">—</span>}
                  </td>
                ))}
              </tr>
              {recOpen && methodKeys.map((k) => (
                <tr key={k} className="border-b border-[var(--line)] bg-[#FAFDF6]">
                  <td className="sticky left-0 z-10 bg-[#FAFDF6] px-4 py-2 pl-9 text-xs text-ink-2">{PAY_LABEL[k]}</td>
                  {cols.map((c) => (
                    <td key={c.p.from} className={`${cell} text-xs`}>
                      {c.recByMethod[k] ? <button onClick={() => setDrill({ title: `${PAY_LABEL[k]} · ${c.p.label}`, vendas: c.vP.filter((v) => (v.paymentMethod || "dinheiro") === k) })} className="text-ink hover:underline">{brl(c.recByMethod[k])}</button> : <span className="text-[var(--text-faded)]">—</span>}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Despesas */}
              <tr className="border-b border-[var(--line)] bg-[#FEF2F2]">
                <td className="sticky left-0 z-10 cursor-pointer bg-[#FEF2F2] px-4 py-2.5 font-bold text-[var(--red-no)]" onClick={() => setDespOpen((o) => !o)}>
                  <span className="inline-flex items-center gap-1">{despOpen ? "▾" : "▸"} Despesas</span>
                </td>
                {cols.map((c) => (
                  <td key={c.p.from} className={`${cell} font-bold text-[var(--red-no)]`}>
                    {c.despTotal > 0 ? <button onClick={() => setDrill({ title: `Despesas · ${c.p.label}`, despesas: c.dP })} className="hover:underline">{brl(c.despTotal)}</button> : <span className="opacity-40">—</span>}
                  </td>
                ))}
              </tr>
              {despOpen && catKeys.map((k) => (
                <tr key={k} className="border-b border-[var(--line)] bg-[#FFF7F7]">
                  <td className="sticky left-0 z-10 bg-[#FFF7F7] px-4 py-2 pl-9 text-xs text-ink-2">{CAT_LABEL[k]}</td>
                  {cols.map((c) => (
                    <td key={c.p.from} className={`${cell} text-xs`}>
                      {c.despByCat[k] ? <button onClick={() => setDrill(k === "taxa_maquininha" ? { title: `Taxa de maquininha · ${c.p.label}`, vendas: c.vP.filter((v) => v.cardFeeCents > 0) } : { title: `${CAT_LABEL[k]} · ${c.p.label}`, despesas: c.dP.filter((e) => e.category === k) })} className="text-ink hover:underline">{brl(c.despByCat[k])}</button> : <span className="text-[var(--text-faded)]">—</span>}
                    </td>
                  ))}
                </tr>
              ))}

              <tr className="border-b border-[var(--line)]">
                <td className="sticky left-0 z-10 bg-bg-elevated px-4 py-2.5 font-semibold text-ink">Resultado</td>
                {cols.map((c) => <td key={c.p.from} className={`${cell} font-semibold ${c.resultado < 0 ? "text-[var(--red-no)]" : c.resultado > 0 ? "text-lime" : "text-[var(--text-muted)]"}`}>{brl(c.resultado)}</td>)}
              </tr>
              <tr className="bg-bg-surface-2">
                <td className="sticky left-0 z-10 bg-bg-surface-2 px-4 py-3 font-extrabold text-ink">Saldo final</td>
                {cols.map((c) => <td key={c.p.from} className={`${cell} font-extrabold ${c.saldoFinal < 0 ? "text-[var(--red-no)]" : "text-brand-600"}`}>{brl(c.saldoFinal)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--text-faded)]">Toque num valor de receita ou despesa pra ver as movimentações.</p>

      {drill && <DrillModal data={drill} onClose={() => setDrill(null)} />}
    </>
  );
}

function DrillModal({ data, onClose }: { data: { title: string; vendas?: Venda[]; despesas?: Despesa[] }; onClose: () => void }) {
  const dmy = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[85vh] max-w-lg flex-col rounded-t-3xl bg-bg-elevated shadow-[var(--shadow-pop)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="border-b border-line p-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line sm:hidden" />
          <h2 className="text-lg font-extrabold text-ink">{data.title}</h2>
          <p className="text-xs text-[var(--text-muted)]">{(data.vendas?.length ?? data.despesas?.length ?? 0)} movimentação(ões)</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {data.vendas?.map((v) => (
            <div key={v.display} className="flex items-center justify-between border-b border-line px-2 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{v.display} · {v.customerName}</div>
                <div className="text-xs text-[var(--text-muted)]">{dmy(v.date)} · {v.paymentMethod ? PAY_LABEL[v.paymentMethod] : v.mode}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lime">{brl(v.netCents)}</div>
                {v.cardFeeCents > 0 && <div className="text-[11px] text-[var(--text-faded)]">taxa {brl(v.cardFeeCents)}</div>}
              </div>
            </div>
          ))}
          {data.despesas?.map((e) => (
            <div key={e.id} className="flex items-center justify-between border-b border-line px-2 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{e.description}</div>
                <div className="text-xs text-[var(--text-muted)]">{dmy(e.date)} · {CAT_LABEL[e.category]}</div>
              </div>
              <div className="font-bold text-[var(--red-no)]">− {brl(e.amountCents)}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-line p-4">
          <button onClick={onClose} className="w-full rounded-xl border border-line py-2.5 font-bold text-ink">Fechar</button>
        </div>
      </div>
    </div>
  );
}
