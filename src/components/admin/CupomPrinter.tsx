"use client";

import { useEffect } from "react";
import { brl } from "@/lib/format";
import { IconPrinter, IconCheck } from "@/components/Icons";

export type CupomItem = { qty: number; name: string; note?: string; totalCents: number };
export type CupomData = {
  loja: string;
  display: string;
  dateLabel: string;
  modeLabel: string;
  paymentLabel?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  items: CupomItem[];
  totalCents: number;
  receivedCents?: number;
  changeCents?: number;
  pointsInfo?: string;
};

const mono = { fontFamily: "'Courier New', monospace", color: "#000", background: "#fff" } as const;
const row = { display: "flex", justifyContent: "space-between", gap: "8px" } as const;
const hr = <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />;

export default function CupomPrinter({ data, onClose }: { data: CupomData; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Controle na tela */}
      <div className="fixed inset-0 z-[60]">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-xs animate-pop rounded-t-3xl bg-bg-elevated p-5 text-center shadow-[var(--shadow-pop)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl brand-gradient text-white">
            <IconPrinter width={24} height={24} />
          </div>
          <h2 className="text-base font-extrabold text-ink">Cupom enviado pra impressão</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Se nada saiu, confira a impressora no computador.</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => window.print()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-sm font-bold text-ink">
              <IconPrinter width={15} height={15} /> Imprimir de novo
            </button>
            <button onClick={onClose} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl brand-gradient py-2.5 text-sm font-bold text-white">
              <IconCheck width={15} height={15} /> Pronto
            </button>
          </div>
        </div>
      </div>

      {/* Cupom (80mm) — só aparece na impressão */}
      <div id="print-cupom" style={{ ...mono, width: "80mm", padding: "4mm 3mm", fontSize: "12px", lineHeight: 1.35 }}>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: "15px" }}>{data.loja}</div>
        {hr}
        <div style={row}><span>Pedido {data.display}</span><span>{data.dateLabel}</span></div>
        <div>{data.modeLabel}{data.paymentLabel ? ` · ${data.paymentLabel}` : ""}</div>
        {data.customerName && <div>Cliente: {data.customerName}{data.phone ? ` (${data.phone})` : ""}</div>}
        {data.address && <div>Endereço: {data.address}</div>}
        {hr}
        {data.items.map((it, i) => (
          <div key={i} style={{ marginBottom: "2px" }}>
            <div style={row}><span>{it.qty}x {it.name}</span><span>{brl(it.totalCents)}</span></div>
            {it.note && <div style={{ paddingLeft: "12px", fontSize: "11px" }}>{it.note}</div>}
          </div>
        ))}
        {hr}
        <div style={{ ...row, fontWeight: 700, fontSize: "14px" }}><span>TOTAL</span><span>{brl(data.totalCents)}</span></div>
        {data.receivedCents != null && <div style={row}><span>Recebido</span><span>{brl(data.receivedCents)}</span></div>}
        {data.changeCents != null && data.changeCents > 0 && <div style={row}><span>Troco</span><span>{brl(data.changeCents)}</span></div>}
        {data.pointsInfo && <><div style={{ marginTop: "4px", textAlign: "center" }}>{data.pointsInfo}</div></>}
        {hr}
        <div style={{ textAlign: "center" }}>Obrigado! Volte sempre :)</div>
      </div>
    </>
  );
}
