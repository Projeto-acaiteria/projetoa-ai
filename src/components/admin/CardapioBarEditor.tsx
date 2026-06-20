"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";
import type { BarCategory, BarProduct } from "@/lib/menu-bar-store";

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const STATIONS = ["cozinha", "bar"];

type CatForm = { id?: string; name: string; station: string; description: string; active: boolean };
type ProdForm = { id?: string; category_id: string; name: string; priceReais: string; size_label: string; active: boolean };

const Pencil = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
const Trash = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
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
    if (f.id) await api("cat.update", { id: f.id, patch: { name: f.name.trim(), station: f.station, description: f.description || null, active: f.active } });
    else await api("cat.create", { name: f.name.trim(), station: f.station, description: f.description || null, sort: cats.length });
    setCatModal(null);
  }
  async function delCat(c: BarCategory) {
    if (!confirm(`Excluir a categoria "${c.name}" e todos os seus produtos?`)) return;
    await api("cat.delete", { id: c.id });
  }

  async function saveProd() {
    const f = prodModal;
    if (!f || !f.name.trim()) return;
    const cents = Math.round((parseFloat(f.priceReais.replace(",", ".")) || 0) * 100);
    if (f.id) await api("prod.update", { id: f.id, patch: { name: f.name.trim(), price_cents: cents, size_label: f.size_label || null, active: f.active } });
    else await api("prod.create", { category_id: f.category_id, name: f.name.trim(), price_cents: cents, size_label: f.size_label || null, sort: 0 });
    setProdModal(null);
  }
  async function delProd(p: BarProduct) {
    if (!confirm(`Excluir o produto "${p.name}"?`)) return;
    await api("prod.delete", { id: p.id });
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando cardápio…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCatModal({ name: "", station: "cozinha", description: "", active: true })} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]">
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
              <button onClick={() => setCatModal({ id: c.id, name: c.name, station: c.station, description: c.description ?? "", active: c.active })} title="Editar categoria" className="rounded-lg p-2 text-[var(--text-faded)] hover:bg-bg-surface-2 hover:text-ink"><Pencil /></button>
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
                  <button onClick={() => setProdModal({ id: p.id, category_id: p.category_id, name: p.name, priceReais: (p.price_cents / 100).toFixed(2).replace(".", ","), size_label: p.size_label ?? "", active: p.active })} className="rounded-lg p-1.5 text-[var(--text-faded)] hover:bg-bg-surface-2 hover:text-ink"><Pencil /></button>
                  <button onClick={() => delProd(p)} className="rounded-lg p-1.5 text-[var(--text-faded)] hover:bg-red-50 hover:text-red-500"><Trash /></button>
                </div>
              </li>
            ))}
          </ul>
          <button onClick={() => setProdModal({ category_id: c.id, name: "", priceReais: "", size_label: "", active: true })} className="mt-3 text-sm font-bold text-brand-600">+ Adicionar produto</button>
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
          <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" checked={catModal.active} onChange={(e) => setCatModal({ ...catModal, active: e.target.checked })} /> Visível no cardápio</label>
        </Modal>
      )}

      {prodModal && (
        <Modal title={prodModal.id ? "Editar produto" : "Novo produto"} onClose={() => setProdModal(null)} onSave={saveProd} saving={saving}>
          <Field label="Nome"><input autoFocus value={prodModal.name} onChange={(e) => setProdModal({ ...prodModal, name: e.target.value })} placeholder="Ex: Batata frita" className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço (R$)"><input value={prodModal.priceReais} onChange={(e) => setProdModal({ ...prodModal, priceReais: e.target.value })} inputMode="decimal" placeholder="0,00" className={inputCls} /></Field>
            <Field label="Tamanho (opcional)"><input value={prodModal.size_label} onChange={(e) => setProdModal({ ...prodModal, size_label: e.target.value })} placeholder="500g / 600ml" className={inputCls} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" checked={prodModal.active} onChange={(e) => setProdModal({ ...prodModal, active: e.target.checked })} /> Disponível</label>
        </Modal>
      )}
    </div>
  );
}
