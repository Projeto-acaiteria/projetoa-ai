"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { StatCard } from "@/components/admin/ui";
import { brl } from "@/lib/format";
import { IconBox, IconAlert, IconClock, IconPlus, IconMinus, IconTrash, IconGear, IconBowl } from "@/components/Icons";
import type { StockItem, StockCategory } from "@/lib/stock-store";
import AtSpecsFields from "@/components/admin/AtSpecsFields";
import ImageUpload from "@/components/admin/ImageUpload";
import { WEIGHT_BASE_STOCK_ID } from "@/lib/menu";

const CAT_LABEL: Record<StockCategory, string> = {
  sorvete: "Sorvetes e potes",
  picole: "Picolés",
  bebida: "Bebidas",
  bebida_alcoolica: "Bebidas alcoólicas",
  salgado: "Salgados e lanches",
  doce: "Doces e guloseimas",
  polpa: "Açaí (polpas)",
  fruta: "Frutas",
  cereal: "Crocantes",
  cobertura: "Cremes e caldas",
  adicional: "Adicionais",
  proteina: "Carnes e proteínas",
  paes_massas: "Pães e massas",
  laticinio: "Laticínios e frios",
  mercearia: "Mercearia (secos)",
  embalagem: "Embalagens e descartáveis",
  limpeza: "Limpeza",
  outro: "Outros",
  // hardware / informática
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

type FamilyKey = "venda" | "producao" | "operacao" | "pc_pronto" | "componentes" | "perifericos";
const FAMILIES: { key: FamilyKey; label: string; cats: StockCategory[]; color: string; soft: string }[] = [
  { key: "venda", label: "Produtos à venda", cats: ["sorvete", "picole", "bebida", "bebida_alcoolica", "salgado", "doce"], color: "#4F46E5", soft: "#EEF2FF" },
  { key: "producao", label: "Insumos de produção", cats: ["polpa", "fruta", "cereal", "cobertura", "adicional", "proteina", "paes_massas", "laticinio", "mercearia"], color: "#0E9488", soft: "#D7F2F0" },
  { key: "operacao", label: "Operação", cats: ["embalagem", "limpeza", "outro"], color: "#7C6E92", soft: "#EFEAF6" },
  // hardware / informática (loja de PC/games)
  { key: "pc_pronto", label: "Computadores", cats: ["computadores"], color: "#111827", soft: "#F3F4F6" },
  { key: "componentes", label: "Componentes", cats: ["cpu", "cooler", "mobo", "ram", "gpu", "ssd", "gabinete", "fonte"], color: "#B45309", soft: "#FEF3C7" },
  { key: "perifericos", label: "Periféricos", cats: ["mouse", "teclado", "mousepad", "monitor", "headset", "cadeira"], color: "#4338CA", soft: "#EEF2FF" },
];
// famílias da assistência técnica (informática) — só aparecem no vertical service, nunca em food/bar
const AT_KEYS: FamilyKey[] = ["pc_pronto", "componentes", "perifericos"];
// famOf TOTAL: categorias custom de um tenant (ex.: bar usa "Destilado"/"Cerveja"/"Refrigerante")
// não estão nas FAMILIES fixas → caem no fallback "à venda" em vez de virar undefined e quebrar a tela.
const famOf = (c: StockCategory) => FAMILIES.find((f) => f.cats.includes(c)) ?? FAMILIES[0];
// Ordem das SEÇÕES no estoque — espelha o fluxo do cardápio: açaí primeiro, depois frutas,
// crocantes, cremes, adicionais, doces; por fim revenda e operação.
const SECTION_ORDER: StockCategory[] = [
  "polpa", "fruta", "cereal", "cobertura", "adicional", "doce",
  "sorvete", "picole", "bebida", "bebida_alcoolica", "salgado",
  "proteina", "paes_massas", "laticinio", "mercearia",
  "embalagem", "limpeza", "outro",
  // hardware
  "computadores", "cpu", "cooler", "mobo", "ram", "gpu", "ssd", "gabinete", "fonte",
  "mouse", "teclado", "mousepad", "monitor", "headset", "cadeira",
];

function daysTo(expiry?: string): number | null {
  if (!expiry) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((new Date(expiry + "T00:00:00").getTime() - t.getTime()) / 86400000);
}

// açaí vendido (kg) por período — o Vidal só quer o volume do dia/semana/mês
type AcaiRep = { totalKg: number; pesoKg: number; copoKg: number; copoCount: number; pesoCount: number };
type AcaiPeriods = { hoje: AcaiRep; semana: AcaiRep; mes: AcaiRep };
const kgFmt = (n: number) => (n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const inp = "w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

export default function EstoqueClient({ family, doseMl = 50, stockDose = false }: { family: "food" | "service"; doseMl?: number; stockDose?: boolean }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FamilyKey | "todos">("todos");
  const [modal, setModal] = useState<null | { kind: "add" } | { kind: "inventory" } | { kind: "move"; item: StockItem; dir: "entrada" | "saida" } | { kind: "edit"; item: StockItem } | { kind: "history"; item: StockItem }>(null);
  // fidelidade: categorias de revenda que NÃO pontuam (a montagem do copo sempre pontua). null=carregando.
  const [nonEarning, setNonEarning] = useState<string[] | null>(null);
  const [acaiVendido, setAcaiVendido] = useState<AcaiPeriods | null>(null);

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
  useEffect(() => {
    fetch("/api/loyalty", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setNonEarning(d.config?.nonEarningCategories ?? []))
      .catch(() => setNonEarning([]));
  }, []);
  useEffect(() => {
    fetch("/api/estoque/acai-vendido", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.mes) setAcaiVendido(d); })
      .catch(() => {});
  }, []);

  // liga/desliga pontos de uma categoria de revenda (otimista + persiste na config de fidelidade)
  const toggleEarns = useCallback(async (cat: string) => {
    setNonEarning((cur) => {
      if (cur == null) return cur;
      const next = cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat];
      fetch("/api/loyalty", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nonEarningCategories: next }) }).catch(() => {});
      return next;
    });
  }, []);

  // categorias de revenda EM USO (têm item com preço de venda) — só essas ganham o toggle de pontos
  const resaleCats = useMemo(
    () => FAMILIES[0].cats.filter((c) => items.some((i) => i.category === c && i.sellPriceCents)),
    [items],
  );

  const low = items.filter((i) => i.qty <= i.minQty);
  // compra sugerida: se tem máximo, repõe até o máximo; senão, um lote do mínimo (folga)
  const reorderQty = (i: StockItem) => (i.maxQty && i.maxQty > i.qty ? i.maxQty - i.qty : Math.max(i.minQty, 1));
  const expAlert = items.filter((i) => {
    const d = daysTo(i.expiry);
    return d !== null && d <= 7;
  });

  const byCat = useMemo(() => {
    const rank = (i: StockItem) => {
      const d = daysTo(i.expiry);
      if (i.qty <= i.minQty) return 0;
      if (d !== null && d <= 7) return 1;
      return 2;
    };
    // seções vêm das categorias REALMENTE presentes: conhecidas na ordem de SECTION_ORDER,
    // depois quaisquer categorias custom do tenant (ex.: bar) no fim — senão elas ficariam invisíveis.
    const present = [...new Set(items.map((i) => i.category))];
    const ordered = [
      ...SECTION_ORDER.filter((c) => present.includes(c)),
      ...present.filter((c) => !SECTION_ORDER.includes(c)),
    ];
    return ordered
      .filter((cat) => filter === "todos" || famOf(cat).key === filter)
      .map((cat) => ({
        cat,
        list: items
          .filter((i) => i.category === cat)
          .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)),
      }))
      .filter((s) => s.list.length > 0);
  }, [items, filter]);

  const remove = async (id: string) => {
    await fetch(`/api/estoque/${id}`, { method: "DELETE" });
    load();
  };
  const famCount = (k: FamilyKey) => items.filter((i) => famOf(i.category).key === k).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {!loaded ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : (
          <>
            <StatCard label="Itens" value={String(items.length)} hint="cadastrados" Icon={IconBox} tone="brand" />
            <StatCard label="Em falta" value={String(low.length)} hint="abaixo do mínimo" Icon={IconAlert} tone="accent" />
            <StatCard label="Vencendo" value={String(expAlert.length)} hint="≤ 7 dias ou vencido" Icon={IconClock} tone="gold" />
          </>
        )}
        <div className="card flex flex-col items-center justify-center gap-2 p-4">
          <button
            onClick={() => setModal({ kind: "add" })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]"
          >
            <IconPlus width={16} height={16} /> Novo item
          </button>
          <button
            onClick={() => setModal({ kind: "inventory" })}
            disabled={items.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink-2 hover:border-brand-400 disabled:opacity-40"
          >
            Conferir estoque
          </button>
        </div>
      </div>

      {/* REPOSIÇÃO — o que atingiu o mínimo e quanto comprar (alvo = máximo) */}
      {loaded && low.length > 0 && (
        <div className="card mt-4 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-[var(--red-no)]/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <IconAlert width={17} height={17} className="text-[var(--red-no)]" />
              <h2 className="text-sm font-extrabold text-ink">Repor estoque <span className="font-medium text-[var(--text-muted)]">· {low.length} {low.length === 1 ? "item no" : "itens no"} mínimo</span></h2>
            </div>
            {family === "service" && (
              <Link href="/admin/compras" className="shrink-0 rounded-lg brand-gradient px-3 py-1.5 text-xs font-bold text-white">Registrar compra</Link>
            )}
          </div>
          <div className="divide-y divide-line">
            {low.slice(0, 12).map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{i.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">tem {i.qty} {i.unit} · mínimo {i.minQty}{i.maxQty ? ` · máx ${i.maxQty}` : ""}</div>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--red-no)]/10 px-2.5 py-1 text-xs font-bold text-[var(--red-no)]">comprar ~{reorderQty(i)} {i.unit}</span>
              </div>
            ))}
            {low.length > 12 && <div className="px-4 py-2 text-center text-[11px] text-[var(--text-faded)]">+ {low.length - 12} outros no mínimo</div>}
          </div>
        </div>
      )}

      {/* Açaí vendido (kg) — dia / semana / mês. O que o Vidal quer bater o olho. */}
      {acaiVendido && (acaiVendido.mes.totalKg > 0 || acaiVendido.mes.copoCount > 0) && (
        <div className="card mt-4 p-4">
          <div className="flex items-center gap-2">
            <IconBowl width={17} height={17} className="text-brand-600" />
            <h2 className="text-sm font-extrabold text-ink">Açaí vendido</h2>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <AcaiPeriodo label="Hoje" r={acaiVendido.hoje} />
            <AcaiPeriodo label="7 dias" r={acaiVendido.semana} />
            <AcaiPeriodo label="Este mês" r={acaiVendido.mes} />
          </div>
        </div>
      )}

      {/* Filtro por família */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        <Chip active={filter === "todos"} onClick={() => setFilter("todos")} label="Todos" count={items.length} />
        {FAMILIES.filter((f) => AT_KEYS.includes(f.key) === (family === "service")).map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} label={f.label} count={famCount(f.key)} color={f.color} />
        ))}
      </div>

      {loaded && items.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-[var(--text-muted)]">
          Nenhum item ainda. Clique em &quot;Novo item&quot;.
        </div>
      )}

      {/* Fidelidade: a montagem do copo sempre pontua; aqui o dono desliga a revenda que não deve gerar pontos */}
      {nonEarning != null && resaleCats.length > 0 && (
        <div className="card mt-5 p-4">
          <h2 className="text-sm font-extrabold text-ink">Fidelidade — o que dá pontos</h2>
          <p className="mb-3 mt-0.5 text-xs text-[var(--text-muted)]">
            A montagem do copo sempre pontua. Desligue a revenda que não deve gerar pontos (ex: refrigerante).
          </p>
          <div className="flex flex-wrap gap-2">
            {resaleCats.map((c) => {
              const on = !nonEarning.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleEarns(c)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    on ? "border-brand-600 bg-bg-base text-brand-600" : "border-line bg-bg-surface-2 text-[var(--text-faded)]"
                  }`}
                >
                  {CAT_LABEL[c]} · {on ? "dá pontos" : "sem pontos"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 space-y-7">
        {byCat.map((s) => (
          <section key={s.cat}>
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: famOf(s.cat).color }} />
              <h2 className="text-sm font-extrabold text-ink">{CAT_LABEL[s.cat] ?? s.cat}</h2>
              <span className="text-xs font-bold text-[var(--text-faded)]">{s.list.length}</span>
              <div className="ml-1 h-px flex-1 bg-line" />
            </div>
            <div className="card divide-y divide-[var(--line)] overflow-hidden">
              {s.list.map((it) => (
                <ItemRow key={it.id} it={it} onMove={(dir) => setModal({ kind: "move", item: it, dir })} onEdit={() => setModal({ kind: "edit", item: it })} onHistory={() => setModal({ kind: "history", item: it })} onRemove={() => remove(it.id)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {modal?.kind === "add" && <AddModal family={family} doseMl={doseMl} stockDose={stockDose} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.kind === "inventory" && <InventoryModal items={items} onClose={() => setModal(null)} onApplied={() => { setModal(null); load(); }} />}
      {modal?.kind === "move" && (
        <MoveModal item={modal.item} dir={modal.dir} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {modal?.kind === "edit" && <EditModal item={modal.item} family={family} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.kind === "history" && <HistoryModal item={modal.item} onClose={() => setModal(null)} />}
    </>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-4">
      <div className="h-3 w-16 animate-pulse rounded bg-bg-surface-2" />
      <div className="mt-2 h-7 w-10 animate-pulse rounded bg-bg-surface-2" />
      <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-bg-surface-2" />
    </div>
  );
}

function AcaiPeriodo({ label, r }: { label: string; r: AcaiRep }) {
  return (
    <div className="rounded-xl border border-line bg-bg-base p-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-xl font-extrabold tabular-nums text-brand-600">
        {kgFmt(r.totalKg)}<span className="ml-0.5 text-xs font-bold text-[var(--text-muted)]">kg</span>
      </div>
      <div className="mt-0.5 text-[10px] leading-tight text-[var(--text-faded)]">{r.copoCount} copos · {kgFmt(r.pesoKg)}kg peso</div>
    </div>
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

function ItemRow({ it, onMove, onEdit, onHistory, onRemove }: { it: StockItem; onMove: (dir: "entrada" | "saida") => void; onEdit: () => void; onHistory: () => void; onRemove: () => void }) {
  const d = daysTo(it.expiry);
  const isBase = it.id === WEIGHT_BASE_STOCK_ID; // base do açaí: não pode excluir (âncora de CMV/baixa)
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
          {it.supplier && <span>· {it.supplier}</span>}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {it.dosesPerBottle ? (
          // destilado: o controle é em GARRAFAS (o dono cadastra a garrafa); as doses são o que baixa por venda
          <>
            <span className={`text-lg font-extrabold ${isLow ? "text-[var(--red-no)]" : "text-ink"}`}>{(it.qty / it.dosesPerBottle).toFixed(1)}</span>
            <span className="ml-0.5 text-xs font-bold text-[var(--text-muted)]">garrafa(s)</span>
            <div className="text-[11px] text-[var(--text-faded)]">{it.qty} doses restantes</div>
          </>
        ) : (
          <>
            <span className={`text-lg font-extrabold ${isLow ? "text-[var(--red-no)]" : "text-ink"}`}>{it.qty}</span>
            <span className="ml-0.5 text-xs font-bold text-[var(--text-muted)]">{it.unit}</span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button onClick={() => onMove("entrada")} title="Entrada" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-[var(--text-muted)] transition hover:border-brand-600 hover:text-brand-600">
          <IconPlus width={15} height={15} />
        </button>
        <button onClick={() => onMove("saida")} title="Saída" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-[var(--text-muted)] transition hover:border-ink hover:text-ink">
          <IconMinus width={15} height={15} />
        </button>
        <button onClick={onHistory} title="Movimentações" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-faded)] transition hover:text-brand-600">
          <IconClock width={15} height={15} />
        </button>
        <button onClick={onEdit} title="Editar" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-faded)] transition hover:text-ink">
          <IconGear width={15} height={15} />
        </button>
        {!isBase && (
          <button onClick={onRemove} title="Remover" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-faded)] transition hover:text-[var(--red-no)]">
            <IconTrash width={15} height={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function AddModal({ family, doseMl = 50, stockDose = false, onClose, onSaved }: { family: "food" | "service"; doseMl?: number; stockDose?: boolean; onClose: () => void; onSaved: () => void }) {
  const isService = family === "service";
  const [name, setName] = useState("");
  const [category, setCategory] = useState<StockCategory>(isService ? "cpu" : "sorvete");
  const [qty, setQty] = useState("0");
  const [unit, setUnit] = useState("un");
  const [minQty, setMinQty] = useState("0");
  const [maxQty, setMaxQty] = useState("");
  const [expiry, setExpiry] = useState("");
  const [sell, setSell] = useState("");
  const [byDose, setByDose] = useState(false); // controlar por dose (destilado/garrafa)
  const [bottleMl, setBottleMl] = useState(""); // tamanho da garrafa (ml) → doses/garrafa = garrafa ÷ doseMl
  const [cost, setCost] = useState(""); // custo (CMV): por garrafa se dose, senão por unidade
  const [supplier, setSupplier] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState(""); // unidade de compra (caixa, fardo...)
  const [purchaseFactor, setPurchaseFactor] = useState(""); // 1 unidade de compra = N unidades de uso
  // vertical AT (hardware): specs do montador + vitrine
  const [specs, setSpecs] = useState<Record<string, string | number | boolean | string[]>>({});
  const [brand, setBrand] = useState("");
  const [badge, setBadge] = useState("");
  const [highlight, setHighlight] = useState(false);
  const [image, setImage] = useState("");
  const [barcode, setBarcode] = useState(""); // EAN — bipa no balcão
  const [ncm, setNcm] = useState(""); const [cfop, setCfop] = useState(""); const [cest, setCest] = useState(""); const [origem, setOrigem] = useState("");
  const [saving, setSaving] = useState(false);

  const isVenda = famOf(category).key === "venda";
  const sellable = isVenda || isService; // hardware é sempre vendável
  // dose (bar): a feature dose vale pra QUALQUER item vendável (não só a categoria açaí "bebida").
  // doses/garrafa = tamanho da garrafa ÷ dose padrão da loja. Entrada e contagem em GARRAFAS.
  const doseCapable = stockDose && sellable && !isService;
  const dosesPerBottle = byDose && bottleMl ? Math.max(0, Math.round((parseFloat(bottleMl.replace(",", ".")) || 0) / (doseMl || 50))) : 0;
  const fams = FAMILIES.filter((f) => AT_KEYS.includes(f.key) === isService); // service vê só cats AT; food vê food

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const doses = dosesPerBottle; // doses por garrafa (0 = item normal)
    const costC = cost ? Math.round((parseFloat(cost.replace(",", ".")) || 0) * 100) : 0;
    await fetch("/api/estoque", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        // com dose, a Qtd digitada é em GARRAFAS → grava em doses (garrafas × doses/garrafa)
        qty: doses > 0 ? Math.round((+qty || 0) * doses) : +qty,
        unit: doses > 0 ? "dose" : unit,
        minQty: +minQty,
        maxQty: maxQty ? +maxQty : undefined,
        expiry: expiry || undefined,
        sellPriceCents: sellable && sell ? Math.round(parseFloat(sell) * 100) : undefined,
        dosesPerBottle: doses > 0 ? doses : undefined,
        // custo p/ CMV: dose → por garrafa; demais → por unidade
        costPerBottleCents: doses > 0 && costC ? costC : undefined,
        costCents: doses === 0 && costC ? costC : undefined,
        supplier: supplier.trim() || undefined,
        purchaseUnit: purchaseUnit.trim() || undefined,
        purchaseFactor: purchaseFactor ? parseFloat(purchaseFactor.replace(",", ".")) || undefined : undefined,
        // AT: specs + vitrine (só service)
        specs: isService && Object.keys(specs).length ? specs : undefined,
        brand: isService ? brand.trim() || undefined : undefined,
        badge: isService ? badge.trim() || undefined : undefined,
        highlight: isService ? highlight || undefined : undefined,
        image: isService ? image || undefined : undefined,
        barcode: sellable ? barcode.trim() || undefined : undefined,
        ncm: isService ? ncm.trim() || undefined : undefined,
        cfop: isService ? cfop.trim() || undefined : undefined,
        cest: isService ? cest.trim() || undefined : undefined,
        origem: isService ? origem.trim() || undefined : undefined,
      }),
    });
    onSaved();
  }

  return (
    <Overlay onClose={onClose} title="Novo item">
      <input className={inp} placeholder={isService ? "Nome (ex: AMD Ryzen 5 5600)" : "Nome (ex: Sorvete pote 2L)"} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <select className={inp} value={category} onChange={(e) => { setCategory(e.target.value as StockCategory); setSpecs({}); }}>
        {fams.map((f) => (
          <optgroup key={f.key} label={f.label}>
            {f.cats.map((c) => (
              <option key={c} value={c}>{CAT_LABEL[c]}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {isService && <input className={inp} placeholder="Marca (ex: AMD, Kingston, Corsair)" value={brand} onChange={(e) => setBrand(e.target.value)} />}
      {sellable && <input className={inp} inputMode="numeric" placeholder="Código de barras (EAN) — bipe aqui pra preencher" value={barcode} onChange={(e) => setBarcode(e.target.value)} />}
      <div className="grid grid-cols-3 gap-2">
        <input className={inp} type="number" min={0} placeholder={byDose ? "Garrafas" : "Qtd"} value={qty} onChange={(e) => setQty(e.target.value)} />
        <input className={inp} placeholder="Unid" value={byDose ? "dose" : unit} onChange={(e) => setUnit(e.target.value)} disabled={byDose} />
        <input className={inp} type="number" min={0} placeholder="Mínimo" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-line bg-bg-base px-3 py-2 text-[11px] text-[var(--text-faded)]">Mínimo = alerta de repor</div>
        <input className={inp} type="number" min={0} placeholder="Máximo (repor até)" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} />
      </div>
      {isService && <AtSpecsFields category={category} value={specs} onChange={setSpecs} />}
      {isService && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Selo (vitrine)</label>
            <select className={`${inp} mt-1`} value={badge} onChange={(e) => setBadge(e.target.value)}>
              <option value="">Sem selo</option>
              {["Lançamento", "Mais Vendido", "Promo", "OpenBox"].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 self-end rounded-lg border border-line bg-bg-base px-3 py-2.5">
            <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
            <span className="text-sm text-ink">Destaque na home</span>
          </label>
        </div>
      )}
      {isService && (
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)]">Foto real (opcional — senão o site usa SVG por categoria)</label>
          <div className="mt-1"><ImageUpload value={image} onChange={setImage} hint="A foto que o cliente vê no site" /></div>
        </div>
      )}
      {doseCapable && (
        <div className="rounded-lg border border-line bg-bg-base p-2.5">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={byDose} onChange={(e) => setByDose(e.target.checked)} />
            <span className="text-sm font-semibold text-ink">Controlar por dose (destilado)</span>
          </label>
          {byDose && (
            <div className="mt-2">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Tamanho da garrafa (ml)</label>
              <input className={`${inp} mt-1`} type="number" min={0} placeholder="ex: 1000" value={bottleMl} onChange={(e) => setBottleMl(e.target.value)} />
              <p className="mt-1 text-[11px] text-[var(--text-faded)]">
                Dose de {doseMl}ml → <b className="text-ink">{dosesPerBottle || "—"} doses/garrafa</b>. A Qtd acima é em GARRAFAS; o estoque conta e baixa em doses. Custo abaixo = por garrafa.
              </p>
            </div>
          )}
        </div>
      )}
      {sellable && (
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)]">Preço de venda</label>
          <div className="mt-1 flex items-center rounded-lg border border-line bg-bg-base px-3">
            <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
            <input className="w-full bg-transparent px-2 py-2.5 text-sm text-ink outline-none" type="number" min={0} step="0.5" placeholder="0,00" value={sell} onChange={(e) => setSell(e.target.value)} />
          </div>
        </div>
      )}
      <div>
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          {byDose ? "Custo por garrafa (CMV — opcional)" : "Custo por unidade (CMV — opcional)"}
        </label>
        <div className="mt-1 flex items-center rounded-lg border border-line bg-bg-base px-3">
          <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
          <input className="w-full bg-transparent px-2 py-2.5 text-sm text-ink outline-none" type="number" min={0} step="0.5" placeholder="0,00" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-faded)]">Quanto VOCÊ paga. Vira o custo da ficha técnica → relatório de CMV e margem.</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-[var(--text-muted)]">Validade (opcional)</label>
        <input className={`${inp} mt-1`} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-semibold text-[var(--text-muted)]">Fornecedor (opcional)</label>
        <input className={`${inp} mt-1`} placeholder="ex: Distribuidora Central" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-semibold text-[var(--text-muted)]">Compra em (opcional)</label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <input className={inp} placeholder="Unid. compra (ex: caixa)" value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)} />
          <input className={inp} type="number" min={0} placeholder={`${unit || "un"} por ${purchaseUnit || "compra"}`} value={purchaseFactor} onChange={(e) => setPurchaseFactor(e.target.value)} />
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-faded)]">Ex: 1 caixa = 12 un. Aí a entrada pode ser lançada em {purchaseUnit || "caixas"}.</p>
      </div>
      {isService && (
        <div className="rounded-lg border border-line bg-bg-base p-2.5">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Fiscal (opcional — pra nota futura)</div>
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} inputMode="numeric" placeholder="NCM (8 díg)" value={ncm} onChange={(e) => setNcm(e.target.value)} />
            <input className={inp} inputMode="numeric" placeholder="CFOP (ex 5102)" value={cfop} onChange={(e) => setCfop(e.target.value)} />
            <input className={inp} inputMode="numeric" placeholder="CEST (opcional)" value={cest} onChange={(e) => setCest(e.target.value)} />
            <select className={inp} value={origem} onChange={(e) => setOrigem(e.target.value)}>
              <option value="">Origem…</option>
              <option value="0">0 · Nacional</option>
              <option value="1">1 · Importada direta</option>
              <option value="2">2 · Importada mercado interno</option>
            </select>
          </div>
        </div>
      )}
      <button onClick={save} disabled={saving} className="mt-1 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
        {saving ? "Salvando..." : "Cadastrar item"}
      </button>
    </Overlay>
  );
}

const SAIDA_REASONS = ["Uso", "Perda", "Vencido", "Quebra"];

function MoveModal({ item, dir, onClose, onSaved }: { item: StockItem; dir: "entrada" | "saida"; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState(""); // entrada: custo desta compra (custo médio ponderado)
  const [byPurchase, setByPurchase] = useState(false); // entrada lançada em unidade de compra
  const [expiry, setExpiry] = useState(item.expiry ?? ""); // entrada: validade do lote que está chegando
  const [saving, setSaving] = useState(false);

  // destilado: o dono lança em GARRAFAS; converte pra doses (× doses/garrafa)
  const isDose = !!item.dosesPerBottle && item.dosesPerBottle > 0;
  const dpb = item.dosesPerBottle ?? 1;
  const [byBottle, setByBottle] = useState(isDose); // dose: entrada/saída em garrafas por padrão
  const canConvert = dir === "entrada" && !!item.purchaseFactor && item.purchaseFactor > 0;
  const factor = item.purchaseFactor ?? 1;
  const typed = parseFloat(qty.replace(",", ".")) || 0;
  const useQty = +((byBottle && isDose ? typed * dpb : byPurchase ? typed * factor : typed)).toFixed(3); // sempre em doses/unidade de USO

  async function save() {
    if (!(useQty > 0)) return;
    setSaving(true);
    // dose: o dono digita o custo POR GARRAFA; o CMV trabalha por dose → divide por doses/garrafa
    const costRaw = dir === "entrada" && cost ? Math.round((parseFloat(cost.replace(",", ".")) || 0) * 100) : undefined;
    const costC = costRaw != null && isDose ? Math.round(costRaw / dpb) : costRaw;
    await fetch(`/api/estoque/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: dir, qty: useQty, reason: reason || (dir === "entrada" ? "Compra" : "Uso"), costCents: costC, expiry: dir === "entrada" ? (expiry || undefined) : undefined }),
    });
    onSaved();
  }

  return (
    <Overlay onClose={onClose} title={`${dir === "entrada" ? "Entrada" : "Saída"} · ${item.name}`}>
      <div className="rounded-xl bg-bg-surface-2 px-3 py-2 text-sm text-ink-2">
        Saldo atual: <b className="text-ink">{isDose ? `${(item.qty / dpb).toFixed(1)} garrafa(s)` : `${item.qty} ${item.unit}`}</b>{isDose && <span className="text-[var(--text-faded)]"> · {item.qty} doses</span>}
      </div>

      {isDose && (
        <div className="flex gap-1.5">
          <button onClick={() => setByBottle(true)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition ${byBottle ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>Em garrafas (×{dpb})</button>
          <button onClick={() => setByBottle(false)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition ${!byBottle ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>Em doses</button>
        </div>
      )}
      {canConvert && !isDose && (
        <div className="flex gap-1.5">
          <button onClick={() => setByPurchase(false)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition ${!byPurchase ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>Em {item.unit}</button>
          <button onClick={() => setByPurchase(true)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition ${byPurchase ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>Em {item.purchaseUnit || "compra"} (×{factor})</button>
        </div>
      )}

      <input className={inp} type="number" min={0} step="0.1" placeholder={`Quantidade (${isDose ? (byBottle ? "garrafas" : "doses") : byPurchase ? item.purchaseUnit || "compra" : item.unit})`} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
      {isDose && byBottle && typed > 0 && <p className="-mt-1 text-[11px] text-[var(--text-faded)]">= {useQty} doses no estoque</p>}
      {byPurchase && !isDose && typed > 0 && <p className="-mt-1 text-[11px] text-[var(--text-faded)]">= {useQty} {item.unit} no estoque</p>}

      {dir === "saida" ? (
        <div>
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {SAIDA_REASONS.map((r) => (
              <button key={r} onClick={() => setReason(r)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${reason === r ? "border-brand-600 bg-bg-base text-brand-600" : "border-line text-[var(--text-muted)]"}`}>{r}</button>
            ))}
          </div>
          <input className={inp} placeholder="Motivo (opcional — detalhe)" value={SAIDA_REASONS.includes(reason) ? "" : reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      ) : (
        <>
          <input className={inp} placeholder="Motivo (ex: Compra fornecedor)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Custo por {isDose ? "garrafa" : item.unit} nesta compra (opcional)</label>
            <div className="mt-1 flex items-center rounded-lg border border-line bg-bg-base px-3">
              <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
              <input className="w-full bg-transparent px-2 py-2.5 text-sm text-ink outline-none" type="number" min={0} step="0.5" placeholder="0,00" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-faded)]">Preenchendo, recalcula o custo médio do insumo (CMV) com base nesta entrada.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Validade do lote (opcional)</label>
            <input className={`${inp} mt-1`} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            <p className="mt-1 text-[11px] text-[var(--text-faded)]">A validade do que está chegando. Alimenta o alerta de vencimento.</p>
          </div>
        </>
      )}

      <button onClick={save} disabled={saving} className="mt-1 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
        {saving ? "Salvando..." : dir === "entrada" ? "Registrar entrada" : "Registrar saída"}
      </button>
    </Overlay>
  );
}

function EditModal({ item, family, onClose, onSaved }: { item: StockItem; family: "food" | "service"; onClose: () => void; onSaved: () => void }) {
  const editFams = FAMILIES.filter((f) => AT_KEYS.includes(f.key) === (family === "service")); // não vaza família AT no food
  const isDose = !!item.dosesPerBottle && item.dosesPerBottle > 0;
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<StockCategory>(item.category);
  const [unit, setUnit] = useState(item.unit);
  const [minQty, setMinQty] = useState(String(item.minQty));
  const [maxQty, setMaxQty] = useState(item.maxQty ? String(item.maxQty) : "");
  const [expiry, setExpiry] = useState(item.expiry ?? "");
  const [sell, setSell] = useState(item.sellPriceCents ? String(item.sellPriceCents / 100) : "");
  const [cost, setCost] = useState(() => {
    const c = isDose ? item.costPerBottleCents : item.costCents;
    return c ? String(c / 100) : "";
  });
  const [supplier, setSupplier] = useState(item.supplier ?? "");
  const [purchaseUnit, setPurchaseUnit] = useState(item.purchaseUnit ?? "");
  const [purchaseFactor, setPurchaseFactor] = useState(item.purchaseFactor ? String(item.purchaseFactor) : "");
  const [barcode, setBarcode] = useState(item.barcode ?? "");
  const [ncm, setNcm] = useState(item.ncm ?? ""); const [cfop, setCfop] = useState(item.cfop ?? ""); const [cest, setCest] = useState(item.cest ?? ""); const [origem, setOrigem] = useState(item.origem ?? "");
  const [saving, setSaving] = useState(false);
  const isVenda = famOf(category).key === "venda";
  const sellable = isVenda || family === "service";
  const isService = family === "service";

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const costC = cost ? Math.round((parseFloat(cost.replace(",", ".")) || 0) * 100) : 0;
    // valores explícitos (não undefined) pra permitir LIMPAR um campo na edição
    await fetch(`/api/estoque/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        category,
        unit,
        minQty: +minQty,
        maxQty: maxQty ? +maxQty : 0,
        expiry: expiry || "",
        sellPriceCents: sellable && sell ? Math.round(parseFloat(sell) * 100) : 0,
        ...(isDose ? { costPerBottleCents: costC } : { costCents: costC }),
        supplier: supplier.trim(),
        purchaseUnit: purchaseUnit.trim(),
        purchaseFactor: purchaseFactor ? parseFloat(purchaseFactor.replace(",", ".")) || 0 : 0,
        barcode: barcode.trim(),
        ncm: ncm.trim(), cfop: cfop.trim(), cest: cest.trim(), origem: origem.trim(),
      }),
    });
    onSaved();
  }

  return (
    <Overlay onClose={onClose} title={`Editar · ${item.name}`}>
      <input className={inp} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <select className={inp} value={category} onChange={(e) => setCategory(e.target.value as StockCategory)}>
        {editFams.map((f) => (
          <optgroup key={f.key} label={f.label}>
            {f.cats.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </optgroup>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2">
        <input className={inp} placeholder="Unid" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={isDose} />
        <input className={inp} type="number" min={0} placeholder="Mínimo" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
        <input className={inp} type="number" min={0} placeholder="Máximo" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} />
      </div>
      <p className="-mt-1 text-[11px] text-[var(--text-faded)]">Mínimo dispara o alerta de repor. Máximo = alvo (compra sugerida = máximo − atual).</p>
      {sellable && (
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)]">Preço de venda</label>
          <div className="mt-1 flex items-center rounded-lg border border-line bg-bg-base px-3">
            <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
            <input className="w-full bg-transparent px-2 py-2.5 text-sm text-ink outline-none" type="number" min={0} step="0.5" placeholder="0,00" value={sell} onChange={(e) => setSell(e.target.value)} />
          </div>
        </div>
      )}
      {sellable && (
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)]">Código de barras (EAN)</label>
          <input className={`${inp} mt-1`} inputMode="numeric" placeholder="Bipe aqui pra preencher" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </div>
      )}
      <div>
        <label className="text-xs font-semibold text-[var(--text-muted)]">{isDose ? "Custo por garrafa (CMV)" : "Custo por unidade (CMV)"}</label>
        <div className="mt-1 flex items-center rounded-lg border border-line bg-bg-base px-3">
          <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
          <input className="w-full bg-transparent px-2 py-2.5 text-sm text-ink outline-none" type="number" min={0} step="0.5" placeholder="0,00" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-faded)]">Quanto você paga. Base do CMV e da margem — corrigir aqui não apaga o histórico.</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-[var(--text-muted)]">Fornecedor (opcional)</label>
        <input className={`${inp} mt-1`} placeholder="ex: Distribuidora Central" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-semibold text-[var(--text-muted)]">Compra em (opcional)</label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <input className={inp} placeholder="Unid. compra (ex: caixa)" value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)} />
          <input className={inp} type="number" min={0} placeholder={`${unit || "un"} por ${purchaseUnit || "compra"}`} value={purchaseFactor} onChange={(e) => setPurchaseFactor(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-[var(--text-muted)]">Validade (opcional)</label>
        <input className={`${inp} mt-1`} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </div>
      {isService && (
        <div className="rounded-lg border border-line bg-bg-base p-2.5">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Fiscal (opcional — pra nota futura)</div>
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} inputMode="numeric" placeholder="NCM (8 díg)" value={ncm} onChange={(e) => setNcm(e.target.value)} />
            <input className={inp} inputMode="numeric" placeholder="CFOP (ex 5102)" value={cfop} onChange={(e) => setCfop(e.target.value)} />
            <input className={inp} inputMode="numeric" placeholder="CEST (opcional)" value={cest} onChange={(e) => setCest(e.target.value)} />
            <select className={inp} value={origem} onChange={(e) => setOrigem(e.target.value)}>
              <option value="">Origem…</option>
              <option value="0">0 · Nacional</option>
              <option value="1">1 · Importada direta</option>
              <option value="2">2 · Importada mercado interno</option>
            </select>
          </div>
        </div>
      )}
      <button onClick={save} disabled={saving} className="mt-1 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-60">
        {saving ? "Salvando..." : "Salvar alterações"}
      </button>
    </Overlay>
  );
}

function HistoryModal({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const moves = [...(item.history ?? [])].reverse();
  const fmt = (at: string) => {
    const d = at.length <= 10 ? at : at.slice(0, 10);
    return d.split("-").reverse().join("/");
  };
  return (
    <Overlay onClose={onClose} title={`Movimentações · ${item.name}`}>
      {moves.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Sem movimentações registradas ainda. Entradas, saídas e ajustes de inventário aparecem aqui.</p>
      ) : (
        <div className="max-h-[55vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {moves.map((m, i) => {
            const isIn = m.type === "entrada";
            return (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <span className={`text-sm font-extrabold ${isIn ? "text-lime" : "text-[var(--red-no)]"}`}>{isIn ? "+" : "−"}{m.qty} {item.unit}</span>
                  <div className="truncate text-xs text-[var(--text-muted)]">{m.reason || (isIn ? "Entrada" : "Saída")}</div>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--text-faded)]">{fmt(m.at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}

// custo por unidade (mesma regra do server unitCostCents): dose = custo/garrafa ÷ doses; senão costCents
function unitCost(it: StockItem): number {
  if (it.dosesPerBottle && it.dosesPerBottle > 0 && it.costPerBottleCents) return Math.round(it.costPerBottleCents / it.dosesPerBottle);
  return Math.max(0, Math.round(it.costCents ?? 0));
}

function InventoryModal({ items, onClose, onApplied }: { items: StockItem[]; onClose: () => void; onApplied: () => void }) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // só itens efetivamente contados (campo preenchido) entram no desvio
  const counted = items
    .map((it) => {
      const raw = counts[it.id];
      if (raw === undefined || raw === "") return null;
      const real = Math.max(0, parseFloat(raw.replace(",", ".")) || 0);
      const deltaQty = +(real - it.qty).toFixed(3);
      const deltaValue = Math.round(deltaQty * unitCost(it));
      return { it, real, deltaQty, deltaValue };
    })
    .filter(Boolean) as { it: StockItem; real: number; deltaQty: number; deltaValue: number }[];

  const falta = counted.reduce((s, c) => s + (c.deltaValue < 0 ? -c.deltaValue : 0), 0);
  const sobra = counted.reduce((s, c) => s + (c.deltaValue > 0 ? c.deltaValue : 0), 0);
  const liquido = sobra - falta;
  const changed = counted.filter((c) => c.deltaQty !== 0);

  async function apply() {
    if (!changed.length) return;
    setSaving(true);
    const payload: Record<string, number> = {};
    for (const c of changed) payload[c.it.id] = c.real;
    await fetch("/api/estoque/inventario", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counts: payload, apply: true }),
    });
    onApplied();
  }

  return (
    <Overlay title="Conferir estoque" onClose={onClose} wide>
      <p className="-mt-2 text-sm text-[var(--text-muted)]">Conte o que tem na prateleira e digite o REAL. O sistema compara com o teórico e mostra a quebra (em R$ pelo custo).</p>

      <div className="grid grid-cols-3 gap-2">
        <Mini label="Falta (perda)" value={brl(falta)} tone="red" />
        <Mini label="Sobra" value={brl(sobra)} tone="lime" />
        <Mini label="Líquido" value={brl(liquido)} tone={liquido < 0 ? "red" : "lime"} />
      </div>

      <div className="max-h-[45vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
        {items.map((it) => {
          const raw = counts[it.id] ?? "";
          const real = raw === "" ? null : Math.max(0, parseFloat(raw.replace(",", ".")) || 0);
          const delta = real === null ? null : +(real - it.qty).toFixed(3);
          const dv = delta === null ? 0 : Math.round(delta * unitCost(it));
          return (
            <div key={it.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{it.name}</div>
                <div className="text-[11px] text-[var(--text-faded)]">teórico {it.qty} {it.unit}{unitCost(it) ? ` · custo ${brl(unitCost(it))}/${it.unit}` : " · sem custo"}</div>
              </div>
              {delta !== null && delta !== 0 && (
                <span className={`shrink-0 text-xs font-bold ${dv < 0 ? "text-[var(--red-no)]" : "text-lime"}`}>
                  {delta > 0 ? "+" : ""}{delta} {it.unit} {dv ? `(${dv > 0 ? "+" : ""}${brl(dv)})` : ""}
                </span>
              )}
              <input
                type="number" min={0} inputMode="decimal" placeholder={String(it.qty)}
                value={raw} onChange={(e) => setCounts((c) => ({ ...c, [it.id]: e.target.value }))}
                className="w-20 shrink-0 rounded-lg border border-line bg-bg-base px-2 py-1.5 text-right text-sm text-ink outline-none focus:border-brand-600"
              />
            </div>
          );
        })}
      </div>

      <button onClick={apply} disabled={saving || !changed.length} className="w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-50">
        {saving ? "Aplicando..." : changed.length ? `Aplicar ajuste em ${changed.length} ${changed.length === 1 ? "item" : "itens"}` : "Nada a ajustar"}
      </button>
      <p className="-mt-1 text-[11px] text-[var(--text-faded)]">Aplicar seta o estoque ao real e registra a diferença como &quot;Ajuste inventário&quot; no histórico.</p>
    </Overlay>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: "red" | "lime" }) {
  return (
    <div className="rounded-xl border border-line bg-bg-base p-2.5 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faded)]">{label}</div>
      <div className={`text-sm font-extrabold ${tone === "red" ? "text-[var(--red-no)]" : "text-lime"}`}>{value}</div>
    </div>
  );
}

function Overlay({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`absolute inset-x-0 bottom-0 mx-auto ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto animate-pop rounded-t-3xl bg-bg-elevated p-5 shadow-[var(--shadow-pop)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl`}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <h2 className="mb-4 text-lg font-extrabold text-ink">{title}</h2>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}
