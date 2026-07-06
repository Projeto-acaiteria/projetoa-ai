"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/admin/ui";

export type Pedido = {
  id: number;
  display: string;
  code: string | null;
  customerName: string;
  phone: string;
  totalCents: number;
  items: { name: string; qty: number }[];
};
type Pay = "dinheiro" | "pix" | "debito" | "credito";

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const PAYS: { id: Pay; label: string }[] = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "Pix" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
];

export default function PedidosPendentes({ pedidos }: { pedidos: Pedido[] }) {
  const router = useRouter();
  const [pay, setPay] = useState<Record<number, Pay>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");

  if (!pedidos.length) return null;

  async function act(id: number, action: "confirm" | "cancel") {
    if (busy) return;
    setBusy(id);
    setErr("");
    try {
      const r = await fetch("/api/at-pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload: { id, paymentMethod: pay[id] ?? "dinheiro" } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao processar.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-5">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">{pedidos.length}</span>
        Pedidos do site
      </h2>
      {err && <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{err}</div>}
      <div className="space-y-2">
        {pedidos.map((p) => {
          const sel = pay[p.id] ?? "dinheiro";
          return (
            <Card key={p.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs">
                    <span className="font-mono text-brand-600">{p.code ?? p.display}</span>
                    <span className="font-semibold text-ink">{p.customerName || "—"}</span>
                    {p.phone && <span className="text-[var(--text-muted)]">· {p.phone}</span>}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{p.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}</div>
                </div>
                <div className="font-mono text-sm font-bold text-ink">{brl(p.totalCents)}</div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <div className="grid grid-cols-4 gap-1">
                  {PAYS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPay((s) => ({ ...s, [p.id]: m.id }))}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${sel === m.id ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => act(p.id, "confirm")}
                  disabled={busy === p.id}
                  className="ml-auto rounded-lg brand-gradient px-3 py-1.5 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  {busy === p.id ? "..." : "Confirmar venda"}
                </button>
                <button
                  onClick={() => act(p.id, "cancel")}
                  disabled={busy === p.id}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-red-500 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
