"use client";

import { useMemo, useState } from "react";
import { type ModifierGroup, type Size } from "@/lib/menu";
import { computePoints, REWARDS, POINTS_PER_BRL } from "@/lib/loyalty";

type Brand = { name: string; whatsapp: string; deliveryFeeCents: number; minOrderCents: number; deliveryZones: { bairro: string; feeCents: number }[]; slug?: string; hasDelivery?: boolean };
import { brl } from "@/lib/format";
import {
  IconBowl,
  IconPlus,
  IconMinus,
  IconWhatsapp,
  IconMoto,
  IconBag,
  IconCheck,
  IconArrowRight,
  IconStar,
  IconGift,
} from "@/components/Icons";

type Qty = Record<string, number>;

// banner-foto por seção (estilo cardápio premium — imagem vende)
const SEC_IMG: Record<string, string> = {
  sabor: "/menu/sec-acai.jpg",
  frutas: "/menu/sec-frutas.jpg",
  cremes: "/menu/sec-cremes.jpg",
  crocantes: "/menu/sec-crocantes.jpg",
  doces: "/menu/sec-doces.jpg",
};

function groupUnits(group: ModifierGroup, qty: Qty) {
  return group.items.reduce((n, it) => n + (qty[it.id] || 0), 0);
}

/** primeiras `freeUpTo` unidades grátis (ordem do cardápio) */
function groupCost(group: ModifierGroup, qty: Qty) {
  let freeLeft = group.paid ? 0 : group.freeUpTo;
  let cents = 0;
  const charged: { name: string; cents: number }[] = [];
  for (const it of group.items) {
    let q = qty[it.id] || 0;
    while (q > 0) {
      if (freeLeft > 0) freeLeft--;
      else {
        cents += it.priceCents;
        charged.push({ name: it.name, cents: it.priceCents });
      }
      q--;
    }
  }
  return { cents, charged };
}

export default function AcaiBuilder({ sizes, groups, brand, isOpen }: { sizes: Size[]; groups: ModifierGroup[]; brand: Brand; isOpen: boolean }) {
  const [sizeId, setSizeId] = useState(sizes[1]?.id ?? sizes[0]?.id ?? "");
  const [qty, setQty] = useState<Qty>({});
  const [mode, setMode] = useState<"retirada" | "entrega">("retirada");
  const [checkout, setCheckout] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bairro, setBairro] = useState("");
  const usaZonas = brand.deliveryZones.length > 0;
  const [sending, setSending] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const size = sizes.find((s) => s.id === sizeId) ?? sizes[0];

  const { addCents, lines } = useMemo(() => {
    let total = 0;
    const lines: { name: string; cents: number }[] = [];
    for (const g of groups) {
      const { cents, charged } = groupCost(g, qty);
      total += cents;
      lines.push(...charged);
    }
    return { addCents: total, lines };
  }, [qty]);

  const zona = brand.deliveryZones.find((z) => z.bairro === bairro);
  const feeCents = mode === "entrega" ? (usaZonas ? (zona?.feeCents ?? 0) : brand.deliveryFeeCents) : 0;
  const totalCents = size.priceCents + addCents + feeCents;
  const belowMin = totalCents < brand.minOrderCents;
  const productCents = size.priceCents + addCents; // pontua só produto, sem taxa
  const earnPts = computePoints(productCents);

  function step(group: ModifierGroup, itemId: string, dir: 1 | -1) {
    setQty((prev) => {
      const cur = prev[itemId] || 0;
      const next = Math.max(0, cur + dir);
      if (dir === 1 && group.max > 0 && groupUnits(group, prev) >= group.max) return prev;
      return { ...prev, [itemId]: next };
    });
  }

  function buildItems() {
    const items: { group: string; name: string; qty: number; paidCents: number }[] = [];
    for (const g of groups) {
      const { charged } = groupCost(g, qty);
      for (const it of g.items) {
        const q = qty[it.id] || 0;
        if (!q) continue;
        const paidCents = charged
          .filter((c) => c.name === it.name)
          .reduce((s, c) => s + c.cents, 0);
        items.push({ group: g.title, name: it.name, qty: q, paidCents });
      }
    }
    return items;
  }

  // ficha técnica do pedido (pra baixa de estoque na entrega)
  function buildConsumes() {
    const acc: Record<string, number> = {};
    for (const ing of size.recipe || []) acc[ing.stockId] = (acc[ing.stockId] || 0) + ing.qty;
    for (const g of groups) for (const it of g.items) {
      const q = qty[it.id] || 0;
      if (q && it.recipe) for (const ing of it.recipe) acc[ing.stockId] = (acc[ing.stockId] || 0) + ing.qty * q;
    }
    return Object.entries(acc).map(([stockId, qty]) => ({ stockId, qty: +qty.toFixed(3) }));
  }

  function waMessage(display?: string) {
    const items = buildItems();
    const L: string[] = [];
    L.push(`*Pedido ${display ?? ""}— ${brand.name}*`.replace("  ", " "));
    L.push(`\n*Cliente:* ${name || "-"}  ${phone ? "· " + phone : ""}`);
    L.push(`\n• ${size.label} — ${brl(size.priceCents)}`);
    for (const it of items) {
      const tag = it.paidCents > 0 ? ` (+${brl(it.paidCents)})` : " (grátis)";
      L.push(`  - ${it.qty}x ${it.name}${tag}`);
    }
    L.push(`\n*Entrega:* ${mode === "entrega" ? `Delivery (+${brl(feeCents)})` : "Retirada no balcão"}`);
    if (mode === "entrega" && address) L.push(`*Endereço:* ${address}`);
    L.push(`*Total: ${brl(totalCents)}*`);
    return encodeURIComponent(L.join("\n"));
  }

  async function submit() {
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("Preencha nome e telefone.");
      return;
    }
    if (mode === "entrega" && !address.trim()) {
      setError("Informe o endereço para entrega.");
      return;
    }
    if (mode === "entrega" && usaZonas && !bairro) {
      setError("Escolha o bairro de entrega.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: brand.slug,
          customerName: name.trim(),
          phone: phone.trim(),
          address: address.trim() || undefined,
          mode,
          sizeLabel: size.label,
          items: buildItems(),
          consumes: buildConsumes(),
          bairro: mode === "entrega" ? bairro || undefined : undefined,
          subtotalCents: size.priceCents + addCents,
          feeCents,
          totalCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      setPlaced(data.order.display);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  /* ---------- tela de sucesso ---------- */
  if (placed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full brand-gradient text-white shadow-[var(--shadow-brand)]">
          <IconCheck width={40} height={40} />
        </div>
        <h2 className="text-2xl font-extrabold text-ink">Pedido recebido!</h2>
        <p className="mt-2 text-[var(--text-muted)]">
          A {brand.name} já recebeu seu pedido <span className="font-bold text-brand-400">{placed}</span> e
          vai começar a preparar. Logo entramos em contato pra confirmar.
        </p>
        <div className="mt-6 card p-4 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">{size.label}</span>
            <span className="font-bold text-ink">{brl(totalCents)}</span>
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            {mode === "entrega" ? "Entrega" : "Retirada no balcão"}
          </div>
        </div>

        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-bg-surface-2 px-4 py-2 text-sm font-bold text-brand-400">
          <IconStar width={16} height={16} /> Você vai juntar {computePoints(size.priceCents + addCents)} pontos
        </div>

        {/* WhatsApp opcional — só se o cliente quiser falar */}
        <a
          href={`https://wa.me/${brand.whatsapp}?text=${waMessage(placed + " ")}`}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-600 py-3.5 font-bold text-brand-400"
        >
          <IconWhatsapp width={20} height={20} /> Acompanhar no WhatsApp (opcional)
        </a>
        <button
          onClick={() => {
            setPlaced(null);
            setCheckout(false);
            setQty({});
          }}
          className="mt-2 w-full rounded-2xl py-3 font-bold text-[var(--text-muted)]"
        >
          Fazer outro pedido
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-40 pt-6">
      {/* Tamanho */}
      <section className="mb-7">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
          <IconBowl width={16} height={16} className="text-brand-400" /> Escolha o tamanho
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {sizes.map((s) => {
            const on = s.id === sizeId;
            return (
              <button
                key={s.id}
                onClick={() => setSizeId(s.id)}
                className={`overflow-hidden rounded-2xl border-2 text-left transition ${
                  on ? "border-brand-600 shadow-[var(--shadow-card)]" : "border-line"
                }`}
              >
                <div
                  className="h-20 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${s.img})` }}
                />
                <div className="bg-bg-elevated p-2.5">
                  <div className="text-xs font-semibold text-[var(--text-muted)]">{s.ml}ml</div>
                  <div className="text-base font-extrabold text-ink">{brl(s.priceCents)}</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#FBF1DC] px-1.5 py-0.5 text-[10px] font-bold text-gold">
                    <IconStar width={10} height={10} /> +{computePoints(s.priceCents)} pts
                  </div>
                  {on && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-brand-400">
                      <IconCheck width={12} height={12} /> selecionado
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Teaser do programa de pontos — visível logo no topo */}
      <a
        href={brand.slug ? `/${brand.slug}/meus-pontos` : "/meus-pontos"}
        className="mb-6 flex items-center justify-between gap-3 overflow-hidden rounded-2xl px-4 py-3 text-white shadow-[var(--shadow-brand)]"
        style={{ background: "linear-gradient(120deg, var(--brand-700) 0%, var(--brand-500) 70%, var(--accent-2) 160%)" }}
      >
        <span className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur">
            <IconStar width={18} height={18} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold">Junte pontos, ganhe açaí grátis</span>
            <span className="block text-xs text-white/80">{POINTS_PER_BRL} ponto a cada R$ 1 — troque por açaí inteiro</span>
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-bold underline decoration-white/50 underline-offset-2">meus pontos</span>
      </a>

      {/* Grupos */}
      {groups.map((g) => {
        const units = groupUnits(g, qty);
        const freeTag = g.paid ? "todos pagos" : `${Math.min(units, g.freeUpTo)}/${g.freeUpTo} grátis`;
        return (
          <section key={g.id} className="mb-6">
            <div className="relative mb-3 h-28 overflow-hidden rounded-2xl border border-line">
              {SEC_IMG[g.id] && (
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${SEC_IMG[g.id]})` }} />
              )}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(100deg, rgba(20,8,32,0.93) 0%, rgba(20,8,32,0.55) 55%, rgba(20,8,32,0.12) 100%)" }}
              />
              <div className="relative flex h-full items-center justify-between px-4">
                <h2 className="text-xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{g.title}</h2>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${g.paid ? "bg-[#FBF1DC] text-gold" : "bg-[#E8F6DD] text-lime"}`}>{freeTag}</span>
              </div>
            </div>
            <div className="card divide-y divide-[var(--line)] overflow-hidden">
              {g.items.map((it) => {
                const q = qty[it.id] || 0;
                return (
                  <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold text-ink">{it.name}</div>
                      <div className="text-xs font-medium text-[var(--text-muted)]">
                        {g.paid ? `+ ${brl(it.priceCents)}` : `grátis ou + ${brl(it.priceCents)}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        aria-label="Remover"
                        onClick={() => step(g, it.id, -1)}
                        disabled={q === 0}
                        className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink disabled:opacity-30"
                      >
                        <IconMinus width={16} height={16} />
                      </button>
                      <span className="w-5 text-center text-[15px] font-bold text-ink">{q}</span>
                      <button
                        aria-label="Adicionar"
                        onClick={() => step(g, it.id, 1)}
                        className="grid h-9 w-9 place-items-center rounded-full brand-gradient text-white shadow-[var(--shadow-brand)]"
                      >
                        <IconPlus width={16} height={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Entrega */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Como você quer receber?
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {([
            { id: "retirada", label: "Retirar no balcão", sub: "Sem taxa", Icon: IconBag },
            ...(brand.hasDelivery === false ? [] : [{ id: "entrega", label: "Delivery", sub: `+ ${brl(brand.deliveryFeeCents)}`, Icon: IconMoto }]),
          ] as const).map(({ id, label, sub, Icon }) => {
            const on = mode === id;
            return (
              <button
                key={id}
                onClick={() => setMode(id as "retirada" | "entrega")}
                className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
                  on ? "border-brand-600 bg-bg-surface-2" : "border-line bg-bg-elevated"
                }`}
              >
                <Icon className="text-brand-400" />
                <div>
                  <div className="text-sm font-bold text-ink">{label}</div>
                  <div className="text-xs font-medium text-[var(--text-muted)]">{sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Resumo */}
      {lines.length > 0 && (
        <section className="mb-2 card p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Resumo</div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-ink-2">{size.label}</span>
            <span className="font-semibold text-ink">{brl(size.priceCents)}</span>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between py-1 text-sm">
              <span className="text-ink-2">+ {l.name}</span>
              <span className="font-semibold text-ink">{brl(l.cents)}</span>
            </div>
          ))}
          {feeCents > 0 && (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-ink-2">Taxa de entrega</span>
              <span className="font-semibold text-ink">{brl(feeCents)}</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
            <span className="flex items-center gap-1.5 text-sm font-bold text-gold">
              <IconStar width={15} height={15} /> Pontos que você ganha
            </span>
            <span className="text-base font-extrabold text-gold">+{earnPts}</span>
          </div>
        </section>
      )}

      {/* Clube de fidelidade — premium */}
      <section className="mt-2 overflow-hidden rounded-3xl border border-[#4a2f6b] shadow-[var(--shadow-card)]">
        {/* header roxo → dourado */}
        <div className="px-5 py-4" style={{ background: "linear-gradient(115deg, var(--brand-800) 0%, var(--brand-500) 58%, var(--accent-2) 155%)" }}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur">
              <IconGift width={22} height={22} className="text-white" />
            </span>
            <div className="min-w-0">
              <div className="text-base font-extrabold leading-tight text-white">Clube Cantinho do Açaí</div>
              <div className="text-xs text-white/85">Junte pontos e troque por açaí grátis</div>
            </div>
          </div>
        </div>

        <div className="bg-bg-elevated p-4">
          <div className="mb-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#FBF1DC] py-2 text-xs font-bold text-gold">
            <IconStar width={14} height={14} /> Você ganha {POINTS_PER_BRL} ponto a cada R$ 1 gasto
          </div>

          <div className="space-y-2.5">
            {REWARDS.map((r, i) => {
              const img = sizes.find((s) => s.id === r.sizeId)?.img;
              return (
                <div key={r.points} className="flex items-center gap-3 rounded-2xl bg-bg-surface-2 p-2.5">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-cover bg-center" style={{ backgroundImage: `url(${img})` }}>
                    <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-[11px] font-extrabold text-[#F4C95C]">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink">{r.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">troque seus pontos por este</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#FBF1DC] px-3 py-1.5">
                    <IconStar width={13} height={13} className="text-gold" />
                    <span className="text-sm font-extrabold text-gold">{r.points}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <a
            href={brand.slug ? `/${brand.slug}/meus-pontos` : "/meus-pontos"}
            className="mt-3.5 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-[#2E1065] shadow-[0_8px_24px_rgba(224,168,46,0.3)]"
            style={{ background: "linear-gradient(135deg, #F4C95C 0%, #E0A82E 100%)" }}
          >
            <IconStar width={16} height={16} /> Ver meus pontos
          </a>
          <p className="mt-2.5 text-center text-xs text-[var(--text-faded)]">
            Informe seu telefone no pedido pra acumular. Pontos viram açaí, nunca dinheiro.
          </p>
        </div>
      </section>

      {/* Barra fixa */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg-elevated/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {!isOpen && (
            <div className="mb-2 text-center text-xs font-bold text-[var(--red-no)]">
              Estamos fechados no momento — volte no horário de funcionamento.
            </div>
          )}
          {isOpen && belowMin && (
            <div className="mb-2 text-center text-xs font-semibold text-[var(--text-muted)]">
              Pedido mínimo de {brl(brand.minOrderCents)}
            </div>
          )}
          {isOpen && !belowMin && earnPts > 0 && (
            <div className="mb-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#FBF1DC] py-1.5 text-xs font-bold text-gold">
              <IconStar width={13} height={13} /> Esse pedido te dá +{earnPts} pontos
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="leading-tight">
              <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">Total</div>
              <div className="text-2xl font-extrabold text-ink">{brl(totalCents)}</div>
            </div>
            <button
              onClick={() => isOpen && !belowMin && setCheckout(true)}
              disabled={belowMin || !isOpen}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold text-white transition ${
                belowMin || !isOpen ? "bg-[#C9BCDD]" : "brand-gradient shadow-[var(--shadow-brand)]"
              }`}
            >
              {isOpen ? "Fazer pedido" : "Fechado"} <IconArrowRight width={20} height={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Checkout (modal) */}
      {checkout && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCheckout(false)} />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl animate-pop rounded-t-3xl bg-bg-elevated p-5 shadow-[var(--shadow-pop)]">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
            <h2 className="text-lg font-extrabold text-ink">Quase lá! Seus dados</h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {mode === "entrega" ? "Para entregar seu açaí" : "Para separar seu pedido"}
            </p>

            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full rounded-xl border border-line bg-bg-base px-4 py-3 text-ink outline-none focus:border-brand-600"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="Telefone / WhatsApp"
                className="w-full rounded-xl border border-line bg-bg-base px-4 py-3 text-ink outline-none focus:border-brand-600"
              />
              {mode === "entrega" && usaZonas && (
                <select
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg-base px-4 py-3 text-ink outline-none focus:border-brand-600"
                >
                  <option value="">Bairro de entrega...</option>
                  {brand.deliveryZones.map((z) => (
                    <option key={z.bairro} value={z.bairro}>{z.bairro} — {brl(z.feeCents)}</option>
                  ))}
                </select>
              )}
              {mode === "entrega" && (
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Endereço de entrega"
                  className="w-full rounded-xl border border-line bg-bg-base px-4 py-3 text-ink outline-none focus:border-brand-600"
                />
              )}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-bg-surface-2 px-4 py-3">
              <span className="text-sm font-semibold text-ink-2">Total</span>
              <span className="text-xl font-extrabold text-ink">{brl(totalCents)}</span>
            </div>

            {earnPts > 0 && (
              <div className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-[#FBF1DC] py-2.5 text-sm font-bold text-gold">
                <IconStar width={15} height={15} /> Você ganha +{earnPts} pontos no telefone informado
              </div>
            )}

            {error && <div className="mt-3 text-sm font-semibold text-[var(--red-no)]">{error}</div>}

            <button
              onClick={submit}
              disabled={sending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient py-4 text-[15px] font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-60"
            >
              <IconCheck width={20} height={20} />
              {sending ? "Enviando..." : "Confirmar pedido"}
            </button>
            <button onClick={() => setCheckout(false)} className="mt-2 w-full py-2 text-sm font-semibold text-[var(--text-muted)]">
              Voltar e ajustar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
