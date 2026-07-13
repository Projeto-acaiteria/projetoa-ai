"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/admin/ui";

type Part = { id: string; sku: string | null; name: string; qty: number; unitCostCents: number };
type Produto = { id: string; name: string; priceCents: number };

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toCents = (s: string) => Math.max(0, Math.round((parseFloat((s || "").replace(",", ".")) || 0) * 100));
const inputCls = "rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-brand-600";

export default function OSPartsEditor({ osId, parts, quitada, produtos }: { osId: string; parts: Part[]; quitada: boolean; produtos: Produto[] }) {
  const router = useRouter();
  const byName = useMemo(() => new Map(produtos.map((p) => [p.name.toLowerCase(), p])), [produtos]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState<string>("");
  const [qty, setQty] = useState("1");
  const [valor, setValor] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // ao escolher um produto do estoque, liga o SKU e sugere o preço de venda
  function onName(v: string) {
    const prod = byName.get(v.trim().toLowerCase());
    setName(v);
    setSku(prod?.id || "");
    if (prod && !valor) setValor((prod.priceCents / 100).toFixed(2).replace(".", ","));
  }

  async function api(action: string, payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Não consegui salvar."); return false; }
      router.refresh();
      return true;
    } finally { setBusy(false); }
  }

  async function adicionar() {
    if (!name.trim()) { setErr("Informe a peça."); return; }
    if (await api("add-part", { id: osId, name: name.trim(), qty: parseInt(qty) || 1, unitCents: toCents(valor), sku: sku || undefined })) {
      setName(""); setSku(""); setQty("1"); setValor("");
    }
  }

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Peças {parts.length > 0 && `(${parts.length})`}</h3>

      {parts.length > 0 ? (
        <div className="mb-3 divide-y divide-line">
          {parts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm text-ink">{p.name}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{p.qty} un × {brl(p.unitCostCents)}{p.sku ? " · do estoque" : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-ink">{brl(p.qty * p.unitCostCents)}</span>
                {!quitada && <button onClick={() => api("remove-part", { id: osId, partId: p.id })} disabled={busy} className="text-red-500 disabled:opacity-40" aria-label="Remover">×</button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-sm text-[var(--text-muted)]">Nenhuma peça lançada. A comissão do técnico sai só do serviço — a peça entra no total, sem comissão.</p>
      )}

      {quitada ? (
        <p className="text-xs text-[var(--text-faded)]">OS quitada — peças bloqueadas.</p>
      ) : (
        <div className="rounded-xl border border-line bg-bg-base p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Adicionar peça</div>
          <datalist id="os-produtos">{produtos.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          <div className="flex flex-wrap items-center gap-2">
            <input list="os-produtos" value={name} onChange={(e) => onName(e.target.value)} placeholder="Peça (do estoque ou avulsa)" className={`${inputCls} min-w-[150px] flex-1`} />
            {sku ? <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-600">estoque</span> : name.trim() && <span className="rounded bg-bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-faded)]">avulsa</span>}
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder="Qtd" className={`${inputCls} w-16 text-center`} />
            <label className="flex items-center gap-1 rounded-lg border border-line bg-bg-elevated px-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">R$</span>
              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className="w-20 bg-transparent py-2 text-sm text-ink outline-none" />
            </label>
            <button onClick={adicionar} disabled={busy} className="rounded-lg brand-gradient px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Adicionar</button>
          </div>
          {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
          <p className="mt-2 text-[10px] text-[var(--text-faded)]">Peça do estoque dá baixa automática quando a OS for quitada. Valor = preço cobrado do cliente.</p>
        </div>
      )}
    </Card>
  );
}
