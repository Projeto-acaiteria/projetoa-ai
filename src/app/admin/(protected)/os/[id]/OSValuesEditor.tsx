"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/admin/ui";
import { useToast } from "@/components/admin/toast";

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toCents = (s: string) => Math.max(0, Math.round((parseFloat((s || "").replace(",", ".")) || 0) * 100));
const str = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const inputCls = "w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-sm text-ink outline-none focus:border-brand-600";

// Ajuste de preço da OS (recebe → diagnostica → precifica). Serviço + desconto editáveis; peças vêm
// do editor de peças. Total e comissão recalculam ao vivo. Some quando a OS é quitada.
export default function OSValuesEditor({ osId, serviceValueCents, discountCents, partsValueCents, commissionPercent }: { osId: string; serviceValueCents: number; discountCents: number; partsValueCents: number; commissionPercent: number }) {
  const router = useRouter();
  const toast = useToast();
  const [sv, setSv] = useState(str(serviceValueCents));
  const [dc, setDc] = useState(discountCents ? str(discountCents) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const service = toCents(sv), disc = toCents(dc);
  const total = Math.max(0, service + partsValueCents - disc);
  const comissao = Math.round(service * commissionPercent / 100);
  const dirty = service !== serviceValueCents || disc !== discountCents;

  async function salvar() {
    setBusy(true); setErr(""); setOk(false);
    try {
      const r = await fetch("/api/os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-values", payload: { id: osId, serviceValueCents: service, discountCents: disc } }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Não consegui salvar."); toast(d.error || "Não consegui salvar.", "error"); return; }
      setOk(true); toast("Valores atualizados"); router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Valor do serviço</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Serviço (mão de obra)
          <div className="mt-1 flex items-center rounded-lg border border-line bg-bg-base px-2"><span className="text-sm text-[var(--text-muted)]">R$</span>
            <input value={sv} onChange={(e) => { setSv(e.target.value); setOk(false); }} inputMode="decimal" placeholder="0,00" className="w-full bg-transparent px-1 py-2 text-sm text-ink outline-none" /></div>
        </label>
        <label className="text-xs font-semibold text-[var(--text-muted)]">Desconto
          <div className="mt-1 flex items-center rounded-lg border border-line bg-bg-base px-2"><span className="text-sm text-[var(--text-muted)]">R$</span>
            <input value={dc} onChange={(e) => { setDc(e.target.value); setOk(false); }} inputMode="decimal" placeholder="0,00" className="w-full bg-transparent px-1 py-2 text-sm text-ink outline-none" /></div>
        </label>
      </div>

      <div className="mt-3 space-y-1 rounded-lg bg-bg-surface-2 p-3 text-sm">
        <div className="flex justify-between text-[var(--text-muted)]"><span>Serviço</span><span>{brl(service)}</span></div>
        <div className="flex justify-between text-[var(--text-muted)]"><span>Peças</span><span>{brl(partsValueCents)}</span></div>
        {disc > 0 && <div className="flex justify-between text-[var(--text-muted)]"><span>Desconto</span><span>− {brl(disc)}</span></div>}
        <div className="flex justify-between border-t border-line pt-1 font-extrabold text-ink"><span>Total</span><span>{brl(total)}</span></div>
        <div className="flex justify-between text-[11px] text-[var(--text-faded)]"><span>Comissão do técnico ({commissionPercent}% do serviço)</span><span>{brl(comissao)}</span></div>
      </div>

      {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
      <button onClick={salvar} disabled={busy || !dirty} className="mt-3 w-full rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Salvando…" : ok && !dirty ? "Salvo ✓" : "Salvar valores"}
      </button>
      <p className="mt-2 text-[11px] text-[var(--text-faded)]">Peça se ajusta no card de Peças. A comissão sai sempre só do serviço.</p>
    </Card>
  );
}
