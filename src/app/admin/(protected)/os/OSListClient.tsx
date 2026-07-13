"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/admin/ui";
import { OS_PRIORITY_META, type OSPriority } from "@/lib/os-priority";

export type OSLite = {
  id: string; code: string | null; customerName: string; device: string; problem: string;
  status: string; situacao?: string | null; priority?: string | null; totalCents: number; paymentStatus: string; createdAt: string;
};

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const STATUS_LABEL: Record<string, string> = { aguardando: "Aguardando", em_reparo: "Em reparo", pronto: "Pronto", entregue: "Entregue", cancelado: "Cancelado" };
const STATUS_CLS: Record<string, string> = {
  aguardando: "text-[var(--text-muted)]", em_reparo: "text-brand-600", pronto: "text-[var(--green-ok)]",
  entregue: "text-[var(--text-faded)]", cancelado: "text-red-500",
};
const haDias = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); return d <= 0 ? "hoje" : d === 1 ? "há 1 dia" : `há ${d} dias`; };

const TABS = [
  { k: "abertas", label: "Em aberto" },
  { k: "aguardando", label: "Aguardando" },
  { k: "em_reparo", label: "Em reparo" },
  { k: "pronto", label: "Prontas" },
  { k: "entregue", label: "Entregues" },
  { k: "todas", label: "Todas" },
] as const;

export default function OSListClient({ orders }: { orders: OSLite[] }) {
  const [tab, setTab] = useState<string>("abertas");
  const [q, setQ] = useState("");

  const count = (k: string) =>
    k === "abertas" ? orders.filter((o) => o.status !== "entregue" && o.status !== "cancelado").length
    : k === "todas" ? orders.length
    : orders.filter((o) => o.status === k).length;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter((o) => {
      const okTab = tab === "todas" ? true
        : tab === "abertas" ? o.status !== "entregue" && o.status !== "cancelado"
        : o.status === tab;
      const okQ = !s || `${o.code ?? ""} ${o.customerName} ${o.device}`.toLowerCase().includes(s);
      return okTab && okQ;
    });
  }, [orders, tab, q]);

  return (
    <div className="max-w-3xl space-y-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar OS por código, cliente ou aparelho…"
        className="w-full rounded-xl border border-line bg-bg-elevated px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-600" />

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${tab === t.k ? "brand-gradient text-white" : "bg-bg-surface-2 text-ink-2"}`}>
            {t.label} <span className={tab === t.k ? "opacity-80" : "text-[var(--text-faded)]"}>{count(t.k)}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nada aqui{q ? ` pra “${q.trim()}”` : ""}.</Card>
      ) : (
        <div className="space-y-2">
          {list.map((o) => (
            <Link key={o.id} href={`/admin/os/${o.id}`} className="block">
              <Card className="flex items-center justify-between gap-3 p-4 transition hover:border-brand-600">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-brand-600">{o.code ?? o.id.slice(0, 8)}</span>
                    <span className={`rounded-full bg-bg-surface-2 px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[o.status] ?? ""}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                    {o.priority && OS_PRIORITY_META[o.priority as OSPriority] && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: OS_PRIORITY_META[o.priority as OSPriority].color }}>{OS_PRIORITY_META[o.priority as OSPriority].label}</span>
                    )}
                    {o.situacao && <span className="rounded-full border border-brand-400 px-2 py-0.5 text-[10px] font-semibold text-brand-600">{o.situacao}</span>}
                    <span className="text-[10px] text-[var(--text-faded)]">· entrou {haDias(o.createdAt)}</span>
                  </div>
                  <div className="truncate text-sm text-ink">{o.customerName || "—"} · {o.device || "—"}</div>
                  {o.problem && <div className="truncate text-xs text-[var(--text-muted)]">{o.problem}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-bold text-ink">{brl(o.totalCents)}</div>
                  <div className={`text-[10px] ${o.paymentStatus === "quitada" ? "text-[var(--green-ok)]" : "text-[var(--text-muted)]"}`}>{o.paymentStatus}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
