"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/admin/ui";
import { useConfirm } from "@/components/admin/useConfirm";
import { useToast } from "@/components/admin/toast";

type Produto = { id: string; name: string; costCents: number };
type PItem = { stockId?: string | null; name: string; qty: number; unitCostCents: number };
type Status = "pendente" | "recebida";
type Purchase = {
  id: string; code: string; fornecedor: string; nfNumber: string | null;
  items: PItem[]; freteCents: number; notes: string | null; date: string;
  status: Status; createdAt: string;
};
type Row = { stockId: string; name: string; qty: string; unit: string };

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toCents = (s: string) => Math.max(0, Math.round((parseFloat((s || "").replace(",", ".")) || 0) * 100));
const centsToStr = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const dmy = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const inputCls = "rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-brand-600";
const emptyRow = (): Row => ({ stockId: "", name: "", qty: "1", unit: "" });

function purchaseTotal(p: Purchase): number {
  return p.items.reduce((s, it) => s + it.qty * it.unitCostCents, 0) + p.freteCents;
}

export default function ComprasClient({ produtos }: { produtos: Produto[] }) {
  const { ask, confirmDialog } = useConfirm();
  const toast = useToast();
  const byName = useMemo(() => new Map(produtos.map((p) => [p.name.toLowerCase(), p])), [produtos]);
  const MSG: Record<string, string> = { create: "Compra criada", update: "Compra salva", receber: "Compra recebida · estoque + despesa", delete: "Compra excluída" };
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fornecedor, setFornecedor] = useState("");
  const [nf, setNf] = useState("");
  const [data, setData] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [frete, setFrete] = useState("");
  const [notes, setNotes] = useState("");

  const reload = useCallback(async () => {
    const r = await fetch("/api/compras", { cache: "no-store" });
    const d = await r.json();
    setPurchases(d.purchases ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const total = useMemo(() => rows.reduce((s, r) => s + (parseInt(r.qty) || 0) * toCents(r.unit), 0) + toCents(frete), [rows, frete]);

  function reset() { setEditId(null); setFornecedor(""); setNf(""); setData(new Date().toISOString().slice(0, 10)); setRows([emptyRow()]); setFrete(""); setNotes(""); setErr(""); }
  function novo() { reset(); setOpen(true); }
  function editar(p: Purchase) {
    setEditId(p.id); setFornecedor(p.fornecedor); setNf(p.nfNumber || ""); setData(p.date);
    setRows(p.items.length ? p.items.map((it) => ({ stockId: it.stockId || "", name: it.name, qty: String(it.qty), unit: centsToStr(it.unitCostCents) })) : [emptyRow()]);
    setFrete(p.freteCents ? centsToStr(p.freteCents) : ""); setNotes(p.notes || ""); setErr(""); setOpen(true);
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const delRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));
  // ao escolher/digitar um produto conhecido, liga o SKU e sugere o custo
  function onName(i: number, name: string) {
    const prod = byName.get(name.trim().toLowerCase());
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, name, stockId: prod?.id || "", unit: prod && !r.unit ? centsToStr(prod.costCents) : r.unit } : r)));
  }

  async function api(action: string, payload: unknown): Promise<boolean> {
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/compras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Não consegui salvar."); toast(d.error || "Não consegui salvar.", "error"); return false; }
      toast(MSG[action] ?? "Feito");
      await reload();
      return true;
    } finally { setSaving(false); }
  }

  async function salvar() {
    const items = rows.filter((r) => r.name.trim()).map((r) => ({ stockId: r.stockId || undefined, name: r.name.trim(), qty: parseInt(r.qty) || 1, unitCostCents: toCents(r.unit) }));
    if (!items.length) { setErr("Adicione ao menos um item."); return; }
    const payload = { id: editId ?? undefined, fornecedor: fornecedor.trim() || undefined, nfNumber: nf.trim() || undefined, items, freteCents: toCents(frete), notes: notes.trim() || undefined, date: data || undefined };
    if (await api(editId ? "update" : "create", payload)) { setOpen(false); reset(); }
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  return (
    <div className="max-w-3xl space-y-4">
      {!open && <button onClick={novo} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white">+ Nova compra</button>}

      {open && (
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-extrabold text-ink">{editId ? "Editar compra" : "Nova compra"}</h3>
            <button onClick={() => { setOpen(false); reset(); }} className="text-xl leading-none text-[var(--text-muted)]">×</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Fornecedor" className={`${inputCls} sm:col-span-1`} />
            <input value={nf} onChange={(e) => setNf(e.target.value)} placeholder="Nº da nota (opcional)" className={inputCls} />
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
          </div>

          <div className="mt-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Itens</div>
            <datalist id="produtos-compra">{produtos.map((p) => <option key={p.id} value={p.name} />)}</datalist>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2">
                  <input list="produtos-compra" value={r.name} onChange={(e) => onName(i, e.target.value)} placeholder="Produto (do estoque ou avulso)" className={`${inputCls} min-w-[150px] flex-1`} />
                  {r.stockId ? <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-600">estoque</span> : <span className="rounded bg-bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-faded)]">avulso</span>}
                  <input value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} inputMode="numeric" placeholder="Qtd" className={`${inputCls} w-16 text-center`} />
                  <input value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} inputMode="decimal" placeholder="Custo un." className={`${inputCls} w-24`} />
                  <span className="w-24 text-right text-sm font-bold text-ink">{brl((parseInt(r.qty) || 0) * toCents(r.unit))}</span>
                  <button onClick={() => delRow(i)} className="px-1 text-red-500">×</button>
                </div>
              ))}
            </div>
            <button onClick={addRow} className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-600">+ Item</button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Frete R$<input value={frete} onChange={(e) => setFrete(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${inputCls} mt-1 w-full`} /></label>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Observação<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional" className={`${inputCls} mt-1 w-full`} /></label>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2.5">
            <span className="text-sm font-bold text-brand-600">Total da compra</span>
            <span className="text-lg font-extrabold text-brand-600">{brl(total)}</span>
          </div>
          {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={() => { setOpen(false); reset(); }} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-[var(--text-muted)]">Cancelar</button>
            <button onClick={salvar} disabled={saving} className="flex-[2] rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando…" : editId ? "Salvar" : "Criar compra"}</button>
          </div>
        </Card>
      )}

      {err && !open && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</p>}
      {purchases.length === 0 && !open && <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhuma compra ainda. Registre a primeira reposição.</Card>}

      {purchases.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-brand-600">{p.code}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${p.status === "recebida" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{p.status === "recebida" ? "Recebida" : "Pendente"}</span>
              </div>
              <div className="truncate font-bold text-ink">{p.fornecedor}</div>
              <div className="text-xs text-[var(--text-muted)]">{dmy(p.date)}{p.nfNumber ? ` · NF ${p.nfNumber}` : ""} · {p.items.length} itens</div>
            </div>
            <div className="text-right"><div className="text-lg font-extrabold text-ink">{brl(purchaseTotal(p))}</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            {p.status === "pendente" ? (
              <>
                <button onClick={async () => { if (await ask({ message: `Receber a compra ${p.code}? Dá entrada no estoque e lança a despesa.`, confirmLabel: "Receber" })) api("receber", { id: p.id }); }} disabled={saving} className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-bold text-green-700 disabled:opacity-50">Receber → dá entrada</button>
                <button onClick={() => editar(p)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-600">Editar</button>
                <button onClick={async () => { if (await ask({ message: `Excluir a compra ${p.code}?`, danger: true, confirmLabel: "Excluir" })) api("delete", { id: p.id }); }} disabled={saving} className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-500">Excluir</button>
              </>
            ) : (
              <span className="text-xs font-semibold text-[var(--green-ok)]">✓ Estoque atualizado e despesa lançada</span>
            )}
          </div>
        </Card>
      ))}
      {confirmDialog}
    </div>
  );
}
