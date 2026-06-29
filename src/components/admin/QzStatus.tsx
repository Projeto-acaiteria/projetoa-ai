"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { qzConnect, getStationPrinter } from "@/lib/qz";

type State = "checking" | "ok" | "noprinter" | "offline";

// Badge de status da impressão (QZ Tray). O ponto de falha nº1 da térmica é o QZ não
// estar rodando na máquina — aqui o operador vê isso ANTES de vender, em vez de descobrir
// quando o cupom não sai. Usa qzConnect (não qzIsActive: aba nova retorna false mesmo com
// QZ aberto). Pinga no mount, ao voltar o foco da janela (abriu o QZ e voltou) e no "tentar
// de novo". Verde é reservado a "pago" no design — ok usa o ponto índigo (acento).
export default function QzStatus({ station = "caixa", className = "" }: { station?: string; className?: string }) {
  const [state, setState] = useState<State>("checking");

  const check = useCallback(async () => {
    try {
      await qzConnect();
      setState(getStationPrinter(station) ? "ok" : "noprinter");
    } catch {
      setState("offline");
    }
  }, [station]);

  useEffect(() => {
    void check();
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [check]);

  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold";

  if (state === "checking")
    return (
      <span className={`${base} border border-line text-[var(--text-muted)] ${className}`}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--text-muted)]" /> Verificando impressora…
      </span>
    );

  if (state === "ok")
    return (
      <span className={`${base} border border-line text-[var(--text-muted)] ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> Impressora pronta
      </span>
    );

  if (state === "noprinter")
    return (
      <Link href="/admin/impressora" className={`${base} border border-brand-600 text-brand-600 ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> Escolha a impressora
      </Link>
    );

  // offline
  return (
    <span className={`${base} bg-[#FEECEC] text-[var(--red-no)] ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--red-no)]" /> QZ Tray fechado — abra o app
      <button onClick={() => void check()} className="ml-0.5 underline">tentar de novo</button>
    </span>
  );
}
