"use client";

import { useCallback, useEffect, useRef } from "react";
import { printTicket } from "@/lib/print";

// Vigia HEADLESS no Caixa: imprime a FILA de jobs sob demanda (ex.: "Imprimir conta" que o garçom
// pede pelo celular — o celular não imprime, o job cai aqui e o Caixa imprime na impressora do balcão).
// Lê /api/print-jobs?station=caixa, imprime o HTML e marca done. Só a máquina do caixa (com impressora)
// roda isso — se não tiver impressora configurada, o printTicket cai no fallback do próprio caixa. — ComandaPRO
export default function CaixaPrintQueue({ station = "caixa" }: { station?: string }) {
  const busy = useRef(false);

  const tick = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await fetch(`/api/print-jobs?station=${encodeURIComponent(station)}`, { cache: "no-store" });
      const d = await r.json();
      const jobs: { id: number; html: string }[] = d.jobs ?? [];
      if (!jobs.length) return;
      const done: number[] = [];
      for (const j of jobs) {
        try { await printTicket(j.html, station); done.push(j.id); } catch { /* tenta na próxima rodada */ }
      }
      if (done.length) await fetch("/api/print-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done }) });
    } catch {
      /* mantém — próxima rodada tenta de novo */
    } finally {
      busy.current = false;
    }
  }, [station]);

  useEffect(() => {
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [tick]);

  return null; // headless
}
