"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/admin/ui";
import { useConfirm } from "@/components/admin/useConfirm";
import { useToast } from "@/components/admin/toast";

type Status = "pendente" | "aprovado" | "recusado" | "expirado";
type ItemKind = "produto" | "servico";
type ApiItem = { kind: ItemKind; name: string; qty: number; unitCents: number; discountCents: number };
type Budget = {
  id: string; code: string; customerName: string; customerPhone: string;
  items: ApiItem[]; freteCents: number; outrosCents: number; discountCents: number;
  validadeAt: string | null; status: Status; createdAt: string;
  osId?: string | null; osCode?: string | null;
};

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const dmy = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

const STATUS: Record<Status, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
  recusado: { label: "Recusado", cls: "bg-red-100 text-red-600" },
  expirado: { label: "Expirado", cls: "bg-slate-200 text-slate-600" },
};

function budgetTotal(b: Budget): number {
  let prod = 0, serv = 0;
  for (const it of b.items) {
    const sub = Math.max(0, it.qty * it.unitCents - it.discountCents);
    if (it.kind === "servico") serv += sub; else prod += sub;
  }
  return Math.max(0, prod + serv + b.freteCents + b.outrosCents - b.discountCents);
}

export default function OrcamentosClient({ storeName }: { storeName?: string }) {
  const { ask, confirmDialog } = useConfirm();
  const toast = useToast();
  const OR_MSG: Record<string, string> = { aprovar: "Orçamento aprovado · OS gerada", delete: "Orçamento excluído", status: "Orçamento atualizado" };
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const reload = useCallback(async () => {
    const r = await fetch("/api/orcamentos", { cache: "no-store" });
    const d = await r.json();
    setBudgets(d.budgets ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function api(action: string, payload: unknown) {
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/orcamentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Não consegui salvar."); toast(d.error || "Não consegui salvar.", "error"); return; }
      toast(OR_MSG[action] ?? "Feito");
      await reload();
    } finally { setSaving(false); }
  }

  function enviarWhats(b: Budget) {
    const url = `${window.location.origin}/doc/${b.code}`;
    const loja = storeName?.trim() || "nossa loja";
    const primeiroNome = (b.customerName || "").trim().split(" ")[0] || "tudo bem";
    const msg = [
      `Olá, ${primeiroNome}! Aqui é da ${loja}.`,
      `Segue o seu orçamento nº ${b.code}, no valor de ${brl(budgetTotal(b))}. Qualquer dúvida, estamos à disposição. 🙂`,
      ``,
      `Para ver os detalhes e aprovar, é só acessar:`,
      url,
    ].join("\n");
    const foneDig = onlyDigits(b.customerPhone);
    window.open(foneDig ? `https://wa.me/55${foneDig}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/orcamentos/editor" className="inline-block rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white">+ Novo orçamento</Link>

      {err && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</p>}
      {budgets.length === 0 && <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhum orçamento ainda. Crie o primeiro.</Card>}

      {budgets.map((b) => (
        <Card key={b.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-brand-600">{b.code}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[b.status].cls}`}>{STATUS[b.status].label}</span>
              </div>
              <div className="truncate font-bold text-ink">{b.customerName}</div>
              <div className="text-xs text-[var(--text-muted)]">{dmy(b.createdAt)}{b.validadeAt ? ` · válido até ${dmy(b.validadeAt)}` : ""} · {b.items.length} itens</div>
            </div>
            <div className="text-right"><div className="text-lg font-extrabold text-ink">{brl(budgetTotal(b))}</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            <a href={`/doc/${b.code}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink">Ver documento (A4)</a>
            <button onClick={() => enviarWhats(b)} className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">Enviar por WhatsApp</button>
            {!b.osId && <Link href={`/admin/orcamentos/editor?id=${b.id}`} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-600">Editar</Link>}
            {b.osId ? (
              <a href={`/admin/os/${b.osId}`} className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">✓ OS gerada: {b.osCode}</a>
            ) : (
              <button onClick={async () => { if (await ask({ message: `Aprovar o orçamento ${b.code} e gerar a Ordem de Serviço?`, confirmLabel: "Aprovar" })) api("aprovar", { id: b.id }); }} disabled={saving} className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-bold text-green-700 disabled:opacity-50">Aprovar → gerar OS</button>
            )}
            {b.status === "pendente" && <button onClick={() => api("status", { id: b.id, status: "recusado" })} disabled={saving} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-[var(--text-muted)]">Recusar</button>}
            <button onClick={async () => { if (await ask({ message: `Excluir o orçamento ${b.code}?`, danger: true, confirmLabel: "Excluir" })) api("delete", { id: b.id }); }} disabled={saving} className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-500">Excluir</button>
          </div>
        </Card>
      ))}
      {confirmDialog}
    </div>
  );
}
