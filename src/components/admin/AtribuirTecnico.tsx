"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Atribui um técnico à OS direto do cockpit (recepção), sem abrir a OS. Reusa /api/os action "assign".
export default function AtribuirTecnico({ id, staffId, staff }: { id: string; staffId: string | null; staff: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function assign(sid: string) {
    if (!sid || busy) return;
    setBusy(true);
    try {
      await fetch("/api/os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", payload: { id, staffId: sid } }) });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <select value={staffId ?? ""} disabled={busy} onChange={(e) => assign(e.target.value)}
      className="rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-brand-600 disabled:opacity-50">
      <option value="">Atribuir técnico…</option>
      {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}
