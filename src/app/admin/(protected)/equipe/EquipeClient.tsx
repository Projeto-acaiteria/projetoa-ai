"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";

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
  aPagarCents: number;
};

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const inputCls = "rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-600";
const PAY_LABEL: Record<PayType, string> = { comissao: "Comissão", diaria: "Diária", salario: "Salário" };
const reaisToCents = (s: string) => Math.round((parseFloat(s.replace(",", ".")) || 0) * 100);

export default function EquipeClient() {
  const [acerto, setAcerto] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // período do relatório de comissões (por data de pagamento da OS)
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // novo membro
  const [name, setName] = useState("");
  const [papel, setPapel] = useState<LoginRole>("technician");
  const [value, setValue] = useState(""); // % comissão (técnico) ou R$ salário (recepção)
  // criar acesso (login) inline por membro
  const [accessFor, setAccessFor] = useState<string | null>(null);
  const [accessRole, setAccessRole] = useState<LoginRole>("technician");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");

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
      : { name: name.trim(), pay_type: "salario", pay_value_cents: reaisToCents(value) };
    if (await api("create", payload)) { setName(""); setValue(""); setPapel("technician"); }
  }
  async function grantAccess(id: string) {
    if (!email.trim() || senha.length < 6) { setErr("Informe email e senha (mín. 6)."); return; }
    if (await api("createAccess", { id, email: email.trim(), senha, role: accessRole })) {
      setAccessFor(null); setEmail(""); setSenha("");
    }
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
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={papel === "technician" ? "Comissão %" : "Salário R$ (opc.)"} className={`${inputCls} w-40`} />
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
              <button onClick={() => confirm(`Excluir ${m.name}?`) && api("delete", { id: m.id })} disabled={saving} className="text-xs font-bold text-red-500">excluir</button>
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
            <div><div className="text-xs text-[var(--text-muted)]">OS quitadas</div><div className="font-bold text-ink">{m.osCount}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">Serviço (base)</div><div className="font-bold text-ink">{brl(m.servicoCents)}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">{m.pay_type === "comissao" ? "Comissão" : PAY_LABEL[m.pay_type]}</div><div className="font-bold text-ink">{m.pay_type === "comissao" ? brl(m.comissaoCents) : brl(m.pay_value_cents)}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">A pagar{m.pay_type !== "comissao" ? " (comissão)" : ""}</div><div className="font-extrabold text-[var(--green-ok)]">{brl(m.aPagarCents)}</div></div>
          </div>
        </Card>
      ))}

      <p className="rounded-xl bg-bg-surface-2 p-3 text-xs text-[var(--text-muted)]">
        A comissão do técnico nasce só quando a OS é <b>quitada</b> e sempre sobre o valor do <b>serviço</b> (mão de obra) — peça nunca entra na base. Recepção/salário: o fixo é acertado à parte. Encargos de folha (13º, FGTS) = contador.
      </p>
    </div>
  );
}
