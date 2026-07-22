"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";

type PayType = "comissao" | "diaria" | "salario";
type Acerto = { id: string; name: string; commission_percent: number; active: boolean; pay_type: PayType; pay_value_cents: number; comandas: number; vendidoCents: number; comissaoCents: number; gorjetaCents: number; aPagarCents: number; hasLogin: boolean };
const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const inputCls = "rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-600";
const PAY_LABEL: Record<PayType, string> = { comissao: "Comissão", diaria: "Diária", salario: "Salário" };
const reaisToCents = (s: string) => Math.round((parseFloat(s.replace(",", ".")) || 0) * 100);
// PRESENÇA/DIÁRIA (mt-33): o garçom bate ponto ao logar; o Adm ajusta valor e bônus da noite.
type Shift = { id: number; staffId: string; name: string; noite: string; diariaCents: number; bonusCents: number; source: string; checkedInAt: string };
type Taxa = { totalCents: number; porNoite: { noite: string; cents: number }[] };
const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const hojeBR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export default function GarconsClient() {
  const [acerto, setAcerto] = useState<Acerto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [payType, setPayType] = useState<PayType>("comissao");
  const [value, setValue] = useState(""); // % se comissão, R$ se diária/salário
  // criar acesso (login) inline por garçom
  const [accessFor, setAccessFor] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [taxa, setTaxa] = useState<Taxa>({ totalCents: 0, porNoite: [] });
  const [openDias, setOpenDias] = useState<string | null>(null); // garçom com as noites abertas
  const [verTaxa, setVerTaxa] = useState(false);
  const [novaNoite, setNovaNoite] = useState(hojeBR());

  const reload = useCallback(async () => {
    const r = await fetch("/api/garcons", { cache: "no-store" });
    const d = await r.json();
    setAcerto(d.acerto ?? []);
    setShifts(d.shifts ?? []);
    setTaxa(d.taxa ?? { totalCents: 0, porNoite: [] });
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function api(action: string, payload: unknown): Promise<boolean> {
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/garcons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Não consegui salvar."); return false; }
      await reload();
      return true;
    } finally { setSaving(false); }
  }
  async function add() {
    if (!name.trim()) return;
    const payload = payType === "comissao"
      ? { name: name.trim(), pay_type: "comissao", commission_percent: parseFloat(value.replace(",", ".")) || 0 }
      : { name: name.trim(), pay_type: payType, pay_value_cents: reaisToCents(value) };
    if (await api("create", payload)) { setName(""); setValue(""); setPayType("comissao"); }
  }
  async function grantAccess(id: string) {
    if (!email.trim() || senha.length < 6) { setErr("Informe email e senha (mín. 6)."); return; }
    if (await api("createAccess", { id, email: email.trim(), senha })) { setAccessFor(null); setEmail(""); setSenha(""); }
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Novo garçom</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do garçom" className={`${inputCls} flex-1`} />
          <select value={payType} onChange={(e) => { setPayType(e.target.value as PayType); setValue(""); }} className={`${inputCls} w-32`}>
            <option value="comissao">Comissão</option>
            <option value="diaria">Diária</option>
            <option value="salario">Salário</option>
          </select>
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={payType === "comissao" ? "Comissão %" : payType === "diaria" ? "Diária R$" : "Salário R$"} className={`${inputCls} w-32`} />
          <button onClick={add} disabled={saving || !name.trim()} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Adicionar</button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-faded)]">O modelo (comissão / diária / salário) é escolha da casa. A gorjeta (taxa de serviço) é somada à parte, por comanda atendida. Esses valores são do Adm — não aparecem pro garçom.</p>
      </Card>

      {/* 10% RECEBIDO — a gorjeta fica no financeiro da casa; esta visão existe pra saberem quanto
          entrou antes de decidir quanto repassar (decisão interna, não rateio automático). */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Taxa de serviço 10% recebida</h3>
            <p className="text-xs text-[var(--text-muted)]">Últimos 30 dias · fica no caixa da casa</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold tabular-nums text-ink">{brl(taxa.totalCents)}</div>
            {taxa.porNoite.length > 0 && (
              <button onClick={() => setVerTaxa(!verTaxa)} className="text-xs font-bold text-brand-600">
                {verTaxa ? "ocultar" : `ver ${taxa.porNoite.length} noite${taxa.porNoite.length === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        </div>
        {verTaxa && (
          <div className="mt-3 divide-y divide-[var(--line)] border-t border-line pt-1">
            {taxa.porNoite.map((n) => (
              <div key={n.noite} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-[var(--text-muted)]">Noite de {ddmm(n.noite)}</span>
                <span className="font-bold tabular-nums text-ink">{brl(n.cents)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--text-faded)]">Quanto desse valor vai pro garçom é decisão interna da casa — o sistema não rateia sozinho.</p>
      </Card>

      {err && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</p>}
      {acerto.length === 0 && <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhum garçom cadastrado.</Card>}
      {acerto.map((g) => (
        <Card key={g.id} className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-ink">{g.name}</span>
              <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">
                {g.pay_type === "comissao" ? `${g.commission_percent}% comissão` : `${PAY_LABEL[g.pay_type]} ${brl(g.pay_value_cents)}`}
              </span>
              {g.hasLogin
                ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-600">✓ tem acesso</span>
                : <button onClick={() => { setAccessFor(accessFor === g.id ? null : g.id); setEmail(""); setSenha(""); setErr(""); }} className="rounded-full border border-brand-400 px-2 py-0.5 text-xs font-bold text-brand-600">criar acesso</button>}
              {!g.active && <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-xs text-[var(--text-faded)]">inativo</span>}
            </div>
            <button onClick={() => confirm(`Excluir ${g.name}?`) && api("delete", { id: g.id })} disabled={saving} className="text-xs font-bold text-red-500">excluir</button>
          </div>

          {accessFor === g.id && (
            <div className="mt-3 rounded-xl border border-line bg-bg-surface-2 p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Login do garçom (ele acessa no próprio celular em comandapro.net.br)</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email de acesso (ex: garcom@bar.com)" className={`${inputCls} flex-1`} autoComplete="off" />
                <input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="senha (mín. 6)" className={`${inputCls} w-40`} autoComplete="new-password" />
                <button onClick={() => grantAccess(g.id)} disabled={saving} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Criar acesso</button>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm sm:grid-cols-5">
            <div><div className="text-xs text-[var(--text-muted)]">Comandas</div><div className="font-bold text-ink">{g.comandas}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">Vendido</div><div className="font-bold text-ink">{brl(g.vendidoCents)}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">{g.pay_type === "comissao" ? "Comissão" : PAY_LABEL[g.pay_type]}</div><div className="font-bold text-ink">{g.pay_type === "comissao" ? brl(g.comissaoCents) : brl(g.pay_value_cents)}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">Gorjeta</div><div className="font-bold text-ink">{brl(g.gorjetaCents)}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">A pagar{g.pay_type !== "comissao" ? " (gorjeta)" : ""}</div><div className="font-extrabold text-[var(--green-ok)]">{brl(g.aPagarCents)}</div></div>
          </div>

          {/* DIÁRIAS — dias trabalhados (check-in no login do garçom) × diária + bônus */}
          {g.pay_type === "diaria" && (() => {
            const meus = shifts.filter((s) => s.staffId === g.id);
            const totDiaria = meus.reduce((s, x) => s + x.diariaCents, 0);
            const totBonus = meus.reduce((s, x) => s + x.bonusCents, 0);
            const aberto = openDias === g.id;
            return (
              <div className="mt-3 rounded-xl border border-line bg-bg-surface-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <b className="text-ink">{meus.length}</b> <span className="text-[var(--text-muted)]">dia{meus.length === 1 ? "" : "s"} trabalhado{meus.length === 1 ? "" : "s"} · diárias <b className="text-ink">{brl(totDiaria)}</b>{totBonus > 0 && <> · bônus <b className="text-ink">{brl(totBonus)}</b></>}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-[var(--green-ok)]">{brl(totDiaria + totBonus)}</span>
                    <button onClick={() => setOpenDias(aberto ? null : g.id)} className="text-xs font-bold text-brand-600">{aberto ? "ocultar" : "ver noites"}</button>
                  </div>
                </div>

                {aberto && (
                  <div className="mt-3 border-t border-line pt-2">
                    {meus.length === 0 && <p className="py-2 text-xs text-[var(--text-muted)]">Nenhuma presença ainda. O garçom bate ponto sozinho ao entrar no sistema — ou lance na mão abaixo.</p>}
                    {meus.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] py-2 last:border-0">
                        <span className="w-16 text-sm font-bold text-ink">{ddmm(s.noite)}</span>
                        <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold text-[var(--text-faded)]">{s.source === "login" ? "check-in" : "manual"}</span>
                        <label className="flex items-center gap-1 text-xs text-[var(--text-muted)]">diária R$
                          <input defaultValue={(s.diariaCents / 100).toFixed(2)} inputMode="decimal" onBlur={(e) => api("shiftUpdate", { id: s.id, diariaCents: reaisToCents(e.target.value) })}
                            className="w-20 rounded-lg border border-line bg-bg-elevated px-2 py-1 text-right text-sm font-bold text-ink outline-none focus:border-brand-600" />
                        </label>
                        <label className="flex items-center gap-1 text-xs text-[var(--text-muted)]">bônus R$
                          <input defaultValue={(s.bonusCents / 100).toFixed(2)} inputMode="decimal" onBlur={(e) => api("shiftUpdate", { id: s.id, bonusCents: reaisToCents(e.target.value) })}
                            className="w-20 rounded-lg border border-line bg-bg-elevated px-2 py-1 text-right text-sm font-bold text-ink outline-none focus:border-brand-600" />
                        </label>
                        <button onClick={() => api("shiftRemove", { id: s.id })} disabled={saving} className="ml-auto text-xs font-bold text-red-500">remover</button>
                      </div>
                    ))}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="date" value={novaNoite} onChange={(e) => setNovaNoite(e.target.value)} className="rounded-lg border border-line bg-bg-elevated px-2 py-1.5 text-sm text-ink outline-none" />
                      <button onClick={() => api("shiftAdd", { staffId: g.id, noite: novaNoite })} disabled={saving} className="rounded-lg border border-brand-400 px-3 py-1.5 text-xs font-bold text-brand-600 disabled:opacity-50">Lançar presença</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      ))}

      <p className="rounded-xl bg-bg-surface-2 p-3 text-xs text-[var(--text-muted)]">
        <b>Diária:</b> o garçom bate ponto sozinho ao entrar no sistema (1 registro por noite, das 6h às 6h). O Adm ajusta o valor da noite e o bônus — o valor cadastrado entra como padrão, e mexer nele depois não altera noite já trabalhada. Dá pra lançar presença na mão se ele trabalhou sem logar.
        <br />A <b>taxa de serviço (10%)</b> fica no caixa da casa; o card acima mostra quanto entrou pra vocês decidirem o repasse. Encargos de folha (13º, FGTS) = contador.
      </p>
    </div>
  );
}
