"use client";

import { useCallback, useEffect, useState } from "react";

// Alerta de chamados de mesa no cockpit (adm/garçom). Polla /api/mesas/chamados a cada 8s e lista
// "Mesa X chamou o garçom / pediu a conta" com botão Atender. — ComandaPRO 3.9
type Call = { id: number; table_number: number; type: "conta" | "atendente"; created_at: string };

export default function CallsAlert() {
  const [calls, setCalls] = useState<Call[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/mesas/chamados", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setCalls((d.calls ?? []) as Call[]);
    } catch {
      /* silencioso — próxima rodada tenta de novo */
    }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, [load]);

  async function atender(id: number) {
    setCalls((c) => c.filter((x) => x.id !== id)); // otimista
    try {
      await fetch("/api/mesas/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "atender", id }),
      });
    } catch {
      /* se falhar, o próximo poll traz de volta */
    }
    load();
  }

  if (!calls.length) return null;

  return (
    <div className="mb-4 space-y-2">
      {calls.map((c) => {
        const garcom = c.type === "atendente";
        return (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
            style={{
              background: garcom ? "rgba(37,99,235,0.10)" : "rgba(217,119,6,0.12)",
              borderColor: garcom ? "#2563EB" : "#D97706",
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: garcom ? "#2563EB" : "#D97706" }} />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: garcom ? "#2563EB" : "#D97706" }} />
              </span>
              <span className="font-bold text-ink">
                Mesa {c.table_number}
                <span className="ml-1.5 font-semibold" style={{ color: garcom ? "#2563EB" : "#B45309" }}>
                  {garcom ? "chamou o garçom" : "pediu a conta"}
                </span>
              </span>
            </div>
            <button
              onClick={() => atender(c.id)}
              className="shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-bold text-white"
              style={{ background: garcom ? "#2563EB" : "#D97706" }}
            >
              Atender
            </button>
          </div>
        );
      })}
    </div>
  );
}
