"use client";

// Comanda de SALÃO do operador pro menu RELACIONAL (bar/grid). Espinha espelhada do Medellín
// (Verbo): rascunho (não cria comanda até o 1º item) → picker grid → temp → confirmAdd (/api/mesas/lancar)
// → painel consolidado por estação → fechar. RODADA 2: diferenciais entre o "+" e o temp —
// modificadores (ProductCustomizer), peso (WeightModal compartilhado) e observação por linha.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { brl } from "@/lib/format";
import type { BarCategory, BarProduct } from "@/lib/menu-bar-store";
import type { CardMachine } from "@/lib/settings-store";
import { IconArrowRight, IconReceipt, IconBag } from "@/components/Icons";
import ProductCustomizer, { type CustomizeResult } from "@/components/menu/ProductCustomizer";
import WeightModal from "@/components/admin/WeightModal";
import { printVias } from "@/lib/print";
import { ticketHtml } from "@/lib/ticket";
import QzStatus from "@/components/admin/QzStatus";

type TableCard = { number: number; area: string; tabId: number | null; openTotalCents: number; openedAt: string | null; contaCalled: boolean };
type ComItem = { name: string; sizeLabel?: string | null; qty: number; unitPriceCents: number; station?: string; note?: string | null; mods?: { name: string; price_cents: number }[] | null };
type Comanda = { tab: { id: number; label?: string | null; people_count?: number }; orders: { items: ComItem[] }[]; payments: { method: string; amountCents: number }[]; consumoCents: number; coverCents: number; totalCents: number; paidCents: number };
// linha do carrinho temp: produto simples (qty), com modificadores (modifierIds) ou por peso (grams) + obs
type TempLine = { uid: string; product: BarProduct; label: string; qty: number; unitPriceCents: number; modifierIds?: string[]; grams?: number; note?: string };
let _seq = 0;
const uid = () => `t${++_seq}`;

const PAYS = [["dinheiro", "Dinheiro"], ["pix", "PIX"], ["debito", "Débito"], ["credito", "Crédito"]] as const;
const agoMin = (iso: string | null, now: number) => { if (!iso) return ""; const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; };

export default function MesasBarClient({ categories, coverShow, staff, storeName, machines, endereco, cnpj, tel, cupomRodape, onSaleClosed }: {
  categories: BarCategory[];
  coverShow: { artist: string; coverCents: number } | null;
  staff: { id: string; name: string }[];
  storeName: string;
  machines: CardMachine[];
  endereco: string;
  cnpj: string;
  tel: string;
  cupomRodape: string;
  onSaleClosed?: () => void; // ressincroniza o saldo do Caixa quando a grade está embutida no hub PDV
}) {
  const [tables, setTables] = useState<TableCard[]>([]);
  const [now, setNow] = useState(() => Date.now());
  // drawer: {table, tabId|null} + view ('pick' lança item · 'comanda' vê/fecha)
  const [drawer, setDrawer] = useState<{ table: TableCard; tabId: number | null } | null>(null);
  const [view, setView] = useState<"pick" | "comanda">("pick");
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [temp, setTemp] = useState<TempLine[]>([]);
  const [pickedCat, setPickedCat] = useState<string | null>(null); // picker category-first: null = grade de categorias
  const [weightFor, setWeightFor] = useState<BarProduct | null>(null);
  const [customizeFor, setCustomizeFor] = useState<{ product: BarProduct } | null>(null);
  const [pax, setPax] = useState(1);
  const [waiter, setWaiter] = useState("");
  const [fee, setFee] = useState(true);
  const [method, setMethod] = useState<string>("pix");
  const activeMachines = machines.filter((m) => m.active);
  const [machineId, setMachineId] = useState<string>(activeMachines[0]?.id ?? "");
  const [parcelas, setParcelas] = useState(1);
  const [parcial, setParcial] = useState(""); // valor de um pagamento parcial (split); vazio = paga a falta
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addN, setAddN] = useState("");
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTables = useCallback(async () => {
    try { const r = await fetch("/api/mesas", { cache: "no-store" }); setTables((await r.json()).tables ?? []); } catch { /* mantém */ }
  }, []);
  useEffect(() => { loadTables(); const t = setInterval(loadTables, 5000); return () => clearInterval(t); }, [loadTables]);
  useEffect(() => { tick.current = setInterval(() => setNow(Date.now()), 30000); return () => { if (tick.current) clearInterval(tick.current); }; }, []);

  async function loadComanda(tabId: number) {
    const r = await fetch(`/api/mesas/comanda?tabId=${tabId}`, { cache: "no-store" });
    setComanda(await r.json());
  }

  function clickTable(t: TableCard) {
    setErr(""); setTemp([]); setPax(1); setWaiter("");
    if (t.tabId) { setDrawer({ table: t, tabId: t.tabId }); setView("comanda"); void loadComanda(t.tabId); }
    else { setDrawer({ table: t, tabId: null }); setView("pick"); setComanda(null); } // rascunho — não cria nada ainda
  }
  function closeDrawer() { setDrawer(null); setComanda(null); setTemp([]); setPickedCat(null); }

  // toca no produto: peso → WeightModal · com grupos → ProductCustomizer · simples → soma a linha
  function onProduct(p: BarProduct) {
    setErr("");
    if (p.by_weight) { setWeightFor(p); return; }
    if (p.groups && p.groups.length) { setCustomizeFor({ product: p }); return; }
    setTemp((c) => {
      const ix = c.findIndex((l) => l.product.id === p.id && !l.grams && !l.modifierIds);
      if (ix >= 0) { const n = [...c]; n[ix] = { ...n[ix], qty: n[ix].qty + 1 }; return n; }
      return [...c, { uid: uid(), product: p, label: p.name, qty: 1, unitPriceCents: p.price_cents }];
    });
  }
  function addWeight(p: BarProduct, grams: number) {
    const liquido = Math.max(0, grams - (p.tare_grams || 0));
    const cents = Math.round((liquido / 1000) * p.price_cents);
    setTemp((c) => [...c, { uid: uid(), product: p, label: `${p.name} ${liquido}g`, qty: 1, unitPriceCents: cents, grams }]);
    setWeightFor(null);
  }
  function addCustom(p: BarProduct, r: CustomizeResult) {
    const nm = p.name + (r.mods.length ? ` (${r.mods.map((m) => m.name).join(", ")})` : "");
    setTemp((c) => [...c, { uid: uid(), product: p, label: nm, qty: r.qty, unitPriceCents: r.unitPriceCents, modifierIds: r.modifierIds }]);
    setCustomizeFor(null);
  }
  const incLine = (u: string) => setTemp((c) => c.map((l) => (l.uid === u ? { ...l, qty: l.qty + 1 } : l)));
  const decLine = (u: string) => setTemp((c) => c.flatMap((l) => (l.uid === u ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l])));
  const delLine = (u: string) => setTemp((c) => c.filter((l) => l.uid !== u));
  const setLineNote = (u: string, note: string) => setTemp((c) => c.map((l) => (l.uid === u ? { ...l, note } : l)));
  const qtyOf = (p: BarProduct) => temp.find((l) => l.product.id === p.id && !l.grams && !l.modifierIds)?.qty ?? 0;
  const tempCount = temp.reduce((s, l) => s + l.qty, 0);
  const tempTotal = temp.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);

  // lança o temp — UM request transacional (/api/mesas/lancar): se for rascunho, abre a comanda
  // e lança junto no servidor; se o lançamento falhar, o servidor faz rollback (sem mesa-fantasma).
  async function confirmAdd() {
    if (!drawer || busy || tempCount === 0) return;
    setBusy(true); setErr("");
    try {
      const items = temp.map((l) => ({ productId: l.product.id, qty: l.qty, modifierIds: l.modifierIds, grams: l.grams, note: l.note }));
      const body = drawer.tabId
        ? { tabId: drawer.tabId, items }
        : { tableNumber: drawer.table.number, pax: coverShow ? pax : undefined, waiterId: waiter || undefined, items };
      const r = await fetch("/api/mesas/lancar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não consegui lançar.");
      const tabId = Number(d.tabId);
      setTemp([]); setDrawer({ table: drawer.table, tabId });
      setView("comanda"); await loadComanda(tabId); loadTables();
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao lançar."); }
    finally { setBusy(false); }
  }

  // comanda consolidada por estação + item igual (Verbo pegadinha #3)
  const consolid = useMemo(() => {
    const map = new Map<string, ComItem & { station: string }>();
    for (const o of comanda?.orders ?? []) for (const it of o.items) {
      const st = it.station ?? "cozinha";
      // chave inclui MODIFICADORES (assinatura ordenada) + obs → mods/obs diferentes NÃO fundem;
      // idênticos (mesmos mods, mesma obs) fundem e somam qty (mantém o #3 sem regressão).
      const modSig = (it.mods ?? []).map((m) => m.name).sort().join("+");
      const k = `${st}|${it.name}|${it.sizeLabel ?? ""}|${it.unitPriceCents}|${modSig}|${it.note ?? ""}`;
      const cur = map.get(k) ?? { ...it, station: st, qty: 0 };
      cur.qty += it.qty; map.set(k, cur);
    }
    return [...map.values()];
  }, [comanda]);

  const consumo = comanda?.consumoCents ?? 0;
  const cover = comanda?.coverCents ?? 0;
  const people = comanda?.tab.people_count ?? 1;

  // couvert ajustável DEPOIS da abertura: muda nº de pessoas → servidor re-faz o snapshot do cover
  async function setPeople(next: number) {
    if (!drawer?.tabId || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/mesas/pessoas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tabId: drawer.tabId, pax: Math.max(1, next) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não consegui ajustar.");
      await loadComanda(drawer.tabId); loadTables();
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao ajustar pessoas."); }
    finally { setBusy(false); }
  }
  const serviceFee = fee ? Math.round(consumo * 0.1) : 0; // taxa só sobre consumo, nunca sobre cover
  const grand = consumo + cover + serviceFee;
  const paid = comanda?.paidCents ?? 0;
  const falta = Math.max(0, grand - paid);

  async function criarMesas() {
    const n = Math.floor(Number(addN) || 0);
    if (n < 1) return;
    setBusy(true);
    try {
      const before = tables.length;
      await fetch("/api/mesas/adicionar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n }) });
      setAddOpen(false); setAddN("");
      // refetch com retry curto: o pooler do Supabase tem read-after-write lag (mesmo padrão do
      // getCurrentStore) — sem isso as mesas só apareciam após F5 (achado do teste na DELL).
      for (const d of [0, 250, 600]) {
        if (d) await new Promise((r) => setTimeout(r, d));
        const r = await fetch("/api/mesas", { cache: "no-store" });
        const got = (await r.json()).tables ?? [];
        setTables(got);
        if (got.length > before || got.length >= n) break;
      }
    } finally { setBusy(false); }
  }

  // fechar SERVER-AUTHORITATIVE: o servidor re-busca a comanda FRESCA, calcula a taxa (applyFee),
  // paga o que falta pelo total fresco e fecha. O total da tela é só preview (não comanda o fecho).
  // pagamento PARCIAL (split): registra um pagamento sem fechar — método/máquina do picker.
  // vários parciais (métodos diferentes) → "Fechar conta" paga o que sobrar.
  async function registrarParcial() {
    if (!drawer?.tabId || busy) return;
    const amountCents = parcial ? Math.round((parseFloat(parcial) || 0) * 100) : falta;
    if (amountCents <= 0) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/mesas/pagamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tabId: drawer.tabId, method, amountCents, machineId: (method === "debito" || method === "credito") && machineId ? machineId : undefined, parcelas: method === "credito" ? parcelas : 1 }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não consegui registrar o pagamento.");
      setParcial("");
      await loadComanda(drawer.tabId);
      onSaleClosed?.();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao registrar pagamento."); }
    finally { setBusy(false); }
  }

  async function fechar() {
    if (!drawer?.tabId || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/mesas/fechar-conta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tabId: drawer.tabId, applyFee: fee, method, machineId: (method === "debito" || method === "credito") && machineId ? machineId : undefined, parcelas: method === "credito" ? parcelas : 1 }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não consegui fechar.");
      // cupom de fechamento: itens (mods no nome + totalCents que JÁ inclui os mods) + total fresco do servidor
      const nowD = new Date(); const p2 = (n: number) => String(n).padStart(2, "0");
      const dest = drawer.table.area === "balcao" ? `Balcão ${drawer.table.number}` : `Mesa ${drawer.table.number}`;
      // auto-impressão por-máquina (desligável na tela de Impressora; default ligado)
      if (localStorage.getItem("autoprint:venda") !== "0") void printVias((via) => ticketHtml({
        loja: storeName, endereco, cnpj, tel, rodape: cupomRodape, display: dest, via,
        dateLabel: `${p2(nowD.getDate())}/${p2(nowD.getMonth() + 1)} ${p2(nowD.getHours())}:${p2(nowD.getMinutes())}`,
        modeLabel: dest, paymentLabel: (PAYS.find(([id]) => id === method) ?? [])[1],
        items: [
          ...consolid.map((it) => ({ qty: it.qty, name: it.name + (it.mods?.length ? ` (${it.mods.map((m) => m.name).join(", ")})` : "") + (it.note ? ` [${it.note}]` : ""), totalCents: it.qty * it.unitPriceCents })),
          ...(cover > 0 ? [{ qty: 1, name: "Couvert", totalCents: cover }] : []),
          ...(serviceFee > 0 ? [{ qty: 1, name: "Taxa de serviço 10%", totalCents: serviceFee }] : []),
        ],
        totalCents: d.totalCents ?? grand,
      }));
      closeDrawer(); loadTables(); onSaleClosed?.();
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao fechar."); }
    finally { setBusy(false); }
  }

  // "pediu a conta" no topo (âmbar) → ocupada (Verbo #2) → livre, depois agrupa por área
  const rank = (t: TableCard) => (t.contaCalled ? 0 : t.tabId ? 1 : 2);
  const areas = useMemo(() => {
    const g: Record<string, TableCard[]> = {};
    for (const t of tables) (g[t.area || "salao"] ??= []).push(t);
    for (const k of Object.keys(g)) g[k].sort((a, b) => rank(a) - rank(b) || a.number - b.number);
    const order = ["balcao", ...Object.keys(g).filter((k) => k !== "balcao")];
    return order.filter((k) => g[k]?.length).map((k) => ({ area: k, list: g[k] }));
  }, [tables]);

  const cats = categories.filter((c) => c.products.length);

  return (
    <>
      {/* toolbar: adicionar mesas (pergunta quantas — não despeja de uma vez) */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <QzStatus />
        <div className="flex items-center gap-2">
        {addOpen ? (
          <>
            <input autoFocus type="number" min={1} value={addN} onChange={(e) => setAddN(e.target.value)} placeholder="total de mesas" className="w-36 rounded-lg border border-line bg-bg-base px-3 py-2 text-sm text-ink outline-none focus:border-brand-600" />
            <button onClick={criarMesas} disabled={busy} className="rounded-lg brand-gradient px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Criar</button>
            <button onClick={() => { setAddOpen(false); setAddN(""); }} className="rounded-lg border border-line px-3 py-2 text-sm font-bold text-[var(--text-muted)]">Cancelar</button>
          </>
        ) : (
          <button onClick={() => setAddOpen(true)} className="rounded-lg border border-line px-3 py-2 text-sm font-bold text-brand-600 hover:border-brand-400">+ Adicionar mesas</button>
        )}
        </div>
      </div>

      {/* GRID de mesas por área */}
      <div className="space-y-6">
        {areas.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-[var(--text-muted)]">Nenhuma mesa. Adicione mesas no salão.</p>}
        {areas.map(({ area, list }) => (
          <section key={area}>
            <h2 className="mb-2 text-sm font-extrabold capitalize text-ink">{area === "balcao" ? "Balcão" : area}</h2>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((t) => {
                const oc = !!t.tabId;
                const conta = t.contaCalled; // pediu a conta → âmbar pulsando, no topo
                const topColor = conta ? "#D97706" : oc ? "var(--brand-600)" : "#16A34A";
                return (
                  <button key={t.number} onClick={() => clickTable(t)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border bg-bg-elevated p-2 text-center transition active:scale-95 ${conta ? "animate-pulse ring-2 ring-amber-400" : ""}`}
                    style={{ borderColor: conta ? "#D97706" : oc ? "var(--brand-600)" : "var(--line)", borderTopWidth: 3, borderTopColor: topColor }}>
                    {conta && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-extrabold uppercase leading-none text-white">pediu a conta</span>}
                    <span className={`text-3xl font-extrabold ${conta ? "text-amber-600" : oc ? "text-ink" : "text-lime"}`}>{t.number}</span>
                    {oc ? (
                      <>
                        <span className={`mt-0.5 text-[11px] font-bold tabular-nums ${conta ? "text-amber-600" : "text-brand-600"}`}>{brl(t.openTotalCents)}</span>
                        <span className="text-[9px] text-[var(--text-faded)]">{agoMin(t.openedAt, now)}</span>
                      </>
                    ) : <span className="mt-1 text-[10px] font-semibold text-lime">Livre</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* DRAWER da mesa */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={closeDrawer}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg-elevated p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-extrabold text-ink">{drawer.table.area === "balcao" ? "Balcão" : "Mesa"} {drawer.table.number}</h3>
              <button onClick={closeDrawer} className="grid h-8 w-8 place-items-center rounded-full border border-line text-lg">✕</button>
            </div>

            {view === "pick" ? (
              <>
                {/* rascunho: cover (pessoas) + garçom só na 1ª abertura */}
                {drawer.tabId === null && (
                  <div className="mb-3 space-y-2">
                    {staff.length > 0 && (
                      <select value={waiter} onChange={(e) => setWaiter(e.target.value)} className="w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-sm text-ink">
                        <option value="">Sem garçom</option>
                        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                    {coverShow && (
                      <div className="rounded-xl border border-line bg-bg-surface-2 p-2.5">
                        <p className="text-xs text-[var(--text-muted)]">Couvert · {coverShow.artist} · {brl(coverShow.coverCents)}/pessoa</p>
                        <div className="mt-1.5 flex items-center justify-center gap-3">
                          <button onClick={() => setPax((p) => Math.max(1, p - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-lg">−</button>
                          <span className="w-8 text-center text-2xl font-extrabold text-ink">{pax}</span>
                          <button onClick={() => setPax((p) => p + 1)} className="grid h-8 w-8 place-items-center rounded-lg brand-gradient text-lg text-white">+</button>
                          <span className="ml-2 text-sm text-[var(--text-muted)]">pessoas</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* picker CATEGORY-FIRST: grade de categorias → produtos da escolhida (lista não fica gigante) */}
                {(() => {
                  const renderProduct = (p: BarProduct) => {
                    const monta = (p.groups && p.groups.length > 0) || p.by_weight;
                    const q = qtyOf(p);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg-base p-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">{p.name}</div>
                          <div className="text-xs font-bold text-brand-600">{brl(p.price_cents)}{p.by_weight && <span className="font-medium text-[var(--text-faded)]">/kg</span>}{monta && <span className="ml-1 rounded bg-bg-surface-2 px-1 text-[9px] font-bold text-[var(--text-muted)]">{p.by_weight ? "pesar" : "monta"}</span>}</div>
                        </div>
                        {!monta && q > 0 ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button onClick={() => { const u = temp.find((l) => l.product.id === p.id && !l.grams && !l.modifierIds)?.uid; if (u) decLine(u); }} className="grid h-7 w-7 place-items-center rounded-lg border border-line text-lg leading-none">−</button>
                            <span className="w-4 text-center text-sm font-bold tabular-nums">{q}</span>
                            <button onClick={() => onProduct(p)} className="grid h-7 w-7 place-items-center rounded-lg brand-gradient text-lg leading-none text-white">+</button>
                          </div>
                        ) : (
                          <button onClick={() => onProduct(p)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg brand-gradient text-xl leading-none text-white">+</button>
                        )}
                      </div>
                    );
                  };
                  const active = cats.find((c) => c.id === pickedCat);
                  if (active) {
                    return (
                      <div>
                        <button onClick={() => setPickedCat(null)} className="mb-2.5 inline-flex items-center gap-1 text-sm font-bold text-brand-600">‹ Categorias</button>
                        <p className="mb-1.5 text-xs font-bold uppercase text-[var(--text-muted)]">{active.name}</p>
                        <div className="grid grid-cols-2 gap-2">{active.products.map(renderProduct)}</div>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {cats.map((cat) => {
                        const n = temp.filter((l) => cat.products.some((p) => p.id === l.product.id)).reduce((s, l) => s + l.qty, 0);
                        return (
                          <button key={cat.id} onClick={() => setPickedCat(cat.id)} className="relative flex items-center justify-between gap-2 rounded-xl border border-line bg-bg-base p-3 text-left">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-ink">{cat.name}</div>
                              <div className="text-[11px] text-[var(--text-faded)]">{cat.products.length} {cat.products.length === 1 ? "item" : "itens"}</div>
                            </div>
                            {n > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">{n}</span>}
                            <IconArrowRight width={15} height={15} className="shrink-0 text-[var(--text-faded)]" />
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* a lançar: linhas do temp com obs por linha (diferencial) */}
                {temp.length > 0 && (
                  <div className="mt-3 rounded-xl border border-line bg-bg-surface-2 p-2.5">
                    <p className="mb-1 text-[11px] font-bold uppercase text-[var(--text-muted)]">A lançar</p>
                    <ul className="space-y-1.5">
                      {temp.map((l) => (
                        <li key={l.uid}>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate text-ink"><b className="tabular-nums">{l.qty}×</b> {l.label}</span>
                            <span className="tabular-nums text-[var(--text-muted)]">{brl(l.qty * l.unitPriceCents)}</span>
                            <button onClick={() => delLine(l.uid)} className="text-[var(--text-faded)] hover:text-[var(--red-no)]">✕</button>
                          </div>
                          <input value={l.note ?? ""} onChange={(e) => setLineNote(l.uid, e.target.value)} placeholder="obs (ex: sem cebola, mal passado)" className="mt-1 w-full rounded-lg border border-line bg-bg-base px-2 py-1 text-xs text-ink outline-none focus:border-brand-600" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">{err}</p>}
                <div className="sticky bottom-0 mt-3 flex gap-2 bg-bg-elevated pt-2">
                  {drawer.tabId !== null && <button onClick={() => { setView("comanda"); setErr(""); }} className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink">Ver comanda</button>}
                  <button onClick={confirmAdd} disabled={busy || tempCount === 0} className="flex flex-1 items-center justify-center gap-2 rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-50">
                    <IconArrowRight width={16} height={16} /> {tempCount ? `Lançar ${tempCount} · ${brl(tempTotal)}` : "Lançar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* COMANDA consolidada */}
                <div className="rounded-xl border border-line">
                  <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs font-bold uppercase text-[var(--text-muted)]"><IconReceipt width={14} height={14} /> Na comanda</div>
                  {consolid.length === 0 ? <p className="px-3 py-4 text-sm text-[var(--text-faded)]">Comanda vazia.</p> : (
                    <ul className="divide-y divide-line">
                      {consolid.map((it, i) => (
                        <li key={i} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                          <span className="min-w-0 text-ink"><b className="tabular-nums">{it.qty}×</b> {it.name}{it.sizeLabel ? ` · ${it.sizeLabel}` : ""} <span className="text-[10px] capitalize text-[var(--text-faded)]">({it.station})</span>{it.mods && it.mods.length > 0 ? <span className="block text-[11px] text-[var(--text-muted)]">{it.mods.map((m) => m.name).join(" · ")}</span> : null}{it.note ? <span className="block text-[11px] italic text-[var(--text-muted)]">obs: {it.note}</span> : null}</span>
                          <span className="shrink-0 tabular-nums text-[var(--text-muted)]">{brl(it.qty * it.unitPriceCents)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-[var(--text-muted)]"><span>Consumo</span><span className="tabular-nums">{brl(consumo)}</span></div>
                  {coverShow ? (
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span className="flex items-center gap-2">Couvert
                        <span className="flex items-center gap-1.5">
                          <button onClick={() => setPeople(people - 1)} disabled={busy || people <= 1} className="grid h-7 w-7 place-items-center rounded-md border border-line text-base leading-none disabled:opacity-40">−</button>
                          <span className="w-5 text-center text-sm font-bold tabular-nums text-ink">{people}</span>
                          <button onClick={() => setPeople(people + 1)} disabled={busy} className="grid h-7 w-7 place-items-center rounded-md brand-gradient text-base leading-none text-white">+</button>
                        </span>
                        <span className="text-xs">pessoas</span>
                      </span>
                      <span className="tabular-nums">{brl(cover)}</span>
                    </div>
                  ) : (cover > 0 && <div className="flex justify-between text-[var(--text-muted)]"><span>Couvert</span><span className="tabular-nums">{brl(cover)}</span></div>)}
                  <label className="flex items-center justify-between"><span className="flex items-center gap-2 text-[var(--text-muted)]"><input type="checkbox" checked={fee} onChange={(e) => setFee(e.target.checked)} /> Taxa de serviço 10%</span><span className="tabular-nums">{brl(serviceFee)}</span></label>
                  <div className="flex justify-between border-t border-line pt-1 text-base font-extrabold text-ink"><span>Total</span><span className="tabular-nums text-brand-600">{brl(grand)}</span></div>
                  {paid > 0 && <div className="flex justify-between text-[var(--text-muted)]"><span>Pago</span><span className="tabular-nums">{brl(paid)}</span></div>}
                  {(comanda?.payments?.length ?? 0) > 0 && (
                    <div className="space-y-0.5 pl-2 text-xs text-[var(--text-faded)]">
                      {comanda!.payments.map((pmt, i) => <div key={i} className="flex justify-between"><span className="capitalize">{pmt.method}</span><span className="tabular-nums">{brl(pmt.amountCents)}</span></div>)}
                    </div>
                  )}
                  {paid > 0 && falta > 0 && <div className="flex justify-between font-bold text-[var(--red-no)]"><span>Falta</span><span className="tabular-nums">{brl(falta)}</span></div>}
                </div>

                <p className="mb-1.5 mt-3 text-xs font-semibold text-[var(--text-muted)]">Pagamento {falta > 0 ? `(falta ${brl(falta)})` : ""}</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {PAYS.map(([id, label]) => <button key={id} onClick={() => setMethod(id)} className={`rounded-lg border-2 py-2 text-[11px] font-bold ${method === id ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>{label}</button>)}
                </div>
                {(method === "debito" || method === "credito") && activeMachines.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {activeMachines.length > 1 && (
                      <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-full rounded-lg border border-line bg-bg-base px-2.5 py-2 text-sm font-semibold text-ink outline-none">
                        {activeMachines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    )}
                    {method === "credito" && (
                      <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="w-full rounded-lg border border-line bg-bg-base px-2.5 py-2 text-sm font-semibold text-ink outline-none">
                        {Array.from({ length: activeMachines.find((x) => x.id === machineId)?.maxParcelas ?? 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "À vista (1x)" : `${n}x parcelado`}</option>)}
                      </select>
                    )}
                  </div>
                )}

                {/* split: registra pagamento parcial (vazio = paga a falta toda) sem fechar */}
                {grand > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    <div className="flex flex-1 items-center rounded-lg border border-line bg-bg-base px-2.5">
                      <span className="text-xs font-semibold text-[var(--text-muted)]">R$</span>
                      <input type="number" min={0} step="0.5" value={parcial} onChange={(e) => setParcial(e.target.value)} placeholder={falta > 0 ? `parcial (vazio = ${brl(falta)})` : "parcial"} className="w-full bg-transparent px-1.5 py-2 text-sm font-bold text-ink outline-none" />
                    </div>
                    <button onClick={registrarParcial} disabled={busy} className="shrink-0 rounded-lg border border-brand-400 px-3 py-2 text-xs font-bold text-brand-600 disabled:opacity-50">Registrar pagamento</button>
                  </div>
                )}

                {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">{err}</p>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setView("pick"); setTemp([]); setErr(""); }} className="flex items-center gap-1.5 rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink"><IconBag width={15} height={15} /> Adicionar item</button>
                  <button onClick={fechar} disabled={busy || grand === 0} className="flex-1 rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-50">{busy ? "..." : "Fechar conta"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* diferenciais (entre o "+" e o temp): peso e modificadores */}
      {weightFor && <WeightModal product={weightFor} onClose={() => setWeightFor(null)} onConfirm={(g) => addWeight(weightFor, g)} />}
      {customizeFor && <ProductCustomizer product={customizeFor.product} accent="#4F46E5" onClose={() => setCustomizeFor(null)} onConfirm={(r) => addCustom(customizeFor.product, r)} />}
    </>
  );
}
