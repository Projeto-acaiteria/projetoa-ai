"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/admin/ui";

type ItemKind = "produto" | "servico";
type ApiItem = { kind: ItemKind; name: string; detail?: string; qty: number; unitCents: number; discountCents: number };
type Budget = {
  id: string; customerName: string; customerPhone: string; cpf: string | null;
  items: ApiItem[]; freteCents: number; outrosCents: number; discountCents: number;
  validadeAt: string | null; observacao: string | null;
};
type Row = { kind: ItemKind; name: string; detail: string; qty: string; unit: string; desc: string };

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toCents = (s: string) => Math.max(0, Math.round((parseFloat((s || "").replace(",", ".")) || 0) * 100));
const centsToStr = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const inputCls = "w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600";
const emptyRow = (kind: ItemKind = "produto"): Row => ({ kind, name: "", detail: "", qty: "1", unit: "", desc: "" });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>{children}</label>;
}

export default function OrcamentoForm({ initial }: { initial: Budget | null }) {
  const router = useRouter();
  const editId = initial?.id ?? null;
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [cpf, setCpf] = useState(initial?.cpf || "");
  const [nome, setNome] = useState(initial?.customerName || "");
  const [fone, setFone] = useState(initial?.customerPhone || "");
  const [rows, setRows] = useState<Row[]>(
    initial?.items.length
      ? initial.items.map((it) => ({ kind: it.kind, name: it.name, detail: it.detail || "", qty: String(it.qty), unit: centsToStr(it.unitCents), desc: it.discountCents ? centsToStr(it.discountCents) : "" }))
      : [emptyRow()],
  );
  const [frete, setFrete] = useState(initial?.freteCents ? centsToStr(initial.freteCents) : "");
  const [outros, setOutros] = useState(initial?.outrosCents ? centsToStr(initial.outrosCents) : "");
  const [desconto, setDesconto] = useState(initial?.discountCents ? centsToStr(initial.discountCents) : "");
  const [validade, setValidade] = useState(initial?.validadeAt || "");
  const [obs, setObs] = useState(initial?.observacao || "");

  const totals = useMemo(() => {
    let prod = 0, serv = 0;
    for (const r of rows) {
      const sub = Math.max(0, (parseInt(r.qty) || 0) * toCents(r.unit) - toCents(r.desc));
      if (r.kind === "servico") serv += sub; else prod += sub;
    }
    return { prod, serv, total: Math.max(0, prod + serv + toCents(frete) + toCents(outros) - toCents(desconto)) };
  }, [rows, frete, outros, desconto]);

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = (kind: ItemKind) => setRows((rs) => [...rs, emptyRow(kind)]);
  const delRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  async function buscarCliente() {
    const doc = onlyDigits(cpf);
    if (doc.length < 3) return;
    const r = await fetch(`/api/os?doc=${doc}`, { cache: "no-store" });
    const d = await r.json();
    if (d.found) { setNome(d.found.name || nome); setFone(d.found.phone || fone); }
  }

  async function salvar() {
    if (!nome.trim()) { setErr("Informe o cliente."); return; }
    const items = rows.filter((r) => r.name.trim()).map((r) => ({ kind: r.kind, name: r.name.trim(), detail: r.detail.trim() || undefined, qty: parseInt(r.qty) || 1, unitCents: toCents(r.unit), discountCents: toCents(r.desc) }));
    if (!items.length) { setErr("Adicione ao menos um item."); return; }
    setSaving(true); setErr("");
    const payload = { id: editId ?? undefined, customerName: nome.trim(), customerPhone: fone.trim() || undefined, cpf: onlyDigits(cpf) || undefined, items, freteCents: toCents(frete), outrosCents: toCents(outros), discountCents: toCents(desconto), validadeAt: validade || undefined, observacao: obs.trim() || undefined };
    const r = await fetch("/api/orcamentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: editId ? "update" : "create", payload }) });
    const d = await r.json();
    if (!r.ok) { setErr(d.error || "Não consegui salvar."); setSaving(false); return; }
    router.push("/admin/orcamentos");
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-4 pb-24">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Cliente</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CPF do cliente">
            <div className="flex gap-2">
              <input value={cpf} onChange={(e) => setCpf(e.target.value)} onBlur={buscarCliente} inputMode="numeric" placeholder="000.000.000-00" className={inputCls} />
              <button onClick={buscarCliente} className="shrink-0 rounded-lg border border-brand-400 px-3 text-sm font-bold text-brand-600">buscar</button>
            </div>
          </Field>
          <Field label="Cliente *"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" className={inputCls} /></Field>
          <Field label="WhatsApp"><input value={fone} onChange={(e) => setFone(e.target.value)} placeholder="(00) 00000-0000" className={inputCls} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Itens</h3>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2">
              <select value={r.kind} onChange={(e) => setRow(i, { kind: e.target.value as ItemKind })} className={`${inputCls} w-28`}>
                <option value="produto">Peça</option>
                <option value="servico">Serviço</option>
              </select>
              <input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Descrição" className={`${inputCls} min-w-[140px] flex-1`} />
              <input value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} inputMode="numeric" placeholder="Qtd" className={`${inputCls} w-16 text-center`} />
              <input value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} inputMode="decimal" placeholder="Valor un." className={`${inputCls} w-24`} />
              <input value={r.desc} onChange={(e) => setRow(i, { desc: e.target.value })} inputMode="decimal" placeholder="Desc." className={`${inputCls} w-20`} />
              <span className="w-24 text-right text-sm font-bold text-ink">{brl(Math.max(0, (parseInt(r.qty) || 0) * toCents(r.unit) - toCents(r.desc)))}</span>
              <button onClick={() => delRow(i)} className="px-1 text-red-500">×</button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={() => addRow("produto")} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-600">+ Peça</button>
          <button onClick={() => addRow("servico")} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-600">+ Serviço</button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Valores e validade</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Frete R$"><input value={frete} onChange={(e) => setFrete(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls} /></Field>
          <Field label="Outros R$"><input value={outros} onChange={(e) => setOutros(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls} /></Field>
          <Field label="Desconto R$"><input value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls} /></Field>
          <Field label="Válido até"><input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-bold text-brand-600">Total do orçamento</span>
          <span className="text-lg font-extrabold text-brand-600">{brl(totals.total)}</span>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Observação</h3>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Aparece no documento (ex: preços sujeitos a disponibilidade de estoque)" rows={2} className={inputCls} />
      </Card>

      {err && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</p>}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-surface/95 px-4 py-3 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Link href="/admin/orcamentos" className="flex-1 rounded-xl border border-line px-4 py-2.5 text-center text-sm font-bold text-[var(--text-muted)]">Cancelar</Link>
          <button onClick={salvar} disabled={saving} className="flex-[2] rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando…" : editId ? "Salvar alterações" : "Criar orçamento"}</button>
        </div>
      </div>
    </div>
  );
}
