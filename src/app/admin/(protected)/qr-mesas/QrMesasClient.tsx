"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { IconPrinter } from "@/components/Icons";

// Aba "QR das mesas" — gera um QR por mesa (→ /slug/mesa/N, pedido roteado por estação) + o QR do
// balcão (→ cardápio da loja). O grid fica DENTRO de #print-qr-mesas pra sair na impressão (o
// globals.css esconde o resto no print). Cabeçalho/botão ficam FORA → somem no papel. — ComandaPRO 3.9
export default function QrMesasClient({
  storeName,
  slug,
  accent,
  coverEnabled,
  mesas,
}: {
  storeName: string;
  slug: string;
  accent: string;
  coverEnabled: boolean;
  mesas: number[];
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const cor = accent || "#111827"; // vazio = preto (ComandaPRO nasce P&B; loja define a cor em Ajustes)
  const base = origin && slug ? `${origin}/${slug}` : "";

  if (!slug) {
    return (
      <div className="card p-6 text-sm text-[var(--text-muted)]">
        Essa loja ainda não tem link público (slug). Configure o cardápio público antes de gerar os QRs das mesas.
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink">QR das mesas</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Imprima e cole em cada mesa (+ o QR do balcão). O cliente aponta a câmera, pede pelo celular e o pedido cai já
            roteado pra cozinha/bar.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]"
        >
          <IconPrinter width={17} height={17} /> Imprimir
        </button>
      </div>

      {coverEnabled && (
        <p className="mb-4 text-xs text-[var(--text-faded)]">
          Como a loja cobra couvert, cada QR de mesa avisa <b>&quot;Cobramos couvert&quot;</b> pro cliente antes de pedir.
        </p>
      )}

      {/* Grid imprimível — DENTRO de #print-qr-mesas (visível no papel; o resto some) */}
      <div id="print-qr-mesas" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-3">
        {base && (
          <QrCard
            storeName={storeName}
            url={base}
            titulo="Peça no Balcão"
            sub="Aponte a câmera, peça e retire aqui"
            cor={cor}
            couvert={false}
          />
        )}
        {mesas.map((n) => (
          <QrCard
            key={n}
            storeName={storeName}
            url={`${base}/mesa/${n}`}
            titulo={`Mesa ${n}`}
            sub="Aponte a câmera e peça pelo celular"
            cor={cor}
            couvert={coverEnabled}
          />
        ))}
      </div>

      <p className="mt-4 text-xs text-[var(--text-faded)]">
        Em produção o link vira o domínio da loja. Cada QR de mesa manda o pedido pra comanda daquela mesa.
      </p>
    </>
  );
}

function QrCard({
  storeName,
  url,
  titulo,
  sub,
  cor,
  couvert,
}: {
  storeName: string;
  url: string;
  titulo: string;
  sub: string;
  cor: string;
  couvert: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center rounded-2xl border p-5 text-center"
      style={{ borderColor: "#e5e7eb", background: "#ffffff", breakInside: "avoid", pageBreakInside: "avoid" }}
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.15em]" style={{ color: cor }}>
        {storeName}
      </div>
      <div className="my-3 rounded-lg bg-white p-2">
        <QRCode value={url} size={150} fgColor="#111827" bgColor="#FFFFFF" />
      </div>
      <div className="text-lg font-extrabold" style={{ color: "#111827" }}>
        {titulo}
      </div>
      <div className="mt-0.5 text-xs" style={{ color: "#6b7280" }}>
        {sub}
      </div>
      {couvert && (
        <div className="mt-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: cor }}>
          Cobramos couvert
        </div>
      )}
    </div>
  );
}
