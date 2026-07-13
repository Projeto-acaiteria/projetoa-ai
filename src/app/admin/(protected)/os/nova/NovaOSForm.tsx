"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/admin/ui";
import { submitOrQueue } from "@/lib/offline-queue";
import { printTicket } from "@/lib/print";
import { osEntryTicketHtml } from "@/lib/ticket";
import { OS_PRIORITY_ORDER, OS_PRIORITY_META } from "@/lib/os-priority";

// Check-in de OS em PÁGINA INTEIRA com seções (familiaridade com o GestãoClick), no lugar do modal.
const inputCls = "w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600";
const onlyDigits = (s: string) => s.replace(/\D/g, "");
const fmtCpf = (s: string) => {
  const d = onlyDigits(s).slice(0, 11);
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

type OSResp = {
  os?: { id: string; code: string | null; customerName: string; customerPhone: string; cpf: string | null; device: string; imei: string | null; condicoes: string | null; acessorios: string | null; problem: string; devicePassword: string | null; createdAt: string };
  store?: { loja: string; cnpj?: string; endereco?: string; tel?: string; rodape?: string };
};

export default function NovaOSForm({ tecnicos = [] }: { tecnicos?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [f, setF] = useState({ cpf: "", customerName: "", customerPhone: "", device: "", imei: "", condicoes: "", acessorios: "", devicePassword: "", problem: "", printObs: "", servico: "", staffId: "", priority: "" });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function buscar() {
    const doc = onlyDigits(f.cpf);
    if (doc.length < 3 || looking) return;
    setLooking(true); setErr(""); setInfo("");
    try {
      const r = await fetch(`/api/os?doc=${doc}`, { cache: "no-store" });
      const d = await r.json();
      if (d.found) { setF((s) => ({ ...s, customerName: d.found.name || s.customerName, customerPhone: d.found.phone || s.customerPhone })); setInfo(`Cliente encontrado: ${d.found.name}`); }
      else setInfo("Cliente novo — preencha os dados.");
    } catch { /* busca é best-effort */ }
    finally { setLooking(false); }
  }

  function imprimirEntrada(resp: OSResp) {
    if (typeof window !== "undefined" && localStorage.getItem("autoprint:os") === "0") return;
    const os = resp.os, st = resp.store;
    if (!os || !st) return;
    try {
      const dt = new Date(os.createdAt);
      const p2 = (n: number) => String(n).padStart(2, "0");
      const dateLabel = `${p2(dt.getDate())}/${p2(dt.getMonth() + 1)}/${dt.getFullYear()} ${p2(dt.getHours())}:${p2(dt.getMinutes())}`;
      void printTicket(osEntryTicketHtml({
        loja: st.loja || "", cnpj: st.cnpj, endereco: st.endereco, tel: st.tel, rodape: st.rodape,
        code: os.code || os.id.slice(0, 6), dateLabel, customerName: os.customerName,
        cpf: os.cpf ? fmtCpf(os.cpf) : undefined, phone: os.customerPhone || undefined,
        device: os.device, imei: os.imei || undefined, condicoes: os.condicoes || undefined,
        acessorios: os.acessorios || undefined, problem: os.problem || undefined, devicePassword: os.devicePassword || undefined,
      }));
    } catch { /* impressão nunca trava o check-in */ }
  }

  async function salvar() {
    if (!f.customerName.trim() || !f.device.trim() || saving) return;
    setSaving(true); setErr(""); setInfo("");
    try {
      const nome = f.customerName.trim();
      const res = await submitOrQueue("/api/os", { action: "create", payload: {
        customerName: nome, customerPhone: f.customerPhone.trim() || undefined, cpf: onlyDigits(f.cpf) || undefined,
        device: f.device.trim(), imei: f.imei.trim() || undefined, condicoes: f.condicoes.trim() || undefined,
        acessorios: f.acessorios.trim() || undefined, devicePassword: f.devicePassword.trim() || undefined,
        problem: f.problem.trim() || undefined, printObs: f.printObs.trim() || undefined,
        staffId: f.staffId || undefined,
        priority: f.priority || undefined,
        serviceValueCents: f.servico ? Math.round((parseFloat(f.servico.replace(",", ".")) || 0) * 100) : undefined,
      } }, `Check-in ${nome}`);
      if ("queued" in res) {
        setInfo("Sem conexão — o check-in ficou salvo aqui e sobe sozinho quando a internet voltar.");
        setTimeout(() => router.push("/admin/os"), 1200);
      } else {
        const data = res.data as OSResp;
        imprimirEntrada(data);
        router.push(data.os ? `/admin/os/${data.os.id}` : "/admin/os");
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao abrir a OS."); setSaving(false); }
  }

  return (
    <div className="max-w-3xl space-y-4 pb-24">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Cliente</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CPF do cliente">
            <div className="flex gap-2">
              <input value={f.cpf} onChange={(e) => set("cpf", e.target.value)} onBlur={buscar} inputMode="numeric" placeholder="000.000.000-00" className={inputCls} />
              <button onClick={buscar} disabled={looking || onlyDigits(f.cpf).length < 3} className="shrink-0 rounded-lg border border-brand-400 px-3 text-sm font-bold text-brand-600 disabled:opacity-40">{looking ? "..." : "buscar"}</button>
            </div>
          </Field>
          <Field label="Cliente *"><input value={f.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="Nome do cliente" className={inputCls} /></Field>
          <Field label="WhatsApp"><input value={f.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} placeholder="(00) 00000-0000" className={inputCls} /></Field>
        </div>
        {info && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-600">{info}</p>}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Equipamento</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Aparelho *"><input value={f.device} onChange={(e) => set("device", e.target.value)} placeholder="ex: iPhone 12, Notebook Acer" className={inputCls} /></Field>
          <Field label="IMEI / série"><input value={f.imei} onChange={(e) => set("imei", e.target.value)} placeholder="número de série" className={`${inputCls} font-mono`} /></Field>
          <Field label="Condições na entrada"><textarea value={f.condicoes} onChange={(e) => set("condicoes", e.target.value)} rows={2} placeholder="ex: tela trincada, riscos na tampa" className={inputCls} /></Field>
          <Field label="Acessórios entregues"><textarea value={f.acessorios} onChange={(e) => set("acessorios", e.target.value)} rows={2} placeholder="carregador, cabo, capa…" className={inputCls} /></Field>
          <Field label="Senha do aparelho"><input value={f.devicePassword} onChange={(e) => set("devicePassword", e.target.value)} placeholder="pra o técnico testar" className={inputCls} /></Field>
          <Field label="Defeito relatado"><textarea value={f.problem} onChange={(e) => set("problem", e.target.value)} rows={2} placeholder="o que o cliente relatou" className={inputCls} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Serviço</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Técnico (opcional)">
            <select value={f.staffId} onChange={(e) => set("staffId", e.target.value)} className={inputCls}>
              <option value="">Atribuir depois</option>
              {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Prioridade">
            <select value={f.priority} onChange={(e) => set("priority", e.target.value)} className={inputCls}>
              <option value="">Normal</option>
              {OS_PRIORITY_ORDER.map((k) => <option key={k} value={k}>{OS_PRIORITY_META[k].label}</option>)}
            </select>
          </Field>
          <Field label="Valor do serviço R$ (opcional)"><input value={f.servico} onChange={(e) => set("servico", e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls} /></Field>
          <Field label="Observações (saem no documento)"><textarea value={f.printObs} onChange={(e) => set("printObs", e.target.value)} rows={2} placeholder="Ex: retirar até sexta · cliente autorizou troca" className={inputCls} /></Field>
        </div>
        <p className="mt-2 text-xs text-[var(--text-faded)]">Ao abrir a OS, imprime o comprovante de entrada 80mm pro cliente.</p>
      </Card>

      {err && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</p>}

      {/* barra de ações fixa no rodapé */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-surface/95 px-4 py-3 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Link href="/admin/os" className="flex-1 rounded-xl border border-line px-4 py-2.5 text-center text-sm font-bold text-[var(--text-muted)]">Cancelar</Link>
          <button onClick={salvar} disabled={saving || !f.customerName.trim() || !f.device.trim()} className="flex-[2] rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Abrindo…" : "Abrir OS"}</button>
        </div>
      </div>
    </div>
  );
}
