"use client";

import { useEffect, useState, useCallback } from "react";
import { brl } from "@/lib/format";
import type { Size, ModifierGroup } from "@/lib/menu";
import type { CashSession } from "@/lib/cash-store";
import type { Customer } from "@/lib/customers-store";
import { nextReward } from "@/lib/loyalty";
import PDV, { type Fees } from "@/components/admin/PDV";
import type { CardMachine } from "@/lib/settings-store";
import { IconWallet, IconCheck, IconArrowRight, IconClock, IconPlus, IconMinus, IconAlert, IconStar } from "@/components/Icons";

type Produto = { id: string; name: string; priceCents: number; qty: number; unit: string };
type Resumo = { salesCashCents: number; salesTotalCents: number; salesCardCents: number; salesPixCents: number; cardFeeCents: number; cardNetCents: number; suprimentoCents: number; sangriaCents: number; saldoCaixaCents: number; nVendas: number };

const hhmm = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function CaixaClient({ sizes, groups, produtos, fees, storeName, machines, endereco, cnpj, tel, showPdv, pricePerKgCents }: { sizes: Size[]; groups: ModifierGroup[]; produtos: Produto[]; fees: Fees; storeName: string; machines: CardMachine[]; endereco: string; cnpj: string; tel: string; showPdv: boolean; pricePerKgCents: number }) {
  const [session, setSession] = useState<CashSession | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [closeResult, setCloseResult] = useState<CashSession | null>(null);

  const load = useCallback(async () => {
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

  return (
    <div className="space-y-5">
      <PainelCaixa session={session} resumo={resumo!} onChanged={load} onClosed={(s) => setCloseResult(s)} />
      {showPdv && <PDV sizes={sizes} groups={groups} produtos={produtos} fees={fees} storeName={storeName} machines={machines} endereco={endereco} cnpj={cnpj} tel={tel} pricePerKgCents={pricePerKgCents} onSold={load} />}
      {!showPdv && <p className="card p-4 text-center text-sm text-[var(--text-muted)]">Pra vender, use o <b className="text-ink">Balcão</b> ou as <b className="text-ink">Mesas</b>. Aqui é a gestão do caixa (abrir, sangria, suprimento e fechamento).</p>}
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
function PainelCaixa({ session, resumo, onChanged, onClosed }: { session: CashSession; resumo: Resumo; onChanged: () => void; onClosed: (s: CashSession) => void }) {
  const [modal, setModal] = useState<null | "sangria" | "suprimento" | "fechar" | "consulta" | "historico">(null);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-lime">
            <span className="h-2 w-2 rounded-full bg-lime" /> Caixa aberto
            <span className="font-semibold text-[var(--text-muted)]"><IconClock width={12} height={12} className="mb-0.5 inline" /> desde {hhmm(session.openedAt)}</span>
          </div>
          <div className="mt-1 text-3xl font-extrabold text-ink">{brl(resumo.saldoCaixaCents)}</div>
          <div className="text-xs font-semibold text-[var(--text-muted)]">em caixa agora</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal("consulta")} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2.5 text-sm font-bold text-brand-600">
            <IconStar width={15} height={15} /> Consultar pontos
          </button>
          <button onClick={() => setModal("historico")} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2.5 text-sm font-bold text-ink">
            <IconClock width={15} height={15} /> Histórico
          </button>
          <button onClick={() => setModal("suprimento")} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2.5 text-sm font-bold text-ink">
            <IconPlus width={15} height={15} /> Suprimento
          </button>
          <button onClick={() => setModal("sangria")} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2.5 text-sm font-bold text-ink">
            <IconMinus width={15} height={15} /> Sangria
          </button>
          <button onClick={() => setModal("fechar")} className="inline-flex items-center gap-1.5 rounded-xl brand-gradient px-3.5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]">
            <IconCheck width={15} height={15} /> Fechar caixa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-line bg-[var(--line)] sm:grid-cols-4">
        <Stat label="Vendas (dinheiro)" value={brl(resumo.salesCashCents)} />
        <Stat label="Total vendido" value={brl(resumo.salesTotalCents)} sub={`${resumo.nVendas} venda${resumo.nVendas === 1 ? "" : "s"}`} />
        <Stat label="Fundo de troco" value={brl(session.openingFloatCents)} />
        <Stat label="Sangrias / supr." value={`${brl(resumo.sangriaCents)} / ${brl(resumo.suprimentoCents)}`} />
      </div>

      {modal === "sangria" && <MovModal type="sangria" onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />}
      {modal === "suprimento" && <MovModal type="suprimento" onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />}
      {modal === "fechar" && <FecharModal expected={resumo.saldoCaixaCents} salesCard={resumo.salesCardCents} salesPix={resumo.salesPixCents} cardFee={resumo.cardFeeCents} onClose={() => setModal(null)} onDone={onClosed} />}
      {modal === "consulta" && <ConsultaModal onClose={() => setModal(null)} />}
      {modal === "historico" && <HistoricoModal onClose={() => setModal(null)} />}
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-bg-elevated px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 text-base font-extrabold text-ink">{value}</div>
      {sub && <div className="text-[11px] font-semibold text-[var(--text-faded)]">{sub}</div>}
    </div>
  );
}

/* ---------------- Modais ---------------- */
function MovModal({ type, onClose, onDone }: { type: "sangria" | "suprimento"; onClose: () => void; onDone: () => void }) {
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const isSangria = type === "sangria";

  async function save() {
    const n = Math.round((parseFloat(val) || 0) * 100);
    if (n <= 0) return;
    setSaving(true);
    await fetch("/api/caixa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: type, amountCents: n, reason }),
    });
    onDone();
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
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (ex: depósito, compra)" className="w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm outline-none focus:border-brand-600" />
      <button onClick={save} disabled={saving} className="mt-1 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
        {saving ? "Salvando..." : isSangria ? "Registrar sangria" : "Registrar suprimento"}
      </button>
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
              <Row label={(s.cardDiffCents ?? 0) === 0 ? "Cartão · conferido (bateu)" : (s.cardDiffCents ?? 0) > 0 ? "Cartão · sobra" : "Cartão · quebra"} value={brl(Math.abs(s.cardDiffCents ?? 0))} tone={(s.cardDiffCents ?? 0) === 0 ? "ok" : "bad"} />
            )}
          </>
        )}
        {(s.salesPixCents ?? 0) > 0 && (
          <>
            <Row label="Pix · esperado" value={brl(s.salesPixCents ?? 0)} />
            {s.pixCountedCents != null && (
              <Row label={(s.pixDiffCents ?? 0) === 0 ? "Pix · conferido (bateu)" : (s.pixDiffCents ?? 0) > 0 ? "Pix · sobra" : "Pix · quebra"} value={brl(Math.abs(s.pixDiffCents ?? 0))} tone={(s.pixDiffCents ?? 0) === 0 ? "ok" : "bad"} />
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
