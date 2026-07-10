"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";

type PayType = "comissao" | "diaria" | "salario";
type Acerto = { id: string; name: string; commission_percent: number; active: boolean; pay_type: PayType; pay_value_cents: number; comandas: number; vendidoCents: number; comissaoCents: number; gorjetaCents: number; aPagarCents: number; hasLogin: boolean };
const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const inputCls = "rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-600";
const PAY_LABEL: Record<PayType, string> = { comissao: "Comissão", diaria: "Diária", salario: "Salário" };
const reaisToCents = (s: string) => Math.round((parseFloat(s.replace(",", ".")) || 0) * 100);

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

  const reload = useCallback(async () => {
    const r = await fetch("/api/garcons", { cache: "no-store" });
    const d = await r.json();
    setAcerto(d.acerto ?? []);
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
        </Card>
      ))}

      <p className="rounded-xl bg-bg-surface-2 p-3 text-xs text-[var(--text-muted)]">
        A gorjeta (taxa de serviço) é dos trabalhadores — aparece por garçom pra organizar o acerto. Diária/salário: o "A pagar" mostra só a gorjeta; o fixo é acertado à parte (o cálculo de dias/mês entra quando o pagamento fechar). Encargos de folha (13º, FGTS) = contador.
      </p>
    </div>
  );
}
