"use client";

import { useEffect, useRef, useState } from "react";

// Auto-update do PWA: o bundle carimba NEXT_PUBLIC_BUILD_ID; este componente compara com o build
// ATUAL do servidor (/api/version) e, quando há versão nova, recarrega — sem o operador reabrir o app.
// Recarrega no momento SEGURO (quando volta o foco ao app) e mostra um banner pra tocar em telas
// sempre-ligadas. Reload preserva a fila offline (IndexedDB), então não perde escrita pendente.
const MY_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

export default function VersionCheck() {
  const [stale, setStale] = useState(false);
  const checking = useRef(false);
  const staleRef = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (checking.current || staleRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return; // offline: não checa
      checking.current = true;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const d = await r.json();
        if (d?.build && d.build !== MY_BUILD) { staleRef.current = true; setStale(true); }
      } catch { /* erro/offline — ignora */ } finally { checking.current = false; }
    };
    const onVisibleCheck = () => { if (document.visibilityState === "visible") check(); };
    check();
    const iv = setInterval(check, 90_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibleCheck);
    return () => { clearInterval(iv); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", onVisibleCheck); };
  }, []);

  // há versão nova → recarrega quando o app VOLTA a ficar visível (momento seguro; operador retornou)
  useEffect(() => {
    if (!stale) return;
    const onVis = () => { if (document.visibilityState === "visible") location.reload(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [stale]);

  if (!stale) return null;
  return (
    <button
      onClick={() => location.reload()}
      className="fixed inset-x-0 bottom-4 z-[100] mx-auto w-max rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg ring-2 ring-white/30"
    >
      🔄 Atualização disponível — toque para atualizar
    </button>
  );
}
