"use client";

import { useEffect, useState, useCallback } from "react";
import { brl } from "@/lib/format";
import type { Size, ModifierGroup } from "@/lib/menu";
import type { CashSession } from "@/lib/cash-store";
import type { Customer } from "@/lib/customers-store";
import { nextReward } from "@/lib/loyalty";
import PDV, { type Fees } from "@/components/admin/PDV";
import type { CardMachine } from "@/lib/settings-store";
import { printTicket } from "@/lib/print";
import QzStatus from "@/components/admin/QzStatus";
import { leituraXHtml, movTicketHtml } from "@/lib/ticket";
import { IconWallet, IconCheck, IconArrowRight, IconClock, IconPlus, IconMinus, IconAlert, IconStar, IconPrinter } from "@/components/Icons";

type StoreHeader = { name: string; endereco: string; cnpj: string; tel: string };
const dmyhm = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Produto = { id: string; name: string; priceCents: number; qty: number; unit: string };
type Resumo = { salesCashCents: number; salesTotalCents: number; salesCardCents: number; salesPixCents: number; cardFeeCents: number; cardNetCents: number; suprimentoCents: number; sangriaCents: number; saldoCaixaCents: number; nVendas: number };

const hhmm = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function CaixaClient({ sizes, groups, produtos, fees, storeName, machines, endereco, cnpj, tel, cupomRodape, showPdv, pricePerKgCents, cashPinSet }: { sizes: Size[]; groups: ModifierGroup[]; produtos: Produto[]; fees: Fees; storeName: string; machines: CardMachine[]; endereco: string; cnpj: string; tel: string; cupomRodape: string; showPdv: boolean; pricePerKgCents: number; cashPinSet: boolean }) {
  const [session, setSession] = useState<CashSession | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [closeResult, setCloseResult] = useState<CashSession | null>(null);

  const load = useCallback(async (data?: { session: CashSession | null; resumo: Resumo | null }) => {
    // se quem chamou já tem o estado autoritativo (resposta do POST), aplica direto —
    // sem refetch que pode correr atrás do write (race de read-after-write)
    if (data) { setSession(data.session); setResumo(data.resumo ?? null); setLoaded(true); return; }
    const r = await fetch("/api/caixa", { cache: "no-store" });
    const d = await r.json();
    setSession(d.session);
    setResumo(d.resumo ?? null);
    setLoaded(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) return <div className="card p-8 text-center text-sm text-[var(--text-muted)]">Carregando caixa...</div>;

  // tela de resultado do fechamento
  if (closeResult) return <FechamentoResultado s={closeResult} onNew={() => { setCloseResult(null); load(); }} />;

  // sem caixa aberto → abertura (primeira tela do dia)
  if (!session) return <Abertura onOpened={load} />;

  // Caixa cabe numa tela só (DELL): painel fixo no topo + PDV preenchendo o resto, cada coluna
  // rolando por dentro — sem scroll de PÁGINA no desktop. Mobile mantém o scroll natural.
  return (
    <div className={`flex flex-col gap-5 ${showPdv ? "lg:h-[calc(100dvh-4rem)] lg:gap-4 lg:overflow-hidden" : ""}`}>
      <div className="shrink-0">
        <PainelCaixa session={session} resumo={resumo!} store={{ name: storeName, endereco, cnpj, tel }} cupomRodape={cupomRodape} cashPinSet={cashPinSet} onChanged={load} onClosed={(s) => setCloseResult(s)} />
      </div>
      {showPdv ? (
        <div className="min-h-0 flex-1">
          <PDV sizes={sizes} groups={groups} produtos={produtos} fees={fees} storeName={storeName} machines={machines} endereco={endereco} cnpj={cnpj} tel={tel} cupomRodape={cupomRodape} pricePerKgCents={pricePerKgCents} onSold={load} />
        </div>
      ) : (
        <p className="card p-4 text-center text-sm text-[var(--text-muted)]">Pra vender, use o <b className="text-ink">Balcão</b> ou as <b className="text-ink">Mesas</b>. Aqui é a gestão do caixa (abrir, sangria, suprimento e fechamento).</p>
      )}
    </div>
  );
}

/* ---------------- Abertura ---------------- */
function Abertura({ onOpened }: { onOpened: () => void }) {
  const [floatR, setFloatR] = useState("");
  const [saving, setSaving] = useState(false);

  async function abrir() {
    setSaving(true);
    await fetch("/api/caixa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "abrir", floatCents: Math.round((parseFloat(floatR) || 0) * 100) }),
    });
    onOpened();
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card p-7 text-center">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl brand-gradient text-white shadow-[var(--shadow-brand)]">
          <IconWallet width={30} height={30} />
        </div>
        <h2 className="text-xl font-extrabold text-ink">Abrir caixa do dia</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Informe o fundo de troco com que você está começando. Enquanto o caixa estiver fechado, não dá pra vender.
        </p>

        <div className="mt-6 text-left">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Fundo de troco inicial</label>
          <div className="mt-1 flex items-center rounded-xl border border-line bg-bg-base px-3">
            <span className="text-base font-bold text-[var(--text-muted)]">R$</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={floatR}
              onChange={(e) => setFloatR(e.target.value)}
              placeholder="0,00"
              autoFocus
              className="w-full bg-transparent px-2 py-3 text-xl font-extrabold text-ink outline-none"
            />
          </div>
        </div>

        <button onClick={abrir} disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient py-4 font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-60">
          {saving ? "Abrindo..." : "Abrir caixa"} <IconArrowRight width={18} height={18} />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Painel do caixa aberto ---------------- */
function PainelCaixa({ session, resumo, store, cupomRodape, cashPinSet, onChanged, onClosed }: { session: CashSession; resumo: Resumo; store: StoreHeader; cupomRodape?: string; cashPinSet: boolean; onChanged: (d?: { session: CashSession | null; resumo: Resumo | null }) => void; onClosed: (s: CashSession) => void }) {
  const [modal, setModal] = useState<null | "sangria" | "suprimento" | "fechar" | "consulta" | "historico" | "leiturax" | "movimentos">(null);

  return (
    <div className="card relative overflow-hidden" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--brand-600) 6%, var(--bg-elevated)) 0%, var(--bg-elevated) 50%)" }}>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg, var(--brand-600), transparent)" }} aria-hidden />
      {/* barra compacta estilo PDV: saldo + stats inline + ações icônicas, tudo numa faixa fina */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3.5">
        <div className="shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Caixa aberto
            <span className="font-semibold text-[var(--text-muted)]">· desde {hhmm(session.openedAt)}</span>
            <QzStatus className="ml-1" />
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold leading-none tracking-tight text-ink tabular-nums">{brl(resumo.saldoCaixaCents)}</span>
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">em caixa</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:border-l sm:border-line sm:pl-5">
          <MiniStat label="Total vendido" value={brl(resumo.salesTotalCents)} sub={`${resumo.nVendas} venda${resumo.nVendas === 1 ? "" : "s"}`} />
          <MiniStat label="Dinheiro" value={brl(resumo.salesCashCents)} />
          <MiniStat label="Fundo troco" value={brl(session.openingFloatCents)} />
          <MiniStat label="Sangria / supr." value={`${brl(resumo.sangriaCents)} / ${brl(resumo.suprimentoCents)}`} sub={session.movements.length ? "ver trilha" : undefined} onClick={session.movements.length ? () => setModal("movimentos") : undefined} />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <IconBtn onClick={() => setModal("consulta")} Icon={IconStar} title="Consultar pontos do cliente" />
          <IconBtn onClick={() => setModal("historico")} Icon={IconClock} title="Histórico de caixas" />
          <IconBtn onClick={() => setModal("leiturax")} Icon={IconPrinter} title="Leitura X (relatório parcial)" />
          <IconBtn onClick={() => setModal("suprimento")} Icon={IconPlus} title="Suprimento (reforço de troco)" />
          <IconBtn onClick={() => setModal("sangria")} Icon={IconMinus} title="Sangria (retirada)" />
          <button onClick={() => setModal("fechar")} className="inline-flex items-center gap-1.5 rounded-lg brand-gradient px-3.5 py-2 text-sm font-bold text-white shadow-[var(--shadow-brand)]">
            <IconCheck width={15} height={15} /> Fechar caixa
          </button>
        </div>
      </div>

      {modal === "sangria" && <MovModal type="sangria" store={store} rodape={cupomRodape} cashPinSet={cashPinSet} onClose={() => setModal(null)} onDone={(d) => { setModal(null); onChanged(d); }} />}
      {modal === "suprimento" && <MovModal type="suprimento" store={store} rodape={cupomRodape} cashPinSet={false} onClose={() => setModal(null)} onDone={(d) => { setModal(null); onChanged(d); }} />}
      {modal === "movimentos" && <MovimentosModal movements={session.movements} onClose={() => setModal(null)} />}
      {modal === "fechar" && <FecharModal expected={resumo.saldoCaixaCents} salesCard={resumo.salesCardCents} salesPix={resumo.salesPixCents} cardFee={resumo.cardFeeCents} onClose={() => setModal(null)} onDone={onClosed} />}
      {modal === "consulta" && <ConsultaModal onClose={() => setModal(null)} />}
      {modal === "historico" && <HistoricoModal onClose={() => setModal(null)} />}
      {modal === "leiturax" && <LeituraXModal store={store} onClose={() => setModal(null)} />}
    </div>
  );
}

function HistoricoModal({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<CashSession[] | null>(null);
  useEffect(() => {
    fetch("/api/caixa/historico", { cache: "no-store" }).then((r) => r.json()).then((d) => setSessions(d.sessions ?? []));
  }, []);
  const dmy = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <Overlay title="Histórico de caixas" onClose={onClose}>
      {!sessions ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhum caixa fechado ainda.</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {sessions.map((s) => {
            const diff = s.diffCents ?? 0;
            return (
              <div key={s.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">Fechado {dmy(s.closedAt)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${diff === 0 ? "bg-[#E8F6DD] text-lime" : "bg-[#FEECEC] text-[var(--red-no)]"}`}>
                    {diff === 0 ? "bateu" : diff > 0 ? `sobra ${brl(diff)}` : `quebra ${brl(-diff)}`}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-[var(--text-muted)]">
                  <span>Aberto: {dmy(s.openedAt)}</span>
                  <span>Fundo: {brl(s.openingFloatCents)}</span>
                  <span>Vendas dinheiro: {brl(s.salesCashCents ?? 0)}</span>
                  <span>Total vendido: {brl(s.salesTotalCents ?? 0)}</span>
                  <span>Esperado: {brl(s.expectedCents ?? 0)}</span>
                  <span>Contado: {brl(s.countedCents ?? 0)}</span>
                  {(s.salesCardCents ?? 0) > 0 && <span>Cartão líq.: {brl(s.cardNetCents ?? 0)}</span>}
                  {(s.salesPixCents ?? 0) > 0 && <span>Pix: {brl(s.salesPixCents ?? 0)}</span>}
                  {s.closedBy && <span className="col-span-2">Fechado por: {s.closedBy}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}

function ConsultaModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function buscar() {
    if (!q.trim()) return;
    setBusy(true);
    const d = await fetch(`/api/clientes?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json());
    setResults(d.customers || []);
    setBusy(false);
  }

  return (
    <Overlay title="Consultar pontos do cliente" onClose={onClose}>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder="Nome ou telefone"
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm outline-none focus:border-brand-600"
        />
        <button onClick={buscar} disabled={busy} className="shrink-0 rounded-lg brand-gradient px-4 text-sm font-bold text-white disabled:opacity-60">
          {busy ? "..." : "Buscar"}
        </button>
      </div>

      {results && results.length === 0 && (
        <div className="rounded-lg bg-bg-surface-2 p-4 text-center text-sm text-[var(--text-muted)]">Nenhum cliente encontrado.</div>
      )}
      {results && results.length > 0 && (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {results.map((c) => {
            const nx = nextReward(c.points);
            return (
              <div key={c.phone} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-ink">{c.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{c.phone}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-brand-600">{c.points}</div>
                    <div className="text-[11px] font-bold text-[var(--text-muted)]">pontos</div>
                  </div>
                </div>
                <div className="mt-1.5 text-xs font-semibold text-lime">
                  {nx ? `Faltam ${nx.missing} pra ${nx.reward.label}` : "Já pode resgatar o prêmio máximo!"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}

/* ---------------- Leitura X (relatório parcial, não fecha o caixa) ---------------- */
function LeituraXModal({ store, onClose }: { store: StoreHeader; onClose: () => void }) {
  // prova-na-fonte: lê o estado autoritativo do servidor no momento da leitura
  // (vendas podem ter rolado no PDV desde o último refresh do painel).
  const [data, setData] = useState<{ session: CashSession; resumo: Resumo } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/caixa", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.session) setData({ session: d.session, resumo: d.resumo }); });
  }, []);

  async function imprimir() {
    if (!data) return;
    setPrinting(true);
    // nº da leitura X por sessão (1ª, 2ª...) — local à máquina do caixa
    const key = `leituraX:${data.session.id}`;
    const seq = (parseInt(localStorage.getItem(key) || "0", 10) || 0) + 1;
    const { session, resumo } = data;
    const html = leituraXHtml({
      loja: store.name, endereco: store.endereco, cnpj: store.cnpj, tel: store.tel,
      dateLabel: dmyhm(new Date().toISOString()),
      openedLabel: dmyhm(session.openedAt),
      operator: session.operator,
      seq,
      nVendas: resumo.nVendas,
      salesCashCents: resumo.salesCashCents,
      salesCardCents: resumo.salesCardCents,
      cardFeeCents: resumo.cardFeeCents,
      cardNetCents: resumo.cardNetCents,
      salesPixCents: resumo.salesPixCents,
      salesTotalCents: resumo.salesTotalCents,
      openingFloatCents: session.openingFloatCents,
      suprimentoCents: resumo.suprimentoCents,
      sangriaCents: resumo.sangriaCents,
      saldoCaixaCents: resumo.saldoCaixaCents,
    });
    const r = await printTicket(html, "caixa");
    localStorage.setItem(key, String(seq));
    setPrinting(false);
    setMsg(r === "erro" ? "Não consegui imprimir. Confira a impressora em /admin/impressora." : "Leitura X enviada pra impressora.");
  }

  return (
    <Overlay title="Leitura X" onClose={onClose}>
      <p className="text-sm text-[var(--text-muted)]">Espelho do caixa agora. Imprime quantas vezes quiser — <b className="text-ink">não fecha nem zera</b> o caixa (isso é o fechamento).</p>
      {!data ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : (
        <>
          <div className="card divide-y divide-[var(--line)] text-left">
            <Row label="Vendas no caixa" value={`${data.resumo.nVendas} venda${data.resumo.nVendas === 1 ? "" : "s"}`} />
            <Row label="Dinheiro" value={brl(data.resumo.salesCashCents)} />
            {data.resumo.salesCardCents > 0 && <Row label="Cartão (líquido)" value={brl(data.resumo.cardNetCents)} />}
            {data.resumo.salesPixCents > 0 && <Row label="Pix" value={brl(data.resumo.salesPixCents)} />}
            <Row label="Total vendido" value={brl(data.resumo.salesTotalCents)} strong />
            <Row label="Saldo em caixa (gaveta)" value={brl(data.resumo.saldoCaixaCents)} strong tone="ok" />
          </div>
          <button onClick={imprimir} disabled={printing} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
            <IconPrinter width={17} height={17} /> {printing ? "Imprimindo..." : "Imprimir Leitura X"}
          </button>
          {msg && <p className="text-center text-xs font-semibold text-[var(--text-muted)]">{msg}</p>}
        </>
      )}
    </Overlay>
  );
}

function MiniStat({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  const inner = (
    <>
      <div className="text-[9px] font-bold uppercase tracking-wide leading-none text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-sm font-extrabold leading-none tabular-nums text-ink">{value}</div>
      {sub && <div className={`mt-1 text-[9px] font-semibold leading-none ${onClick ? "text-brand-600" : "text-[var(--text-faded)]"}`}>{sub}</div>}
    </>
  );
  return onClick ? <button onClick={onClick} className="text-left">{inner}</button> : <div>{inner}</div>;
}

function IconBtn({ onClick, Icon, title }: { onClick: () => void; Icon: (p: { width?: number; height?: number }) => React.ReactNode; title: string }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-2 transition hover:border-brand-400 hover:text-brand-600">
      <Icon width={16} height={16} />
    </button>
  );
}

/* ---------------- Modais ---------------- */
function MovModal({ type, store, rodape, cashPinSet, onClose, onDone }: { type: "sangria" | "suprimento"; store: StoreHeader; rodape?: string; cashPinSet: boolean; onClose: () => void; onDone: (d?: { session: CashSession | null; resumo: Resumo | null }) => void }) {
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("");
  const [operator, setOperator] = useState("");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const isSangria = type === "sangria";
  const needsPin = isSangria && cashPinSet;

  async function save() {
    const n = Math.round((parseFloat(val) || 0) * 100);
    if (n <= 0) { setErr("Informe um valor."); return; }
    if (isSangria && !operator.trim()) { setErr("Diga quem está retirando."); return; }
    if (needsPin && pin.trim().length < 4) { setErr("Digite o PIN do caixa."); return; }
    setSaving(true); setErr("");
    const r = await fetch("/api/caixa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: type, amountCents: n, reason, operator: operator.trim() || undefined, pin: needsPin ? pin.trim() : undefined }),
    });
    const d = await r.json().catch(() => null);
    if (d && d.ok) {
      // comprovante físico (toggle por-máquina em /admin/impressora; default ligado)
      if (localStorage.getItem("mov:comprovante") !== "0") {
        try {
          await printTicket(movTicketHtml({
            loja: store.name, endereco: store.endereco, cnpj: store.cnpj, tel: store.tel,
            tipo: type, amountCents: n, operator: operator.trim() || undefined, reason: reason.trim() || undefined,
            dateLabel: dmyhm(new Date().toISOString()), saldoCaixaCents: d.resumo?.saldoCaixaCents ?? 0, rodape,
          }), "caixa");
        } catch { /* impressão é best-effort: o movimento já foi salvo */ }
      }
      onDone(d); return; // aplica o resumo autoritativo do POST (sem refetch que corre atrás do write)
    }
    setSaving(false);
    setErr(d?.error || "Não consegui registrar.");
  }

  return (
    <Overlay title={isSangria ? "Sangria (retirada)" : "Suprimento (reforço)"} onClose={onClose}>
      <p className="text-sm text-[var(--text-muted)]">
        {isSangria ? "Retirar dinheiro do caixa (depósito, troco, despesa)." : "Adicionar dinheiro ao caixa (reforço de troco)."}
      </p>
      <div className="flex items-center rounded-xl border border-line bg-bg-base px-3">
        <span className="text-base font-bold text-[var(--text-muted)]">R$</span>
        <input type="number" min={0} step="0.5" value={val} onChange={(e) => setVal(e.target.value)} placeholder="0,00" autoFocus className="w-full bg-transparent px-2 py-3 text-xl font-extrabold text-ink outline-none" />
      </div>
      <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder={isSangria ? "Quem está retirando" : "Quem está fazendo (opcional)"} className="w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm outline-none focus:border-brand-600" />
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (ex: depósito, compra)" className="w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm outline-none focus:border-brand-600" />
      {needsPin && (
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)]">PIN do caixa</label>
          <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••" className="mt-1 w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-brand-600" />
        </div>
      )}
      {err && <p className="rounded-lg bg-[#FEECEC] px-3 py-2 text-center text-sm font-semibold text-[var(--red-no)]">{err}</p>}
      <button onClick={save} disabled={saving} className="mt-1 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
        {saving ? "Salvando..." : isSangria ? "Registrar sangria" : "Registrar suprimento"}
      </button>
    </Overlay>
  );
}

// Trilha de auditoria do caixa aberto: cada sangria/suprimento com operador, motivo e hora.
function MovimentosModal({ movements, onClose }: { movements: CashSession["movements"]; onClose: () => void }) {
  const hm = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <Overlay title="Movimentos do caixa" onClose={onClose}>
      {movements.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhuma sangria ou suprimento ainda.</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {movements.map((m, i) => {
            const sangria = m.type === "sangria";
            return (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${sangria ? "bg-[#FEECEC] text-[var(--red-no)]" : "bg-[#E8F6DD] text-lime"}`}>
                  {sangria ? <IconMinus width={15} height={15} /> : <IconPlus width={15} height={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{sangria ? "Sangria" : "Suprimento"}</span>
                    <span className={`text-sm font-extrabold tabular-nums ${sangria ? "text-[var(--red-no)]" : "text-lime"}`}>{sangria ? "− " : "+ "}{brl(m.amountCents)}</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {hm(m.at)}{m.by ? ` · ${m.by}` : ""}{m.reason ? ` · ${m.reason}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}

function DiffPill({ diff }: { diff: number }) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-2 ${diff === 0 ? "bg-[#E8F6DD]" : "bg-[#FEECEC]"}`}>
      <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: diff === 0 ? "var(--lime)" : "var(--red-no)" }}>
        {diff !== 0 && <IconAlert width={14} height={14} />}
        {diff === 0 ? "Bateu certinho" : diff > 0 ? "Sobra" : "Quebra"}
      </span>
      {diff !== 0 && <span className="font-extrabold" style={{ color: "var(--red-no)" }}>{brl(Math.abs(diff))}</span>}
    </div>
  );
}

function FecharModal({ expected, salesCard, salesPix, cardFee, onClose, onDone }: { expected: number; salesCard: number; salesPix: number; cardFee: number; onClose: () => void; onDone: (s: CashSession) => void }) {
  const [counted, setCounted] = useState("");
  const [cardCounted, setCardCounted] = useState("");
  const [pixCounted, setPixCounted] = useState("");
  const [saving, setSaving] = useState(false);
  const countedCents = Math.round((parseFloat(counted) || 0) * 100);
  const cardCents = Math.round((parseFloat(cardCounted) || 0) * 100);
  const pixCents = Math.round((parseFloat(pixCounted) || 0) * 100);
  const diff = countedCents - expected;
  const cardNet = salesCard - cardFee;

  async function fechar() {
    setSaving(true);
    const r = await fetch("/api/caixa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "fechar",
        countedCents,
        cardCountedCents: salesCard > 0 && cardCounted !== "" ? cardCents : undefined,
        pixCountedCents: salesPix > 0 && pixCounted !== "" ? pixCents : undefined,
      }),
    });
    const d = await r.json();
    if (r.ok) onDone(d.session);
    else setSaving(false);
  }

  return (
    <Overlay title="Fechar caixa" onClose={onClose}>
      {/* DINHEIRO */}
      <div className="flex items-center justify-between rounded-xl bg-bg-surface-2 px-4 py-3">
        <span className="text-sm font-semibold text-[var(--text-muted)]">Esperado na gaveta (dinheiro)</span>
        <span className="text-lg font-extrabold text-ink">{brl(expected)}</span>
      </div>
      <label className="text-xs font-semibold text-[var(--text-muted)]">Dinheiro contado</label>
      <div className="flex items-center rounded-xl border border-line bg-bg-base px-3">
        <span className="text-base font-bold text-[var(--text-muted)]">R$</span>
        <input type="number" min={0} step="0.5" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0,00" autoFocus className="w-full bg-transparent px-2 py-3 text-xl font-extrabold text-ink outline-none" />
      </div>
      {counted !== "" && <DiffPill diff={diff} />}

      {/* CARTÃO */}
      {salesCard > 0 && (
        <div className="mt-2 space-y-1.5 border-t border-line pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[var(--text-muted)]">Cartão (bruto)</span>
            <span className="font-bold text-ink">{brl(salesCard)}</span>
          </div>
          <p className="text-[11px] text-[var(--text-faded)]">taxa maquininha {brl(cardFee)} · líquido a receber {brl(cardNet)}</p>
          <label className="text-xs font-semibold text-[var(--text-muted)]">Cartão conferido (relatório da maquininha)</label>
          <div className="flex items-center rounded-xl border border-line bg-bg-base px-3">
            <span className="text-base font-bold text-[var(--text-muted)]">R$</span>
            <input type="number" min={0} step="0.5" value={cardCounted} onChange={(e) => setCardCounted(e.target.value)} placeholder="0,00" className="w-full bg-transparent px-2 py-2.5 text-lg font-bold text-ink outline-none" />
          </div>
          {cardCounted !== "" && <DiffPill diff={cardCents - salesCard} />}
        </div>
      )}

      {/* PIX */}
      {salesPix > 0 && (
        <div className="mt-2 space-y-1.5 border-t border-line pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[var(--text-muted)]">Pix (esperado)</span>
            <span className="font-bold text-ink">{brl(salesPix)}</span>
          </div>
          <label className="text-xs font-semibold text-[var(--text-muted)]">Pix conferido (extrato)</label>
          <div className="flex items-center rounded-xl border border-line bg-bg-base px-3">
            <span className="text-base font-bold text-[var(--text-muted)]">R$</span>
            <input type="number" min={0} step="0.5" value={pixCounted} onChange={(e) => setPixCounted(e.target.value)} placeholder="0,00" className="w-full bg-transparent px-2 py-2.5 text-lg font-bold text-ink outline-none" />
          </div>
          {pixCounted !== "" && <DiffPill diff={pixCents - salesPix} />}
        </div>
      )}

      <button onClick={fechar} disabled={saving || counted === ""} className="mt-3 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
        {saving ? "Fechando..." : "Confirmar fechamento"}
      </button>
    </Overlay>
  );
}

function FechamentoResultado({ s, onNew }: { s: CashSession; onNew: () => void }) {
  const diff = s.diffCents ?? 0;
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl brand-gradient text-white shadow-[var(--shadow-brand)]">
        <IconCheck width={30} height={30} />
      </div>
      <h2 className="text-xl font-extrabold text-ink">Caixa fechado</h2>
      {s.closedBy && <p className="mt-1 text-sm text-[var(--text-muted)]">por {s.closedBy}</p>}
      <div className="card mt-6 divide-y divide-[var(--line)] text-left">
        <Row label="Fundo de troco" value={brl(s.openingFloatCents)} />
        <Row label="Total vendido (dia)" value={brl(s.salesTotalCents ?? 0)} />
        <Row label="Dinheiro · esperado" value={brl(s.expectedCents ?? 0)} />
        <Row label="Dinheiro · contado" value={brl(s.countedCents ?? 0)} />
        <Row label={diff === 0 ? "Dinheiro · diferença" : diff > 0 ? "Dinheiro · sobra" : "Dinheiro · quebra"} value={brl(Math.abs(diff))} strong tone={diff === 0 ? "ok" : "bad"} />
        {(s.salesCardCents ?? 0) > 0 && (
          <>
            <Row label="Cartão · bruto" value={brl(s.salesCardCents ?? 0)} />
            <Row label="Cartão · taxa maquininha" value={`− ${brl(s.cardFeeCents ?? 0)}`} />
            <Row label="Cartão · líquido a receber" value={brl(s.cardNetCents ?? 0)} />
            {s.cardCountedCents != null && (
              <>
                <Row label="Cartão · conferido (relatório)" value={brl(s.cardCountedCents)} />
                <Row label={(s.cardDiffCents ?? 0) === 0 ? "Cartão · diferença" : (s.cardDiffCents ?? 0) > 0 ? "Cartão · sobra" : "Cartão · quebra"} value={brl(Math.abs(s.cardDiffCents ?? 0))} tone={(s.cardDiffCents ?? 0) === 0 ? "ok" : "bad"} />
              </>
            )}
          </>
        )}
        {(s.salesPixCents ?? 0) > 0 && (
          <>
            <Row label="Pix · esperado" value={brl(s.salesPixCents ?? 0)} />
            {s.pixCountedCents != null && (
              <>
                <Row label="Pix · conferido (extrato)" value={brl(s.pixCountedCents)} />
                <Row label={(s.pixDiffCents ?? 0) === 0 ? "Pix · diferença" : (s.pixDiffCents ?? 0) > 0 ? "Pix · sobra" : "Pix · quebra"} value={brl(Math.abs(s.pixDiffCents ?? 0))} tone={(s.pixDiffCents ?? 0) === 0 ? "ok" : "bad"} />
              </>
            )}
          </>
        )}
      </div>
      <button onClick={onNew} className="mt-6 w-full rounded-2xl brand-gradient py-4 font-bold text-white shadow-[var(--shadow-brand)]">
        Abrir novo caixa
      </button>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "ok" | "bad" }) {
  const color = tone === "ok" ? "var(--lime)" : tone === "bad" ? "var(--red-no)" : "var(--text-primary)";
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-ink-2">{label}</span>
      <span className={strong ? "text-base font-extrabold" : "font-bold text-ink"} style={strong ? { color } : undefined}>{value}</span>
    </div>
  );
}

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md animate-pop rounded-t-3xl bg-bg-elevated p-5 shadow-[var(--shadow-pop)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <h2 className="mb-4 text-lg font-extrabold text-ink">{title}</h2>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}
