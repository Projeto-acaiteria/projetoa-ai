"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";

type EventoRow = { id: string; artist: string; event_date: string; cover_cents: number; repasse_cents: number; active: boolean; arrecadado_cents: number; comandas: number };
const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const inputCls = "w-full rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-600";
const reaisToCents = (s: string) => Math.round((parseFloat(s.replace(",", ".")) || 0) * 100);

export default function EventosClient() {
  const [eventos, setEventos] = useState<EventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [artist, setArtist] = useState("");
  const [date, setDate] = useState("");
  const [cover, setCover] = useState("");
  const [repasse, setRepasse] = useState("");

  const reload = useCallback(async () => {
    const r = await fetch("/api/eventos", { cache: "no-store" });
    const d = await r.json();
    setEventos(d.eventos ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function api(action: string, payload: unknown) {
    setSaving(true);
    try { await fetch("/api/eventos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) }); await reload(); } finally { setSaving(false); }
  }
  async function addShow() {
    if (!artist.trim() || !date) return;
    await api("create", { artist: artist.trim(), event_date: date, cover_cents: reaisToCents(cover), repasse_cents: reaisToCents(repasse) });
    setArtist(""); setDate(""); setCover(""); setRepasse("");
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  return (
    <div className="max-w-2xl space-y-4">
      {/* novo show */}
      <Card className="p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Novo show</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artista / atração" className={inputCls} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <input value={cover} onChange={(e) => setCover(e.target.value)} inputMode="decimal" placeholder="Cover por pessoa (R$)" className={inputCls} />
          <input value={repasse} onChange={(e) => setRepasse(e.target.value)} inputMode="decimal" placeholder="Repasse pro artista (R$)" className={inputCls} />
        </div>
        <button onClick={addShow} disabled={saving || !artist.trim() || !date} className="mt-3 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-50">Agendar show</button>
      </Card>

      {eventos.length === 0 && <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhum show agendado ainda.</Card>}
      {eventos.map((e) => (
        <Card key={e.id} className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-ink">{e.artist}</span>
                <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">{new Date(e.event_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Cover {brl(e.cover_cents)}/pessoa · Repasse {brl(e.repasse_cents)}</p>
            </div>
            <button onClick={() => confirm(`Excluir o show de ${e.artist}?`) && api("delete", { id: e.id })} disabled={saving} className="text-xs font-bold text-red-500">excluir</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3 text-sm">
            <span className="text-[var(--text-secondary)]">Arrecadado (cover): <b className="text-[var(--green-ok)]">{brl(e.arrecadado_cents)}</b></span>
            <span className="text-[var(--text-secondary)]">Comandas com cover: <b className="text-ink">{e.comandas}</b></span>
            <span className="text-[var(--text-secondary)]">Líquido p/ casa: <b className="text-ink">{brl(e.arrecadado_cents - e.repasse_cents)}</b></span>
          </div>
        </Card>
      ))}

      <p className="rounded-xl bg-bg-surface-2 p-3 text-xs text-[var(--text-muted)]">
        O cover por pessoa é cobrado na comanda quando a mesa é aberta com o nº de pessoas (na tela de Mesas). O arrecadado soma os covers das comandas do dia do show.
      </p>
    </div>
  );
}
