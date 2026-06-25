"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, Badge } from "@/components/admin/ui";
import { brl } from "@/lib/format";
import { IconMoto, IconBag, IconArrowRight, IconPrinter, IconCheck } from "@/components/Icons";
import CupomPrinter, { type CupomData } from "@/components/admin/CupomPrinter";
import { printTicket } from "@/lib/print";
import { ticketHtml, type TicketData } from "@/lib/ticket";
import type { Order, OrderStatus } from "@/lib/orders-store";
import type { WaMsgs } from "@/lib/settings-store";

const PAY_LABEL: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Cartão débito", credito: "Cartão crédito" };
const MODE_LABEL: Record<string, string> = { balcao: "Balcão", retirada: "Retirada", entrega: "Entrega" };
// fallback sem emoji (vale só até o fetch de /api/configuracoes trazer as mensagens reais).
// motivo: emoji astral passado por PROP RSC server→client corrompe (vira �); via fetch/JSON preserva.
const WA_FALLBACK: WaMsgs = {
  recebido: "Olá {nome}! Recebemos seu pedido {codigo} na {loja}. Já vamos preparar!",
  preparo: "Oi {nome}, seu pedido {codigo} já está em preparo!",
  saiu: "{nome}, seu pedido {codigo} saiu para entrega — chega já!",
  entregue: "Pedido {codigo} entregue. Obrigado, {nome}!",
};

function cupomFromOrder(o: Order, storeName: string, head: { endereco: string; cnpj: string; tel: string }): CupomData {
  const d = new Date(o.createdAt);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    loja: storeName, endereco: head.endereco, cnpj: head.cnpj, tel: head.tel,
    display: o.display,
    dateLabel: `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`,
    modeLabel: MODE_LABEL[o.mode] ?? o.mode,
    paymentLabel: o.paymentMethod ? PAY_LABEL[o.paymentMethod] : undefined,
    customerName: o.customerName,
    phone: o.phone || undefined,
    address: o.address,
    items: o.items.map((it) => ({ qty: it.qty, name: it.name, totalCents: it.paidCents })),
    totalCents: o.totalCents,
    pointsInfo: o.pointsAwarded ? `Pontos ganhos: +${o.pointsAwarded}` : undefined,
  };
}

// cupom térmico (auto-impressão) — tamanho em destaque + acompanhamentos
function ticketFromOrder(o: Order, storeName: string, head: { endereco: string; cnpj: string; tel: string }): TicketData {
  const d = new Date(o.createdAt);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    loja: storeName, endereco: head.endereco, cnpj: head.cnpj, tel: head.tel,
    display: o.display,
    dateLabel: `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`,
    modeLabel: MODE_LABEL[o.mode] ?? o.mode,
    paymentLabel: o.paymentMethod ? PAY_LABEL[o.paymentMethod] : undefined,
    customerName: o.customerName,
    phone: o.phone || undefined,
    address: o.address,
    bairro: o.bairro,
    feeCents: o.feeCents || undefined,
    // sizeLabel "Delivery"/"Retirada" é só marcador de tipo (já vai no modeLabel) — não vira item
    items: [
      ...(o.sizeLabel && o.sizeLabel !== "Delivery" && o.sizeLabel !== "Retirada" ? [{ qty: 1, name: o.sizeLabel }] : []),
      ...o.items.map((it) => ({ qty: it.qty, name: it.name, totalCents: it.paidCents > 0 ? it.paidCents : undefined })),
    ],
    totalCents: o.totalCents,
    code: o.code,
    // não processamos pagamento: em pedido do link (entrega/retirada) o entregador/balcão RECEBE o total
    collectCents: o.mode !== "balcao" ? o.totalCents : undefined,
    pointsInfo: o.pointsAwarded ? `Pontos ganhos: +${o.pointsAwarded}` : undefined,
    origem: o.mode === "balcao" ? "balcao" : "link",
  };
}

const COLS: { key: OrderStatus; label: string; tone: "accent" | "gold" | "brand" | "lime" }[] = [
  { key: "recebido", label: "Recebido", tone: "accent" },
  { key: "preparo", label: "Em preparo", tone: "gold" },
  { key: "saiu", label: "Saiu p/ entrega", tone: "brand" },
  { key: "entregue", label: "Entregue", tone: "lime" },
];
const NEXT: Record<OrderStatus, OrderStatus | null> = {
  recebido: "preparo",
  preparo: "saiu",
  saiu: "entregue",
  entregue: null,
};
const hhmm = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

// telefone do cliente → formato wa.me (só dígitos, com DDI 55)
function waPhone(raw?: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 11) d = "55" + d; // sem DDI → assume Brasil
  return d;
}
// mensagem pronta pro cliente, conforme o status do pedido (loja → cliente). Anexa o link de
// rastreio (quando há slug + código) pro cliente acompanhar o status ao vivo na página.
// usa os templates editáveis da loja (Ajustes), com placeholders {nome} {codigo} {loja}.
// anexa o link de rastreio (quando há slug + código) pro cliente acompanhar ao vivo.
function customerMsg(o: Order, storeName: string, trackBase: string, msgs: WaMsgs): string {
  const nome = (o.customerName || "").split(" ")[0] || "";
  const tmpl = msgs[o.status as keyof WaMsgs] ?? "Olá {nome}, sobre seu pedido {codigo} na {loja}.";
  const base = tmpl
    .replace(/\{nome\}/g, nome)
    .replace(/\{codigo\}/g, o.code || "")
    .replace(/\{loja\}/g, storeName)
    .replace(/�/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
  const link = trackBase && o.code && o.status !== "entregue" ? `\n\nAcompanhe aqui: ${trackBase}/pedido/${o.code}` : "";
  return base + link;
}
const IconWhats = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607z"/></svg>
);

export default function PedidosClient({ storeName, storeSlug, endereco, cnpj, tel }: { storeName: string; storeSlug: string; endereco: string; cnpj: string; tel: string }) {
  // base do link de rastreio (origem do navegador + slug da loja) p/ anexar na mensagem do WhatsApp
  const trackBase = typeof window !== "undefined" && storeSlug ? `${window.location.origin}/${storeSlug}` : "";
  const [waMsgs, setWaMsgs] = useState<WaMsgs>(WA_FALLBACK);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const [notifyWhats, setNotifyWhats] = useState(true); // avisar cliente no WhatsApp ao avançar status
  const [soundOn, setSoundOn] = useState(true);
  const seen = useRef<Set<number>>(new Set());
  const first = useRef(true);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    setAutoPrint(localStorage.getItem("autoprint:caixa") !== "0");
    setSoundOn(localStorage.getItem("sound:caixa") !== "0");
  }, []);

  // mensagens do WhatsApp via fetch/JSON (NÃO por prop RSC — a prop corrompe o emoji astral)
  useEffect(() => {
    fetch("/api/configuracoes", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.store?.waMsgs) setWaMsgs(d.store.waMsgs); }).catch(() => {});
  }, []);

  // bipe de novo pedido (Web Audio, sem arquivo) — 2 toques curtos
  const beep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx.current = audioCtx.current ?? new Ctx();
      const ac = audioCtx.current;
      if (ac.state === "suspended") void ac.resume();
      [0, 0.18].forEach((t) => {
        const o = ac.createOscillator(); const g = ac.createGain();
        o.type = "sine"; o.frequency.value = 880;
        g.gain.setValueAtTime(0.001, ac.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.15);
        o.connect(g); g.connect(ac.destination);
        o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.16);
      });
    } catch { /* navegador sem áudio / sem gesto ainda — silencioso */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pedidos", { cache: "no-store" });
      const data = await res.json();
      const list: Order[] = data.orders ?? [];
      setOrders(list);
      // auto-impressão: 1ª carga só marca os existentes; depois imprime os pedidos NOVOS do link
      if (first.current) {
        list.forEach((o) => seen.current.add(o.id));
        first.current = false;
      } else {
        const novos = list.filter((o) => !seen.current.has(o.id));
        novos.forEach((o) => seen.current.add(o.id));
        const novosLink = novos.filter((o) => o.mode !== "balcao");
        if (soundOn && novosLink.length) beep();
        if (autoPrint) {
          for (const o of novosLink) void printTicket(ticketHtml(ticketFromOrder(o, storeName, { endereco, cnpj, tel })));
        }
      }
    } catch {
      /* mantém estado anterior */
    } finally {
      setLoaded(true);
    }
  }, [autoPrint, soundOn, beep, storeName]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // tempo real (polling)
    return () => clearInterval(t);
  }, [load]);

  function toggleAuto() {
    setAutoPrint((v) => {
      const nv = !v;
      localStorage.setItem("autoprint:caixa", nv ? "1" : "0");
      return nv;
    });
  }
  function toggleSound() {
    setSoundOn((v) => {
      const nv = !v;
      localStorage.setItem("sound:caixa", nv ? "1" : "0");
      if (nv) beep(); // toca pra confirmar + libera o áudio (gesto do usuário)
      return nv;
    });
  }

  async function advance(o: Order) {
    const next = NEXT[o.status];
    if (!next) return;
    // semi-auto: avisa o cliente no WhatsApp com a msg do NOVO status. Abre ANTES do await
    // (senão o popup é bloqueado por perder o gesto do clique). Controlado pelo toggle do topo.
    if (notifyWhats && o.phone) {
      window.open(`https://wa.me/${waPhone(o.phone)}?text=${encodeURIComponent(customerMsg({ ...o, status: next }, storeName, trackBase, waMsgs))}`, "_blank", "noopener,noreferrer");
    }
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: next } : x)));
    await fetch(`/api/pedidos/${o.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  return (
    <>
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-bg-elevated p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${autoPrint ? "brand-gradient text-white" : "bg-bg-surface-2 text-[var(--text-muted)]"}`}>
          <IconPrinter width={18} height={18} />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-bold text-ink">Impressão automática {autoPrint ? "ligada" : "desligada"}</div>
          <div className="text-xs text-[var(--text-muted)]">pedidos do link saem na impressora do caixa</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={toggleSound} title={soundOn ? "Som de novo pedido ligado" : "Som desligado"} aria-label="Ligar/desligar som de novo pedido" className={`grid h-9 w-9 place-items-center rounded-lg border border-line ${soundOn ? "text-brand-600" : "text-[var(--text-faded)]"}`}>
          {soundOn ? (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>
          ) : (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m23 9-6 6M17 9l6 6"/></svg>
          )}
        </button>
        <button onClick={() => setNotifyWhats((v) => !v)} title={notifyWhats ? "Avisar cliente no WhatsApp ao avançar status (ligado)" : "Aviso ao cliente no WhatsApp desligado"} aria-label="Ligar/desligar aviso ao cliente no WhatsApp" className={`grid h-9 w-9 place-items-center rounded-lg border border-line ${notifyWhats ? "text-[#25D366]" : "text-[var(--text-faded)]"}`}>
          <IconWhats size={18} />
        </button>
        <button onClick={toggleAuto} aria-label="Ligar/desligar impressão automática" className={`relative h-7 w-12 shrink-0 rounded-full transition ${autoPrint ? "bg-brand-600" : "bg-bg-surface-2"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${autoPrint ? "left-6" : "left-1"}`} />
        </button>
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLS.map((col) => {
        const list = orders.filter((o) => o.status === col.key);
        return (
          <div key={col.key}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-bold text-ink">{col.label}</span>
              <Badge tone={col.tone}>{list.length}</Badge>
            </div>
            <div className="space-y-2.5">
              {loaded && list.length === 0 && (
                <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-[var(--text-faded)]">
                  nenhum
                </div>
              )}
              {list.map((o) => (
                <Card key={o.id} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{o.display}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                      {o.mode === "entrega" ? <IconMoto width={14} height={14} /> : <IconBag width={14} height={14} />}
                      {hhmm(o.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-ink-2">{o.customerName}</div>
                  <div className="text-xs text-[var(--text-muted)]">{o.phone}</div>

                  {/* pedido completo */}
                  <div className="mt-2 rounded-lg bg-bg-surface-2 p-2.5">
                    <div className="text-xs font-bold text-ink">{o.sizeLabel}</div>
                    <ul className="mt-1 space-y-0.5">
                      {o.items.map((it, i) => (
                        <li key={i} className="flex justify-between text-[11px] text-ink-2">
                          <span>{it.qty}x {it.name}</span>
                          <span className={it.paidCents > 0 ? "font-semibold text-ink" : "text-lime"}>
                            {it.paidCents > 0 ? `+${brl(it.paidCents)}` : "grátis"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {o.mode === "entrega" && o.address && (
                    <div className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                      <span className="font-semibold">Entrega:</span> {o.address}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-brand-600">{brl(o.totalCents)}</span>
                    <div className="flex items-center gap-1.5">
                      {o.phone && (
                        <a
                          href={`https://wa.me/${waPhone(o.phone)}?text=${encodeURIComponent(customerMsg(o, storeName, trackBase, waMsgs))}`}
                          target="_blank" rel="noopener noreferrer"
                          title="Falar com o cliente no WhatsApp"
                          className="grid h-7 w-7 place-items-center rounded-lg border border-line text-[#25D366] hover:border-[#25D366]"
                        >
                          <IconWhats size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => setPrintOrder(o)}
                        title="Imprimir cupom"
                        className="grid h-7 w-7 place-items-center rounded-lg border border-line text-[var(--text-muted)] hover:border-brand-600 hover:text-brand-600"
                      >
                        <IconPrinter width={14} height={14} />
                      </button>
                      {NEXT[o.status] && (
                        <button
                          onClick={() => advance(o)}
                          className="inline-flex items-center gap-1 rounded-lg brand-gradient px-2.5 py-1.5 text-[11px] font-bold text-white"
                        >
                          {col.key === "recebido" ? "Preparar" : col.key === "preparo" ? (o.mode === "entrega" ? "Saiu p/ entrega" : "Pronto") : "Entregue"}
                          <IconArrowRight width={13} height={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
      {printOrder && <CupomPrinter data={cupomFromOrder(printOrder, storeName, { endereco, cnpj, tel })} onClose={() => setPrintOrder(null)} />}
    </div>
    </>
  );
}
