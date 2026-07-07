"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/admin/ui";
import { compressImage } from "@/lib/compress-image";
import type { OSPhoto } from "@/lib/service-orders-store";

const STATUSES = [
  { k: "aguardando", label: "Aguardando" },
  { k: "em_reparo", label: "Em reparo" },
  { k: "pronto", label: "Pronto" },
] as const;

// Bancada do técnico: mudar status, escrever o laudo e anexar fotos (antes/depois). Tudo via /api/os
// (que tem o guard de papel). Fotos comprimidas no client (compressImage) antes de subir.
export default function TecOSWork({ id, status, diagnosis, photos }: { id: string; status: string; diagnosis: string; photos: OSPhoto[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [laudo, setLaudo] = useState(diagnosis);
  const [err, setErr] = useState("");
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  async function api(action: string, payload: Record<string, unknown>) {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/os", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "falha"); }
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setBusy(false); }
  }

  async function uploadPhoto(file: File, label: string) {
    setBusy(true); setErr("");
    try {
      const c = await compressImage(file);
      if (!c.ok) { setErr(c.reason); return; }
      const fd = new FormData();
      fd.append("file", c.file);
      const up = await fetch("/api/upload-foto", { method: "POST", body: fd });
      const d = await up.json();
      if (!up.ok) throw new Error(d.error || "falha no upload");
      await api("photo-add", { id, url: d.url, label });
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha no upload"); setBusy(false); }
  }

  const laudoDirty = laudo.trim() !== (diagnosis ?? "").trim();

  return (
    <Card className="space-y-5 p-5">
      {/* SITUAÇÃO */}
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Situação</h3>
        <div className="grid grid-cols-3 gap-2">
          {STATUSES.map((s) => (
            <button key={s.k} disabled={busy || status === s.k} onClick={() => api("status", { id, status: s.k })}
              className={`rounded-lg border px-3 py-2.5 text-xs font-bold transition ${status === s.k ? "brand-gradient border-transparent text-white" : "border-line text-ink hover:border-brand-600"} disabled:opacity-60`}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-[var(--text-faded)]">Entrega e cobrança são da recepção.</p>
      </div>

      {/* LAUDO */}
      <div className="border-t border-line pt-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Laudo técnico</h3>
        <textarea value={laudo} onChange={(e) => setLaudo(e.target.value)} disabled={busy} rows={4}
          placeholder="O que você achou / o que foi feito no aparelho…"
          className="w-full resize-y rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600 disabled:opacity-50" />
        <button disabled={busy || !laudoDirty} onClick={() => api("diagnosis", { id, diagnosis: laudo })}
          className="mt-2 rounded-lg brand-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {laudoDirty ? "Salvar laudo" : "Laudo salvo"}
        </button>
      </div>

      {/* FOTOS */}
      <div className="border-t border-line pt-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Fotos do aparelho</h3>
        {photos.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {photos.map((ph) => (
              <div key={ph.url} className="group relative overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={ph.label} className="aspect-square w-full object-cover" />
                {ph.label && <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">{ph.label}</span>}
                <button disabled={busy} onClick={() => api("photo-remove", { id, url: ph.url })}
                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-50">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => beforeRef.current?.click()} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink hover:border-brand-600 disabled:opacity-50">+ Foto antes</button>
          <button type="button" disabled={busy} onClick={() => afterRef.current?.click()} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink hover:border-brand-600 disabled:opacity-50">+ Foto depois</button>
        </div>
        <p className="mt-1.5 text-[10px] text-[var(--text-faded)]">Comprime no aparelho antes de subir (não pesa).</p>
        <input ref={beforeRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, "antes"); e.target.value = ""; }} />
        <input ref={afterRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, "depois"); e.target.value = ""; }} />
      </div>

      {busy && <p className="text-xs text-[var(--text-muted)]">Salvando…</p>}
      {err && <p className="text-xs text-red-500">{err}</p>}
    </Card>
  );
}
