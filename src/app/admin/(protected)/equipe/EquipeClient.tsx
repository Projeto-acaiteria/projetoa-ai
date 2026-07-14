"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";
import { useConfirm } from "@/components/admin/useConfirm";

type PayType = "comissao" | "diaria" | "salario";
type LoginRole = "technician" | "reception";
type Membro = {
  id: string;
  name: string;
  commission_percent: number;
  active: boolean;
  pay_type: PayType;
  pay_value_cents: number;
  hasLogin: boolean;
  osCount: number;
  servicoCents: number;
  comissaoCents: number;
  pendenteCents: number;
  pendenteCount: number;
  aPagarCents: number;
};

type PendingOS = {
  id: string;
  code: string | null;
  device: string;
  customerName: string;
  paidAt: string | null;
  serviceValueCents: number;
  commissionPercent: number;
  comissaoCents: number;
};
type PaymentRow = {
  id: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalCents: number;
  paidCents: number;
  bonusCents: number;
  bonusReason: string | null;
  notes: string | null;
  osIds: string[];
  paidAt: string;
};

type FixedPayment = { id: string; amountCents: number; periodStart: string | null; periodEnd: string | null; description: string; date: string };
const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const dmy = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const inputCls = "rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-600";
const PAY_LABEL: Record<PayType, string> = { comissao: "Comissão", diaria: "Diária", salario: "Salário" };
const reaisToCents = (s: string) => Math.round((parseFloat(s.replace(",", ".")) || 0) * 100);

export default function EquipeClient() {
  const { ask, confirmDialog } = useConfirm();
  const [acerto, setAcerto] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // período do relatório de comissões (por data de pagamento da OS)
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // novo membro
  const [name, setName] = useState("");
  const [papel, setPapel] = useState<LoginRole>("technician");
  const [fixType, setFixType] = useState<"salario" | "diaria">("salario"); // não-técnico: salário ou diária
  const [value, setValue] = useState(""); // % comissão (técnico) ou R$ salário/diária (recepção)
  // criar acesso (login) inline por membro
  const [accessFor, setAccessFor] = useState<string | null>(null);
  const [accessRole, setAccessRole] = useState<LoginRole>("technician");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  // modal de pagamento de comissão
  const [payFor, setPayFor] = useState<Membro | null>(null);
  const [detail, setDetail] = useState<{ pending: PendingOS[]; payments: PaymentRow[] } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bonus, setBonus] = useState("");
  const [bonusReason, setBonusReason] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payDate, setPayDate] = useState("");
  const [partial, setPartial] = useState(""); // override opcional do valor de comissão pago (parcial)
  // modal de pagamento FIXO (salário/diária) — recepção contratada, ajudante por dia
  const [payFixedFor, setPayFixedFor] = useState<Membro | null>(null);
  const [fixedHistory, setFixedHistory] = useState<FixedPayment[]>([]);
  const [fixedAmount, setFixedAmount] = useState("");
  const [fixedFrom, setFixedFrom] = useState("");
  const [fixedTo, setFixedTo] = useState("");
  const [fixedNote, setFixedNote] = useState("");

  const reload = useCallback(async () => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", `${from}T00:00:00-03:00`);
    if (to) qs.set("to", `${to}T23:59:59-03:00`);
    const r = await fetch(`/api/equipe${qs.toString() ? `?${qs}` : ""}`, { cache: "no-store" });
    const d = await r.json();
    setAcerto(d.acerto ?? []);
    setLoading(false);
  }, [from, to]);
  useEffect(() => { reload(); }, [reload]);

  async function api(action: string, payload: unknown): Promise<boolean> {
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/equipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Não consegui salvar."); return false; }
      await reload();
      return true;
    } finally { setSaving(false); }
  }
  async function add() {
    if (!name.trim()) return;
    // técnico ganha comissão (% sobre o serviço da OS); recepção não tem comissão (salário opcional).
    const payload = papel === "technician"
      ? { name: name.trim(), pay_type: "comissao", commission_percent: parseFloat(value.replace(",", ".")) || 0 }
      : { name: name.trim(), pay_type: fixType, pay_value_cents: reaisToCents(value) };
    if (await api("create", payload)) { setName(""); setValue(""); setPapel("technician"); setFixType("salario"); }
  }

  // pagamento FIXO (salário/diária): abre o modal e carrega o histórico do funcionário
  async function openFixed(m: Membro) {
    setPayFixedFor(m); setFixedHistory([]); setFixedAmount(m.pay_value_cents ? String(m.pay_value_cents / 100).replace(".", ",") : "");
    setFixedFrom(""); setFixedTo(""); setFixedNote(""); setErr("");
    const r = await fetch(`/api/equipe?staff=${m.id}`, { cache: "no-store" });
    const d = await r.json();
    setFixedHistory(d.fixedPayments ?? []);
  }
  async function doPayFixed() {
    if (!payFixedFor) return;
    const ok = await api("payFixed", {
      staffId: payFixedFor.id, staffName: payFixedFor.name, amountCents: reaisToCents(fixedAmount),
      periodStart: fixedFrom || undefined, periodEnd: fixedTo || undefined, note: fixedNote.trim() || undefined,
    });
    if (ok) await openFixed(payFixedFor); // recarrega histórico, mantém o modal aberto
  }
  async function grantAccess(id: string) {
    if (!email.trim() || senha.length < 6) { setErr("Informe email e senha (mín. 6)."); return; }
    if (await api("createAccess", { id, email: email.trim(), senha, role: accessRole })) {
      setAccessFor(null); setEmail(""); setSenha("");
    }
  }

  async function openPay(m: Membro) {
    setPayFor(m); setDetail(null); setSel(new Set()); setBonus(""); setBonusReason(""); setPayNotes(""); setPartial(""); setErr("");
    setPayDate(new Date().toISOString().slice(0, 10));
    const r = await fetch(`/api/equipe?staff=${m.id}`, { cache: "no-store" });
    const d = await r.json();
    const pend: PendingOS[] = d.pending ?? [];
    setDetail({ pending: pend, payments: d.payments ?? [] });
    setSel(new Set(pend.map((o) => o.id))); // pré-seleciona tudo que está pendente
  }
  const selTotalCents = (detail?.pending ?? []).filter((o) => sel.has(o.id)).reduce((s, o) => s + o.comissaoCents, 0);
  function toggleOS(id: string) {
    setSel((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  async function submitPay() {
    if (!payFor) return;
    const osIds = [...sel];
    const bonusCents = reaisToCents(bonus);
    if (osIds.length === 0 && bonusCents === 0) { setErr("Selecione ao menos uma OS ou informe um bônus."); return; }
    const payload: Record<string, unknown> = {
      staffId: payFor.id, osIds, bonusCents,
      bonusReason: bonusReason.trim() || undefined,
      notes: payNotes.trim() || undefined,
      paidAt: payDate ? `${payDate}T12:00:00-03:00` : undefined,
    };
    if (partial.trim()) payload.paidCents = reaisToCents(partial);
    if (await api("payCommission", payload)) setPayFor(null);
  }
  async function reverse(id: string) {
    if (!(await ask({ message: "Estornar este pagamento? As OS voltam a pendente.", danger: true, confirmLabel: "Estornar" }))) return;
    if (await api("reverseCommission", { paymentId: id }) && payFor) openPay(payFor);
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Novo membro da equipe</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do funcionário" className={`${inputCls} flex-1`} />
          <select value={papel} onChange={(e) => { setPapel(e.target.value as LoginRole); setValue(""); }} className={`${inputCls} w-36`}>
            <option value="technician">Técnico</option>
            <option value="reception">Recepção</option>
          </select>
          {papel === "reception" && (
            <select value={fixType} onChange={(e) => setFixType(e.target.value as "salario" | "diaria")} className={`${inputCls} w-32`}>
              <option value="salario">Salário</option>
              <option value="diaria">Diária</option>
            </select>
          )}
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={papel === "technician" ? "Comissão %" : fixType === "diaria" ? "Diária R$ (opc.)" : "Salário R$ (opc.)"} className={`${inputCls} w-40`} />
          <button onClick={add} disabled={saving || !name.trim()} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Adicionar</button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-faded)]">O <b>técnico</b> executa as OS e ganha comissão (% sobre o serviço da OS quitada — peça nunca entra na base). A <b>recepção</b> atende o balcão/vendas e não tem comissão. Esses valores são do Adm — não aparecem pro funcionário. O login (e-mail + senha) leva cada um pra sua área.</p>
      </Card>

      {/* filtro de período do relatório de comissões (por data de pagamento da OS) */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Comissões — de</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full`} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-full`} />
          </div>
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)]">Limpar</button>
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--text-faded)]">Sem período = todas as OS quitadas. A comissão é sobre o serviço (mão de obra) das OS já pagas.</p>
      </Card>

      {err && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</p>}
      {acerto.length === 0 && <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhum membro cadastrado.</Card>}
      {acerto.map((m) => (
        <Card key={m.id} className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-ink">{m.name}</span>
              <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">
                {m.pay_type === "comissao" ? `${m.commission_percent}% comissão` : `${PAY_LABEL[m.pay_type]} ${brl(m.pay_value_cents)}`}
              </span>
              {m.hasLogin
                ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-600">✓ tem acesso</span>
                : <button onClick={() => { setAccessFor(accessFor === m.id ? null : m.id); setAccessRole(m.pay_type === "comissao" ? "technician" : "reception"); setEmail(""); setSenha(""); setErr(""); }} className="rounded-full border border-brand-400 px-2 py-0.5 text-xs font-bold text-brand-600">criar acesso</button>}
              {!m.active && <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-xs text-[var(--text-faded)]">inativo</span>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => api("update", { id: m.id, patch: { active: !m.active } })} disabled={saving} className="text-xs font-bold text-[var(--text-muted)]">{m.active ? "desativar" : "ativar"}</button>
              <button onClick={async () => { if (await ask({ message: `Excluir ${m.name}?`, danger: true, confirmLabel: "Excluir" })) api("delete", { id: m.id }); }} disabled={saving} className="text-xs font-bold text-red-500">excluir</button>
            </div>
          </div>

          {accessFor === m.id && (
            <div className="mt-3 rounded-xl border border-line bg-bg-surface-2 p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Login do funcionário (ele acessa no próprio celular/PC em comandapro.net.br). O papel decide a área: Técnico → bancada / Minha área; Recepção → cockpit de atendimento.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select value={accessRole} onChange={(e) => setAccessRole(e.target.value as LoginRole)} className={`${inputCls} w-36`}>
                  <option value="technician">Técnico</option>
                  <option value="reception">Recepção</option>
                </select>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail de acesso" className={`${inputCls} flex-1`} autoComplete="off" />
                <input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="senha (mín. 6)" className={`${inputCls} w-40`} autoComplete="new-password" />
                <button onClick={() => grantAccess(m.id)} disabled={saving} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Criar acesso</button>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm sm:grid-cols-4">
            <div><div className="text-xs text-[var(--text-muted)]">OS quitadas{(from || to) ? " (período)" : ""}</div><div className="font-bold text-ink">{m.osCount}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">Comissão{(from || to) ? " (período)" : ""}</div><div className="font-bold text-ink">{m.pay_type === "comissao" ? brl(m.comissaoCents) : brl(m.pay_value_cents)}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">Pendente (a pagar)</div><div className="font-extrabold text-[var(--green-ok)]">{brl(m.pendenteCents)}</div></div>
            <div className="flex items-end">
              {m.pay_type === "comissao" ? (
                m.pendenteCents > 0 && <button onClick={() => openPay(m)} disabled={saving} className="w-full rounded-xl brand-gradient px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Registrar pagamento</button>
              ) : (
                <button onClick={() => openFixed(m)} disabled={saving} className="w-full rounded-xl brand-gradient px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Registrar pagamento</button>
              )}
            </div>
          </div>
        </Card>
      ))}

      <p className="rounded-xl bg-bg-surface-2 p-3 text-xs text-[var(--text-muted)]">
        A comissão do técnico nasce só quando a OS é <b>quitada</b> e sempre sobre o valor do <b>serviço</b> (mão de obra) — peça nunca entra na base. Salário/diária (recepção, ajudante) você paga em <b>Registrar pagamento</b> — entra como despesa no Financeiro. Encargos de folha (13º, FGTS) = contador.
      </p>

      {payFor && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={() => setPayFor(null)}>
          <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-ink">Pagar comissão · {payFor.name}</h3>
              <button onClick={() => setPayFor(null)} className="text-xl leading-none text-[var(--text-muted)]">×</button>
            </div>

            {!detail ? (
              <p className="py-6 text-center text-sm text-[var(--text-muted)]">Carregando…</p>
            ) : (
              <>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">OS pendentes ({detail.pending.length})</div>
                {detail.pending.length === 0 ? (
                  <p className="rounded-xl bg-bg-surface-2 p-3 text-sm text-[var(--text-muted)]">Nenhuma OS com comissão pendente. Você ainda pode lançar só um bônus.</p>
                ) : (
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                    {detail.pending.map((o) => (
                      <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-surface-2">
                        <input type="checkbox" checked={sel.has(o.id)} onChange={() => toggleOS(o.id)} className="h-4 w-4 accent-[var(--brand-600)]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink">{o.code ? `${o.code} · ` : ""}{o.device || "Serviço"}</div>
                          <div className="text-xs text-[var(--text-muted)]">{o.customerName} · {dmy(o.paidAt)} · {o.commissionPercent}% de {brl(o.serviceValueCents)}</div>
                        </div>
                        <div className="text-sm font-bold text-ink">{brl(o.comissaoCents)}</div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-brand-600">Comissão selecionada</span>
                  <span className="font-extrabold text-brand-600">{brl(selTotalCents)}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor pago (padrão = total)</label>
                    <input value={partial} onChange={(e) => setPartial(e.target.value)} inputMode="decimal" placeholder={brl(selTotalCents).replace("R$ ", "")} className={`${inputCls} w-full`} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data do pagamento</label>
                    <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={`${inputCls} w-full`} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Bônus R$ (opcional)</label>
                    <input value={bonus} onChange={(e) => setBonus(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${inputCls} w-full`} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Motivo do bônus</label>
                    <input value={bonusReason} onChange={(e) => setBonusReason(e.target.value)} placeholder="ex.: meta batida" className={`${inputCls} w-full`} />
                  </div>
                </div>
                <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Observação (opcional)" className={`${inputCls} mt-2 w-full`} />

                <div className="mt-4 flex gap-2">
                  <button onClick={() => setPayFor(null)} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)]">Cancelar</button>
                  <button onClick={submitPay} disabled={saving} className="flex-1 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Confirmar pagamento</button>
                </div>

                {detail.payments.length > 0 && (
                  <div className="mt-5 border-t border-line pt-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Histórico de pagamentos</div>
                    <div className="space-y-1">
                      {detail.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg-surface-2 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <div className="font-semibold text-ink">
                              {brl(p.paidCents + p.bonusCents)} <span className="text-xs font-normal text-[var(--text-muted)]">· {dmy(p.paidAt)}</span>
                              {p.paidCents < p.totalCents && <span className="ml-1 text-xs font-bold text-amber-600">parcial</span>}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {p.osIds.length} OS{p.bonusCents > 0 ? ` · bônus ${brl(p.bonusCents)}${p.bonusReason ? ` (${p.bonusReason})` : ""}` : ""}
                            </div>
                          </div>
                          <button onClick={() => reverse(p.id)} disabled={saving} className="shrink-0 text-xs font-bold text-red-500">estornar</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de pagamento FIXO (salário/diária) — sem OS, gera despesa "Salários" + histórico */}
      {payFixedFor && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={() => setPayFixedFor(null)}>
          <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-ink">Pagar {PAY_LABEL[payFixedFor.pay_type].toLowerCase()} · {payFixedFor.name}</h3>
              <button onClick={() => setPayFixedFor(null)} className="text-xl leading-none text-[var(--text-muted)]">×</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor pago</label>
                <input value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Período de (opc.)</label>
                <input type="date" value={fixedFrom} onChange={(e) => setFixedFrom(e.target.value)} className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">até (opc.)</label>
                <input type="date" value={fixedTo} onChange={(e) => setFixedTo(e.target.value)} className={`${inputCls} w-full`} />
              </div>
            </div>
            <input value={fixedNote} onChange={(e) => setFixedNote(e.target.value)} placeholder="Observação (ex.: adiantamento, vale)" className={`${inputCls} mt-2 w-full`} />
            <p className="mt-2 text-[11px] text-[var(--text-faded)]">Entra como despesa <b>Salários</b> no Financeiro automaticamente — não lance de novo lá.</p>
            {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}

            <div className="mt-4 flex gap-2">
              <button onClick={() => setPayFixedFor(null)} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)]">Fechar</button>
              <button onClick={doPayFixed} disabled={saving || reaisToCents(fixedAmount) <= 0} className="flex-1 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Registrar pagamento</button>
            </div>

            {fixedHistory.length > 0 && (
              <div className="mt-5 border-t border-line pt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Histórico de pagamentos</div>
                <div className="space-y-1">
                  {fixedHistory.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg-surface-2 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink">{brl(p.amountCents)} <span className="text-xs font-normal text-[var(--text-muted)]">· {dmy(p.date)}</span></div>
                        {p.periodStart && <div className="text-xs text-[var(--text-muted)]">{dmy(p.periodStart)} – {dmy(p.periodEnd)}</div>}
                      </div>
                      <button onClick={async () => { if (await ask({ message: "Estornar este pagamento? A despesa é removida do Financeiro.", danger: true, confirmLabel: "Estornar" })) { await api("reverseFixed", { expenseId: p.id, staffId: payFixedFor.id }); openFixed(payFixedFor); } }} disabled={saving} className="shrink-0 text-xs font-bold text-red-500">estornar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
