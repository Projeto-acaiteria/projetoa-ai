"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/admin/ui";

// Observação da OS que SAI no documento pro cliente (recepção/dono edita). Diferente das anotações
// internas do técnico, que nunca aparecem no documento.
export default function OSObsEditor({ id, initial }: { id: string; initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = text !== initial;

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "printObs", payload: { id, text } }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <Card className="p-5">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Observações (saem no documento)</h3>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Ex: retirar até sexta · cliente autorizou troca da fonte"
        className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving || !dirty} className="rounded-lg brand-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? "Salvando…" : "Salvar"}</button>
        {saved && <span className="text-xs font-bold text-[var(--green-ok)]">✓ salvo</span>}
        <span className="text-[10px] text-[var(--text-faded)]">Sai no documento A4. As anotações internas do técnico ficam só no sistema.</span>
      </div>
    </Card>
  );
}
