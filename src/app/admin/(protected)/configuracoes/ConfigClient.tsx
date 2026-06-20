"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";
import { IconCard, IconCheck, IconBowl, IconPlus } from "@/components/Icons";
import ImageUpload from "@/components/admin/ImageUpload";

type Fees = { dinheiro: number; pix: number; debito: number; credito: number };
type Zone = { bairro: string; feeCents: number };
type Hour = { open: string; close: string; closed: boolean };
type Store = { name: string; tagline: string; whatsapp: string; deliveryFeeCents: number; minOrderCents: number; deliveryZones: Zone[]; hours: Hour[]; logoUrl: string; bannerUrl: string; primaryColor: string };

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const FEE_ROWS: { k: keyof Fees; label: string; hint: string }[] = [
  { k: "dinheiro", label: "Dinheiro", hint: "normalmente sem taxa" },
  { k: "pix", label: "Pix", hint: "geralmente 0% ou taxa baixa" },
  { k: "debito", label: "Cartão de débito", hint: "taxa da maquininha" },
  { k: "credito", label: "Cartão de crédito", hint: "taxa da maquininha (à vista)" },
];

const inp = "w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

export default function ConfigClient() {
  const [fees, setFees] = useState<Fees | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/configuracoes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setFees(d.fees); setStore(d.store); });
  }, []);

  function setS<K extends keyof Store>(k: K, v: Store[K]) {
    setStore((s) => (s ? { ...s, [k]: v } : s));
    setSaved(false);
  }
  function setF(k: keyof Fees, v: string) {
    setFees((f) => (f ? { ...f, [k]: parseFloat(v) || 0 } : f));
    setSaved(false);
  }

  async function save() {
    if (!fees || !store) return;
    setSaving(true);
    const r = await fetch("/api/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fees, store }),
    });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  }

  if (!fees || !store) return <div className="card p-8 text-center text-sm text-[var(--text-muted)]">Carregando...</div>;

  return (
    <div className="max-w-2xl space-y-5">
      {/* Dados da loja */}
      <Card className="p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconBowl width={20} height={20} className="text-brand-600" />
          <h2 className="text-base font-extrabold text-ink">Dados da loja</h2>
        </div>
        <p className="mb-4 text-sm text-[var(--text-muted)]">Aparece no cardápio, no cupom e nos pedidos.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Nome da loja</label>
            <input className={`${inp} mt-1`} value={store.name} onChange={(e) => setS("name", e.target.value)} placeholder="Ex: Açaí do Vidal" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Frase / slogan</label>
            <input className={`${inp} mt-1`} value={store.tagline} onChange={(e) => setS("tagline", e.target.value)} placeholder="Ex: Cremoso de verdade" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">WhatsApp (com DDD)</label>
            <input className={`${inp} mt-1`} inputMode="tel" value={store.whatsapp} onChange={(e) => setS("whatsapp", e.target.value)} placeholder="5599991234567" />
            <p className="mt-1 text-[11px] text-[var(--text-faded)]">Formato: 55 + DDD + número (só números).</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)]">Taxa de entrega</label>
              <div className="mt-1 flex items-center rounded-lg border border-line bg-bg-base px-3">
                <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
                <input className="w-full bg-transparent px-2 py-2.5 text-sm font-bold text-ink outline-none" type="number" min={0} step="0.5" value={store.deliveryFeeCents / 100} onChange={(e) => setS("deliveryFeeCents", Math.round((parseFloat(e.target.value) || 0) * 100))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)]">Pedido mínimo</label>
              <div className="mt-1 flex items-center rounded-lg border border-line bg-bg-base px-3">
                <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
                <input className="w-full bg-transparent px-2 py-2.5 text-sm font-bold text-ink outline-none" type="number" min={0} step="0.5" value={store.minOrderCents / 100} onChange={(e) => setS("minOrderCents", Math.round((parseFloat(e.target.value) || 0) * 100))} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Identidade visual (cardápio público) */}
      <Card className="p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-brand-600">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C21.998 6.012 17.5 2 12 2Z"/></svg>
          </span>
          <h2 className="text-base font-extrabold text-ink">Identidade visual</h2>
        </div>
        <p className="mb-4 text-sm text-[var(--text-muted)]">A cara da sua loja no cardápio público (logo, banner e cor).</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Logo</label>
            <div className="mt-1.5"><ImageUpload value={store.logoUrl} onChange={(url) => setS("logoUrl", url)} aspect="square" hint="Aparece no topo do cardápio. PNG quadrado fica melhor." /></div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Banner (foto de fundo)</label>
            <div className="mt-1.5"><ImageUpload value={store.bannerUrl} onChange={(url) => setS("bannerUrl", url)} aspect="wide" hint="Foto de fundo do topo. Horizontal, boa qualidade." /></div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Cor de destaque</label>
            <div className="mt-1.5 flex items-center gap-3">
              <input type="color" value={store.primaryColor || "#7c3aed"} onChange={(e) => setS("primaryColor", e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-bg-base" />
              <input className={`${inp} flex-1`} value={store.primaryColor} onChange={(e) => setS("primaryColor", e.target.value)} placeholder="#7c3aed (vazio = padrão)" />
              {store.primaryColor && <button onClick={() => setS("primaryColor", "")} className="rounded-lg px-2 py-1.5 text-xs font-bold text-red-500">limpar</button>}
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-faded)]">Aplicada no botão principal do cardápio. Vazio = cor padrão do modelo.</p>
          </div>
        </div>
      </Card>

      {/* Horário de funcionamento */}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-1 text-base font-extrabold text-ink">Horário de funcionamento</h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">O cardápio mostra &quot;Aberto/Fechado&quot; e bloqueia pedidos fora do horário.</p>
        <div className="space-y-2">
          {store.hours.map((h, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-sm font-semibold text-ink">{DIAS[i]}</span>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                <input type="checkbox" checked={!h.closed} onChange={(e) => setStore((s) => s ? { ...s, hours: s.hours.map((x, k) => k === i ? { ...x, closed: !e.target.checked } : x) } : s)} className="h-4 w-4 accent-[var(--brand-600)]" />
                {h.closed ? "Fechado" : "Aberto"}
              </label>
              {!h.closed && (
                <div className="flex items-center gap-1.5 text-sm">
                  <input type="time" value={h.open} onChange={(e) => setStore((s) => s ? { ...s, hours: s.hours.map((x, k) => k === i ? { ...x, open: e.target.value } : x) } : s)} className="rounded-lg border border-line bg-bg-base px-2 py-1.5" />
                  <span className="text-[var(--text-muted)]">às</span>
                  <input type="time" value={h.close} onChange={(e) => setStore((s) => s ? { ...s, hours: s.hours.map((x, k) => k === i ? { ...x, close: e.target.value } : x) } : s)} className="rounded-lg border border-line bg-bg-base px-2 py-1.5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Zonas de entrega */}
      <Card className="p-5 sm:p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-ink">Bairros e taxas de entrega</h2>
          <button onClick={() => setStore((s) => s ? { ...s, deliveryZones: [...s.deliveryZones, { bairro: "", feeCents: 500 }] } : s)} className="inline-flex items-center gap-1 rounded-lg bg-bg-surface-2 px-3 py-1.5 text-sm font-bold text-brand-600">
            <IconPlus width={14} height={14} /> Bairro
          </button>
        </div>
        <p className="mb-3 text-sm text-[var(--text-muted)]">Se vazio, usa a taxa de entrega única acima. Com bairros, o cliente escolhe e paga a taxa do bairro dele.</p>
        <div className="space-y-2">
          {store.deliveryZones.length === 0 && <p className="text-sm text-[var(--text-faded)]">Nenhum bairro — taxa única.</p>}
          {store.deliveryZones.map((z, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={z.bairro} onChange={(e) => setStore((s) => s ? { ...s, deliveryZones: s.deliveryZones.map((x, k) => k === i ? { ...x, bairro: e.target.value } : x) } : s)} placeholder="Bairro" className={`${inp} min-w-0 flex-1`} />
              <div className="flex items-center rounded-lg border border-line bg-bg-base px-3">
                <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
                <input type="number" min={0} step="0.5" value={z.feeCents / 100} onChange={(e) => setStore((s) => s ? { ...s, deliveryZones: s.deliveryZones.map((x, k) => k === i ? { ...x, feeCents: Math.round((parseFloat(e.target.value) || 0) * 100) } : x) } : s)} className="w-16 bg-transparent px-2 py-2 text-right text-sm font-bold text-ink outline-none" />
              </div>
              <button onClick={() => setStore((s) => s ? { ...s, deliveryZones: s.deliveryZones.filter((_, k) => k !== i) } : s)} className="rounded-lg border border-line px-2 py-2 text-xs font-bold text-[var(--red-no)]">x</button>
            </div>
          ))}
        </div>
      </Card>

      {/* Taxas */}
      <Card className="p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconCard width={20} height={20} className="text-brand-600" />
          <h2 className="text-base font-extrabold text-ink">Formas de pagamento · taxas da maquininha</h2>
        </div>
        <p className="mb-4 text-sm text-[var(--text-muted)]">O sistema desconta automático e mostra o líquido em cada venda.</p>
        <div className="divide-y divide-[var(--line)]">
          {FEE_ROWS.map((row) => (
            <div key={row.k} className="flex items-center gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">{row.label}</div>
                <div className="text-xs text-[var(--text-muted)]">{row.hint}</div>
              </div>
              <div className="flex w-28 items-center rounded-lg border border-line bg-bg-base px-3">
                <input type="number" min={0} max={100} step="0.1" value={fees[row.k]} onChange={(e) => setF(row.k, e.target.value)} className="w-full bg-transparent py-2 text-right text-sm font-bold text-ink outline-none" />
                <span className="text-sm font-semibold text-[var(--text-muted)]">%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-60">
          <IconCheck width={16} height={16} /> {saving ? "Salvando..." : "Salvar configurações"}
        </button>
        {saved && <span className="text-sm font-semibold text-lime">Salvo ✓</span>}
      </div>
    </div>
  );
}
