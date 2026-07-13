"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitOrQueue } from "@/lib/offline-queue";
import { printTicket } from "@/lib/print";
import { osEntryTicketHtml } from "@/lib/ticket";

const inputCls = "w-full rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

const onlyDigits = (s: string) => s.replace(/\D/g, "");
const fmtCpf = (s: string) => {
  const d = onlyDigits(s).slice(0, 11);
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d;
};

type OSResp = {
  os?: { id: string; code: string | null; customerName: string; customerPhone: string; cpf: string | null; device: string; imei: string | null; problem: string; devicePassword: string | null; createdAt: string };
  store?: { loja: string; cnpj?: string; endereco?: string; tel?: string; rodape?: string };
};

export default function NovaOSButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [f, setF] = useState({ cpf: "", customerName: "", customerPhone: "", device: "", imei: "", devicePassword: "", problem: "", servico: "" });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  // busca cliente recorrente pelo CPF (recepção): acha a OS mais recente e auto-preenche
  async function buscar() {
    const doc = onlyDigits(f.cpf);
    if (doc.length < 3 || looking) return;
    setLooking(true); setErr(""); setInfo("");
    try {
      const r = await fetch(`/api/os?doc=${doc}`, { cache: "no-store" });
      const d = await r.json();
      if (d.found) {
        setF((s) => ({ ...s, customerName: d.found.name || s.customerName, customerPhone: d.found.phone || s.customerPhone }));
        setInfo(`Cliente encontrado: ${d.found.name}`);
      } else {
        setInfo("Cliente novo — preencha os dados.");
      }
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
        code: os.code || os.id.slice(0, 6), dateLabel,
        customerName: os.customerName,
        cpf: os.cpf ? fmtCpf(os.cpf) : undefined,
        phone: os.customerPhone || undefined,
        device: os.device, imei: os.imei || undefined,
        problem: os.problem || undefined,
        devicePassword: os.devicePassword || undefined,
      }));
    } catch { /* impressão nunca trava o check-in */ }
  }

  async function salvar() {
    if (!f.customerName.trim() || !f.device.trim() || saving) return;
    setSaving(true); setErr(""); setInfo("");
    try {
      const nome = f.customerName.trim();
      // online envia direto; offline enfileira (resiliência a quedas) — sync ao reconectar
      const res = await submitOrQueue("/api/os", { action: "create", payload: {
        customerName: nome,
        customerPhone: f.customerPhone.trim() || undefined,
        cpf: onlyDigits(f.cpf) || undefined,
        device: f.device.trim(),
        imei: f.imei.trim() || undefined,
        devicePassword: f.devicePassword.trim() || undefined,
        problem: f.problem.trim() || undefined,
        serviceValueCents: f.servico ? Math.round((parseFloat(f.servico.replace(",", ".")) || 0) * 100) : undefined,
      } }, `Check-in ${nome}`);
      setF({ cpf: "", customerName: "", customerPhone: "", device: "", imei: "", devicePassword: "", problem: "", servico: "" });
      if ("queued" in res) {
        // offline: fica pendente (λ.prova-na-fonte) — avisa sem fechar, o indicador mostra a fila
        setInfo("Sem conexão — o check-in ficou salvo aqui e sobe sozinho quando a internet voltar.");
      } else {
        imprimirEntrada(res.data as OSResp); // imprime o comprovante de entrada 80mm
        setOpen(false); router.refresh();
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao abrir a OS."); }
    finally { setSaving(false); }
  }

  return (
    <>
      <button onClick={() => { setErr(""); setInfo(""); setOpen(true); }} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white">
        + Nova OS
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 lg:items-center" onClick={() => setOpen(false)}>
          <div className="my-8 w-full max-w-md rounded-2xl border border-line bg-bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-ink">Check-in do aparelho</h2>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={f.cpf} onChange={(e) => set("cpf", e.target.value)} onBlur={buscar} inputMode="numeric" placeholder="CPF do cliente" className={`${inputCls} flex-1`} />
                <button onClick={buscar} disabled={looking || onlyDigits(f.cpf).length < 3} className="rounded-xl border border-brand-400 px-3 py-2.5 text-sm font-bold text-brand-600 disabled:opacity-40">
                  {looking ? "..." : "buscar"}
                </button>
              </div>
              <input value={f.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="Cliente *" className={inputCls} />
              <input value={f.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} placeholder="WhatsApp" className={inputCls} />
              <input value={f.device} onChange={(e) => set("device", e.target.value)} placeholder="Aparelho * (ex: iPhone 12, Notebook Acer)" className={inputCls} />
              <input value={f.imei} onChange={(e) => set("imei", e.target.value)} placeholder="IMEI / série" className={`${inputCls} font-mono`} />
              <input value={f.devicePassword} onChange={(e) => set("devicePassword", e.target.value)} placeholder="Senha do aparelho (pra o técnico testar)" className={inputCls} />
              <textarea value={f.problem} onChange={(e) => set("problem", e.target.value)} placeholder="Defeito relatado" rows={2} className={inputCls} />
              <input value={f.servico} onChange={(e) => set("servico", e.target.value)} inputMode="decimal" placeholder="Valor do serviço R$ (opcional)" className={inputCls} />
            </div>
            {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
            {info && <p className="mt-2 rounded-lg bg-gold/10 px-3 py-2 text-xs font-semibold text-gold">{info}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-[var(--text-muted)]">Cancelar</button>
              <button onClick={salvar} disabled={saving || !f.customerName.trim() || !f.device.trim()} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                Abrir OS {saving ? "..." : ""}
              </button>
            </div>
            <p className="mt-3 text-[11px] text-[var(--text-faded)]">Ao abrir a OS, imprime o comprovante de entrada 80mm pro cliente.</p>
          </div>
        </div>
      )}
    </>
  );
}
