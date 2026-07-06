"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls = "w-full rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

export default function NovaOSButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ customerName: "", customerPhone: "", device: "", imei: "", problem: "", servico: "" });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function salvar() {
    if (!f.customerName.trim() || !f.device.trim() || saving) return;
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/os", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", payload: {
          customerName: f.customerName.trim(),
          customerPhone: f.customerPhone.trim() || undefined,
          device: f.device.trim(),
          imei: f.imei.trim() || undefined,
          problem: f.problem.trim() || undefined,
          serviceValueCents: f.servico ? Math.round((parseFloat(f.servico.replace(",", ".")) || 0) * 100) : undefined,
        } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao abrir a OS.");
      setF({ customerName: "", customerPhone: "", device: "", imei: "", problem: "", servico: "" });
      setOpen(false);
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao abrir a OS."); }
    finally { setSaving(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white">
        + Nova OS
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 lg:items-center" onClick={() => setOpen(false)}>
          <div className="my-8 w-full max-w-md rounded-2xl border border-line bg-bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-ink">Check-in do aparelho</h2>
            <div className="space-y-2">
              <input value={f.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="Cliente *" className={inputCls} />
              <input value={f.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} placeholder="WhatsApp" className={inputCls} />
              <input value={f.device} onChange={(e) => set("device", e.target.value)} placeholder="Aparelho * (ex: iPhone 12, Notebook Acer)" className={inputCls} />
              <input value={f.imei} onChange={(e) => set("imei", e.target.value)} placeholder="IMEI / série" className={`${inputCls} font-mono`} />
              <textarea value={f.problem} onChange={(e) => set("problem", e.target.value)} placeholder="Defeito relatado" rows={2} className={inputCls} />
              <input value={f.servico} onChange={(e) => set("servico", e.target.value)} inputMode="decimal" placeholder="Valor do serviço R$ (opcional)" className={inputCls} />
            </div>
            {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-[var(--text-muted)]">Cancelar</button>
              <button onClick={salvar} disabled={saving || !f.customerName.trim() || !f.device.trim()} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                Abrir OS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
