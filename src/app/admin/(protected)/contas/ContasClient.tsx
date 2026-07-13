"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/admin/ui";

type Kind = "pagar" | "receber";
type Payment = { amountCents: number; date: string; note?: string | null };
type Bill = {
  id: string; code: string; kind: Kind; description: string; party: string | null;
  amountCents: number; dueDate: string; payments: Payment[]; notes: string | null;
  settledAt: string | null; createdAt: string;
};

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toCents = (s: string) => Math.max(0, Math.round((parseFloat((s || "").replace(",", ".")) || 0) * 100));
const centsToStr = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const dmy = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const inputCls = "rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-brand-600";

const paidCents = (b: Bill) => (b.payments ?? []).reduce((s, p) => s + (p.amountCents || 0), 0);
const openCents = (b: Bill) => Math.max(0, b.amountCents - paidCents(b));
const statusOf = (b: Bill): "pendente" | "parcial" | "pago" => {
  const paid = paidCents(b);
  if (paid <= 0) return "pendente";
  if (paid >= b.amountCents) return "pago";
  return "parcial";
};

export default function ContasClient() {
  const [tab, setTab] = useState<Kind>("pagar");
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // editor
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [party, setParty] = useState("");
  const [valor, setValor] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  // baixa
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaVal, setBaixaVal] = useState("");
  const [baixaDate, setBaixaDate] = useState("");

  const reload = useCallback(async () => {
    const r = await fetch("/api/contas", { cache: "no-store" });
    const d = await r.json();
    setBills(d.bills ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const list = useMemo(() => bills.filter((b) => b.kind === tab), [bills, tab]);
  const today = todayStr();

  // resumo do lado ativo
  const abertas = list.filter((b) => statusOf(b) !== "pago");
  const totalAberto = abertas.reduce((s, b) => s + openCents(b), 0);
  const vencidoCents = abertas.filter((b) => b.dueDate < today).reduce((s, b) => s + openCents(b), 0);
  const venceHojeCents = abertas.filter((b) => b.dueDate === today).reduce((s, b) => s + openCents(b), 0);

  const countPagar = bills.filter((b) => b.kind === "pagar" && statusOf(b) !== "pago").length;
  const countReceber = bills.filter((b) => b.kind === "receber" && statusOf(b) !== "pago").length;

  function reset() { setEditId(null); setDesc(""); setParty(""); setValor(""); setDue(today); setNotes(""); setErr(""); }
  function novo() { reset(); setOpen(true); }
  function editar(b: Bill) {
    setEditId(b.id); setDesc(b.description); setParty(b.party || ""); setValor(centsToStr(b.amountCents));
    setDue(b.dueDate); setNotes(b.notes || ""); setErr(""); setOpen(true);
  }

  async function api(action: string, payload: unknown): Promise<boolean> {
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/contas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Não consegui salvar."); return false; }
      await reload();
      return true;
    } finally { setSaving(false); }
  }

  async function salvar() {
    if (toCents(valor) <= 0) { setErr("Informe o valor da conta."); return; }
    const payload = { id: editId ?? undefined, kind: tab, description: desc.trim() || undefined, party: party.trim(), amountCents: toCents(valor), dueDate: due || undefined, notes: notes.trim() };
    if (await api(editId ? "update" : "create", payload)) { setOpen(false); reset(); }
  }

  function abrirBaixa(b: Bill) { setBaixaId(b.id); setBaixaVal(centsToStr(openCents(b))); setBaixaDate(today); setErr(""); }
  async function confirmarBaixa() {
    if (!baixaId) return;
    if (await api("baixa", { id: baixaId, amountCents: toCents(baixaVal), date: baixaDate })) setBaixaId(null);
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  const labelParty = tab === "pagar" ? "Fornecedor" : "Cliente";
  const labelBaixa = tab === "pagar" ? "Pagar" : "Receber";

  return (
    <div className="max-w-3xl space-y-4">
      {/* Abas a pagar / a receber */}
      <div className="flex gap-1.5">
        {([["pagar", "A pagar", countPagar], ["receber", "A receber", countReceber]] as const).map(([k, label, n]) => (
          <button key={k} onClick={() => { setTab(k); setOpen(false); setBaixaId(null); }}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === k ? "brand-gradient text-white" : "bg-bg-surface-2 text-ink-2"}`}>
            {label} <span className={tab === k ? "opacity-80" : "text-[var(--text-faded)]"}>{n}</span>
          </button>
        ))}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Tile n={brl(vencidoCents)} label="Vencido" color="#ef4444" />
        <Tile n={brl(venceHojeCents)} label="Vence hoje" color="#f59e0b" />
        <Tile n={brl(totalAberto)} label={`Total em aberto`} color="#7c3aed" />
      </div>

      {!open && <button onClick={novo} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white">+ Nova conta {tab === "pagar" ? "a pagar" : "a receber"}</button>}

      {/* Editor */}
      {open && (
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-extrabold text-ink">{editId ? "Editar conta" : `Nova conta a ${tab}`}</h3>
            <button onClick={() => { setOpen(false); reset(); }} className="text-xl leading-none text-[var(--text-muted)]">×</button>
          </div>
          <div className="space-y-2">
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição (ex: Aluguel, Distribuidora X)" className={`${inputCls} w-full`} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={party} onChange={(e) => setParty(e.target.value)} placeholder={`${labelParty} (opcional)`} className={inputCls} />
              <label className="flex items-center gap-2 rounded-lg border border-line bg-bg-elevated px-3">
                <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
                <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className="w-full bg-transparent py-2 text-sm text-ink outline-none" />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Vencimento<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${inputCls} mt-1 w-full`} /></label>
              <label className="text-xs font-semibold text-[var(--text-muted)]">Observação<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional" className={`${inputCls} mt-1 w-full`} /></label>
            </div>
          </div>
          {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={() => { setOpen(false); reset(); }} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-[var(--text-muted)]">Cancelar</button>
            <button onClick={salvar} disabled={saving} className="flex-[2] rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando…" : editId ? "Salvar" : "Criar conta"}</button>
          </div>
        </Card>
      )}

      {err && !open && !baixaId && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</p>}
      {list.length === 0 && !open && <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhuma conta {tab === "pagar" ? "a pagar" : "a receber"} ainda.</Card>}

      {list.map((b) => {
        const st = statusOf(b);
        const overdue = st !== "pago" && b.dueDate < today;
        const dueToday = st !== "pago" && b.dueDate === today;
        return (
          <Card key={b.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-brand-600">{b.code}</span>
                  <StatusPill st={st} />
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${overdue ? "bg-red-100 text-red-700" : dueToday ? "bg-amber-100 text-amber-700" : "bg-bg-surface-2 text-[var(--text-muted)]"}`}>
                    {overdue ? "Vencida " : "Vence "}{dmy(b.dueDate)}
                  </span>
                </div>
                <div className="mt-0.5 truncate font-bold text-ink">{b.description}</div>
                {b.party && <div className="text-xs text-[var(--text-muted)]">{tab === "pagar" ? "Fornecedor" : "Cliente"}: {b.party}</div>}
                {b.notes && <div className="text-xs text-[var(--text-faded)]">{b.notes}</div>}
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold text-ink">{brl(b.amountCents)}</div>
                {st === "parcial" && <div className="text-[11px] font-bold text-[var(--text-muted)]">pago {brl(paidCents(b))} · falta {brl(openCents(b))}</div>}
              </div>
            </div>

            {/* baixa inline */}
            {baixaId === b.id ? (
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Valor R$<input value={baixaVal} onChange={(e) => setBaixaVal(e.target.value)} inputMode="decimal" className={`${inputCls} mt-1 block w-28`} /></label>
                <label className="text-xs font-semibold text-[var(--text-muted)]">Data<input type="date" value={baixaDate} onChange={(e) => setBaixaDate(e.target.value)} className={`${inputCls} mt-1 block`} /></label>
                <button onClick={confirmarBaixa} disabled={saving} className="rounded-lg brand-gradient px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{labelBaixa}</button>
                <button onClick={() => setBaixaId(null)} className="px-2 py-2 text-xs font-bold text-[var(--text-muted)]">cancelar</button>
                {err && <span className="text-xs font-semibold text-red-600">{err}</span>}
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {st !== "pago" ? (
                  <button onClick={() => abrirBaixa(b)} disabled={saving} className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-bold text-green-700 disabled:opacity-50">{labelBaixa} (baixa)</button>
                ) : (
                  <span className="text-xs font-semibold text-[var(--green-ok)]">✓ {tab === "pagar" ? "Paga" : "Recebida"}{b.settledAt ? " em " + dmy(b.settledAt) : ""}</span>
                )}
                {b.payments.length > 0 && (
                  <button onClick={() => confirm("Estornar a última baixa desta conta?") && api("estornar", { id: b.id })} disabled={saving} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-[var(--text-muted)]">Estornar baixa</button>
                )}
                <button onClick={() => editar(b)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-600">Editar</button>
                <button onClick={() => confirm(`Excluir a conta ${b.code}?`) && api("delete", { id: b.id })} disabled={saving} className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-500">Excluir</button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Tile({ n, label, color }: { n: string; label: string; color: string }) {
  return (
    <div className="rounded-xl p-3 text-white" style={{ background: color }}>
      <div className="text-lg font-extrabold leading-none tabular-nums sm:text-xl">{n}</div>
      <div className="mt-1 text-[11px] font-semibold opacity-95">{label}</div>
    </div>
  );
}

function StatusPill({ st }: { st: "pendente" | "parcial" | "pago" }) {
  const map = { pendente: ["bg-bg-surface-2 text-[var(--text-muted)]", "Pendente"], parcial: ["bg-amber-100 text-amber-700", "Parcial"], pago: ["bg-green-100 text-green-700", "Pago"] } as const;
  const [cls, label] = map[st];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>;
}
