"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// QR do PIX com copia-e-cola e polling — UM componente só, usado nos dois lugares que cobram:
//   · /admin/bloqueado (checkout completo, loja já travada)
//   · faixa de vencimento no topo do painel (BillingDueBanner), sem sair da tela
// Saiu de dentro do PagarClient pra não existirem duas telas de PIX divergindo. Espelha o
// PixInlineCheckout do AgendaPRO, que é o fluxo que já roda redondo lá.

const brl = (cents: number) => "R$ " + (cents / 100).toFixed(2).replace(".", ",");

export default function PixInlineCheckout({
  qrImage,
  qrPayload,
  valorCents,
  label,
  onTrocar,
}: {
  qrImage: string | null;
  qrPayload: string | null;
  valorCents: number;
  label: string;
  onTrocar?: () => void;
}) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Aguardando pagamento…");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/billing/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.subscription?.status === "active") {
          setStatusMsg("Pagamento confirmado! Liberando seu painel…");
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => router.refresh(), 1500);
        }
      } catch {
        // silencioso — próxima rodada tenta de novo
      }
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router]);

  async function copiar() {
    if (!qrPayload) return;
    try {
      await navigator.clipboard.writeText(qrPayload);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      const el = document.getElementById("pix-payload") as HTMLInputElement | null;
      el?.select();
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-1 pt-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-3xl font-bold text-[#FF8A3D]">{brl(valorCents)}</p>
      </div>

      {qrImage ? (
        <div className="flex items-center justify-center rounded-2xl bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${qrImage}`} alt="QR Code PIX" width={240} height={240} style={{ width: 240, height: 240, display: "block" }} />
        </div>
      ) : (
        <div className="rounded-2xl p-6 text-center text-xs text-amber-300" style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.30)" }}>
          QR Code não chegou. Usa o código PIX abaixo no app do banco.
        </div>
      )}

      <ol className="list-decimal space-y-1.5 pl-4 text-xs text-slate-300">
        <li>Abre o app do seu banco</li>
        <li>Escolhe pagar com PIX → escaneia o QR ou cola o código</li>
        <li>A gente libera seu painel automático em segundos</li>
      </ol>

      {qrPayload && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ou cola no banco:</p>
          <div className="flex items-stretch gap-2">
            <input
              id="pix-payload"
              type="text"
              readOnly
              value={qrPayload}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="min-w-0 flex-1 rounded-lg px-3 py-2.5 font-mono text-[11px]"
              style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.10)", color: "#cbd5e1" }}
            />
            <button
              type="button"
              onClick={copiar}
              className="flex-shrink-0 rounded-lg px-4 text-xs font-bold text-white transition-all"
              style={{ background: copiado ? "linear-gradient(135deg,#22C55E,#16A34A)" : "linear-gradient(135deg,#FF8A3D,#F5480C)" }}
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: "rgba(245,72,12,0.10)", border: "1px solid rgba(245,72,12,0.30)" }}>
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <p className="text-[11px] leading-snug text-[#FFB380]">{statusMsg}</p>
      </div>

      {onTrocar && (
        <button type="button" onClick={onTrocar} className="w-full pt-1 text-[11px] text-slate-400 underline hover:text-slate-200">
          Trocar forma de pagamento
        </button>
      )}
    </div>
  );
}
