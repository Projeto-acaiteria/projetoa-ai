"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PAYS: [string, string][] = [["pix", "PIX"], ["dinheiro", "Dinheiro"], ["cartao", "Cartão"]];

function waLink(phone: string, msg: string): string {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length <= 11 ? "55" + digits : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}

// Ações da recepção numa OS PRONTA: avisar o cliente (WhatsApp) e entregar (quita se faltar).
export default function RecepcaoProntaAcoes({ id, customerName, customerPhone, device, quitada, notified, storeName }: {
  id: string; customerName: string; customerPhone: string; device: string; quitada: boolean; notified?: boolean; storeName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [avisado, setAvisado] = useState(!!notified);
  const [err, setErr] = useState("");

  // ao abrir o WhatsApp, carimba "avisado" (otimista) — não bloqueia o link
  function marcarAvisado() {
    setAvisado(true);
    fetch("/api/os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "notify", payload: { id } }) })
      .then(() => router.refresh()).catch(() => {});
  }

  async function entregar(paymentMethod?: string) {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "entregar", payload: { id, paymentMethod } }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "falha"); }
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao entregar"); setBusy(false); }
  }

  const nome = customerName?.split(" ")[0] || "cliente";
  const msg = `Oi ${nome}! Aqui é da ${storeName}. Seu ${device || "aparelho"} está pronto pra retirada. 🔧`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {customerPhone && (
        <a href={waLink(customerPhone, msg)} target="_blank" rel="noopener noreferrer" onClick={marcarAvisado}
          className="rounded-lg border border-[var(--green-ok)]/40 bg-[var(--green-ok)]/10 px-3 py-1.5 text-xs font-bold text-[var(--green-ok)] hover:bg-[var(--green-ok)]/20">
          {avisado ? "Avisar de novo" : "Avisar no WhatsApp"}
        </a>
      )}
      {!payOpen ? (
        <button disabled={busy} onClick={() => (quitada ? entregar() : setPayOpen(true))}
          className="rounded-lg brand-gradient px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {busy ? "…" : quitada ? "Entregar" : "Receber e entregar"}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-[var(--text-muted)]">Pagou com:</span>
          {PAYS.map(([k, l]) => (
            <button key={k} disabled={busy} onClick={() => entregar(k)}
              className="rounded-lg border border-line px-2 py-1.5 text-xs font-bold text-ink hover:border-brand-600 disabled:opacity-50">{l}</button>
          ))}
          <button onClick={() => setPayOpen(false)} className="text-[10px] text-[var(--text-muted)]">cancelar</button>
        </span>
      )}
      {err && <span className="text-xs text-red-500">{err}</span>}
    </div>
  );
}
