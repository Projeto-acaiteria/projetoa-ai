"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/admin/ui";
import {
  filterCompatible, validateBuild, recommendedWattage, estimateWattage,
  isFonteAdequate, isCoolerRequired, isGpuRequired, buildTotalCents, buildStatus,
  BUILD_LABEL, type Build, type BuildItem, type BuildCategory,
} from "@/lib/pc-builder";

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Step = { cat: BuildCategory; hint: string; optional?: (b: Build) => boolean };
const STEPS: Step[] = [
  { cat: "cpu", hint: "O cérebro · define a plataforma" },
  { cat: "cooler", hint: "Opcional se a CPU já vem com cooler", optional: (b) => !isCoolerRequired(b) },
  { cat: "mobo", hint: "Filtrada pelo socket da CPU" },
  { cat: "ram", hint: "Filtrada pelo tipo (DDR4/DDR5) da placa" },
  { cat: "gpu", hint: "Opcional se a CPU tem vídeo integrado", optional: (b) => !isGpuRequired(b) },
  { cat: "ssd", hint: "SSD NVMe é o padrão" },
  { cat: "gabinete", hint: "Compatível com o form-factor da placa" },
  { cat: "fonte", hint: "Wattagem calculada pela build" },
];

export default function MontadorClient({ items }: { items: BuildItem[] }) {
  const router = useRouter();
  const [build, setBuild] = useState<Build>({});
  const [activeStep, setActiveStep] = useState(0);
  const [showIgpu, setShowIgpu] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [customer, setCustomer] = useState("");
  const [feeInput, setFeeInput] = useState("150");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const issues = useMemo(() => validateBuild(build), [build]);
  const errors = issues.filter((i) => i.type === "error");
  const total = buildTotalCents(build);
  const status = buildStatus(build);
  const consumption = estimateWattage(build);
  const minWatts = recommendedWattage(build);
  const ready = status.filled === status.required && errors.length === 0;

  function select(cat: BuildCategory, item: BuildItem) {
    const nb = { ...build, [cat]: item };
    setBuild(nb);
    const idx = STEPS.findIndex((s) => s.cat === cat);
    const next = STEPS[idx + 1];
    if (next) {
      if (next.optional?.(nb) && !nb[next.cat]) {
        if (next.cat === "gpu") setShowIgpu(true);
        else setTimeout(() => setActiveStep(idx + 2), 150);
      } else setTimeout(() => setActiveStep(idx + 1), 150);
    }
  }
  function clear(cat: BuildCategory) {
    setBuild((b) => {
      const n = { ...b };
      const idx = STEPS.findIndex((s) => s.cat === cat);
      for (let i = idx; i < STEPS.length; i++) delete n[STEPS[i].cat];
      return n;
    });
    setActiveStep(STEPS.findIndex((s) => s.cat === cat));
  }

  async function gerarOS() {
    if (!ready || saving) return;
    setSaving(true); setErr("");
    try {
      const parts = STEPS.map((s) => build[s.cat]).filter((x): x is BuildItem => !!x)
        .map((x) => ({ sku: x.id, name: x.name, priceCents: x.sellPriceCents }));
      const fee = Math.round((parseFloat(feeInput.replace(",", ".")) || 0) * 100);
      const r = await fetch("/api/os", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "montagem", payload: { customerName: customer.trim() || "Cliente", montagemFeeCents: fee, parts } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao gerar a OS.");
      router.push("/admin/os");
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao gerar a OS."); }
    finally { setSaving(false); }
  }

  const feeCents = Math.round((parseFloat(feeInput.replace(",", ".")) || 0) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* passos */}
      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const isActive = activeStep === idx;
          const selected = build[step.cat];
          const prevDone = idx === 0 || !!build[STEPS[idx - 1].cat] || !!STEPS[idx - 1].optional?.(build);
          const optional = step.optional?.(build);
          const candidates = filterCompatible(items.filter((p) => p.category === step.cat), build, step.cat);

          return (
            <Card key={step.cat} className={`overflow-hidden p-0 ${isActive ? "border-brand-600" : ""}`}>
              <button type="button" onClick={() => prevDone && setActiveStep(idx)} disabled={!prevDone}
                className={`flex w-full items-center gap-3 p-4 text-left ${prevDone ? "hover:bg-bg-surface-2" : "cursor-not-allowed opacity-40"}`}>
                <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-sm font-bold ${selected ? "bg-[var(--green-ok)]/15 text-[var(--green-ok)]" : isActive ? "brand-gradient text-white" : "bg-bg-surface-2 text-[var(--text-muted)]"}`}>
                  {selected ? "✓" : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{BUILD_LABEL[step.cat]}</span>
                    {optional && !selected && <span className="rounded bg-bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--text-muted)]">opcional</span>}
                  </div>
                  <div className="truncate text-xs text-[var(--text-muted)]">{selected ? `${selected.name} · ${brl(selected.sellPriceCents)}` : step.hint}</div>
                </div>
                {selected && <span onClick={(e) => { e.stopPropagation(); clear(step.cat); }} className="cursor-pointer px-2 text-xs text-[var(--text-muted)] hover:text-red-500">trocar</span>}
              </button>

              {isActive && (
                <div className="space-y-2 border-t border-line p-4">
                  {candidates.length === 0 ? (
                    <div className="py-6 text-center text-sm text-[var(--text-muted)]">Nenhuma opção compatível em estoque · reveja a etapa anterior.</div>
                  ) : candidates.map((p) => {
                    const inadequate = step.cat === "fonte" && !!build.cpu && !isFonteAdequate(p, build);
                    return (
                      <button key={p.id} type="button" disabled={inadequate} onClick={() => !inadequate && select(step.cat, p)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left ${inadequate ? "cursor-not-allowed border-line opacity-50" : "border-line hover:border-brand-600 bg-bg-elevated"}`}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{p.brand}</span>
                            {inadequate && <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-500">Potência insuficiente</span>}
                            {p.specs?.cooler_included === true && <span className="rounded border border-[var(--green-ok)]/30 bg-[var(--green-ok)]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--green-ok)]">Cooler incluído</span>}
                            {p.specs?.igpu === true && <span className="rounded border border-brand-600/30 bg-brand-600/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-600">Vídeo integrado</span>}
                          </div>
                          <div className="text-sm font-semibold leading-snug text-ink">{p.name}</div>
                        </div>
                        <div className="flex-shrink-0 text-right font-mono font-bold text-ink">{brl(p.sellPriceCents)}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* resumo */}
      <aside className="h-fit space-y-4 lg:sticky lg:top-4">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-ink">A build</h3>
            {Object.keys(build).length > 0 && <button onClick={() => { setBuild({}); setActiveStep(0); }} className="text-xs font-bold uppercase text-red-500">↻ Reiniciar</button>}
          </div>
          <div className="text-3xl font-bold tabular-nums text-ink">{brl(total)}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">só peças · a taxa de montagem entra no fim</div>
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-bold uppercase text-[var(--text-muted)]">Status</span>
              <span className="font-mono font-bold text-brand-600">{status.filled}/{status.required}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-surface-2"><div className="h-full brand-gradient transition-all" style={{ width: `${status.percent}%` }} /></div>
          </div>
        </Card>

        {errors.length > 0 && (
          <div className="space-y-2">
            {errors.map((i, k) => <div key={k} className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-ink">{i.message}</div>)}
          </div>
        )}

        {(build.cpu || build.gpu) && (
          <Card className="p-4 text-sm">
            <div className="font-bold uppercase text-[var(--text-muted)] text-xs mb-1">Consumo estimado</div>
            <div className="font-mono text-ink">~{consumption}W · fonte recomendada <span className="text-brand-600">{minWatts}W+</span></div>
          </Card>
        )}

        {!finalizing ? (
          <button onClick={() => ready && setFinalizing(true)} disabled={!ready}
            className="w-full rounded-xl brand-gradient px-6 py-4 text-sm font-bold uppercase text-white disabled:opacity-40 disabled:cursor-not-allowed">
            {ready ? "Gerar OS de montagem" : `Faltam ${status.required - status.filled} componente(s)`}
          </button>
        ) : (
          <Card className="space-y-2 p-4">
            <div className="text-sm font-bold text-ink">Gerar OS de montagem</div>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nome do cliente" className="w-full rounded-xl border border-line bg-bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600" />
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Taxa de montagem (R$)</label>
              <input value={feeInput} onChange={(e) => setFeeInput(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-line bg-bg-elevated px-3 py-2.5 text-sm font-mono text-ink outline-none focus:border-brand-600" />
            </div>
            <div className="flex items-center justify-between border-t border-line pt-2 text-sm">
              <span className="text-[var(--text-muted)]">Total da OS</span>
              <span className="font-mono font-bold text-ink">{brl(total + feeCents)}</span>
            </div>
            {err && <div className="text-xs text-red-500">{err}</div>}
            <div className="flex gap-2">
              <button onClick={() => setFinalizing(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-[var(--text-muted)]">Voltar</button>
              <button onClick={gerarOS} disabled={saving} className="flex-1 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold uppercase text-white disabled:opacity-50">
                {saving ? "Gerando…" : "Confirmar e gerar OS"}
              </button>
            </div>
          </Card>
        )}
      </aside>

      {showIgpu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowIgpu(false)}>
          <Card className="max-w-sm p-6" >
            <h3 className="mb-2 text-lg font-bold text-ink">Precisa de placa de vídeo dedicada?</h3>
            <p className="mb-5 text-sm text-[var(--text-muted)]">O <strong className="text-ink">{build.cpu?.name}</strong> já tem vídeo integrado — roda o dia a dia e jogos leves sem GPU. Pra jogos pesados, escolha uma dedicada.</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowIgpu(false); setActiveStep(STEPS.findIndex((s) => s.cat === "gpu") + 1); }} className="flex-1 rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink">Pular GPU</button>
              <button onClick={() => { setShowIgpu(false); setActiveStep(STEPS.findIndex((s) => s.cat === "gpu")); }} className="flex-1 rounded-xl brand-gradient px-4 py-3 text-sm font-bold uppercase text-white">Escolher GPU</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
