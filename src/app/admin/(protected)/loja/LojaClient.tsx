"use client";

import { useMemo, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { brl } from "@/lib/format";
import { IconSearch, IconBox, IconPlus } from "@/components/Icons";

export type LojaProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  qty: number;
  sellPriceCents: number;
  image: string;
  badge: string;
  published: boolean;
};

// Rótulos das categorias hardware (mesma nomenclatura da tela de Estoque).
const CAT_LABEL: Record<string, string> = {
  computadores: "Computadores e notebooks",
  cpu: "Processadores (CPU)",
  cooler: "Coolers e water",
  mobo: "Placas-mãe",
  ram: "Memórias (RAM)",
  gpu: "Placas de vídeo (GPU)",
  ssd: "SSD e armazenamento",
  gabinete: "Gabinetes",
  fonte: "Fontes",
  mouse: "Mouses",
  teclado: "Teclados",
  mousepad: "Mousepads",
  monitor: "Monitores",
  headset: "Headsets",
  cadeira: "Cadeiras gamer",
};

// Atalhos por FAMÍLIA (filtro do topo). Espelha o agrupamento do Estoque AT.
type FamKey = "todos" | "pecas" | "perifericos" | "pcs";
const FAMILIES: { key: FamKey; label: string; cats: string[] }[] = [
  { key: "todos", label: "Todos", cats: [] },
  { key: "pecas", label: "Peças de PC", cats: ["cpu", "cooler", "mobo", "ram", "gpu", "ssd", "gabinete", "fonte"] },
  { key: "perifericos", label: "Periféricos", cats: ["mouse", "teclado", "mousepad", "headset", "monitor", "cadeira"] },
  { key: "pcs", label: "PCs prontos", cats: ["computadores"] },
];
// famílias reais (sem "todos") — usadas como seções do HUB de categorias
const HUB_FAMILIES = FAMILIES.filter((f) => f.key !== "todos");
// ordem estável das seções (grupos por categoria)
const SECTION_ORDER = [
  "computadores",
  "cpu", "cooler", "mobo", "ram", "gpu", "ssd", "gabinete", "fonte",
  "mouse", "teclado", "mousepad", "monitor", "headset", "cadeira",
];

type StatusFilter = "todos" | "publicados" | "rascunho";

const inp = "w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

export default function LojaClient({ products, pixDiscountPercent }: { products: LojaProduct[]; pixDiscountPercent: number }) {
  const [items, setItems] = useState<LojaProduct[]>(products);
  const [fam, setFam] = useState<FamKey>("todos");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  // nível 2: categoria aberta (null = HUB de categorias). Busca tem prioridade e ignora isso.
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const famCats = useMemo(() => new Map(FAMILIES.map((f) => [f.key, new Set(f.cats)])), []);
  const famCount = useCallback(
    (key: FamKey) => (key === "todos" ? items.length : items.filter((i) => famCats.get(key)!.has(i.category)).length),
    [items, famCats],
  );

  // liga/desliga "no site" — otimista + persiste; reverte se o servidor recusar (λ.prova-na-fonte:
  // a UI só confirma depois do PATCH ok; erro volta o estado e avisa).
  const togglePublish = useCallback(async (id: string, next: boolean) => {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, published: next } : it)));
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const r = await fetch("/api/loja-produtos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, published: next }),
      });
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      setItems((cur) => cur.map((it) => (it.id === id ? { ...it, published: !next } : it)));
      alert("Não consegui salvar. Tente de novo.");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const cats = famCats.get(fam)!;
    return items.filter((i) => {
      if (fam !== "todos" && !cats.has(i.category)) return false;
      if (status === "publicados" && !i.published) return false;
      if (status === "rascunho" && i.published) return false;
      if (term && !(`${i.name} ${i.brand} ${i.id}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [items, fam, status, q, famCats]);

  // agrupa por categoria, ordem estável + qualquer categoria fora da lista no fim
  const groups = useMemo(() => {
    const present = [...new Set(filtered.map((i) => i.category))];
    const ordered = [
      ...SECTION_ORDER.filter((c) => present.includes(c)),
      ...present.filter((c) => !SECTION_ORDER.includes(c)),
    ];
    return ordered
      .map((cat) => ({ cat, list: filtered.filter((i) => i.category === cat).sort((a, b) => a.name.localeCompare(b.name)) }))
      .filter((g) => g.list.length > 0);
  }, [filtered]);

  // contagem por categoria pros cards do HUB (total + publicados) — independe do filtro de status
  const catStats = useMemo(() => {
    const m = new Map<string, { total: number; published: number; cover: string }>();
    for (const it of items) {
      const cur = m.get(it.category) ?? { total: 0, published: 0, cover: "" };
      cur.total += 1;
      if (it.published) cur.published += 1;
      if (it.image && !cur.cover) cur.cover = it.image; // capa = 1ª foto real da categoria
      m.set(it.category, cur);
    }
    return m;
  }, [items]);

  // nível 2: produtos da categoria aberta (aplica o filtro de status)
  const catList = useMemo(() => {
    if (!activeCat) return [];
    return items
      .filter((i) => i.category === activeCat)
      .filter((i) => (status === "publicados" ? i.published : status === "rascunho" ? !i.published : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, activeCat, status]);

  const searching = q.trim().length > 0;

  const total = items.length;
  const publishedCount = items.filter((i) => i.published).length;

  return (
    <>
      {/* Resumo + Adicionar produto (o editor completo vem depois) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">
          <b className="text-ink">{total}</b> produtos · <b className="text-ink">{publishedCount}</b> publicados no site
        </p>
        <Link
          href="/admin/loja/novo"
          className="inline-flex items-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]"
        >
          <IconPlus width={16} height={16} /> Adicionar produto
        </Link>
      </div>

      {/* Filtro por FAMÍLIA */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {FAMILIES.map((f) => (
          <Chip
            key={f.key}
            active={fam === f.key}
            onClick={() => {
              setFam(f.key);
              setActiveCat(null); // trocar de família volta pro HUB
            }}
            label={f.label}
            count={famCount(f.key)}
          />
        ))}
      </div>

      {/* Busca + status */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faded)]">
            <IconSearch width={16} height={16} />
          </span>
          <input
            className={`${inp} pl-9`}
            placeholder="Buscar por nome, marca ou SKU"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {(["todos", "publicados", "rascunho"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold capitalize transition ${
                status === s ? "border-brand-600 bg-bg-base text-brand-600" : "border-line text-[var(--text-muted)] hover:border-brand-400"
              }`}
            >
              {s === "todos" ? "Todos" : s === "publicados" ? "Publicados" : "Rascunho"}
            </button>
          ))}
        </div>
      </div>

      {/* BUSCA GLOBAL (prioridade): ignora o nível de categoria e lista tudo que casa, agrupado por categoria */}
      {searching ? (
        groups.length === 0 ? (
          <EmptyState>Nenhum produto encontrado com esse filtro.</EmptyState>
        ) : (
          <div className="mt-5 space-y-7">
            {groups.map((g) => (
              <section key={g.cat}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <h2 className="text-sm font-extrabold text-ink">{CAT_LABEL[g.cat] ?? g.cat}</h2>
                  <span className="text-xs font-bold text-[var(--text-faded)]">{g.list.length}</span>
                  <div className="ml-1 h-px flex-1 bg-line" />
                </div>
                <div className="card divide-y divide-[var(--line)] overflow-hidden">
                  {g.list.map((it) => (
                    <ProductRow
                      key={it.id}
                      it={it}
                      pixPct={pixDiscountPercent}
                      busy={!!busy[it.id]}
                      onToggle={() => togglePublish(it.id, !it.published)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : activeCat ? (
        /* NÍVEL 2 — produtos da categoria aberta */
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setActiveCat(null)}
            className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 transition hover:opacity-80"
          >
            ← Categorias
          </button>
          <div className="mb-2.5 mt-3 flex items-center gap-2.5">
            <h2 className="text-sm font-extrabold text-ink">{CAT_LABEL[activeCat] ?? activeCat}</h2>
            <span className="text-xs font-bold text-[var(--text-faded)]">{catList.length}</span>
            <div className="ml-1 h-px flex-1 bg-line" />
          </div>
          {catList.length === 0 ? (
            <EmptyState>Nenhum produto nessa categoria com esse filtro.</EmptyState>
          ) : (
            <div className="card divide-y divide-[var(--line)] overflow-hidden">
              {catList.map((it) => (
                <ProductRow
                  key={it.id}
                  it={it}
                  pixPct={pixDiscountPercent}
                  busy={!!busy[it.id]}
                  onToggle={() => togglePublish(it.id, !it.published)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* NÍVEL 1 — HUB de categorias, agrupado por família */
        (() => {
          const sections = HUB_FAMILIES
            .filter((f) => fam === "todos" || fam === f.key)
            .map((f) => ({ f, cats: f.cats.filter((c) => (catStats.get(c)?.total ?? 0) > 0) }))
            .filter((s) => s.cats.length > 0);
          if (sections.length === 0) {
            return <EmptyState>Nenhuma categoria com produtos.</EmptyState>;
          }
          return (
            <div className="mt-5 space-y-7">
              {sections.map(({ f, cats }) => (
                <section key={f.key}>
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <h2 className="text-sm font-extrabold text-ink">{f.label}</h2>
                    <div className="ml-1 h-px flex-1 bg-line" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {cats.map((cat) => {
                      const s = catStats.get(cat)!;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActiveCat(cat)}
                          className="card flex flex-col gap-0 overflow-hidden p-0 text-left transition hover:border-brand-400"
                        >
                          <div className="flex aspect-[5/3] w-full items-center justify-center overflow-hidden bg-white">
                            {s.cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.cover} alt={CAT_LABEL[cat] ?? cat} loading="lazy" className="h-full w-full object-contain p-2.5" />
                            ) : (
                              <IconBox width={26} height={26} className="text-brand-600" />
                            )}
                          </div>
                          <div className="min-w-0 p-3">
                            <div className="truncate font-bold text-ink">{CAT_LABEL[cat] ?? cat}</div>
                            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                              {s.total} {s.total === 1 ? "produto" : "produtos"} · {s.published} publicados
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          );
        })()
      )}
    </>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-[var(--text-muted)]">
      {children}
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-bold transition ${
        active ? "border-transparent brand-gradient text-white shadow-[var(--shadow-brand)]" : "border-line bg-bg-elevated text-ink-2 hover:border-brand-400"
      }`}
    >
      {label}
      <span className={active ? "text-white/80" : "text-[var(--text-faded)]"}>{count}</span>
    </button>
  );
}

function Thumb({ it }: { it: LojaProduct }) {
  if (it.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={it.image} alt={it.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-bg-surface-2 text-[var(--text-faded)]" aria-hidden>
      <IconBox width={18} height={18} />
    </span>
  );
}

function ProductRow({ it, pixPct, busy, onToggle }: { it: LojaProduct; pixPct: number; busy: boolean; onToggle: () => void }) {
  const pixCents = pixPct > 0 && it.sellPriceCents > 0 ? Math.round(it.sellPriceCents * (1 - pixPct / 100)) : 0;
  return (
    <div className="flex items-center gap-3 py-3 pl-4 pr-4">
      <Link href={`/admin/loja/${it.id}`} className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-80" title="Editar produto">
        <Thumb it={it} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold text-ink">{it.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                it.published ? "bg-[#E8F6DD] text-lime" : "bg-bg-surface-2 text-[var(--text-muted)]"
              }`}
            >
              {it.published ? "Publicado" : "Rascunho"}
            </span>
            {it.badge && <span className="rounded-full bg-[#FBF1DC] px-2 py-0.5 text-[10px] font-bold text-gold">{it.badge}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-muted)]">
            {it.brand && <span>{it.brand}</span>}
            <span className="text-[var(--text-faded)]">SKU {it.id}</span>
            <span className={it.qty > 0 ? "" : "font-bold text-[var(--red-no)]"}>· {it.qty} em estoque</span>
          </div>
        </div>

        <div className="hidden shrink-0 text-right sm:block">
          {it.sellPriceCents > 0 ? (
            <>
              <div className="font-extrabold tabular-nums text-ink">{brl(it.sellPriceCents)}</div>
              {pixCents > 0 && (
                <div className="text-[11px] font-bold text-[var(--green-ok)]">{brl(pixCents)} no PIX</div>
              )}
            </>
          ) : (
            <span className="text-xs text-[var(--text-faded)]">sem preço</span>
          )}
        </div>
      </Link>

      {/* Toggle "no site" */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <button
          type="button"
          role="switch"
          aria-checked={it.published}
          aria-label={it.published ? "Tirar do site" : "Publicar no site"}
          onClick={onToggle}
          disabled={busy}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
            it.published ? "brand-gradient" : "bg-bg-surface-2"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${it.published ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
        <span className="text-[10px] font-bold text-[var(--text-faded)]">no site</span>
      </div>
    </div>
  );
}
