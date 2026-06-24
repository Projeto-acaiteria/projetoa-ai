"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { printTicket } from "@/lib/print";
import { stationTicketHtml } from "@/lib/ticket";

// KDS — telas de preparo por estação. Lê /api/kds (pedidos já roteados por estação pelo motor)
// e avança status pendente → preparando → pronto → entregue (sai do quadro). Polling 8s + tick
// de 1s pro tempo/urgência. O aparelho da cozinha fixa a estação; persiste em localStorage.

type KdsItem = { name: string; size_label: string | null; qty: number; mods: { name: string; price_cents: number }[] | null; note?: string | null };
type KdsOrder = { id: number; station: string; status: string; created_at: string; table_label: string; note: string | null; items: KdsItem[] };

const COLS = [
  { key: "pendente", title: "Na fila", accent: "#F59E0B" },
  { key: "preparando", title: "Preparando", accent: "#3B82F6" },
  { key: "pronto", title: "Pronto", accent: "#10B981" },
] as const;

const NEXT: Record<string, string> = { pendente: "preparando", preparando: "pronto", pronto: "entregue" };
const NEXT_LABEL: Record<string, string> = { pendente: "Iniciar preparo", preparando: "Marcar pronto", pronto: "Entregar" };

function minsSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}
function urgency(mins: number) {
  if (mins >= 10) return { color: "#DC2626", label: `${mins} min`, pulse: true };
  if (mins >= 5) return { color: "#D97706", label: `${mins} min`, pulse: false };
  return { color: "#16A34A", label: mins === 0 ? "agora" : `${mins} min`, pulse: false };
}
function StationIcon({ station, size = 14 }: { station: string; size?: number }) {
  if (station === "bar")
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14l-7 9z" /><path d="M12 12v7" /><path d="M8 21h8" /></svg>);
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 11h16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M6 15l1 5h10l1-5" /></svg>);
}

export default function KdsClient({ stations, loja }: { stations: string[]; loja: string }) {
  const multi = stations.length > 1;
  const [sel, setSel] = useState<string>("todas");
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [busy, setBusy] = useState<number | null>(null);
  const [autoprint, setAutoprint] = useState(false);
  const inited = useRef(false);
  const printedRef = useRef<Set<number>>(new Set()); // ids já impressos (não reimprimir)
  const baselined = useRef(false); // 1ª carga marca os existentes sem imprimir

  function buildTicket(o: KdsOrder) {
    return stationTicketHtml({
      loja,
      station: o.station,
      tableLabel: o.table_label,
      dateLabel: new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      orderId: o.id,
      items: o.items.map((i) => ({ qty: i.qty, name: i.name, sizeLabel: i.size_label, mods: i.mods, note: i.note })),
      note: o.note,
    });
  }
  function printOrder(o: KdsOrder) {
    printTicket(buildTicket(o), o.station);
    printedRef.current.add(o.id);
  }

  // estação persistida por aparelho (a cozinha fixa "cozinha")
  useEffect(() => {
    const saved = localStorage.getItem("kds:station");
    if (saved && (saved === "todas" || stations.includes(saved))) setSel(saved);
    inited.current = true;
  }, [stations]);
  useEffect(() => { if (inited.current) localStorage.setItem("kds:station", sel); }, [sel]);

  const active = sel === "todas" ? stations : [sel];

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/kds?stations=${encodeURIComponent(active.join(","))}`, { cache: "no-store" });
      const d = await r.json();
      const list: KdsOrder[] = d.orders ?? [];
      setOrders(list);
      // auto-print de pedidos NOVOS (pendentes). 1ª carga só marca baseline (não imprime o backlog).
      if (!baselined.current) {
        list.forEach((o) => printedRef.current.add(o.id));
        baselined.current = true;
      } else if (autoprint) {
        for (const o of list) if (o.status === "pendente" && !printedRef.current.has(o.id)) printOrder(o);
      }
    } catch { /* mantém o que tem */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.join(","), autoprint]);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  async function advance(o: KdsOrder) {
    setBusy(o.id);
    // otimista: pronto→entregue some; senão muda de coluna
    const nextStatus = NEXT[o.status];
    setOrders((cur) => (nextStatus === "entregue" ? cur.filter((x) => x.id !== o.id) : cur.map((x) => (x.id === o.id ? { ...x, status: nextStatus } : x))));
    try {
      await fetch("/api/kds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: o.id, status: nextStatus }) });
    } finally {
      setBusy(null);
      load();
    }
  }

  return (
    <div>
      {/* controles: seletor de estação + impressão automática */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {multi ? (
          <div className="flex flex-wrap gap-2">
            {["todas", ...stations].map((s) => (
              <button
                key={s}
                onClick={() => setSel(s)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition ${sel === s ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
              >
                {s !== "todas" && <StationIcon station={s} />} {s}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <button
          onClick={() => setAutoprint((v) => !v)}
          title="Imprime a via na impressora da estação assim que o pedido chega"
          className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${autoprint ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
          Impressão automática {autoprint ? "ON" : "OFF"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLS.map((col) => {
          const cards = orders.filter((o) => o.status === col.key);
          return (
            <section key={col.key} className="rounded-2xl bg-zinc-50 p-3">
              <header className="mb-3 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.accent }} /> {col.title}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-zinc-500">{cards.length}</span>
              </header>

              <div className="space-y-3">
                {cards.length === 0 && <p className="px-1 py-6 text-center text-sm text-zinc-300">—</p>}
                {cards.map((o) => {
                  const u = urgency(minsSince(o.created_at, now));
                  return (
                    <article key={o.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm" style={{ borderLeft: `4px solid ${u.color}` }}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-base font-extrabold text-zinc-900">{o.table_label}</span>
                        <span className="flex items-center gap-2.5">
                          <button onClick={() => printOrder(o)} title="Imprimir via" className="text-zinc-300 transition hover:text-zinc-700">
                            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
                          </button>
                          <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: u.color }}>
                            {u.pulse && <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: u.color }} />}
                            {u.label}
                          </span>
                        </span>
                      </div>
                      {multi && sel === "todas" && (
                        <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-zinc-500">
                          <StationIcon station={o.station} size={11} /> {o.station}
                        </span>
                      )}
                      <ul className="space-y-1">
                        {o.items.map((it, i) => (
                          <li key={i} className="text-sm">
                            <div className="flex gap-2">
                              <span className="font-bold text-zinc-900 tabular-nums">{it.qty}×</span>
                              <span className="text-zinc-700">{it.name}{it.size_label && <span className="text-zinc-400"> · {it.size_label}</span>}</span>
                            </div>
                            {it.mods && it.mods.length > 0 && (
                              <div className="pl-6 text-xs font-bold text-amber-700">
                                {it.mods.map((m, j) => <div key={j}>+ {m.name}</div>)}
                              </div>
                            )}
                            {it.note && <div className="pl-6 text-xs font-bold italic text-amber-700">obs: {it.note}</div>}
                          </li>
                        ))}
                      </ul>
                      {o.note && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Obs: {o.note}</p>}
                      <button
                        onClick={() => advance(o)}
                        disabled={busy === o.id}
                        className="mt-3 w-full rounded-lg py-2 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                        style={{ background: COLS.find((c) => c.key === o.status)?.accent }}
                      >
                        {NEXT_LABEL[o.status]}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
