"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/compress-image";

// Upload simples de imagem (logo/banner): comprime no client (webp) ANTES de subir → /api/upload-foto.
// Sem banco de imagens (é identidade da loja, não foto de produto). Preview + remover.
export default function ImageUpload({
  value,
  onChange,
  aspect = "square",
  hint,
}: {
  value: string;
  onChange: (url: string) => void;
  aspect?: "square" | "wide";
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setErr("");
    try {
      const c = await compressImage(file);
      if (!c.ok) { setErr(c.reason); return; }
      const fd = new FormData();
      fd.append("file", c.file);
      const r = await fetch("/api/upload-foto", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "falha no upload");
      onChange(d.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  const box = aspect === "wide" ? "h-16 w-28" : "h-16 w-16";

  return (
    <div className="flex items-center gap-3">
      <div className={`${box} shrink-0 overflow-hidden rounded-xl border border-line bg-bg-surface-2`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-[var(--text-faded)]">sem imagem</div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50">{uploading ? "Subindo…" : "Subir imagem"}</button>
          {value && <button type="button" onClick={() => onChange("")} className="rounded-lg px-2 py-1.5 text-xs font-bold text-red-500">Remover</button>}
        </div>
        {hint && !err && <span className="text-[11px] text-[var(--text-faded)]">{hint}</span>}
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </div>
  );
}
