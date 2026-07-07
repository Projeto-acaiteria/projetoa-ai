"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { pendingCount, flushQueue, QUEUE_EVENT } from "@/lib/offline-queue";

// Barra de status offline (só no Starteq/AT). Mostra conexão + quantas escritas estão PENDENTES
// (ainda não subiram). Ao reconectar, drena a fila e atualiza a tela. λ.prova-na-fonte: o operador
// vê que ainda não sincronizou — não é "achei que salvou".
export default function OfflineIndicator() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pend, setPend] = useState(0);

  const refresh = useCallback(async () => { setPend(await pendingCount()); }, []);

  const sync = useCallback(async () => {
    const sent = await flushQueue();
    await refresh();
    if (sent > 0) router.refresh(); // as escritas subiram → recarrega os dados do servidor
  }, [refresh, router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    if (navigator.onLine) sync(); // drena o que sobrou de uma sessão offline anterior

    const onOnline = () => { setOnline(true); sync(); };
    const onOffline = () => { setOnline(false); refresh(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(QUEUE_EVENT, refresh);
    const iv = setInterval(refresh, 8000); // rede social de segurança
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(QUEUE_EVENT, refresh);
      clearInterval(iv);
    };
  }, [refresh, sync]);

  // nada a mostrar quando está tudo online e sincronizado
  if (online && pend === 0) return null;

  return (
    <div className={`mb-3 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${online ? "border-brand-400 bg-brand-600/5" : "border-gold/50 bg-gold/10"}`}>
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${online ? "bg-brand-600" : "bg-gold"}`} />
        <span className="font-bold text-ink">{online ? "Sincronizando…" : "Sem conexão — trabalhando local"}</span>
      </span>
      {pend > 0 && (
        <span className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{pend} {pend === 1 ? "escrita pendente" : "escritas pendentes"}</span>
          {online && <button onClick={sync} className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink hover:border-brand-600">Sincronizar</button>}
        </span>
      )}
    </div>
  );
}
