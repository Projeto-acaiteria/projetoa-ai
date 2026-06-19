"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { StatCard } from "@/components/admin/ui";
import { brl } from "@/lib/format";
import { IconBox, IconAlert, IconClock, IconPlus, IconMinus, IconTrash } from "@/components/Icons";
import type { StockItem, StockCategory } from "@/lib/stock-store";

const CAT_LABEL: Record<StockCategory, string> = {
  sorvete: "Sorvetes e potes",
  picole: "Picolés",
  bebida: "Bebidas",
  salgado: "Salgados e lanches",
  doce: "Doces e guloseimas",
  polpa: "Polpas e bases",
  fruta: "Frutas",
  cereal: "Cereais e complementos",
  cobertura: "Coberturas e caldas",
  adicional: "Adicionais premium",
  embalagem: "Embalagens e descartáveis",
  limpeza: "Limpeza",
  outro: "Outros",
};

type FamilyKey = "venda" | "producao" | "operacao";
const FAMILIES: { key: FamilyKey; label: string; cats: StockCategory[]; color: string; soft: string }[] = [
  { key: "venda", label: "Produtos à venda", cats: ["sorvete", "picole", "bebida", "salgado", "doce"], color: "#6D28D9", soft: "#EFE6FF" },
  { key: "producao", label: "Insumos de produção", cats: ["polpa", "fruta", "cereal", "cobertura", "adicional"], color: "#0E9488", soft: "#D7F2F0" },
  { key: "operacao", label: "Operação", cats: ["embalagem", "limpeza", "outro"], color: "#7C6E92", soft: "#EFEAF6" },
];
const famOf = (c: StockCategory) => FAMILIES.find((f) => f.cats.includes(c))!;
const ALL_CATS = FAMILIES.flatMap((f) => f.cats);

function daysTo(expiry?: string): number | null {
  if (!expiry) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((new Date(expiry + "T00:00:00").getTime() - t.getTime()) / 86400000);
}

const inp = "w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

export default function EstoqueClient() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FamilyKey | "todos">("todos");
  const [modal, setModal] = useState<null | { kind: "add" } | { kind: "move"; item: StockItem; dir: "entrada" | "saida" }>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/estoque", { cache: "no-store" });
      setItems((await r.json()).items ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const low = items.filter((i) => i.qty <= i.minQty);
  const expAlert = items.filter((i) => {
    const d = daysTo(i.expiry);
    return d !== null && d <= 7;
  });

  const byFamily = useMemo(() => {
    const rank = (i: StockItem) => {
      const d = daysTo(i.expiry);
      if (i.qty <= i.minQty) return 0;
      if (d !== null && d <= 7) return 1;
      return 2;
    };
    return FAMILIES.map((f) => ({
      ...f,
      list: items
        .filter((i) => f.cats.includes(i.category))
        .sort((a, b) => rank(a) - rank(b) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    })).filter((f) => f.list.length > 0 && (filter === "todos" || filter === f.key));
  }, [items, filter]);

  const remove = async (id: string) => {
    await fetch(`/api/estoque/${id}`, { method: "DELETE" });
    load();
  };
  const famCount = (k: FamilyKey) => items.filter((i) => famOf(i.category).key === k).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Itens" value={String(items.length)} hint="cadastrados" Icon={IconBox} tone="brand" />
        <StatCard label="Em falta" value={String(low.length)} hint="abaixo do mínimo" Icon={IconAlert} tone="accent" />
        <StatCard label="Vencendo" value={String(expAlert.length)} hint="≤ 7 dias ou vencido" Icon={IconClock} tone="gold" />
        <div className="card flex items-center justify-center p-4">
          <button
            onClick={() => setModal({ kind: "add" })}
            className="inline-flex items-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]"
          >
            <IconPlus width={16} height={16} /> Novo item
          </button>
        </div>
      </div>

      {/* Filtro por família */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        <Chip active={filter === "todos"} onClick={() => setFilter("todos")} label="Todos" count={items.length} />
        {FAMILIES.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} label={f.label} count={famCount(f.key)} color={f.color} />
        ))}
      </div>

      {loaded && items.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-[var(--text-muted)]">
          Nenhum item ainda. Clique em &quot;Novo item&quot;.
        </div>
      )}

      <div className="mt-5 space-y-7">
        {byFamily.map((f) => (
          <section key={f.key}>
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
              <h2 className="text-sm font-extrabold text-ink">{f.label}</h2>
              <span className="text-xs font-bold text-[var(--text-faded)]">{f.list.length}</span>
              <div className="ml-1 h-px flex-1 bg-line" />
            </div>
            <div className="card divide-y divide-[var(--line)] overflow-hidden">
              {f.list.map((it) => (
                <ItemRow key={it.id} it={it} onMove={(dir) => setModal({ kind: "move", item: it, dir })} onRemove={() => remove(it.id)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {modal?.kind === "add" && <AddModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.kind === "move" && (
        <MoveModal item={modal.item} dir={modal.dir} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </>
  );
}

function Chip({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-bold transition ${
        active ? "border-transparent brand-gradient text-white shadow-[var(--shadow-brand)]" : "border-line bg-bg-elevated text-ink-2 hover:border-brand-400"
      }`}
    >
      {color && !active && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
      <span className={active ? "text-white/80" : "text-[var(--text-faded)]"}>{count}</span>
    </button>
  );
}

function ItemRow({ it, onMove, onRemove }: { it: StockItem; onMove: (dir: "entrada" | "saida") => void; onRemove: () => void }) {
  const d = daysTo(it.expiry);
  const isLow = it.qty <= it.minQty;
  const expired = d !== null && d < 0;
  const expiring = d !== null && d >= 0 && d <= 7;
  const accent = isLow || expired ? "var(--red-no)" : expiring ? "var(--gold)" : null;

  return (
    <div className="relative flex items-center gap-3 py-3 pl-5 pr-4">
      {accent && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full" style={{ background: accent }} />}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-ink">{it.name}</span>
          {it.sellPriceCents ? (
            <span className="rounded-full bg-[#E8F6DD] px-2 py-0.5 text-[11px] font-bold text-lime">vende {brl(it.sellPriceCents)}</span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
          <span>{CAT_LABEL[it.category]}</span>
          {isLow && <span className="font-bold text-[var(--red-no)]">· estoque baixo</span>}
          {expired && <span className="font-bold text-[var(--red-no)]">· vencido</span>}
          {expiring && <span className="font-bold text-gold">· vence em {d}d</span>}
          {it.expiry && !expired && !expiring && <span>· val. {it.expiry.split("-").reverse().join("/")}</span>}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <span className={`text-lg font-extrabold ${isLow ? "text-[var(--red-no)]" : "text-ink"}`}>{it.qty}</span>
        <span className="ml-0.5 text-xs font-bold text-[var(--text-muted)]">{it.unit}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button onClick={() => onMove("entrada")} title="Entrada" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-[var(--text-muted)] transition hover:border-brand-600 hover:text-brand-600">
          <IconPlus width={15} height={15} />
        </button>
        <button onClick={() => onMove("saida")} title="Saída" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-[var(--text-muted)] transition hover:border-ink hover:text-ink">
          <IconMinus width={15} height={15} />
        </button>
        <button onClick={onRemove} title="Remover" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-faded)] transition hover:text-[var(--red-no)]">
          <IconTrash width={15} height={15} />
        </button>
      </div>
    </div>
  );
}

function AddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<StockCategory>("sorvete");
  const [qty, setQty] = useState("0");
  const [unit, setUnit] = useState("un");
  const [minQty, setMinQty] = useState("0");
  const [expiry, setExpiry] = useState("");
  const [sell, setSell] = useState("");
  const [saving, setSaving] = useState(false);

  const isVenda = famOf(category).key === "venda";

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/estoque", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        qty: +qty,
        unit,
        minQty: +minQty,
        expiry: expiry || undefined,
        sellPriceCents: isVenda && sell ? Math.round(parseFloat(sell) * 100) : undefined,
      }),
    });
    onSaved();
  }

  return (
    <Overlay onClose={onClose} title="Novo item">
      <input className={inp} placeholder="Nome (ex: Sorvete pote 2L)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <select className={inp} value={category} onChange={(e) => setCategory(e.target.value as StockCategory)}>
        {FAMILIES.map((f) => (
          <optgroup key={f.key} label={f.label}>
            {f.cats.map((c) => (
              <option key={c} value={c}>{CAT_LABEL[c]}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2">
        <input className={inp} type="number" min={0} placeholder="Qtd" value={qty} onChange={(e) => setQty(e.target.value)} />
        <input className={inp} placeholder="Unid" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <input className={inp} type="number" min={0} placeholder="Mínimo" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
      </div>
      {isVenda && (
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)]">Preço de venda</label>
          <div className="mt-1 flex items-center rounded-lg border border-line bg-bg-base px-3">
            <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
            <input className="w-full bg-transparent px-2 py-2.5 text-sm text-ink outline-none" type="number" min={0} step="0.5" placeholder="0,00" value={sell} onChange={(e) => setSell(e.target.value)} />
          </div>
        </div>
      )}
      <div>
        <label className="text-xs font-semibold text-[var(--text-muted)]">Validade (opcional)</label>
        <input className={`${inp} mt-1`} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </div>
      <button onClick={save} disabled={saving} className="mt-1 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
        {saving ? "Salvando..." : "Cadastrar item"}
      </button>
    </Overlay>
  );
}

function MoveModal({ item, dir, onClose, onSaved }: { item: StockItem; dir: "entrada" | "saida"; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = parseFloat(qty);
    if (!n || n <= 0) return;
    setSaving(true);
    await fetch(`/api/estoque/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: dir, qty: n, reason: reason || (dir === "entrada" ? "Compra" : "Uso") }),
    });
    onSaved();
  }

  return (
    <Overlay onClose={onClose} title={`${dir === "entrada" ? "Entrada" : "Saída"} · ${item.name}`}>
      <div className="rounded-xl bg-bg-surface-2 px-3 py-2 text-sm text-ink-2">
        Saldo atual: <b className="text-ink">{item.qty} {item.unit}</b>
      </div>
      <input className={inp} type="number" min={0} step="0.1" placeholder={`Quantidade (${item.unit})`} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
      <input className={inp} placeholder={dir === "entrada" ? "Motivo (ex: Compra fornecedor)" : "Motivo (ex: Uso / perda)"} value={reason} onChange={(e) => setReason(e.target.value)} />
      <button onClick={save} disabled={saving} className="mt-1 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
        {saving ? "Salvando..." : dir === "entrada" ? "Registrar entrada" : "Registrar saída"}
      </button>
    </Overlay>
  );
}

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md animate-pop rounded-t-3xl bg-bg-elevated p-5 shadow-[var(--shadow-pop)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <h2 className="mb-4 text-lg font-extrabold text-ink">{title}</h2>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}
