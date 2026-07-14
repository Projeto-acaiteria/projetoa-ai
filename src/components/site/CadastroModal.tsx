"use client";

// MODAL de captura self-service (estudo de concorrentes — modelo Consumer: pede POUCO, sem cartão,
// e joga DIRETO no /cadastro já pré-preenchido). 3 campos: Nome, WhatsApp, Estabelecimento.
// Gatilho: rolar >50% da página OU intenção de saída (mouse pro topo) — uma vez por sessão.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight, IconCheck } from "@/components/Icons";

const ACCENT = "#6366F1";
const INK = "#241C17";
const SESSION_KEY = "cpro_lead_modal_v1";

function formatPhone(s: string) {
  const d = s.replace(/\D+/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function CadastroModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [negocio, setNegocio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const shown = useRef(false);

  const waDigits = whatsapp.replace(/\D+/g, "").length;
  const valido = nome.trim().length > 1 && negocio.trim().length > 1 && waDigits >= 10;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { if (sessionStorage.getItem(SESSION_KEY)) return; } catch { /* ignore */ }

    const abrir = () => {
      if (shown.current) return;
      shown.current = true;
      setOpen(true);
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
      cleanup();
    };
    const onScroll = () => {
      const h = document.documentElement;
      const depth = (h.scrollTop + window.innerHeight) / h.scrollHeight;
      if (depth > 0.5) abrir();
    };
    const onExit = (e: MouseEvent) => { if (e.clientY <= 0) abrir(); };
    function cleanup() {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onExit);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseout", onExit);
    return cleanup;
  }, []);

  // Esc fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  function enviar() {
    if (!valido) return;
    const q = new URLSearchParams({ negocio: negocio.trim(), nome: nome.trim(), wa: whatsapp.replace(/\D+/g, "") });
    router.push(`/cadastro?${q.toString()}`);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(20,16,24,0.55)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Criar seu cardápio grátis"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="animate-pop relative w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <button aria-label="Fechar" onClick={() => setOpen(false)} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/[0.05] text-[#6B5D52] transition hover:bg-black/10">✕</button>
        <div className="grid md:grid-cols-2">
          {/* Painel de valor (esquerda) — colorido, food-alegre */}
          <div className="relative hidden flex-col justify-center overflow-hidden p-8 text-white md:flex" style={{ background: "linear-gradient(150deg, #6D5DF6 0%, #8B5CF6 55%, #A855F7 100%)" }}>
            <div className="text-sm font-bold uppercase tracking-wider text-white/85">Comece grátis</div>
            <h2 className="mt-3 text-3xl font-extrabold leading-[1.1] tracking-tight">Crie seu cardápio grátis em 2 minutos</h2>
            <p className="mt-3 text-white/85">Sem instalar nada. Sem cartão pra testar. Pronto pra receber pedido hoje.</p>
            <ul className="mt-6 space-y-3 text-[15px] font-semibold">
              {["Cardápio digital + link de delivery", "0% de comissão por pedido", "14 dias grátis, cancela quando quiser"].map((b) => (
                <li key={b} className="flex items-center gap-2.5"><span className="text-[#FFD84D]"><IconCheck width={18} height={18} /></span> {b}</li>
              ))}
            </ul>
          </div>

          {/* Formulário (direita) */}
          <div className="p-7 sm:p-9">
            <div className="text-lg font-extrabold md:hidden" style={{ color: INK }}>Crie seu cardápio grátis em 2 minutos</div>
            <p className="mt-1 text-sm text-[#6B5D52] md:hidden">Sem cartão. Pronto pra receber pedido hoje.</p>
            <div className="mt-4 space-y-3 md:mt-0">
              <div>
                <label className="mb-1 block text-sm font-semibold" style={{ color: INK }}>Seu nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você se chama" autoFocus
                  className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 outline-none transition focus:border-indigo-400" style={{ color: INK }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold" style={{ color: INK }}>Nome do estabelecimento</label>
                <input value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder="Ex: Açaí do João"
                  className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 outline-none transition focus:border-indigo-400" style={{ color: INK }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold" style={{ color: INK }}>WhatsApp</label>
                <input value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} placeholder="(99) 99999-9999" inputMode="tel"
                  className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 outline-none transition focus:border-indigo-400" style={{ color: INK }} />
              </div>
            </div>
            <button onClick={enviar} disabled={!valido}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-bold text-white transition enabled:hover:opacity-90 disabled:opacity-50"
              style={{ background: ACCENT, boxShadow: `0 12px 34px ${ACCENT}55` }}>
              Criar meu cardápio grátis <IconArrowRight width={18} height={18} />
            </button>
            <div className="mt-3 text-center text-xs text-[#8A7B6E]">14 dias grátis · sem cartão · leva 2 minutos</div>
          </div>
        </div>
      </div>
    </div>
  );
}
