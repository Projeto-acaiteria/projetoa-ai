"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { IconCheck, IconArrowRight } from "@/components/Icons";

export default function QRCardapio({ storeName, storeTagline, slug }: { storeName: string; storeTagline: string; slug?: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // link DEDICADO da loja (/<slug>); só cai no /cardapio legado se a loja não tiver slug
  const url = origin ? `${origin}/${slug || "cardapio"}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard pode falhar em http — ignora */
    }
  }

  return (
    <>
      <div className="card mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* QR */}
          <div className="grid h-40 w-40 shrink-0 place-items-center self-center rounded-2xl bg-white p-3 ring-1 ring-line sm:self-auto">
            {url ? (
              <QRCode value={url} size={140} fgColor="#2E1065" bgColor="#FFFFFF" />
            ) : (
              <div className="h-[140px] w-[140px] animate-pulse rounded bg-bg-surface-2" />
            )}
          </div>

          {/* Texto + ações */}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold text-ink">Cardápio digital · QR pras mesas</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Imprima e cole nas mesas. O cliente aponta a câmera, abre o cardápio e o pedido cai no painel.
            </p>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-bg-base px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-2">
                {url || "carregando..."}
              </span>
              <button
                onClick={copy}
                className="shrink-0 rounded-lg bg-bg-surface-2 px-3 py-1.5 text-xs font-bold text-brand-600"
              >
                {copied ? "Copiado!" : "Copiar link"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]"
              >
                Imprimir cartaz das mesas <IconArrowRight width={16} height={16} />
              </button>
              <a
                href={url || "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink"
              >
                Abrir cardápio
              </a>
            </div>
            <p className="mt-2 text-xs text-[var(--text-faded)]">
              Em produção o link vira o domínio da loja (ex: cardapio.acaidovidal.com.br).
            </p>
          </div>
        </div>
      </div>

      {/* Cartaz imprimível (some na tela, ocupa a folha no print) */}
      <div id="print-cartaz" className="flex-col items-center justify-center bg-white p-12 text-center" style={{ width: "210mm", height: "297mm", display: "flex" }}>
        <div className="text-[28px] font-extrabold" style={{ color: "#1E1B4B" }}>
          {storeName}
        </div>
        <div className="mt-2 text-[18px]" style={{ color: "#334155" }}>
          {storeTagline}
        </div>

        <div className="mt-10 rounded-3xl p-6" style={{ border: "3px solid #4F46E5" }}>
          {url && <QRCode value={url} size={320} fgColor="#1E1B4B" bgColor="#FFFFFF" />}
        </div>

        <div className="mt-10 flex items-center gap-2 text-[26px] font-extrabold" style={{ color: "#4F46E5" }}>
          <IconCheck width={28} height={28} /> Aponte a câmera e faça seu pedido
        </div>
        <div className="mt-3 text-[16px]" style={{ color: "#7C6E92" }}>
          Peça pelo celular · retirada no balcão ou entrega
        </div>
        <div className="mt-8 text-[13px]" style={{ color: "#A89BBC" }}>
          {url}
        </div>
      </div>
    </>
  );
}
