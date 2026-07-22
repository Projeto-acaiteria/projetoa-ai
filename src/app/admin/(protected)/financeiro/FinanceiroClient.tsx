"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { StatCard, Card, Badge } from "@/components/admin/ui";
import { brl } from "@/lib/format";
import { dateBR, todayBR } from "@/lib/date-br";
import { IconWallet, IconChart, IconReceipt, IconPlus, IconTrash } from "@/components/Icons";
import FluxoCaixaTabela from "@/components/admin/FluxoCaixaTabela";

type Cancelamento = { id: number; display: string; itemName: string; qty: number; totalCents: number; reason: string; cancelledBy: string | null; at: string };
type Venda = { display: string; date: string; mode: string; paymentMethod: string | null; grossCents: number; cardFeeCents: number; netCents: number; customerName: string };
type Despesa = { id: string; description: string; category: string; amountCents: number; date: string; createdAt: string };
type Fixed = { id: string; description: string; category: string; amountCents: number };

// Categorias de despesa que o Adm escolhe no lançamento — variam por tipo de loja.
const CATS_FOOD = ["insumos", "aluguel", "salarios", "utilidades", "embalagens", "marketing", "manutencao", "impostos", "outros"];
const CATS_SERVICE = ["pecas", "aluguel", "salarios", "utilidades", "marketing", "manutencao", "impostos", "frete", "outros"];
// comissao/bonus NÃO entram no dropdown (são sintéticas do pagamento de comissão) — só têm rótulo p/ exibir.
const CAT_LABEL: Record<string, string> = {
  insumos: "Insumos", aluguel: "Aluguel", salarios: "Salários", utilidades: "Energia / Água",
  embalagens: "Embalagens", marketing: "Marketing", manutencao: "Manutenção", impostos: "Impostos", outros: "Outros",
  pecas: "Peças / fornecedores", frete: "Frete / envio", comissao: "Comissão (técnico)", bonus: "Bônus (técnico)",
};
const PAY_LABEL: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito" };

const PERIODS = [
  { k: "hoje", label: "Hoje", days: 0 },
  { k: "7d", label: "7 dias", days: 6 },
  { k: "30d", label: "30 dias", days: 29 },
  { k: "tudo", label: "Tudo", days: -1 },
] as const;

const dmy = (d: string) => (d.length > 10 ? dateBR(d) : d).split("-").reverse().join("/"); // ISO→data BR; data pura fica

export default function FinanceiroClient({ family }: { family?: string }) {
  const CATS = family === "service" ? CATS_SERVICE : CATS_FOOD;
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [comissoes, setComissoes] = useState<Despesa[]>([]); // saídas sintéticas (comissão/bônus pagos) — read-only
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["k"]>("30d");
  const [tab, setTab] = useState<"resumo" | "fluxo" | "despesas" | "cancelamentos">("resumo");
  const [cancelamentos, setCancelamentos] = useState<Cancelamento[]>([]);
  const [modal, setModal] = useState(false);
  const [fixed, setFixed] = useState<Fixed[]>([]);
  const [fixedModal, setFixedModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/financeiro", { cache: "no-store" }).then((r) => r.json());
      setVendas(d.vendas ?? []);
      setDespesas(d.despesas ?? []);
      setComissoes(d.comissoes ?? []);
      setCancelamentos(d.cancelamentos ?? []);
      const fx = await fetch("/api/despesas-fixas", { cache: "no-store" }).then((r) => r.json());
      setFixed(fx.fixed ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  async function lancarFixas() {
    await fetch("/api/despesas-fixas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lancar" }) });
    load();
  }
  async function removeFixa(id: string) {
    await fetch(`/api/despesas-fixas/${id}`, { method: "DELETE" });
    load();
  }
  useEffect(() => {
    load();
  }, [load]);

  const cutoff = useMemo(() => {
    const days = PERIODS.find((p) => p.k === period)!.days;
    if (days < 0) return "0000-00-00";
    const d = new Date();
    d.setDate(d.getDate() - days);
    return dateBR(d); // corte no fuso do Brasil (não UTC)
  }, [period]);

  // despesas reais (editáveis, aba Despesas) x TODAS as saídas (reais + comissão/bônus pagos), p/ o resultado.
  const allDespesas = useMemo(() => [...despesas, ...comissoes], [despesas, comissoes]);
  const fVendas = vendas.filter((v) => dateBR(v.date) >= cutoff);
  const fDespesas = despesas.filter((e) => e.date >= cutoff); // só reais → lista/aba Despesas
  const fDespesasAll = allDespesas.filter((e) => e.date >= cutoff); // reais + comissão → totais/gráficos/fluxo

  const grossCents = fVendas.reduce((s, v) => s + v.grossCents, 0);
  const feeCents = fVendas.reduce((s, v) => s + v.cardFeeCents, 0);
  const entradasCents = fVendas.reduce((s, v) => s + v.netCents, 0); // líquido
  const despesasCents = fDespesasAll.reduce((s, e) => s + e.amountCents, 0); // inclui comissão paga
  const saldoCents = entradasCents - despesasCents;

  // receitas por forma de pagamento (bruto) e despesas por categoria
  const recByMethod = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of fVendas) m[v.paymentMethod || "dinheiro"] = (m[v.paymentMethod || "dinheiro"] || 0) + v.grossCents;
    return m;
  }, [fVendas]);
  const despByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of fDespesasAll) m[e.category] = (m[e.category] || 0) + e.amountCents;
    return m;
  }, [fDespesasAll]);

  // fluxo de caixa agrupado por DIA, com saldo acumulado
  const byDay = useMemo(() => {
    const map: Record<string, { rec: number; desp: number }> = {};
    for (const v of fVendas) {
      const d = dateBR(v.date);
      (map[d] ??= { rec: 0, desp: 0 }).rec += v.netCents;
    }
    for (const e of fDespesasAll) (map[e.date] ??= { rec: 0, desp: 0 }).desp += e.amountCents;
    const days = Object.keys(map).sort();
    let saldo = 0;
    const rows = days.map((d) => {
      const { rec, desp } = map[d];
      saldo += rec - desp;
      return { date: d, rec, desp, result: rec - desp, saldo };
    });
    return rows.reverse();
  }, [fVendas, fDespesasAll]);

  async function removeDespesa(id: string) {
    await fetch(`/api/despesas/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      {/* período + abas */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-bg-elevated p-1">
          {(["resumo", "fluxo", "despesas", "cancelamentos"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3.5 py-2 text-sm font-bold capitalize transition ${tab === t ? "brand-gradient text-white" : "text-ink-2"}`}>
              {t === "fluxo" ? "Fluxo de caixa" : t}
            </button>
          ))}
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {PERIODS.map((p) => (
            <button key={p.k} onClick={() => setPeriod(p.k)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${period === p.k ? "bg-bg-surface-2 text-brand-600" : "text-[var(--text-muted)]"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* RESUMO */}
      {tab === "resumo" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Entradas (líquido)" value={brl(entradasCents)} hint={`${fVendas.length} vendas`} Icon={IconWallet} tone="lime" />
            <StatCard label="Despesas" value={brl(despesasCents)} hint={`${fDespesas.length} lançamentos`} Icon={IconReceipt} tone="gold" />
            <StatCard label="Saldo (lucro)" value={brl(saldoCents)} hint="entradas - despesas" Icon={IconChart} tone={saldoCents >= 0 ? "brand" : "accent"} />
            <StatCard label="Taxas maquininha" value={brl(feeCents)} hint="descontadas das vendas" Icon={IconWallet} tone="accent" />
          </div>

          <Card className="mt-5 p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Como fechou o período</h2>
            <Linha label="Faturamento (bruto)" value={brl(grossCents)} />
            <Linha label="(−) Taxas da maquininha" value={`− ${brl(feeCents)}`} tone="muted" />
            <Linha label="(=) Entradas líquidas" value={brl(entradasCents)} strong />
            <Linha label="(−) Despesas" value={`− ${brl(despesasCents)}`} tone="muted" />
            <div className="mt-1 border-t border-line pt-2">
              <Linha label="Saldo do período" value={brl(saldoCents)} strong tone={saldoCents >= 0 ? "ok" : "bad"} />
            </div>
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Receitas por forma de pagamento</h2>
              {Object.keys(recByMethod).length === 0 && <p className="text-sm text-[var(--text-muted)]">Sem receitas no período.</p>}
              {["dinheiro", "pix", "debito", "credito"].filter((k) => recByMethod[k]).map((k) => {
                const v = recByMethod[k];
                const pct = grossCents ? Math.round((v / grossCents) * 100) : 0;
                return (
                  <div key={k} className="py-1.5">
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold text-ink">{PAY_LABEL[k]}</span>
                      <span className="font-bold text-ink">{brl(v)} <span className="text-xs font-semibold text-[var(--text-muted)]">{pct}%</span></span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-bg-surface-2"><div className="h-full rounded-full brand-gradient" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </Card>
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Despesas por categoria</h2>
              {Object.keys(despByCat).length === 0 && <p className="text-sm text-[var(--text-muted)]">Sem despesas no período.</p>}
              {Object.entries(despByCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                const pct = despesasCents ? Math.round((v / despesasCents) * 100) : 0;
                return (
                  <div key={k} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="font-semibold text-ink">{CAT_LABEL[k]}</span>
                    <span className="font-bold text-[var(--red-no)]">− {brl(v)} <span className="text-xs font-semibold text-[var(--text-muted)]">{pct}%</span></span>
                  </div>
                );
              })}
            </Card>
          </div>
        </>
      )}

      {/* FLUXO DE CAIXA — tabela multi-período com drill-down (comissão paga entra como despesa) */}
      {tab === "fluxo" && <FluxoCaixaTabela vendas={vendas} despesas={allDespesas} />}

      {/* CANCELAMENTOS — trilha de auditoria: o que foi tirado da comanda, por quem e por quê.
          Cancelar é permitido (inclusive em comanda já paga, a pedido da casa); aqui fica o registro. */}
      {tab === "cancelamentos" && (() => {
        const lista = cancelamentos.filter((c) => dateBR(c.at) >= cutoff);
        const total = lista.reduce((s, c) => s + c.totalCents, 0);
        return (
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Itens cancelados</h2>
                <div className="text-xs text-[var(--text-muted)]">
                  {lista.length} cancelamento{lista.length === 1 ? "" : "s"} no período · total <b className="text-ink">{brl(total)}</b>
                </div>
              </div>
              <Badge tone="muted">auditoria</Badge>
            </div>
            {lista.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhum item cancelado no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-xs uppercase text-[var(--text-muted)]">
                      <th className="py-2 pr-3 font-bold">Quando</th>
                      <th className="py-2 pr-3 font-bold">Mesa</th>
                      <th className="py-2 pr-3 font-bold">Item</th>
                      <th className="py-2 pr-3 text-right font-bold">Valor</th>
                      <th className="py-2 pr-3 font-bold">Motivo</th>
                      <th className="py-2 font-bold">Quem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {lista.map((c) => (
                      <tr key={c.id}>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-[var(--text-muted)]">
                          {new Date(c.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 font-semibold text-ink">{c.display}</td>
                        <td className="py-2.5 pr-3 text-ink"><b className="tabular-nums">{c.qty}×</b> {c.itemName}</td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-right font-bold tabular-nums text-[var(--red-no)]">− {brl(c.totalCents)}</td>
                        <td className="py-2.5 pr-3 text-[var(--text-muted)]">{c.reason}</td>
                        <td className="whitespace-nowrap py-2.5 text-xs text-[var(--text-faded)]">{c.cancelledBy ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })()}

      {/* DESPESAS */}
      {tab === "despesas" && (
        <>
          {/* Despesas fixas (recorrentes) */}
          <Card className="mb-5 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Despesas fixas · todo mês</h2>
                <div className="text-xs text-[var(--text-muted)]">Custo fixo mensal: <b className="text-ink">{brl(fixed.reduce((s, f) => s + f.amountCents, 0))}</b></div>
              </div>
              <div className="flex gap-2">
                {fixed.length > 0 && (
                  <button onClick={lancarFixas} className="rounded-xl border border-line px-3.5 py-2 text-sm font-bold text-brand-600">
                    Lançar no mês
                  </button>
                )}
                <button onClick={() => setFixedModal(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-bg-surface-2 px-3.5 py-2 text-sm font-bold text-ink">
                  <IconPlus width={15} height={15} /> Nova fixa
                </button>
              </div>
            </div>
            {fixed.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Cadastre aluguel, salários, energia… e lance todo mês com um clique.</p>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {fixed.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 py-2.5">
                    <span className="rounded-md bg-[#EFE6FF] px-2 py-0.5 text-[11px] font-bold text-brand-600">fixa</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{f.description}</div>
                      <div className="text-xs text-[var(--text-muted)]">{CAT_LABEL[f.category]}</div>
                    </div>
                    <span className="font-bold text-ink">{brl(f.amountCents)}/mês</span>
                    <button onClick={() => removeFixa(f.id)} className="text-[var(--text-faded)] hover:text-[var(--red-no)]"><IconTrash width={15} height={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--text-muted)]">Lançamentos no período: <b className="text-ink">{brl(fDespesas.reduce((s, e) => s + e.amountCents, 0))}</b></div>
            <button onClick={() => setModal(true)} className="inline-flex items-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]">
              <IconPlus width={16} height={16} /> Nova despesa
            </button>
          </div>
          {loaded && fDespesas.length === 0 && (
            <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-[var(--text-muted)]">Nenhuma despesa no período.</div>
          )}
          <div className="space-y-2">
            {fDespesas.map((e) => (
              <Card key={e.id} className="flex items-center gap-3 p-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FBF1DC] text-gold">
                  <IconReceipt width={17} height={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{e.description}</div>
                  <div className="text-xs text-[var(--text-muted)]">{dmy(e.date)} · {CAT_LABEL[e.category]}</div>
                </div>
                <div className="font-bold text-[var(--red-no)]">− {brl(e.amountCents)}</div>
                <button onClick={() => removeDespesa(e.id)} className="text-[var(--text-faded)] hover:text-[var(--red-no)]">
                  <IconTrash width={16} height={16} />
                </button>
              </Card>
            ))}
          </div>
        </>
      )}

      {modal && <DespesaModal cats={CATS} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
      {fixedModal && <FixaModal cats={CATS} onClose={() => setFixedModal(false)} onSaved={() => { setFixedModal(false); load(); }} />}
    </>
  );
}

function FixaModal({ cats, onClose, onSaved }: { cats: string[]; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("aluguel");
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);
  const inp = "w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

  async function save() {
    const cents = Math.round((parseFloat(valor) || 0) * 100);
    if (!description.trim() || cents <= 0) return;
    setSaving(true);
    await fetch("/api/despesas-fixas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, category, amountCents: cents }) });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md animate-pop rounded-t-3xl bg-bg-elevated p-5 shadow-[var(--shadow-pop)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <h2 className="mb-1 text-lg font-extrabold text-ink">Nova despesa fixa</h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">Repete todo mês. Você lança no mês com um clique.</p>
        <div className="space-y-3">
          <input className={inp} placeholder="Descrição (ex: Aluguel do ponto)" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
          <select className={inp} value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
          <div className="flex items-center rounded-lg border border-line bg-bg-base px-3">
            <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
            <input className="w-full bg-transparent px-2 py-2.5 text-sm font-bold text-ink outline-none" type="number" min={0} step="0.5" placeholder="0,00 por mês" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <button onClick={save} disabled={saving} className="w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar despesa fixa"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Linha({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "ok" | "bad" | "muted" }) {
  const color = tone === "ok" ? "var(--lime)" : tone === "bad" ? "var(--red-no)" : tone === "muted" ? "var(--text-muted)" : "var(--text-primary)";
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-ink-2">{label}</span>
      <span className={strong ? "text-base font-extrabold" : "font-semibold"} style={{ color }}>{value}</span>
    </div>
  );
}

function DespesaModal({ cats, onClose, onSaved }: { cats: string[]; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(cats[0] ?? "outros");
  const [valor, setValor] = useState("");
  const [date, setDate] = useState(todayBR());
  const [saving, setSaving] = useState(false);
  const inp = "w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

  async function save() {
    const cents = Math.round((parseFloat(valor) || 0) * 100);
    if (!description.trim() || cents <= 0) return;
    setSaving(true);
    await fetch("/api/despesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, category, amountCents: cents, date }),
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md animate-pop rounded-t-3xl bg-bg-elevated p-5 shadow-[var(--shadow-pop)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <h2 className="mb-4 text-lg font-extrabold text-ink">Nova despesa</h2>
        <div className="space-y-3">
          <input className={inp} placeholder="Descrição (ex: Polpa fornecedor)" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
          <select className={inp} value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center rounded-lg border border-line bg-bg-base px-3">
              <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
              <input className="w-full bg-transparent px-2 py-2.5 text-sm font-bold text-ink outline-none" type="number" min={0} step="0.5" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <input className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button onClick={save} disabled={saving} className="w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
            {saving ? "Salvando..." : "Lançar despesa"}
          </button>
        </div>
      </div>
    </div>
  );
}
