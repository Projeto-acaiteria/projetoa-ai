"use client";

// Compartilha o documento A4 (OS ou orçamento): link pro /doc/[code] + envio por WhatsApp.
export default function DocShare({ code, name, phone, kind = "os" }: { code: string; name: string; phone?: string | null; kind?: "os" | "orcamento" }) {
  function whats() {
    const url = `${window.location.origin}/doc/${code}`;
    const label = kind === "orcamento" ? "o seu orçamento" : "a sua ordem de serviço";
    const msg = `Olá ${name || ""}! Segue ${label} da nossa loja. Acompanhe aqui: ${url}`;
    const d = (phone || "").replace(/\D/g, "");
    window.open(d ? `https://wa.me/55${d}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/doc/${code}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink">Ver documento (A4)</a>
      <button onClick={whats} className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">Enviar por WhatsApp</button>
    </div>
  );
}
