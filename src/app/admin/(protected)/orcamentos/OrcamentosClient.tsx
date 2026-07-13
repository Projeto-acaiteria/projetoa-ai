"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/admin/ui";

type Status = "pendente" | "aprovado" | "recusado" | "expirado";
type ItemKind = "produto" | "servico";
type ApiItem = { kind: ItemKind; name: string; detail?: string; qty: number; unitCents: number; discountCents: number };
type Budget = {
  id: string; code: string; customerName: string; customerPhone: string; cpf: string | null;
  items: ApiItem[]; freteCents: number; outrosCents: number; discountCents: number;
  validadeAt: string | null; observacao: string | null; status: Status; createdAt: string;
  osId?: string | null; osCode?: string | null;
};

// linha do editor (dinheiro como texto pra digitar)
type Row = { kind: ItemKind; name: string; detail: string; qty: string; unit: string; desc: string };

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toCents = (s: string) => Math.max(0, Math.round((parseFloat((s || "").replace(",", ".")) || 0) * 100));
const centsToStr = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const dmy = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const inputCls = "rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-brand-600";

const STATUS: Record<Status, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
  recusado: { label: "Recusado", cls: "bg-red-100 text-red-600" },
  expirado: { label: "Expirado", cls: "bg-slate-200 text-slate-600" },
};
const emptyRow = (kind: ItemKind = "produto"): Row => ({ kind, name: "", detail: "", qty: "1", unit: "", desc: "" });

export default function OrcamentosClient({ storeName }: { storeName?: string }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // form
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [fone, setFone] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [frete, setFrete] = useState("");
  const [outros, setOutros] = useState("");
  const [desconto, setDesconto] = useState("");
  const [validade, setValidade] = useState("");
  const [obs, setObs] = useState("");

  const reload = useCallback(async () => {
    const r = await fetch("/api/orcamentos", { cache: "no-store" });
    const d = await r.json();
    setBudgets(d.budgets ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const totals = useMemo(() => {
    let prod = 0, serv = 0;
    for (const r of rows) {
      const sub = Math.max(0, (parseInt(r.qty) || 0) * toCents(r.unit) - toCents(r.desc));
      if (r.kind === "servico") serv += sub; else prod += sub;
    }
    const total = Math.max(0, prod + serv + toCents(frete) + toCents(outros) - toCents(desconto));
    return { prod, serv, total };
  }, [rows, frete, outros, desconto]);

  function resetForm() {
    setEditId(null); setCpf(""); setNome(""); setFone(""); setRows([emptyRow()]);
    setFrete(""); setOutros(""); setDesconto(""); setValidade(""); setObs(""); setErr("");
  }
  function novo() { resetForm(); setOpen(true); }
  function editar(b: Budget) {
    setEditId(b.id); setCpf(b.cpf || ""); setNome(b.customerName); setFone(b.customerPhone);
    setRows(b.items.length ? b.items.map((it) => ({ kind: it.kind, name: it.name, detail: it.detail || "", qty: String(it.qty), unit: centsToStr(it.unitCents), desc: it.discountCents ? centsToStr(it.discountCents) : "" })) : [emptyRow()]);
    setFrete(b.freteCents ? centsToStr(b.freteCents) : ""); setOutros(b.outrosCents ? centsToStr(b.outrosCents) : "");
    setDesconto(b.discountCents ? centsToStr(b.discountCents) : ""); setValidade(b.validadeAt || ""); setObs(b.observacao || "");
    setErr(""); setOpen(true);
  }

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

  async function api(action: string, payload: unknown): Promise<{ ok: boolean; code?: string }> {
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/orcamentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Não consegui salvar."); return { ok: false }; }
      await reload();
      return { ok: true, code: d.code };
    } finally { setSaving(false); }
  }

  async function salvar() {
    if (!nome.trim()) { setErr("Informe o cliente."); return; }
    const items = rows.filter((r) => r.name.trim()).map((r) => ({ kind: r.kind, name: r.name.trim(), detail: r.detail.trim() || undefined, qty: parseInt(r.qty) || 1, unitCents: toCents(r.unit), discountCents: toCents(r.desc) }));
    if (!items.length) { setErr("Adicione ao menos um item."); return; }
    const payload = {
      id: editId ?? undefined, customerName: nome.trim(), customerPhone: fone.trim() || undefined, cpf: onlyDigits(cpf) || undefined,
      items, freteCents: toCents(frete), outrosCents: toCents(outros), discountCents: toCents(desconto),
      validadeAt: validade || undefined, observacao: obs.trim() || undefined,
    };
    const res = await api(editId ? "update" : "create", payload);
    if (res.ok) { setOpen(false); resetForm(); }
  }

  function docUrl(code: string) { return `${window.location.origin}/doc/${code}`; }
  function enviarWhats(b: Budget) {
    const url = docUrl(b.code);
    const loja = storeName?.trim() || "nossa loja";
    const primeiroNome = (b.customerName || "").trim().split(" ")[0] || "tudo bem";
    const msg = [
      `Olá, ${primeiroNome}! Aqui é da ${loja}.`,
      `Segue o seu orçamento nº ${b.code}, no valor de ${brl(budgetTotal(b))}. Qualquer dúvida, estamos à disposição. 🙂`,
      ``,
      `Para ver os detalhes e aprovar, é só acessar:`,
      url,
    ].join("\n");
    const foneDig = onlyDigits(b.customerPhone);
    const wa = foneDig ? `https://wa.me/55${foneDig}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(wa, "_blank");
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  return (
    <div className="max-w-3xl space-y-4">
      {!open && (
        <button onClick={novo} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white">+ Novo orçamento</button>
      )}

      {open && (
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-extrabold text-ink">{editId ? "Editar orçamento" : "Novo orçamento"}</h3>
            <button onClick={() => { setOpen(false); resetForm(); }} className="text-xl leading-none text-[var(--text-muted)]">×</button>
          </div>

          {/* cliente */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex gap-2 sm:w-64">
              <input value={cpf} onChange={(e) => setCpf(e.target.value)} onBlur={buscarCliente} inputMode="numeric" placeholder="CPF" className={`${inputCls} flex-1`} />
              <button onClick={buscarCliente} className="rounded-lg border border-brand-400 px-3 text-sm font-bold text-brand-600">buscar</button>
            </div>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Cliente *" className={`${inputCls} flex-1`} />
            <input value={fone} onChange={(e) => setFone(e.target.value)} placeholder="WhatsApp" className={`${inputCls} sm:w-40`} />
          </div>

          {/* itens */}
          <div className="mt-4">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Itens</div>
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
          </div>

          {/* extras + validade */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Frete R$<input value={frete} onChange={(e) => setFrete(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${inputCls} mt-1 w-full`} /></label>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Outros R$<input value={outros} onChange={(e) => setOutros(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${inputCls} mt-1 w-full`} /></label>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Desconto R$<input value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${inputCls} mt-1 w-full`} /></label>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Válido até<input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className={`${inputCls} mt-1 w-full`} /></label>
          </div>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (aparece no documento)" rows={2} className={`${inputCls} mt-2 w-full`} />

          <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2.5">
            <span className="text-sm font-bold text-brand-600">Total do orçamento</span>
            <span className="text-lg font-extrabold text-brand-600">{brl(totals.total)}</span>
          </div>

          {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={() => { setOpen(false); resetForm(); }} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-[var(--text-muted)]">Cancelar</button>
            <button onClick={salvar} disabled={saving} className="flex-1 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando…" : "Salvar orçamento"}</button>
          </div>
        </Card>
      )}

      {err && !open && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</p>}
      {budgets.length === 0 && !open && <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhum orçamento ainda. Crie o primeiro.</Card>}

      {budgets.map((b) => (
        <Card key={b.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-brand-600">{b.code}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[b.status].cls}`}>{STATUS[b.status].label}</span>
              </div>
              <div className="truncate font-bold text-ink">{b.customerName}</div>
              <div className="text-xs text-[var(--text-muted)]">{dmy(b.createdAt)}{b.validadeAt ? ` · válido até ${dmy(b.validadeAt)}` : ""} · {b.items.length} itens</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-extrabold text-ink">{brl(budgetTotal(b))}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            <a href={`/doc/${b.code}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink">Ver documento (A4)</a>
            <button onClick={() => enviarWhats(b)} className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">Enviar por WhatsApp</button>
            {!b.osId && <button onClick={() => editar(b)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-600">Editar</button>}
            {b.osId ? (
              <a href={`/admin/os/${b.osId}`} className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">✓ OS gerada: {b.osCode}</a>
            ) : (
              <button onClick={() => confirm(`Aprovar o orçamento ${b.code} e gerar a Ordem de Serviço?`) && api("aprovar", { id: b.id })} className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-bold text-green-700">Aprovar → gerar OS</button>
            )}
            {b.status === "pendente" && <button onClick={() => api("status", { id: b.id, status: "recusado" })} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-[var(--text-muted)]">Recusar</button>}
            <button onClick={() => confirm(`Excluir o orçamento ${b.code}?`) && api("delete", { id: b.id })} className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-500">Excluir</button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// total do orçamento salvo (espelha budgetTotals do server)
function budgetTotal(b: Budget): number {
  let prod = 0, serv = 0;
  for (const it of b.items) {
    const sub = Math.max(0, it.qty * it.unitCents - it.discountCents);
    if (it.kind === "servico") serv += sub; else prod += sub;
  }
  return Math.max(0, prod + serv + b.freteCents + b.outrosCents - b.discountCents);
}
