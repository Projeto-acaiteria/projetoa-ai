"use client";

import { useState } from "react";
import { brl } from "@/lib/format";
import { qzReadScaleGrams, qzListSerialPorts, getScaleConfig, setScaleConfig } from "@/lib/qz";

// Modal de PESO compartilhado (Balcão + Mesas): digita os gramas (ou lê da balança via QZ Tray),
// desconta a tara, mostra o valor ao vivo. onConfirm devolve o peso BRUTO (gramas).
export default function WeightModal({ product, onClose, onConfirm }: { product: { name: string; price_cents: number; tare_grams: number }; onClose: () => void; onConfirm: (grams: number) => void }) {
  const [grams, setGrams] = useState("");
  const [reading, setReading] = useState(false);
  const [scaleMsg, setScaleMsg] = useState("");
  const [cfgOpen, setCfgOpen] = useState(false);
  const [ports, setPorts] = useState<string[]>([]);
  const [selPort, setSelPort] = useState("");
  const [baud, setBaud] = useState("9600");
  const bruto = Math.max(0, Math.round(parseFloat(grams.replace(",", ".")) || 0));
  const liquido = Math.max(0, bruto - (product.tare_grams || 0));
  const cents = Math.round((liquido / 1000) * product.price_cents);

  async function ler() {
    setScaleMsg("");
    if (!getScaleConfig()) {
      setReading(true);
      try {
        const ps = await qzListSerialPorts();
        setPorts(ps); setSelPort(ps[0] ?? ""); setCfgOpen(true);
      } catch {
        setScaleMsg("QZ Tray não está rodando. Abra o QZ Tray ou digite o peso na mão.");
      } finally { setReading(false); }
      return;
    }
    setReading(true);
    try {
      const g = await qzReadScaleGrams();
      if (g != null && g > 0) setGrams(String(g));
      else setScaleMsg("Não consegui ler um peso estável. Tente de novo ou digite na mão.");
    } catch (e) {
      setScaleMsg(e instanceof Error ? e.message : "Falha ao ler a balança.");
    } finally { setReading(false); }
  }
  function salvarCfg() {
    if (!selPort) return;
    setScaleConfig({ port: selPort, baudRate: Number(baud) || 9600, dataBits: 8, parity: "none", stopBits: 1 });
    setCfgOpen(false);
    void ler();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl bg-bg-elevated p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-ink">{product.name}</h3>
        <p className="mb-3 text-sm text-[var(--text-muted)]">{brl(product.price_cents)}/kg{product.tare_grams ? ` · tara ${product.tare_grams}g` : ""}</p>

        {cfgOpen ? (
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 text-xs font-bold text-[var(--text-muted)]">Configurar balança (1ª vez)</p>
            <select value={selPort} onChange={(e) => setSelPort(e.target.value)} className="mb-2 w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-sm text-ink">
              {ports.length === 0 && <option value="">nenhuma porta encontrada</option>}
              {ports.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={baud} onChange={(e) => setBaud(e.target.value)} className="mb-2 w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-sm text-ink">
              {["2400", "4800", "9600"].map((b) => <option key={b} value={b}>{b} baud</option>)}
            </select>
            <button onClick={salvarCfg} disabled={!selPort} className="w-full rounded-lg brand-gradient py-2 text-sm font-bold text-white disabled:opacity-50">Salvar e ler</button>
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-[var(--text-muted)]">Peso na balança (g)</label>
              <button onClick={ler} disabled={reading} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-brand-600 disabled:opacity-50">
                {reading ? "Lendo…" : "⚖ Ler balança"}
              </button>
            </div>
            <input autoFocus type="number" inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="ex: 480" className="w-full rounded-xl border border-line bg-bg-base px-4 py-3 text-lg font-bold text-ink outline-none focus:border-brand-600" />
            {scaleMsg && <p className="mt-1 text-[11px] text-[var(--red-no)]">{scaleMsg}</p>}
            {product.tare_grams > 0 && bruto > 0 && <p className="mt-1 text-[11px] text-[var(--text-faded)]">líquido {liquido}g (tara {product.tare_grams}g descontada)</p>}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-bg-surface-2 px-4 py-3">
              <span className="text-sm text-[var(--text-muted)]">Valor</span>
              <span className="text-2xl font-extrabold text-brand-600">{brl(cents)}</span>
            </div>
            <button onClick={() => liquido > 0 && onConfirm(bruto)} disabled={liquido <= 0} className="mt-3 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-50">Lançar</button>
          </>
        )}
      </div>
    </div>
  );
}
