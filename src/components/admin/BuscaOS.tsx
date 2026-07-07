"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = { id: string; code: string | null; customerName: string; device: string; status: string; paymentStatus: string };

const STATUS_LABEL: Record<string, string> = {
  aguardando: "Aguardando", em_reparo: "Em reparo", pronto: "Pronto", entregue: "Entregue", cancelado: "Cancelado",
};

// Busca de balcão: cliente chega, a recepção acha a OS na hora por código, nome ou telefone.
export default function BuscaOS() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/os?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
        const d = await r.json();
        setHits(d.results ?? []);
      } catch { setHits([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // fecha o dropdown ao clicar fora
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setHits(null); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function abrir(id: string) { setHits(null); setQ(""); router.push(`/admin/os/${id}`); }

  return (
    <div ref={boxRef} className="relative mb-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar OS por código, cliente ou telefone…"
        className="w-full rounded-xl border border-line bg-bg-elevated px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-600" />
      {hits !== null && (q.trim().length >= 2) && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-bg-surface shadow-lg">
          {loading && hits.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--text-muted)]">Buscando…</div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--text-muted)]">Nada encontrado pra “{q.trim()}”.</div>
          ) : (
            hits.map((h) => (
              <button key={h.id} onClick={() => abrir(h.id)} className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-bg-surface-2">
                <span className="min-w-0">
                  <span className="font-mono text-xs text-brand-600">{h.code ?? h.id.slice(0, 8)}</span>
                  <span className="block truncate text-sm text-ink">{h.customerName || "—"} · {h.device || "—"}</span>
                </span>
                <span className="shrink-0 rounded-full bg-bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">{STATUS_LABEL[h.status] ?? h.status}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
