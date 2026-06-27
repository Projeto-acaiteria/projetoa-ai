"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";
import { IconCard, IconCheck, IconBowl, IconPlus } from "@/components/Icons";
import ImageUpload from "@/components/admin/ImageUpload";

type Fees = { dinheiro: number; pix: number; debito: number; credito: number };
type Zone = { bairro: string; feeCents: number };
type Hour = { open: string; close: string; closed: boolean };
type Store = { name: string; tagline: string; whatsapp: string; endereco: string; cnpj: string; deliveryMode: "fixed" | "zones"; deliveryFeeCents: number; minOrderCents: number; deliveryZones: Zone[]; hours: Hour[]; logoUrl: string; bannerUrl: string; primaryColor: string; pricePerKgCents: number; waMsgs: { recebido: string; preparo: string; saiu: string; entregue: string } };
type Machine = { id: string; name: string; debito: number; credito: number; creditoParcelado: number; maxParcelas: number; active: boolean };

// presets REFERENCIAIS (taxas mudam por contrato — o dono ajusta depois)
const MACHINE_PRESETS: Omit<Machine, "id" | "active">[] = [
  { name: "InfinitePay", debito: 1.37, credito: 3.15, creditoParcelado: 4.2, maxParcelas: 12 },
  { name: "Stone", debito: 1.99, credito: 3.15, creditoParcelado: 4.6, maxParcelas: 12 },
  { name: "Cielo", debito: 1.39, credito: 3.09, creditoParcelado: 4.5, maxParcelas: 12 },
  { name: "PagBank", debito: 1.99, credito: 3.19, creditoParcelado: 4.66, maxParcelas: 12 },
  { name: "Mercado Pago", debito: 1.99, credito: 3.03, creditoParcelado: 4.51, maxParcelas: 12 },
  { name: "SumUp", debito: 1.9, credito: 3.45, creditoParcelado: 4.95, maxParcelas: 12 },
];

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const FEE_ROWS: { k: keyof Fees; label: string; hint: string }[] = [
  { k: "dinheiro", label: "Dinheiro", hint: "normalmente sem taxa" },
  { k: "pix", label: "Pix", hint: "geralmente 0% ou taxa baixa" },
  { k: "debito", label: "Cartão de débito", hint: "taxa da maquininha" },
  { k: "credito", label: "Cartão de crédito", hint: "taxa da maquininha (à vista)" },
];

const inp = "w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

type Config = { has_delivery: boolean; cover_enabled: boolean; loyalty_enabled: boolean; stock_dose: boolean; sells_by_weight: boolean } | null;

export default function ConfigClient() {
  const [fees, setFees] = useState<Fees | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [config, setConfig] = useState<Config>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [hasPin, setHasPin] = useState(false);
  const [pinInput, setPinInput] = useState(""); // novo PIN sendo digitado (vazio = não mexe)
  const [pinDirty, setPinDirty] = useState(false); // só manda cashPin no PUT se o dono tocou
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/configuracoes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setFees(d.fees); setStore(d.store); setConfig(d.config ? { has_delivery: !!d.config.has_delivery, cover_enabled: !!d.config.cover_enabled, loyalty_enabled: !!d.config.loyalty_enabled, stock_dose: !!d.config.stock_dose, sells_by_weight: !!d.config.sells_by_weight } : null); setMachines(Array.isArray(d.machines) ? d.machines : []); setHasPin(!!d.hasCashPin); });
  }, []);

  function setS<K extends keyof Store>(k: K, v: Store[K]) {
    setStore((s) => (s ? { ...s, [k]: v } : s));
    setSaved(false);
  }
  function setF(k: keyof Fees, v: string) {
    setFees((f) => (f ? { ...f, [k]: parseFloat(v) || 0 } : f));
    setSaved(false);
  }
  function addMachine(preset?: Omit<Machine, "id" | "active">) {
    const base = preset ?? { name: "", debito: 0, credito: 0, creditoParcelado: 0, maxParcelas: 12 };
    setMachines((a) => [...a, { ...base, id: crypto.randomUUID(), active: true }]);
    setSaved(false);
  }
  function updMachine(id: string, patch: Partial<Machine>) {
    setMachines((a) => a.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    setSaved(false);
  }

  async function save() {
    if (!fees || !store) return;
    setSaving(true);
    const r = await fetch("/api/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // cashPin só vai quando o dono mexeu (string vazia/<4 dígitos limpa no servidor)
      body: JSON.stringify({ fees, store, config: config ?? undefined, machines, cashPin: pinDirty ? pinInput : undefined }),
    });
    if (r.ok) {
      const d = await r.json().catch(() => null);
      if (d) setHasPin(!!d.hasCashPin);
      setPinInput(""); setPinDirty(false);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    }
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
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Endereço (cabeçalho do cupom)</label>
            <input className={`${inp} mt-1`} value={store.endereco} onChange={(e) => setS("endereco", e.target.value)} placeholder="Ex: Quadra Arse 14, Alameda 17 - Palmas/TO" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">CNPJ ou CPF (cupom)</label>
            <input className={`${inp} mt-1`} value={store.cnpj} onChange={(e) => setS("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
            <p className="mt-1 text-[11px] text-[var(--text-faded)]">Sai no cabeçalho do cupom. Vazio = não mostra.</p>
          </div>
          {config?.sells_by_weight && (
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)]">Preço por kg (venda por peso)</label>
              <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-line bg-bg-base px-3">
                <span className="text-sm font-bold text-[var(--text-muted)]">R$</span>
                <DecimalInput value={store.pricePerKgCents / 100} onChange={(n) => setS("pricePerKgCents", Math.round(n * 100))} className="w-full bg-transparent py-2.5 text-sm font-bold text-ink outline-none" />
                <span className="text-sm text-[var(--text-muted)]">/kg</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-faded)]">Self-service no balcão: pesa e cobra por kg.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Entrega (delivery) — módulo ligável por loja */}
      {config && (
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-brand-600">
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"/><path d="M3 6h11v9M14 9h4l3 3v3h-2"/></svg>
                </span>
                <h2 className="text-base font-extrabold text-ink">Entrega (delivery)</h2>
              </div>
              <p className="text-sm text-[var(--text-muted)]">Recebe pedido pelo seu link, sem comissão. Liga e desliga quando quiser.</p>
            </div>
            <button
              type="button"
              onClick={() => { setConfig((c) => (c ? { ...c, has_delivery: !c.has_delivery } : c)); setSaved(false); }}
              role="switch" aria-checked={config.has_delivery}
              className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${config.has_delivery ? "brand-gradient" : "bg-bg-surface-2 border border-line"}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${config.has_delivery ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          {config.has_delivery && (
            <div className="mt-4 space-y-4 border-t border-line pt-4">
              {/* modo de cobrança: taxa fixa OU por bairro/região */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)]">Como cobra a entrega?</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {([["fixed", "Taxa fixa", "Um valor único pra qualquer endereço"], ["zones", "Por bairro/região", "Cada bairro tem sua taxa"]] as const).map(([id, label, sub]) => (
                    <button key={id} onClick={() => setS("deliveryMode", id)} className={`rounded-xl border-2 p-3 text-left transition ${store.deliveryMode === id ? "border-brand-600 bg-bg-surface-2" : "border-line"}`}>
                      <div className="text-sm font-bold text-ink">{label}</div>
                      <div className="text-[11px] text-[var(--text-faded)]">{sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {store.deliveryMode === "fixed" ? (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)]">Taxa de entrega (única)</label>
                  <div className="mt-1 flex w-40 items-center rounded-lg border border-line bg-bg-base px-3">
                    <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
                    <DecimalInput className="w-full bg-transparent px-2 py-2.5 text-sm font-bold text-ink outline-none" value={store.deliveryFeeCents / 100} onChange={(n) => setS("deliveryFeeCents", Math.round(n * 100))} />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Bairros e taxas</label>
                    <button onClick={() => setStore((s) => s ? { ...s, deliveryZones: [...s.deliveryZones, { bairro: "", feeCents: 500 }] } : s)} className="inline-flex items-center gap-1 rounded-lg bg-bg-surface-2 px-3 py-1.5 text-sm font-bold text-brand-600">
                      <IconPlus width={14} height={14} /> Bairro
                    </button>
                  </div>
                  <div className="space-y-2">
                    {store.deliveryZones.length === 0 && <p className="text-sm text-[var(--text-faded)]">Adicione os bairros que você atende e a taxa de cada um.</p>}
                    {store.deliveryZones.map((z, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={z.bairro} onChange={(e) => setStore((s) => s ? { ...s, deliveryZones: s.deliveryZones.map((x, k) => k === i ? { ...x, bairro: e.target.value } : x) } : s)} placeholder="Bairro" className={`${inp} min-w-0 flex-1`} />
                        <div className="flex items-center rounded-lg border border-line bg-bg-base px-3">
                          <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
                          <DecimalInput value={z.feeCents / 100} onChange={(n) => setStore((s) => s ? { ...s, deliveryZones: s.deliveryZones.map((x, k) => k === i ? { ...x, feeCents: Math.round(n * 100) } : x) } : s)} className="w-16 bg-transparent px-2 py-2 text-right text-sm font-bold text-ink outline-none" />
                        </div>
                        <button onClick={() => setStore((s) => s ? { ...s, deliveryZones: s.deliveryZones.filter((_, k) => k !== i) } : s)} className="rounded-lg border border-line px-2 py-2 text-xs font-bold text-[var(--red-no)]">x</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)]">Pedido mínimo</label>
                <div className="mt-1 flex w-40 items-center rounded-lg border border-line bg-bg-base px-3">
                  <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
                  <DecimalInput className="w-full bg-transparent px-2 py-2.5 text-sm font-bold text-ink outline-none" value={store.minOrderCents / 100} onChange={(n) => setS("minOrderCents", Math.round(n * 100))} />
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-faded)]">Retirada no balcão é sempre grátis. A taxa só vale pra entrega.</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Recursos da loja — ligar/desligar features (couvert, fidelidade, dose) */}
      {config && (
        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 text-base font-extrabold text-ink">Recursos da loja</h2>
          <p className="mb-3 text-sm text-[var(--text-muted)]">Ligue só o que o seu negócio usa.</p>
          <div className="divide-y divide-line">
            <FeatureToggle label="Couvert / Shows" hint="Cobra couvert por pessoa quando tem atração ao vivo (bar)." on={config.cover_enabled} onToggle={() => { setConfig((c) => c ? { ...c, cover_enabled: !c.cover_enabled } : c); setSaved(false); }} />
            <FeatureToggle label="Fidelidade (pontos)" hint="Cliente junta pontos e troca por brinde." on={config.loyalty_enabled} onToggle={() => { setConfig((c) => c ? { ...c, loyalty_enabled: !c.loyalty_enabled } : c); setSaved(false); }} />
            <FeatureToggle label="Dose / garrafa" hint="Controle de destilado em doses (estoque do bar)." on={config.stock_dose} onToggle={() => { setConfig((c) => c ? { ...c, stock_dose: !c.stock_dose } : c); setSaved(false); }} />
          </div>
        </Card>
      )}

      {/* Segurança do caixa — PIN pra autorizar sangria */}
      <Card className="p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-brand-600">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <h2 className="text-base font-extrabold text-ink">Segurança do caixa</h2>
        </div>
        <p className="mb-4 text-sm text-[var(--text-muted)]">PIN de 4 a 6 dígitos pra autorizar <b className="text-ink">sangria</b> (retirada de dinheiro do caixa). Quem não tem o PIN não consegue tirar. Suprimento e venda não pedem PIN.</p>
        <div className="mb-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${hasPin ? "bg-[#E8F6DD] text-lime" : "bg-bg-surface-2 text-[var(--text-muted)]"}`}>
            {hasPin ? "PIN configurado" : "Sem PIN — sangria liberada"}
          </span>
        </div>
        <label className="text-xs font-semibold text-[var(--text-muted)]">{hasPin ? "Trocar PIN" : "Definir PIN"}</label>
        <div className="mt-1 flex items-center gap-2">
          <input type="password" inputMode="numeric" autoComplete="off" value={pinInput} onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinDirty(true); setSaved(false); }} placeholder={hasPin ? "novo PIN" : "4 a 6 dígitos"} className={`${inp} max-w-[180px] text-center font-bold tracking-[0.3em]`} />
          {hasPin && <button type="button" onClick={() => { setPinInput(""); setPinDirty(true); setSaved(false); }} className="rounded-lg border border-line px-3 py-2.5 text-xs font-bold text-[var(--red-no)]">Remover PIN</button>}
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-faded)]">
          {pinDirty && !pinInput ? "O PIN será REMOVIDO ao salvar." : "Salve as configurações pra aplicar. Menos de 4 dígitos remove o PIN."}
        </p>
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
                <DecimalInput max={100} value={fees[row.k]} onChange={(n) => { setFees((f) => (f ? { ...f, [row.k]: n } : f)); setSaved(false); }} className="w-full bg-transparent py-2 text-right text-sm font-bold text-ink outline-none" />
                <span className="text-sm font-semibold text-[var(--text-muted)]">%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Maquininhas */}
      <Card className="p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconCard width={20} height={20} className="text-brand-600" />
          <h2 className="text-base font-extrabold text-ink">Maquininhas</h2>
        </div>
        <p className="mb-4 text-sm text-[var(--text-muted)]">Cadastre suas máquinas e as taxas que cada uma cobra. Ao receber no cartão você escolhe a máquina e as parcelas — o sistema desconta a taxa certa e mostra o líquido.</p>

        <div className="space-y-3">
          {machines.map((m) => (
            <div key={m.id} className="rounded-xl border border-line p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <input value={m.name} onChange={(e) => updMachine(m.id, { name: e.target.value })} placeholder="Nome (ex: Stone)" className={`${inp} flex-1 font-semibold`} />
                <button onClick={() => { setMachines((a) => a.filter((x) => x.id !== m.id)); setSaved(false); }} className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-ink">remover</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([["debito", "Débito"], ["credito", "Crédito à vista"], ["creditoParcelado", "Crédito parcelado"]] as const).map(([k, label]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
                    <div className="flex items-center rounded-lg border border-line bg-bg-base px-2.5">
                      <DecimalInput max={100} value={m[k]} onChange={(n) => updMachine(m.id, { [k]: n })} className="w-full bg-transparent py-2 text-right text-sm font-bold text-ink outline-none" />
                      <span className="text-xs font-semibold text-[var(--text-muted)]">%</span>
                    </div>
                  </label>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                Máx. parcelas
                <select value={m.maxParcelas} onChange={(e) => updMachine(m.id, { maxParcelas: Number(e.target.value) })} className="rounded-lg border border-line bg-bg-base px-2 py-1.5 text-sm font-bold text-ink outline-none">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
                </select>
              </label>
            </div>
          ))}
          {machines.length === 0 && <p className="rounded-xl border border-dashed border-line py-4 text-center text-sm text-[var(--text-muted)]">Nenhuma máquina ainda. Adicione pelo provedor abaixo ou em branco.</p>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Adicionar:</span>
          {MACHINE_PRESETS.map((p) => (
            <button key={p.name} onClick={() => addMachine(p)} className="rounded-lg border border-brand-400 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:border-brand-600">{p.name}</button>
          ))}
          <button onClick={() => addMachine()} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink"><IconPlus width={14} height={14} /> Em branco</button>
        </div>
      </Card>

      {/* Mensagens do WhatsApp — por status, editáveis (disparadas ao avançar o pedido) */}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-1 text-base font-extrabold text-ink">Mensagens do WhatsApp</h2>
        <p className="mb-3 text-sm text-[var(--text-muted)]">O que o cliente recebe quando você avança o pedido. Use <b className="text-ink">{"{nome}"}</b>, <b className="text-ink">{"{codigo}"}</b> e <b className="text-ink">{"{loja}"}</b> — o link de rastreio entra sozinho.</p>
        <div className="space-y-3">
          {(([
            ["recebido", "Pedido recebido"],
            ["preparo", "Em preparo"],
            ["saiu", "Saiu para entrega / pronto"],
            ["entregue", "Entregue"],
          ] as const)).map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
              <textarea value={store.waMsgs[k]} onChange={(e) => setS("waMsgs", { ...store.waMsgs, [k]: e.target.value })} rows={2} className={`${inp} resize-none`} />
            </label>
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

// Input decimal robusto: segura o TEXTO cru enquanto digita (aceita "," ou ".") e só
// converte pra número no onChange — sem o parseFloat-por-tecla reordenar dígitos (bug do CIC:
// digitar 4.99 por cima de 4,6 virava 099). Resync só quando o value externo muda (preset/reload).
function DecimalInput({ value, onChange, max = 100000, className, placeholder }: { value: number; onChange: (n: number) => void; max?: number; className?: string; placeholder?: string }) {
  const [txt, setTxt] = useState(value ? String(value) : "");
  useEffect(() => {
    const parsed = txt.trim() === "" ? 0 : parseFloat(txt.replace(",", "."));
    if ((Number.isFinite(parsed) ? parsed : 0) !== value) setTxt(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
      value={txt}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,]/g, "");
        setTxt(t);
        const n = parseFloat(t.replace(",", "."));
        onChange(Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0);
      }}
    />
  );
}

function FeatureToggle({ label, hint, on, onToggle }: { label: string; hint: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <div className="text-sm font-bold text-ink">{label}</div>
        <div className="text-xs text-[var(--text-muted)]">{hint}</div>
      </div>
      <button type="button" onClick={onToggle} role="switch" aria-checked={on}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "brand-gradient" : "bg-bg-surface-2 border border-line"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
