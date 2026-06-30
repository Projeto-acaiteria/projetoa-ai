"use client";

import { useEffect, useState } from "react";
import type { Menu } from "@/lib/menu-store";
import type { Size, ModifierGroup, Modifier, Ingredient } from "@/lib/menu";
import { IconPlus, IconCheck, IconBowl } from "@/components/Icons";

const uid = (p: string) => p + Math.random().toString(36).slice(2, 9);

type Insumo = { id: string; name: string; unit: string };

// edita a ficha técnica (insumos consumidos) de um item
function RecipeRow({ recipe, onChange, insumos }: { recipe?: Ingredient[]; onChange: (r: Ingredient[]) => void; insumos: Insumo[] }) {
  const rec = recipe || [];
  const nameOf = (id: string) => insumos.find((x) => x.id === id);
  const usados = new Set(rec.map((r) => r.stockId));
  const disponiveis = insumos.filter((x) => !usados.has(x.id));
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-bg-surface-2 px-2 py-1.5">
      <span className="text-[11px] font-bold uppercase text-[var(--text-faded)]">Baixa estoque:</span>
      {rec.length === 0 && <span className="text-[11px] text-[var(--text-faded)]">nenhum insumo</span>}
      {rec.map((ing, i) => {
        const ins = nameOf(ing.stockId);
        return (
          <span key={ing.stockId} className="inline-flex items-center gap-1 rounded-md border border-line bg-bg-elevated px-1.5 py-0.5 text-xs">
            <span className="font-semibold text-ink">{ins?.name ?? "?"}</span>
            <input
              type="number" min={0} step={0.01} value={ing.qty}
              onChange={(e) => onChange(rec.map((r, k) => (k === i ? { ...r, qty: Math.max(0, parseFloat(e.target.value) || 0) } : r)))}
              className="w-16 rounded border border-line bg-bg-base px-1.5 text-right outline-none"
            />
            <span className="text-[var(--text-muted)]">{ins?.unit}</span>
            <button onClick={() => onChange(rec.filter((_, k) => k !== i))} className="text-[var(--text-faded)] hover:text-[var(--red-no)]">×</button>
          </span>
        );
      })}
      {disponiveis.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && onChange([...rec, { stockId: e.target.value, qty: 0.1 }])}
          className="rounded-md border border-dashed border-brand-600 bg-bg-elevated px-1.5 py-0.5 text-xs font-bold text-brand-600 outline-none"
        >
          <option value="">+ insumo</option>
          {disponiveis.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}
    </div>
  );
}

function PriceInput({ cents, onChange }: { cents: number; onChange: (c: number) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-line bg-bg-base px-2">
      <span className="text-xs font-semibold text-[var(--text-muted)]">R$</span>
      <input
        type="number"
        min={0}
        step={0.5}
        value={cents / 100}
        onChange={(e) => onChange(Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)))}
        className="w-16 bg-transparent px-1 py-1.5 text-right text-sm font-bold text-ink outline-none"
      />
    </div>
  );
}

const inp =
  "rounded-lg border border-line bg-bg-base px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-600";
const numInp = `${inp} w-16 text-center`;
const delBtn =
  "shrink-0 rounded-lg border border-line px-2 py-1.5 text-xs font-bold text-[var(--red-no)] hover:bg-[#FEECEC]";

export default function CardapioEditor({ hasEstoque = false }: { hasEstoque?: boolean }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/cardapio", { cache: "no-store" }).then((r) => r.json()).then((m) => setMenu(m));
    fetch("/api/estoque", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setInsumos((d.items ?? []).map((i: { id: string; name: string; unit: string }) => ({ id: i.id, name: i.name, unit: i.unit }))));
  }, []);

  function patch(next: Menu) {
    setMenu(next);
    setDirty(true);
    setSaved(false);
  }

  // ---- tamanhos ----
  const setSizes = (sizes: Size[]) => patch({ ...menu!, sizes });
  const updSize = (i: number, p: Partial<Size>) =>
    setSizes(menu!.sizes.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const addSize = () =>
    setSizes([...menu!.sizes, { id: uid("s"), label: "Novo copo", ml: 0, priceCents: 0, img: "/menu/copo-500.jpg" }]);
  const delSize = (i: number) => setSizes(menu!.sizes.filter((_, k) => k !== i));

  // ---- grupos ----
  const setGroups = (groups: ModifierGroup[]) => patch({ ...menu!, groups });
  const updGroup = (i: number, p: Partial<ModifierGroup>) =>
    setGroups(menu!.groups.map((g, k) => (k === i ? { ...g, ...p } : g)));
  const addGroup = () =>
    setGroups([...menu!.groups, { id: uid("g"), title: "Novo grupo", freeUpTo: 0, max: 0, paid: false, items: [] }]);
  const delGroup = (i: number) => setGroups(menu!.groups.filter((_, k) => k !== i));

  // ---- itens ----
  const updItem = (gi: number, ii: number, p: Partial<Modifier>) =>
    updGroup(gi, { items: menu!.groups[gi].items.map((it, k) => (k === ii ? { ...it, ...p } : it)) });
  const addItem = (gi: number) =>
    updGroup(gi, { items: [...menu!.groups[gi].items, { id: uid("i"), name: "Novo item", priceCents: 0 }] });
  const delItem = (gi: number, ii: number) =>
    updGroup(gi, { items: menu!.groups[gi].items.filter((_, k) => k !== ii) });

  async function save() {
    if (!menu) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cardapio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(menu),
      });
      const data = await res.json();
      if (res.ok) {
        setMenu(data.menu);
        setDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!menu) {
    return <div className="card p-6 text-center text-sm text-[var(--text-muted)]">Carregando cardápio...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Barra salvar */}
      <div className="sticky top-[60px] z-20 flex items-center justify-between rounded-2xl border border-line bg-bg-elevated/95 px-4 py-3 backdrop-blur lg:top-2">
        <div className="text-sm font-semibold text-ink-2">
          {dirty ? "Alterações não salvas" : saved ? "Tudo salvo ✓" : "Editor do cardápio"}
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)] disabled:bg-none disabled:bg-bg-surface-2 disabled:text-[var(--text-faded)] disabled:shadow-none"
        >
          <IconCheck width={16} height={16} /> {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>

      {/* Tamanhos */}
      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <IconBowl width={18} height={18} className="text-brand-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Tamanhos e preço-base</h2>
        </div>
        <div className="space-y-2">
          {menu.sizes.map((s, i) => (
            <div key={s.id} className="rounded-lg border border-line p-2">
              <div className="flex flex-wrap items-center gap-2">
              <input
                value={s.label}
                onChange={(e) => updSize(i, { label: e.target.value })}
                className={`${inp} min-w-0 flex-1`}
                placeholder="Nome (ex: Copo 500ml)"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={s.ml}
                  onChange={(e) => updSize(i, { ml: parseInt(e.target.value) || 0 })}
                  className={numInp}
                />
                <span className="text-xs font-semibold text-[var(--text-muted)]">ml</span>
              </div>
              <PriceInput cents={s.priceCents} onChange={(c) => updSize(i, { priceCents: c })} />
              <button onClick={() => delSize(i)} className={delBtn}>
                remover
              </button>
              </div>
              {hasEstoque && <RecipeRow recipe={s.recipe} insumos={insumos} onChange={(r) => updSize(i, { recipe: r })} />}
            </div>
          ))}
        </div>
        <button
          onClick={addSize}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand-600 px-3 py-2 text-sm font-bold text-brand-600"
        >
          <IconPlus width={15} height={15} /> Adicionar tamanho
        </button>
      </div>

      {/* Grupos de adicionais */}
      {menu.groups.map((g, gi) => (
        <div key={g.id} className="card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={g.title}
              onChange={(e) => updGroup(gi, { title: e.target.value })}
              className={`${inp} min-w-0 flex-1 font-bold`}
              placeholder="Nome do grupo"
            />
            <button onClick={() => delGroup(gi)} className={delBtn}>
              remover grupo
            </button>
          </div>

          {/* Config do grupo */}
          <div className="mb-3 flex flex-wrap items-center gap-4 rounded-xl bg-bg-surface-2 px-3 py-2.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-ink-2">
              <input
                type="checkbox"
                checked={g.paid}
                onChange={(e) => updGroup(gi, { paid: e.target.checked })}
                className="h-4 w-4 accent-[var(--brand-600)]"
              />
              Todos pagos
            </label>
            {!g.paid && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                Grátis até
                <input
                  type="number"
                  min={0}
                  value={g.freeUpTo}
                  onChange={(e) => updGroup(gi, { freeUpTo: parseInt(e.target.value) || 0 })}
                  className={numInp}
                />
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
              Máximo
              <input
                type="number"
                min={0}
                value={g.max}
                onChange={(e) => updGroup(gi, { max: parseInt(e.target.value) || 0 })}
                className={numInp}
              />
            </label>
          </div>

          {/* Itens */}
          <div className="space-y-2">
            {g.items.map((it, ii) => (
              <div key={it.id} className="rounded-lg border border-line p-2">
                <div className="flex items-center gap-2">
                <input
                  value={it.name}
                  onChange={(e) => updItem(gi, ii, { name: e.target.value })}
                  className={`${inp} min-w-0 flex-1`}
                  placeholder="Nome do item"
                />
                <PriceInput cents={it.priceCents} onChange={(c) => updItem(gi, ii, { priceCents: c })} />
                <button onClick={() => delItem(gi, ii)} className={delBtn}>
                  x
                </button>
                </div>
                {hasEstoque && <RecipeRow recipe={it.recipe} insumos={insumos} onChange={(r) => updItem(gi, ii, { recipe: r })} />}
              </div>
            ))}
          </div>
          <button
            onClick={() => addItem(gi)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-sm font-bold text-ink-2"
          >
            <IconPlus width={15} height={15} /> Adicionar item
          </button>
        </div>
      ))}

      <button
        onClick={addGroup}
        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-brand-600 px-4 py-3 text-sm font-bold text-brand-600"
      >
        <IconPlus width={16} height={16} /> Adicionar grupo de adicionais
      </button>
    </div>
  );
}
