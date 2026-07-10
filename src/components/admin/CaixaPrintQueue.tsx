"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { printTicket } from "@/lib/print";
import { getStationPrinter } from "@/lib/qz";

// Vigia HEADLESS da FILA de impressão: imprime jobs sob demanda (ex.: garçom pede "Imprimir conta"
// pelo celular — o celular não imprime, o job cai aqui e a MÁQUINA DO CAIXA imprime na impressora do
// balcão). Montado no AdminShell → roda em QUALQUER página do admin, mas SÓ na máquina que tem a
// impressora do caixa configurada (getStationPrinter). Celular do garçom / outras máquinas não têm
// impressora → nem faz polling. Assim a impressão é automática sem precisar estar na tela do Caixa. — ComandaPRO
export default function CaixaPrintQueue({ station = "caixa" }: { station?: string }) {
  const busy = useRef(false);
  const [hasPrinter, setHasPrinter] = useState(false);

  useEffect(() => {
    const read = () => setHasPrinter(!!getStationPrinter(station));
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [station]);

  const tick = useCallback(async () => {
    if (busy.current || !getStationPrinter(station)) return; // só a máquina do caixa (com impressora) imprime a fila
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
    if (!hasPrinter) return; // sem impressora do caixa nesta máquina → não vigia
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [tick, hasPrinter]);

  return null; // headless
}
