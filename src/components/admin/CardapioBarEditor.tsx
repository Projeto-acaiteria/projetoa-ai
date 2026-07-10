"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/admin/ui";
import type { BarCategory, BarProduct } from "@/lib/menu-bar-store";
import { IMAGE_BANK } from "@/config/image-bank";
import { compressImage } from "@/lib/compress-image";
import ModifierManager from "@/components/admin/ModifierManager";
import RecipeManager from "@/components/admin/RecipeManager";

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const STATIONS = ["cozinha", "bar"];

type CatForm = { id?: string; name: string; station: string; description: string; active: boolean; earns_points: boolean; no_prep: boolean };
type ProdForm = { id?: string; category_id: string; name: string; priceReais: string; size_label: string; img: string; active: boolean; by_weight: boolean; tara: string };

const ImgIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
);

function ImagePicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setErr("");
    try {
      // comprime no client (webp ~200-350KB) ANTES de subir — porte do AgendaPRO
      const c = await compressImage(file);
      if (!c.ok) { setErr(c.reason); return; }
      const fd = new FormData();
      fd.append("file", c.file);
      const r = await fetch("/api/upload-foto", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "falha no upload");
      onChange(d.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-bg-surface-2">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--text-faded)]"><ImgIcon /></div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50">{uploading ? "Subindo…" : "Subir foto"}</button>
            <button type="button" onClick={() => setBankOpen((v) => !v)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink">Banco de imagens</button>
            {value && <button type="button" onClick={() => onChange("")} className="rounded-lg px-2 py-1.5 text-xs font-bold text-red-500">Remover</button>}
          </div>
          {err && <span className="text-xs text-red-500">{err}</span>}
        </div>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>
      {bankOpen && (
        <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-line p-2">
          {IMAGE_BANK.map((cat) => (
            <div key={cat.key} className="mb-2 last:mb-0">
              <p className="mb-1 text-xs font-bold text-[var(--text-muted)]">{cat.label}</p>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {cat.photos.map((url) => (
                  <button type="button" key={url} onClick={() => { onChange(url); setBankOpen(false); }} className="aspect-square overflow-hidden rounded-lg border border-line transition hover:ring-2 hover:ring-brand-600">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Pencil = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
const Trash = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
);
const Sliders = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-600";

function Modal({ title, onClose, onSave, saving, children }: { title: string; onClose: () => void; onSave: () => void; saving: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl bg-bg-elevated p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-extrabold text-ink">{title}</h3>
        <div className="space-y-3">{children}</div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-bold text-[var(--text-secondary)]">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="flex-1 rounded-xl brand-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

export default function CardapioBarEditor() {
  const [cats, setCats] = useState<BarCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catModal, setCatModal] = useState<CatForm | null>(null);
  const [prodModal, setProdModal] = useState<ProdForm | null>(null);
  const [modProduct, setModProduct] = useState<BarProduct | null>(null);
  const [recipeProduct, setRecipeProduct] = useState<BarProduct | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ message: string; onYes: () => void } | null>(null);

  const reload = useCallback(async () => {
    const r = await fetch("/api/cardapio-bar", { cache: "no-store" });
    const d = await r.json();
    setCats(d.categories ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function api(action: string, payload: unknown) {
    setSaving(true);
    try {
      await fetch("/api/cardapio-bar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function saveCat() {
    const f = catModal;
    if (!f || !f.name.trim()) return;
    if (f.id) await api("cat.update", { id: f.id, patch: { name: f.name.trim(), station: f.station, description: f.description || null, active: f.active, earns_points: f.earns_points, no_prep: f.no_prep } });
    else await api("cat.create", { name: f.name.trim(), station: f.station, description: f.description || null, sort: cats.length, earns_points: f.earns_points, no_prep: f.no_prep });
    setCatModal(null);
  }
  function delCat(c: BarCategory) {
    setConfirmDel({ message: `Excluir a categoria "${c.name}" e todos os seus produtos? Não dá pra desfazer.`, onYes: () => api("cat.delete", { id: c.id }) });
  }

  async function saveProd() {
    const f = prodModal;
    if (!f || !f.name.trim()) return;
    const cents = Math.round((parseFloat(f.priceReais.replace(",", ".")) || 0) * 100);
    const tara = Math.max(0, Math.round(parseFloat(f.tara.replace(",", ".")) || 0));
    if (f.id) await api("prod.update", { id: f.id, patch: { name: f.name.trim(), price_cents: cents, size_label: f.size_label || null, img: f.img || null, active: f.active, by_weight: f.by_weight, tare_grams: tara } });
    else await api("prod.create", { category_id: f.category_id, name: f.name.trim(), price_cents: cents, size_label: f.size_label || null, img: f.img || null, sort: 0, by_weight: f.by_weight, tare_grams: tara });
    setProdModal(null);
  }
  function delProd(p: BarProduct) {
    setConfirmDel({ message: `Excluir o produto "${p.name}"?`, onYes: () => api("prod.delete", { id: p.id }) });
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando cardápio…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCatModal({ name: "", station: "cozinha", description: "", active: true, earns_points: true, no_prep: false })} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]">
          + Nova categoria
        </button>
      </div>

      {cats.length === 0 && (
        <Card className="p-6 text-center text-sm text-[var(--text-muted)]">
          Nenhuma categoria ainda. Crie a primeira — ex: <b>Petiscos</b> (cozinha), <b>Bebidas</b> (bar).
        </Card>
      )}

      {cats.map((c) => (
        <Card key={c.id} className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`text-lg font-extrabold ${c.active ? "text-ink" : "text-[var(--text-faded)] line-through"}`}>{c.name}</h3>
              <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-xs font-semibold capitalize text-[var(--text-muted)]">{c.station}</span>
              {!c.active && <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-xs text-[var(--text-faded)]">oculta</span>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setCatModal({ id: c.id, name: c.name, station: c.station, description: c.description ?? "", active: c.active, earns_points: c.earns_points, no_prep: c.no_prep })} title="Editar categoria" className="rounded-lg p-2 text-[var(--text-faded)] hover:bg-bg-surface-2 hover:text-ink"><Pencil /></button>
              <button onClick={() => delCat(c)} title="Excluir categoria" className="rounded-lg p-2 text-[var(--text-faded)] hover:bg-red-50 hover:text-red-500"><Trash /></button>
            </div>
          </div>

          <ul className="divide-y divide-line">
            {c.products.length === 0 && <li className="py-2 text-sm text-[var(--text-faded)]">Sem produtos ainda.</li>}
            {c.products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <div className={p.active ? "" : "opacity-50"}>
                  <span className="font-semibold text-ink">{p.name}</span>
                  {p.size_label && <span className="text-sm text-[var(--text-faded)]"> · {p.size_label}</span>}
                  {!p.active && <span className="ml-2 rounded bg-bg-surface-2 px-1.5 text-xs text-[var(--text-faded)]">oculto</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-brand-600">{brl(p.price_cents)}</span>
                  <button onClick={() => setModProduct(p)} title="Personalização (adicionais, ponto, remover…)" className="relative rounded-lg p-1.5 text-[var(--text-faded)] hover:bg-bg-surface-2 hover:text-ink">
                    <Sliders />
                    {p.groups.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">{p.groups.length}</span>}
                  </button>
                  <button onClick={() => setRecipeProduct(p)} title={(p.recipe?.length ?? 0) > 0 ? "Ficha técnica (baixa de estoque + CMV)" : "Sem ficha técnica — a venda não baixa estoque nem entra no CMV"} className={`relative rounded-lg p-1.5 hover:bg-bg-surface-2 hover:text-ink ${(p.recipe?.length ?? 0) > 0 ? "text-[var(--text-faded)]" : "text-[var(--gold)]"}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                    {(p.recipe?.length ?? 0) > 0
                      ? <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">{p.recipe.length}</span>
                      : <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--gold)] ring-2 ring-bg-elevated" />}
                  </button>
                  <button onClick={() => setProdModal({ id: p.id, category_id: p.category_id, name: p.name, priceReais: (p.price_cents / 100).toFixed(2).replace(".", ","), size_label: p.size_label ?? "", img: p.img ?? "", active: p.active, by_weight: p.by_weight, tara: String(p.tare_grams || "") })} className="rounded-lg p-1.5 text-[var(--text-faded)] hover:bg-bg-surface-2 hover:text-ink"><Pencil /></button>
                  <button onClick={() => delProd(p)} className="rounded-lg p-1.5 text-[var(--text-faded)] hover:bg-red-50 hover:text-red-500"><Trash /></button>
                </div>
              </li>
            ))}
          </ul>
          <button onClick={() => setProdModal({ category_id: c.id, name: "", priceReais: "", size_label: "", img: "", active: true, by_weight: false, tara: "" })} className="mt-3 text-sm font-bold text-brand-600">+ Adicionar produto</button>
        </Card>
      ))}

      {catModal && (
        <Modal title={catModal.id ? "Editar categoria" : "Nova categoria"} onClose={() => setCatModal(null)} onSave={saveCat} saving={saving}>
          <Field label="Nome"><input autoFocus value={catModal.name} onChange={(e) => setCatModal({ ...catModal, name: e.target.value })} placeholder="Ex: Petiscos" className={inputCls} /></Field>
          <Field label="Estação (pra onde o pedido vai)">
            <select value={catModal.station} onChange={(e) => setCatModal({ ...catModal, station: e.target.value })} className={inputCls}>
              {STATIONS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </Field>
          <Field label="Descrição (opcional)"><input value={catModal.description} onChange={(e) => setCatModal({ ...catModal, description: e.target.value })} placeholder="Ex: Pra acompanhar a cerveja" className={inputCls} /></Field>
          <label className="flex items-center gap-2 rounded-lg bg-bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink">
            <input type="checkbox" checked={catModal.earns_points} onChange={(e) => setCatModal({ ...catModal, earns_points: e.target.checked })} />
            Dá pontos de fidelidade
            <span className="font-normal text-[var(--text-faded)]">— desligue em itens de revenda (refri, água)</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg bg-bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink">
            <input type="checkbox" checked={catModal.no_prep} onChange={(e) => setCatModal({ ...catModal, no_prep: e.target.checked })} />
            Pronto pra servir
            <span className="font-normal text-[var(--text-faded)]">— cerveja/refri: imprime no bar e cobra, mas some do quadro de Preparo</span>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" checked={catModal.active} onChange={(e) => setCatModal({ ...catModal, active: e.target.checked })} /> Visível no cardápio</label>
        </Modal>
      )}

      {prodModal && (
        <Modal title={prodModal.id ? "Editar produto" : "Novo produto"} onClose={() => setProdModal(null)} onSave={saveProd} saving={saving}>
          <Field label="Nome"><input autoFocus value={prodModal.name} onChange={(e) => setProdModal({ ...prodModal, name: e.target.value })} placeholder={prodModal.by_weight ? "Ex: Comida a quilo" : "Ex: Batata frita"} className={inputCls} /></Field>
          <label className="flex items-center gap-2 rounded-lg bg-bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink">
            <input type="checkbox" checked={prodModal.by_weight} onChange={(e) => setProdModal({ ...prodModal, by_weight: e.target.checked })} />
            Vender por peso (R$/kg) — marmita / a quilo
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label={prodModal.by_weight ? "Preço por kg (R$)" : "Preço (R$)"}><input value={prodModal.priceReais} onChange={(e) => setProdModal({ ...prodModal, priceReais: e.target.value })} inputMode="decimal" placeholder="0,00" className={inputCls} /></Field>
            {prodModal.by_weight ? (
              <Field label="Tara do prato (g)"><input value={prodModal.tara} onChange={(e) => setProdModal({ ...prodModal, tara: e.target.value })} inputMode="numeric" placeholder="0" className={inputCls} /></Field>
            ) : (
              <Field label="Tamanho (opcional)"><input value={prodModal.size_label} onChange={(e) => setProdModal({ ...prodModal, size_label: e.target.value })} placeholder="500g / 600ml" className={inputCls} /></Field>
            )}
          </div>
          <Field label="Foto (opcional)"><ImagePicker value={prodModal.img} onChange={(url) => setProdModal((m) => (m ? { ...m, img: url } : m))} /></Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" checked={prodModal.active} onChange={(e) => setProdModal({ ...prodModal, active: e.target.checked })} /> Disponível</label>
        </Modal>
      )}

      {modProduct && <ModifierManager product={modProduct} onClose={() => setModProduct(null)} onChanged={reload} />}
      {recipeProduct && <RecipeManager product={recipeProduct} onClose={() => setRecipeProduct(null)} onChanged={reload} />}

      {confirmDel && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setConfirmDel(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl bg-bg-elevated p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-ink">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{confirmDel.message}</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmDel(null)} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-bold text-[var(--text-secondary)]">Cancelar</button>
              <button onClick={() => { const fn = confirmDel.onYes; setConfirmDel(null); fn(); }} disabled={saving} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white disabled:opacity-60">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
