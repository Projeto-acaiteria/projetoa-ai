"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/admin/ui";
import { OS_PRIORITY_ORDER, OS_PRIORITY_META } from "@/lib/os-priority";

const STATUSES = [
  { k: "aguardando", label: "Aguardando" },
  { k: "em_reparo", label: "Em reparo" },
  { k: "pronto", label: "Pronto" },
  { k: "entregue", label: "Entregue" },
] as const;
const PAYS: [string, string][] = [["pix", "PIX"], ["dinheiro", "Dinheiro"], ["cartao", "Cartão"]];

export default function OSActions({ id, status, situacao, situacoes, paymentStatus, priority, staffId, staff }: { id: string; status: string; situacao: string | null; situacoes: string[]; paymentStatus: string; priority: string | null; staffId: string | null; staff: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  async function api(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch("/api/os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      router.refresh();
    } finally { setBusy(false); }
  }

  const quitada = paymentStatus === "quitada";
  const cancelada = status === "cancelado";

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Prioridade</h3>
        <select value={priority ?? ""} disabled={busy} onChange={(e) => api("priority", { id, priority: e.target.value })}
          className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600 disabled:opacity-50">
          <option value="">Normal</option>
          {OS_PRIORITY_ORDER.map((k) => <option key={k} value={k}>{OS_PRIORITY_META[k].label}</option>)}
        </select>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Técnico</h3>
        <select value={staffId ?? ""} disabled={busy} onChange={(e) => e.target.value && api("assign", { id, staffId: e.target.value })}
          className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600 disabled:opacity-50">
          <option value="">Sem técnico atribuído</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <p className="mt-1 text-[10px] text-[var(--text-faded)]">Define quem monta/repara e a comissão sobre o serviço.</p>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Situação</h3>
        <div className="grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <button key={s.k} disabled={busy || status === s.k || cancelada} onClick={() => api("status", { id, status: s.k })}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${status === s.k ? "brand-gradient border-transparent text-white" : "border-line text-ink hover:border-brand-600"} disabled:opacity-50`}>
              {s.label}
            </button>
          ))}
        </div>
        {!cancelada && (
          <button disabled={busy} onClick={() => confirm("Cancelar esta OS?") && api("status", { id, status: "cancelado" })} className="mt-2 text-xs font-bold text-red-500">
            Cancelar OS
          </button>
        )}
        {cancelada && <div className="mt-2 text-xs font-bold text-red-500">OS cancelada</div>}
      </div>

      {situacoes.length > 0 && (
        <div className="border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Situação da loja</h3>
          <select value={situacao ?? ""} disabled={busy || cancelada} onChange={(e) => api("situacao", { id, situacao: e.target.value })}
            className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600 disabled:opacity-50">
            <option value="">— Nenhuma —</option>
            {situacoes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="mt-1 text-[10px] text-[var(--text-faded)]">Rótulo interno de acompanhamento (ex: aguardando peça). Aparece na lista e no painel. Edite as opções em Ajustes.</p>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Pagamento</h3>
        {quitada ? (
          <div className="rounded-lg border border-[var(--green-ok)]/40 bg-[var(--green-ok)]/10 px-3 py-2 text-sm font-bold text-[var(--green-ok)]">✓ Quitada</div>
        ) : !payOpen ? (
          <button disabled={busy || cancelada} onClick={() => setPayOpen(true)} className="w-full rounded-xl brand-gradient px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-50">
            Quitar OS
          </button>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-[var(--text-muted)]">Forma de pagamento:</div>
            <div className="grid grid-cols-3 gap-2">
              {PAYS.map(([k, l]) => (
                <button key={k} disabled={busy} onClick={() => api("quitar", { id, paymentMethod: k })} className="rounded-lg border border-line px-2 py-2.5 text-xs font-bold text-ink hover:border-brand-600 disabled:opacity-50">
                  {l}
                </button>
              ))}
            </div>
            <button onClick={() => setPayOpen(false)} className="text-xs text-[var(--text-muted)]">cancelar</button>
          </div>
        )}
        <p className="mt-2 text-[10px] text-[var(--text-faded)]">Quitar gera a comissão do técnico e dá baixa nas peças do estoque.</p>
      </div>
    </Card>
  );
}
