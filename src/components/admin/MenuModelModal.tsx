"use client";

import { useMemo, useRef, useState } from "react";
import type { MenuModel, ModelGroup } from "@/config/menu-models";
import { modelImage, PICKER_GROUPS } from "@/config/image-bank";
import { compressImage } from "@/lib/compress-image";

// MONTADOR de cardápio a partir do modelo do segmento. Editor completo: o dono adiciona/renomeia/
// remove produtos, sabores e faixas (que ele nomeia e precifica), escolhe a FOTO (banco/upload),
// troca a estação (cozinha/bar), e cria tudo em lote. Modelo = ponto de partida editável.
const centsToStr = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const strToCents = (s: string) => Math.max(0, Math.round((parseFloat(String(s).replace(",", ".")) || 0) * 100));

type DFlavor = { name: string };
type DTier = { name: string; price: string; flavors: DFlavor[] };
type DOption = { name: string; price: string };
type DGroup = { title: string; min_select?: number; max_select?: number; free_up_to?: number; price_mode?: ModelGroup["price_mode"]; kind: "tier" | "option"; tiers: DTier[]; options: DOption[] };
type DProduct = { on: boolean; name: string; size_label?: string; img: string; price: string; groups: DGroup[] };
type DCat = { on: boolean; name: string; station: "cozinha" | "bar"; no_prep?: boolean; products: DProduct[] };

function toDraft(model: MenuModel): DCat[] {
  return model.categories.map((c) => ({
    on: true, name: c.name, station: c.station === "bar" ? "bar" : "cozinha", no_prep: c.no_prep,
    products: c.products.map((p) => ({
      on: true, name: p.name, size_label: p.size_label, img: p.img || modelImage(p.img_key), price: centsToStr(p.price_cents),
      groups: (p.groups ?? []).map((g): DGroup => ({
        title: g.title, min_select: g.min_select, max_select: g.max_select, free_up_to: g.free_up_to, price_mode: g.price_mode,
        kind: g.tiers?.length ? "tier" : "option",
        tiers: (g.tiers ?? []).map((t) => ({ name: t.name, price: centsToStr(t.price_cents), flavors: t.flavors.map((f) => ({ name: f })) })),
        options: (g.options ?? []).map((o) => ({ name: o.name, price: centsToStr(o.price_cents) })),
      })),
    })),
  }));
}

export default function MenuModelModal({ model, onClose, onApplied }: {
  model: MenuModel; onClose: () => void; onApplied: (r: { categories: number; products: number }) => void;
}) {
  const [draft, setDraft] = useState<DCat[]>(() => toDraft(model));
  const [picker, setPicker] = useState<string | null>(null); // "ci:pi" do produto com picker aberto
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const upTarget = useRef<[number, number] | null>(null);
  const edit = (fn: (d: DCat[]) => void) => setDraft((prev) => { const d = structuredClone(prev); fn(d); return d; });

  async function onFile(f: File) {
    const t = upTarget.current; if (!t) return;
    const c = await compressImage(f);
    if (!c.ok) { setErr(c.reason); return; }
    const fd = new FormData(); fd.append("file", c.file);
    const r = await fetch("/api/upload-foto", { method: "POST", body: fd });
    const d = await r.json();
    if (r.ok) { edit((dr) => { dr[t[0]].products[t[1]].img = d.url; }); setPicker(null); }
    else setErr(d.error || "Falha no upload");
  }

  const built = useMemo<MenuModel>(() => ({
    segment: model.segment, label: model.label,
    categories: draft.filter((c) => c.on && c.name.trim()).map((c) => ({
      name: c.name.trim(), station: c.station, no_prep: c.no_prep,
      products: c.products.filter((p) => p.on && p.name.trim()).map((p) => ({
        name: p.name.trim(), price_cents: p.groups.length ? 0 : strToCents(p.price), size_label: p.size_label, img: p.img || undefined,
        groups: p.groups.map((g): ModelGroup | null => {
          if (g.kind === "tier") {
            const tiers = g.tiers.filter((t) => t.name.trim() && t.flavors.some((f) => f.name.trim()))
              .map((t) => ({ name: t.name.trim(), price_cents: strToCents(t.price), flavors: t.flavors.map((f) => f.name.trim()).filter(Boolean) }));
            return tiers.length ? { title: g.title.trim() || "Sabores", min_select: g.min_select, max_select: g.max_select, free_up_to: g.free_up_to, price_mode: g.price_mode, tiers } : null;
          }
          const options = g.options.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), price_cents: strToCents(o.price) }));
          return options.length ? { title: g.title.trim() || "Opções", min_select: g.min_select, max_select: g.max_select, free_up_to: g.free_up_to, price_mode: g.price_mode, options } : null;
        }).filter((g): g is ModelGroup => !!g),
      })).filter((p) => p.name),
    })).filter((c) => c.products.length),
  }), [model, draft]);

  const totalProd = built.categories.reduce((n, c) => n + c.products.length, 0);

  async function criar() {
    if (!totalProd) return;
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/cardapio-bar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "model.apply", payload: { model: built } }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao criar");
      onApplied({ categories: d.categories, products: d.products });
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao criar"); } finally { setSaving(false); }
  }

  const nameInp = "min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-sm font-semibold text-ink outline-none focus:bg-bg-surface-2";
  const price = (v: string, on: (s: string) => void, w = "w-16") => (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-bg-elevated px-2 py-1"><span className="text-[11px] font-bold text-[var(--text-muted)]">R$</span><input value={v} onChange={(e) => on(e.target.value)} inputMode="decimal" className={`${w} bg-transparent text-right text-sm font-semibold text-ink outline-none`} /></span>
  );
  const addBtn = "rounded-lg border border-dashed border-line px-2.5 py-1 text-xs font-bold text-[var(--brand-600)] hover:bg-bg-surface-2";
  const xBtn = "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--text-faded)] transition hover:bg-red-500/10 hover:text-red-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-bg-elevated shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-lg font-extrabold text-ink">Monte o cardápio da sua {model.label}</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Vem preenchido pra você editar — <b>troque a foto, adicione seus sabores, ajuste os preços</b> (referência de mercado). Remova o que não vende.</p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto bg-bg-surface-2/40 px-5 py-4">
          {draft.map((cat, ci) => (
            <section key={ci} className={`overflow-hidden rounded-2xl border border-line bg-bg-elevated ${cat.on ? "" : "opacity-45"}`}>
              <header className="flex items-center gap-2 border-b border-line bg-bg-surface-2 px-3 py-2.5">
                <input type="checkbox" checked={cat.on} onChange={() => edit((d) => { d[ci].on = !d[ci].on; })} className="h-4 w-4 accent-[var(--brand-600)]" />
                <input value={cat.name} onChange={(e) => edit((d) => { d[ci].name = e.target.value; })} className={`${nameInp} font-extrabold`} />
                <div className="flex shrink-0 overflow-hidden rounded-lg border border-line text-[11px] font-bold">
                  {(["cozinha", "bar"] as const).map((st) => (
                    <button key={st} type="button" onClick={() => edit((d) => { d[ci].station = st; })} className={`px-2.5 py-1 uppercase tracking-wide transition ${cat.station === st ? "bg-[var(--brand-600)] text-white" : "text-[var(--text-muted)]"}`}>{st}</button>
                  ))}
                </div>
                <button type="button" onClick={() => edit((d) => { d.splice(ci, 1); })} className={xBtn} title="Remover categoria">✕</button>
              </header>

              {cat.on && (
                <div className="space-y-2.5 p-3">
                  {cat.products.map((p, pi) => {
                    const pk = `${ci}:${pi}`;
                    return (
                      <div key={pi} className={`rounded-xl border border-line bg-bg-elevated p-3 ${p.on ? "" : "opacity-45"}`}>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => setPicker(picker === pk ? null : pk)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-bg-surface-2" title="Trocar foto">
                            {p.img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.img} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-[9px] font-semibold text-[var(--text-faded)]">+ foto</span>}
                            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[8px] font-bold uppercase text-white">trocar</span>
                          </button>
                          <input type="checkbox" checked={p.on} onChange={() => edit((d) => { d[ci].products[pi].on = !d[ci].products[pi].on; })} className="h-4 w-4 accent-[var(--brand-600)]" />
                          <input value={p.name} onChange={(e) => edit((d) => { d[ci].products[pi].name = e.target.value; })} placeholder="Nome do produto" className={nameInp} />
                          {!p.groups.length && price(p.price, (s) => edit((d) => { d[ci].products[pi].price = s; }))}
                          <button type="button" onClick={() => edit((d) => { d[ci].products.splice(pi, 1); })} className={xBtn} title="Remover produto">✕</button>
                        </div>

                        {picker === pk && (
                          <div className="mt-3 rounded-xl border border-line bg-bg-surface-2 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-bold text-ink">Escolher foto</span>
                              <button type="button" onClick={() => { upTarget.current = [ci, pi]; fileRef.current?.click(); }} className={addBtn}>Subir a minha</button>
                            </div>
                            <div className="max-h-44 space-y-2 overflow-y-auto">
                              {PICKER_GROUPS.map((grp) => (
                                <div key={grp.label}>
                                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{grp.label}</p>
                                  <div className="grid grid-cols-5 gap-1.5">
                                    {grp.photos.map((url) => (
                                      <button key={url} type="button" onClick={() => { edit((d) => { d[ci].products[pi].img = url; }); setPicker(null); }} className="aspect-square overflow-hidden rounded-lg border border-line transition hover:ring-2 hover:ring-[var(--brand-600)]">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {p.on && p.groups.map((g, gi) => (
                          <div key={gi} className="mt-3 rounded-lg bg-bg-surface-2 p-2.5">
                            <div className="mb-1.5 flex items-center gap-2">
                              <input value={g.title} onChange={(e) => edit((d) => { d[ci].products[pi].groups[gi].title = e.target.value; })} className="min-w-0 flex-1 bg-transparent text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] outline-none" />
                              <span className="text-[10px] text-[var(--text-faded)]">{g.kind === "tier" ? "faixas · meio a meio" : g.min_select ? "escolha 1" : "adicionais"}</span>
                              <button type="button" onClick={() => edit((d) => { d[ci].products[pi].groups.splice(gi, 1); })} className={xBtn}>✕</button>
                            </div>

                            {g.kind === "tier" ? (
                              <div className="space-y-1.5">
                                {g.tiers.map((t, ti) => (
                                  <div key={ti} className="rounded-lg border border-line bg-bg-elevated p-2">
                                    <div className="flex items-center gap-2">
                                      <input value={t.name} onChange={(e) => edit((d) => { d[ci].products[pi].groups[gi].tiers[ti].name = e.target.value; })} placeholder="Nome da faixa" className={`${nameInp} font-bold`} />
                                      <span className="text-[11px] text-[var(--text-muted)]">+</span>
                                      {price(t.price, (s) => edit((d) => { d[ci].products[pi].groups[gi].tiers[ti].price = s; }))}
                                      <button type="button" onClick={() => edit((d) => { d[ci].products[pi].groups[gi].tiers.splice(ti, 1); })} className={xBtn}>✕</button>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                      {t.flavors.map((f, fi) => (
                                        <span key={fi} className="inline-flex items-center rounded-lg border border-line bg-bg-surface-2 pl-2">
                                          <input value={f.name} onChange={(e) => edit((d) => { d[ci].products[pi].groups[gi].tiers[ti].flavors[fi].name = e.target.value; })} placeholder="sabor" className="bg-transparent py-1 text-xs font-semibold text-ink outline-none" style={{ width: `${Math.max(6, f.name.length + 1)}ch` }} />
                                          <button type="button" onClick={() => edit((d) => { d[ci].products[pi].groups[gi].tiers[ti].flavors.splice(fi, 1); })} className={xBtn}>✕</button>
                                        </span>
                                      ))}
                                      <button type="button" onClick={() => edit((d) => { d[ci].products[pi].groups[gi].tiers[ti].flavors.push({ name: "" }); })} className={addBtn}>+ sabor</button>
                                    </div>
                                  </div>
                                ))}
                                <button type="button" onClick={() => edit((d) => { d[ci].products[pi].groups[gi].tiers.push({ name: "Nova faixa", price: "0,00", flavors: [{ name: "" }] }); })} className={addBtn}>+ nova faixa</button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {g.options.map((o, oi) => (
                                  <span key={oi} className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg-elevated px-2 py-1">
                                    <input value={o.name} onChange={(e) => edit((d) => { d[ci].products[pi].groups[gi].options[oi].name = e.target.value; })} placeholder="opção" className="bg-transparent text-xs font-semibold text-ink outline-none" style={{ width: `${Math.max(6, o.name.length + 1)}ch` }} />
                                    <span className="text-[10px] text-[var(--text-muted)]">R$</span>
                                    <input value={o.price} onChange={(e) => edit((d) => { d[ci].products[pi].groups[gi].options[oi].price = e.target.value; })} inputMode="decimal" className="w-12 rounded border border-line bg-bg-surface-2 px-1 text-right text-xs text-ink outline-none" />
                                    <button type="button" onClick={() => edit((d) => { d[ci].products[pi].groups[gi].options.splice(oi, 1); })} className={xBtn}>✕</button>
                                  </span>
                                ))}
                                <button type="button" onClick={() => edit((d) => { d[ci].products[pi].groups[gi].options.push({ name: "", price: "0,00" }); })} className={addBtn}>+ opção</button>
                              </div>
                            )}
                          </div>
                        ))}

                        {p.on && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => edit((d) => { d[ci].products[pi].groups.push({ title: "Adicionais", kind: "option", min_select: 0, max_select: 0, price_mode: "sum", tiers: [], options: [{ name: "", price: "0,00" }] }); })} className={addBtn}>+ adicionais</button>
                            <button type="button" onClick={() => edit((d) => { d[ci].products[pi].groups.push({ title: "Sabores", kind: "tier", min_select: 1, max_select: 2, price_mode: "highest", tiers: [{ name: "Faixa", price: "0,00", flavors: [{ name: "" }] }], options: [] }); })} className={addBtn}>+ sabores/faixas</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => edit((d) => { d[ci].products.push({ on: true, name: "", img: "", price: "0,00", groups: [] }); })} className={`${addBtn} w-full py-2`}>+ adicionar produto</button>
                </div>
              )}
            </section>
          ))}
          <button type="button" onClick={() => edit((d) => { d.push({ on: true, name: "Nova categoria", station: "cozinha", products: [] }); })} className={`${addBtn} w-full py-2.5`}>+ adicionar categoria</button>
        </div>

        <div className="border-t border-line px-5 py-4">
          {err && <p className="mb-2 text-sm text-red-500">{err}</p>}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-[var(--text-secondary)]">Cancelar</button>
            <button onClick={criar} disabled={saving || !totalProd} className="flex-1 rounded-xl brand-gradient py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {saving ? "Criando…" : `Criar cardápio · ${totalProd} ${totalProd === 1 ? "item" : "itens"}`}
            </button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}
