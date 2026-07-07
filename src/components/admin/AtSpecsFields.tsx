"use client";

import { specFieldsFor, type SpecField } from "@/config/at-specs";
import type { StockCategory } from "@/lib/stock-store";

type SpecValue = string | number | boolean | string[];
type Specs = Record<string, SpecValue>;

// Campos de SPEC guiados pelo contrato do vertical AT (config/at-specs). Renderiza o input certo
// por tipo. O montador do site depende dessas chaves — o form garante que entrem preenchidas.
export default function AtSpecsFields({ category, value, onChange }: {
  category: StockCategory; value: Specs; onChange: (s: Specs) => void;
}) {
  const fields = specFieldsFor(category);
  if (fields.length === 0) return null;

  const set = (k: string, v: SpecValue | undefined) => {
    const next = { ...value };
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[k];
    else next[k] = v;
    onChange(next);
  };

  const inp = "w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-sm text-ink outline-none focus:border-brand-600";

  return (
    <div className="rounded-xl border border-gold/40 bg-gold/5 p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gold">Specs técnicas · {category} <span className="text-[var(--text-faded)]">(o montador do site usa isto)</span></div>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <Field key={f.key} f={f} value={value[f.key]} onChange={(v) => set(f.key, v)} inp={inp} />
        ))}
      </div>
    </div>
  );
}

function Field({ f, value, onChange, inp }: { f: SpecField; value: SpecValue | undefined; onChange: (v: SpecValue | undefined) => void; inp: string }) {
  const label = <label className="text-[11px] font-semibold text-[var(--text-muted)]">{f.label}{f.unit ? ` (${f.unit})` : ""}</label>;

  if (f.type === "boolean") {
    return (
      <label className="col-span-1 flex items-center gap-2 rounded-lg border border-line bg-bg-base px-3 py-2">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked ? true : undefined)} />
        <span className="text-sm text-ink">{f.label}</span>
      </label>
    );
  }
  if (f.type === "select") {
    return (
      <div>{label}
        <select className={`${inp} mt-0.5`} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (f.type === "multiselect") {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (o: string) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
    return (
      <div className="col-span-2">{label}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {f.options?.map((o) => (
            <button key={o} type="button" onClick={() => toggle(o)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${arr.includes(o) ? "border-brand-600 bg-brand-600/10 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>{o}</button>
          ))}
        </div>
      </div>
    );
  }
  // text | number
  return (
    <div>{label}
      <input className={`${inp} mt-0.5`} type={f.type === "number" ? "number" : "text"} value={value === undefined ? "" : String(value)}
        placeholder={f.hint} min={f.type === "number" ? 0 : undefined}
        onChange={(e) => onChange(f.type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : (e.target.value || undefined))} />
    </div>
  );
}
