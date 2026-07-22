// Store de mesas e comandas · salão da açaiteria (server-side, Supabase via db()).
// Tabelas reais e relacionais já existem no schema (NÃO são o padrão {id,data} dos
// protótipos): tables / tabs / tab_orders / tab_order_items / tab_payments / service_calls.
// Salão simples: SEM cover artístico, SEM dose/garrafa, SEM roteamento de estação,
// SEM garçom/comissão. Todos os valores em CENTAVOS (int).
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { applyConsumes, listStock, unitCostCents, moveStock } from "@/lib/stock-store";
import { todayBR } from "@/lib/date-br";
import { awardPoints, getByPhone, normPhone, reversePoints } from "@/lib/customers-store";
import { pointsForSale } from "@/lib/loyalty";
import { WEIGHT_BASE_STOCK_ID } from "@/lib/menu";
import { getLoyalty } from "@/lib/loyalty-store";
import { readMenu } from "@/lib/menu-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { getActiveEvent } from "@/lib/events-store";

const POLPA_STOCK_ID = WEIGHT_BASE_STOCK_ID; // insumo base do açaí pesado (kg) — fonte única em menu.ts

const num = (v: unknown) => Number(v ?? 0);

// ── Tipos ──────────────────────────────────────────────────────────────────
export type TabStatus = "aberta" | "fechada";

export type StockConsume = { stockId: string; qty: number; costCents?: number };

export type Tab = {
  id: number;
  table_id: number | null;
  label: string | null;
  status: TabStatus;
  opened_at: string;
  closed_at: string | null;
  service_fee_cents: number;
  customer_phone: string | null;
  customer_name: string | null;
  cover_cents: number; // couvert artístico (snapshot na abertura = cover do show × pessoas)
  people_count: number;
};

export type TabItem = {
  id: number;
  tab_order_id: number;
  name: string;
  size_label: string | null;
  qty: number;
  unit_price_cents: number;
  consumes: StockConsume[] | null;
  note?: string | null;
  mods?: { name: string; price_cents: number }[] | null;
  earns_points?: boolean; // fidelidade: a categoria do item pontua? (ausente = sim)
};

export type TabOrder = {
  id: number;
  tab_id: number;
  note: string | null;
  status: string; // 'pendente'
  created_at: string;
  station: string; // 'cozinha' | 'bar' | 'copa' ... (roteamento; default 'cozinha')
};

export type TabPayment = {
  id: number;
  tab_id: number;
  method: string;
  amount_cents: number;
  fee_percent: number;
  paid_at: string;
};

export type ServiceCallType = "conta" | "atendente";
export type ServiceCall = {
  id: number;
  table_number: number;
  tab_id: number | null;
  type: ServiceCallType;
  status: "pendente" | "atendido";
  created_at: string;
};

export type TableCard = {
  number: number;
  area: string;
  tabId: number | null;
  openTotalCents: number;
  openedAt: string | null;
  contaCalled: boolean; // cliente pediu a conta (service_call 'conta' pendente) — tile âmbar no topo
};

// Item novo a lançar numa comanda
export type NewTabItem = {
  name: string;
  sizeLabel?: string | null;
  qty: number;
  unitPriceCents: number;
  consumes?: StockConsume[] | null;
  sizeId?: string; // copo: ficha técnica resolvida pelo tamanho no servidor
  grams?: number; // peso: polpa proporcional resolvida no servidor
  productId?: string; // bar: ficha técnica do menu_product resolvida no servidor (baixa automática)
  stockId?: string; // revenda direta (refri/picolé): baixa 1 un do próprio item de estoque
  station?: string; // estação de preparo (bar). Ausente = 'cozinha' (açaí).
  mods?: { name: string; price_cents: number }[] | null; // personalização escolhida (espelha no KDS/cupom)
  note?: string | null; // observação da LINHA (ex: ponto da carne, sem cebola)
  earnsPoints?: boolean; // fidelidade: a categoria do item pontua? (ausente = sim)
};

// ── Mesas ────────────────────────────────────────────────────────────────────

/** Mesas com o estado da comanda aberta (se houver). Total = soma qty*unit_price. */
export async function getTables(): Promise<TableCard[]> {
  const d = db();
  const sid = await resolveStoreId();
  const { data: tables } = await d.from("tables").select("id, number, area").eq("store_id", sid).order("number");
  if (!tables?.length) return [];

  // comandas abertas → indexa por mesa
  const { data: openTabs } = await d
    .from("tabs")
    .select("id, table_id, opened_at")
    .eq("store_id", sid)
    .eq("status", "aberta");
  const tabByTable = new Map<number, { id: number; opened_at: string }>();
  for (const t of openTabs ?? []) {
    if (t.table_id != null) tabByTable.set(num(t.table_id), { id: num(t.id), opened_at: t.opened_at });
  }

  // total dos itens das comandas abertas
  const tabIds = [...tabByTable.values()].map((t) => t.id);
  const totalByTab = new Map<number, number>();
  if (tabIds.length) {
    const { data: orders } = await d.from("tab_orders").select("id, tab_id").in("tab_id", tabIds);
    const orderToTab = new Map((orders ?? []).map((o) => [num(o.id), num(o.tab_id)]));
    const orderIds = (orders ?? []).map((o) => num(o.id));
    if (orderIds.length) {
      const { data: items } = await d
        .from("tab_order_items")
        .select("tab_order_id, qty, unit_price_cents")
        .in("tab_order_id", orderIds);
      for (const it of items ?? []) {
        const tabId = orderToTab.get(num(it.tab_order_id));
        if (tabId == null) continue;
        totalByTab.set(tabId, (totalByTab.get(tabId) ?? 0) + num(it.qty) * num(it.unit_price_cents));
      }
    }
  }

  // "pediu a conta": chamados 'conta' pendentes — mapeia por tab_id (preferido) ou nº da mesa.
  // Como só marcamos contaCalled em mesa COM comanda aberta, chamado de mesa já liberada não vaza.
  const { data: calls } = await d
    .from("service_calls")
    .select("tab_id, table_number, type")
    .eq("store_id", sid)
    .eq("status", "pendente")
    .eq("type", "conta");
  const contaTabIds = new Set<number>();
  const contaTableNums = new Set<number>();
  for (const c of (calls ?? []) as Array<{ tab_id: number | null; table_number: number }>) {
    if (c.tab_id != null) contaTabIds.add(num(c.tab_id));
    else contaTableNums.add(num(c.table_number));
  }

  return (tables ?? []).map((tbl) => {
    const open = tabByTable.get(num(tbl.id));
    return {
      number: num(tbl.number),
      area: (tbl.area as string) ?? "salao",
      tabId: open?.id ?? null,
      openTotalCents: open ? totalByTab.get(open.id) ?? 0 : 0,
      openedAt: open?.opened_at ?? null,
      contaCalled: open ? contaTabIds.has(open.id) || contaTableNums.has(num(tbl.number)) : false,
    };
  });
}

/** Cria as mesas 1..n (area 'salao') que ainda não existem. Idempotente. */
export async function ensureTables(n: number, storeId?: string): Promise<void> {
  const d = db();
  const sid = storeId ?? (await resolveStoreId()); // storeId explícito no cadastro (server-side, sem sessão)
  const { data: existing } = await d.from("tables").select("number").eq("store_id", sid);
  const have = new Set((existing ?? []).map((t) => num(t.number)));
  const missing: { number: number; area: string; store_id: string }[] = [];
  for (let i = 1; i <= n; i++) if (!have.has(i)) missing.push({ number: i, area: "salao", store_id: sid });
  if (missing.length) await d.from("tables").insert(missing);
}

// ── Comandas ─────────────────────────────────────────────────────────────────

/** Comanda aberta da mesa (status='aberta') ou cria uma nova. storeId explícito no fluxo público
 *  (pedido pela mesa via slug, sem auth — senão resolveStoreId cairia na loja errada). */
export async function getOrCreateOpenTab(tableId: number, label?: string, storeId?: string, pax?: number): Promise<Tab> {
  const d = db();
  const sid = storeId ?? (await resolveStoreId());
  const { data: existing } = await d
    .from("tabs")
    .select("*")
    .eq("store_id", sid)
    .eq("table_id", tableId)
    .eq("status", "aberta")
    .maybeSingle();
  if (existing) return existing as Tab;

  // COUVERT artístico: só entra quando o nº de pessoas é informado pelo GARÇOM ou CAIXA (pax).
  // Pedido pelo QR do cliente NÃO cobra couvert — a página do QR só AVISA que a noite tem couvert
  // artístico; quem lança as pessoas e cobra é o garçom/caixa (ajustável na comanda).
  let cover_cents = 0;
  const people_count = Math.max(1, Math.round(pax ?? 1));
  if (pax && pax > 0) {
    const cfg = await getStoreConfig(sid);
    if (cfg?.cover_enabled) {
      const ev = await getActiveEvent(sid);
      if (ev) cover_cents = ev.cover_cents * people_count;
    }
  }

  const { data, error } = await d
    .from("tabs")
    .insert({ store_id: sid, table_id: tableId, label: label ?? null, status: "aberta", service_fee_cents: 0, cover_cents, people_count })
    .select()
    .single();
  if (error) {
    // CORRIDA: 2 pedidos simultâneos na mesma mesa (vários QR ao mesmo tempo). O índice parcial
    // único (mt-21: 1 comanda aberta por mesa) barra o 2º insert → reusa a comanda que venceu.
    if ((error as { code?: string }).code === "23505") {
      const { data: tab } = await d
        .from("tabs").select("*").eq("store_id", sid).eq("table_id", tableId).eq("status", "aberta").maybeSingle();
      if (tab) return tab as Tab;
    }
    throw error;
  }
  return data as Tab;
}

/** Ajusta o nº de pessoas de uma comanda ABERTA e RE-FAZ o snapshot do couvert (cover × pessoas).
 *  Server-authoritative: o valor do show vem do getActiveEvent, nunca do client. */
export async function setTabPeople(tabId: number, pax: number): Promise<{ people_count: number; cover_cents: number }> {
  const d = db();
  const sid = await resolveStoreId();
  const { data: tab } = await d.from("tabs").select("id, status").eq("id", tabId).eq("store_id", sid).maybeSingle();
  if (!tab) throw new Error("Comanda não encontrada.");
  if ((tab as { status: string }).status === "fechada") throw new Error("Comanda já fechada.");
  const people_count = Math.max(1, Math.round(pax));
  let cover_cents = 0;
  const cfg = await getStoreConfig(sid);
  if (cfg?.cover_enabled) {
    const ev = await getActiveEvent(sid);
    if (ev) cover_cents = ev.cover_cents * people_count;
  }
  const { error } = await d.from("tabs").update({ people_count, cover_cents }).eq("id", tabId).eq("store_id", sid);
  if (error) throw error;
  return { people_count, cover_cents };
}

/** Resolve a mesa pelo NÚMERO (cria se não existir). Pro QR público /[slug]/mesa/N. */
export async function getOrCreateTableByNumber(tableNumber: number, storeId?: string): Promise<number> {
  const d = db();
  const sid = storeId ?? (await resolveStoreId());
  const { data: ex } = await d.from("tables").select("id").eq("store_id", sid).eq("number", tableNumber).maybeSingle();
  if (ex) return num(ex.id);
  const { data, error } = await d.from("tables").insert({ store_id: sid, number: tableNumber, area: "salao" }).select("id").single();
  if (error) {
    // CORRIDA: criação simultânea da mesma mesa (UNIQUE store_id+number) → reusa a que venceu
    if ((error as { code?: string }).code === "23505") {
      const { data: ex2 } = await d.from("tables").select("id").eq("store_id", sid).eq("number", tableNumber).maybeSingle();
      if (ex2) return num(ex2.id);
    }
    throw error;
  }
  return num((data as { id: number }).id);
}

/** Lança itens numa comanda, ROTEANDO por estação: 1 tab_order por estação (cozinha/bar/...),
 *  cada um com seus tab_order_items. Itens de cozinha+bar viram 2 tab_orders → cada um vai pra
 *  sua impressora/KDS, mas a comanda (tab) soma tudo. Açaí (sem station) = 1 tab_order 'cozinha'.
 *  Baixa estoque por ficha técnica. Retorna os tab_orders criados (um por estação). */
export async function addTabItems(tabId: number, items: NewTabItem[], storeId?: string, note?: string): Promise<TabOrder[]> {
  const d = db();
  const sid = storeId ?? (await resolveStoreId());
  // a comanda tem que ser DESTA loja (anti-IDOR: não injetar item em comanda alheia)
  const { data: ownTab } = await d.from("tabs").select("id").eq("id", tabId).eq("store_id", sid).maybeSingle();
  if (!ownTab) throw new Error("Comanda não encontrada.");
  const menu = await readMenu(storeId);

  // ficha técnica do BAR resolvida no SERVIDOR pelo productId (recipe do menu_products, nunca do client)
  const prodIds = [...new Set(items.map((it) => it.productId).filter(Boolean) as string[])];
  const recipeByProduct = new Map<string, StockConsume[]>();
  const nameByProduct = new Map<string, string>();
  const sizeByProduct = new Map<string, string>(); // 'dose' | 'garrafa' | ... → roteia a baixa pro estoque certo
  const noPrepByProduct = new Map<string, boolean>(); // categoria "pronto pra servir" → some do quadro de Preparo (mas imprime/cobra normal)
  if (prodIds.length) {
    const { data: prods } = await d.from("menu_products").select("id, recipe, name, category_id, size_label").eq("store_id", sid).in("id", prodIds);
    const catIds = [...new Set(((prods ?? []) as { category_id?: string }[]).map((p) => p.category_id).filter(Boolean) as string[])];
    const noPrepByCat = new Map<string, boolean>();
    if (catIds.length) {
      const { data: cats } = await d.from("menu_categories").select("id, no_prep").in("id", catIds);
      for (const c of (cats ?? []) as { id: string; no_prep?: boolean }[]) noPrepByCat.set(String(c.id), !!c.no_prep);
    }
    for (const p of (prods ?? []) as { id: string; recipe: unknown; name: string; category_id?: string; size_label?: string }[]) {
      const r = Array.isArray(p.recipe)
        ? (p.recipe as StockConsume[]).map((x) => ({ stockId: String(x?.stockId ?? ""), qty: num(x?.qty) })).filter((x) => x.stockId && x.qty > 0)
        : [];
      recipeByProduct.set(String(p.id), r);
      nameByProduct.set(String(p.id), String(p.name ?? ""));
      sizeByProduct.set(String(p.id), String(p.size_label ?? "").toLowerCase());
      noPrepByProduct.set(String(p.id), p.category_id ? (noPrepByCat.get(String(p.category_id)) ?? false) : false);
    }
  }

  // custo CONGELADO dos insumos no momento da venda → CMV histórico estável (não muda se o custo
  // for editado depois). Não-fatal: se o estoque falhar de ler, segue sem custo (cmv usa o atual).
  // Também indexa o estoque POR NOME → baixa automática por nome (bar): produto sem ficha técnica
  // baixa 1 unid/dose do item de estoque de mesmo nome (ex.: dose "Old Parr" → −1 dose do estoque
  // "Old Parr"; "Heineken" → −1 un). É o que liga a venda à baixa sem cadastrar recipe em cada item.
  // DOIS índices por nome: estoque em DOSE (destilado controlado por garrafa→doses) e estoque em
  // UNIDADE (garrafa inteira / revenda). Assim a venda de DOSE baixa a dose, e a de GARRAFA baixa a
  // garrafa — nunca se confundem (mesmo nome, ex.: "Beefeater" pode ter os dois, cada um baixa o seu).
  const costById = new Map<string, number>();
  const doseStockByName = new Map<string, string>();
  const unitStockByName = new Map<string, string>();
  const normName = (s: string) => s.normalize("NFC").trim().toLowerCase();
  try {
    for (const s of await listStock(sid)) {
      costById.set(s.id, unitCostCents(s));
      if (!s.name) continue;
      if (s.dosesPerBottle && s.dosesPerBottle > 0) doseStockByName.set(normName(s.name), s.id);
      else unitStockByName.set(normName(s.name), s.id);
    }
  } catch (e) {
    console.error("addTabItems: falha ao congelar custo no consumes (segue sem custo):", e instanceof Error ? e.message : e);
  }

  // ficha técnica resolvida no SERVIDOR (ignora consumes que vierem do client)
  const resolved = items.map((it) => {
    let consumes: StockConsume[] = [];
    if (it.sizeId) {
      const size = menu.sizes.find((s) => s.id === it.sizeId);
      consumes = (size?.recipe ?? []).map((r) => ({ stockId: r.stockId, qty: r.qty }));
    } else if (it.grams && it.grams > 0) {
      consumes = [{ stockId: POLPA_STOCK_ID, qty: +(it.grams / 1000).toFixed(3) }];
    } else if (it.productId) {
      consumes = recipeByProduct.get(it.productId) ?? [];
      // sem ficha técnica → baixa por NOME, roteada pelo TIPO do produto:
      // garrafa → estoque de garrafa/unidade (NUNCA a dose); dose → estoque de dose; demais → unidade, senão dose.
      if (!consumes.length) {
        const nm = normName(nameByProduct.get(it.productId) ?? "");
        const size = sizeByProduct.get(it.productId) ?? "";
        const sid2 = size === "garrafa" ? unitStockByName.get(nm)
          : size === "dose" ? doseStockByName.get(nm)
          : (unitStockByName.get(nm) ?? doseStockByName.get(nm));
        if (sid2) consumes = [{ stockId: sid2, qty: 1 }];
      }
    } else if (it.stockId) {
      consumes = [{ stockId: it.stockId, qty: 1 }]; // revenda: baixa 1 un do próprio item
    }
    consumes = consumes.map((c) => ({ ...c, costCents: costById.get(c.stockId) ?? 0 }));
    const noPrep = it.productId ? (noPrepByProduct.get(it.productId) ?? false) : false;
    return { ...it, consumes, station: it.station || "cozinha", noPrep };
  });

  // agrupa por estação → 1 tab_order por estação (o roteamento)
  const byStation = new Map<string, typeof resolved>();
  for (const it of resolved) {
    const arr = byStation.get(it.station) ?? [];
    arr.push(it);
    byStation.set(it.station, arr);
  }

  const created: TabOrder[] = [];
  for (const [station, group] of byStation) {
    const { data: order, error } = await d
      .from("tab_orders")
      .insert({ store_id: sid, tab_id: tabId, status: "pendente", station, note: note ?? null })
      .select()
      .single();
    if (error) throw error;

    const rows = group.map((it) => ({
      store_id: sid,
      tab_order_id: (order as TabOrder).id,
      name: it.name,
      size_label: it.sizeLabel ?? null,
      qty: it.qty,
      unit_price_cents: it.unitPriceCents,
      consumes: it.consumes,
      mods: it.mods ?? null,
      note: it.note ?? null,
      earns_points: it.earnsPoints !== false, // ausente = pontua (default)
      no_prep: it.noPrep, // "pronto pra servir": imprime/cobra, mas some do quadro de Preparo
    }));
    const { error: e2 } = await d.from("tab_order_items").insert(rows);
    if (e2) throw e2;
    created.push(order as TabOrder);
  }

  // baixa de estoque pela ficha técnica resolvida — NÃO-FATAL (os itens já estão na comanda acima;
  // uma falha de baixa não pode derrubar o lançamento já commitado).
  const today = todayBR();
  const consumes = resolved.flatMap((it) => it.consumes.map((c) => ({ stockId: c.stockId, qty: c.qty * it.qty })));
  await applyConsumes(consumes, "Mesa comanda", today, sid);
  return created;
}

// ── KDS (telas de preparo por estação) ───────────────────────────────────────
export type KdsItem = { name: string; size_label: string | null; qty: number; mods: { name: string; price_cents: number }[] | null; note?: string | null; no_prep?: boolean };
export type KdsOrder = {
  id: number;
  station: string;
  status: string; // 'pendente' | 'preparando' | 'pronto'
  created_at: string;
  table_label: string;
  note: string | null;
  items: KdsItem[];
};

export const KDS_STATUSES = ["pendente", "preparando", "pronto"] as const;
// avança pendente → preparando → pronto → entregue (sai do KDS)
export function nextKdsStatus(s: string): string {
  const i = KDS_STATUSES.indexOf(s as (typeof KDS_STATUSES)[number]);
  return i < 0 ? "preparando" : i >= KDS_STATUSES.length - 1 ? "entregue" : KDS_STATUSES[i + 1];
}

/** Pedidos ABERTOS (pendente/preparando/pronto) das estações dadas, com itens e a mesa.
 *  É o feed do KDS — cada tab_order já vem roteado pra UMA estação pelo addTabItems. */
export async function getStationOrders(stations: string[]): Promise<KdsOrder[]> {
  const d = db();
  const sid = await resolveStoreId();
  const { data: orders } = await d
    .from("tab_orders")
    .select("id, tab_id, station, status, note, created_at")
    .eq("store_id", sid)
    .in("station", stations)
    .in("status", KDS_STATUSES as unknown as string[])
    .order("created_at");
  const list = (orders ?? []) as Array<{ id: number; tab_id: number; station: string; status: string; note: string | null; created_at: string }>;
  if (!list.length) return [];

  const orderIds = list.map((o) => o.id);
  const tabIds = [...new Set(list.map((o) => o.tab_id))];
  const [{ data: items }, { data: tabs }] = await Promise.all([
    d.from("tab_order_items").select("tab_order_id, name, size_label, qty, mods, note, no_prep").in("tab_order_id", orderIds),
    d.from("tabs").select("id, label").in("id", tabIds),
  ]);
  const labelByTab = new Map<number, string>();
  for (const t of (tabs ?? []) as Array<{ id: number; label: string | null }>) labelByTab.set(t.id, t.label ?? "Balcão");
  const byOrder = new Map<number, KdsItem[]>();
  for (const it of (items ?? []) as Array<{ tab_order_id: number; name: string; size_label: string | null; qty: number; mods: { name: string; price_cents: number }[] | null; note: string | null; no_prep: boolean | null }>) {
    const arr = byOrder.get(it.tab_order_id) ?? [];
    arr.push({ name: it.name, size_label: it.size_label, qty: num(it.qty), mods: it.mods ?? null, note: (it.note ?? null), no_prep: !!it.no_prep });
    byOrder.set(it.tab_order_id, arr);
  }
  return list.map((o) => ({
    id: o.id,
    station: o.station,
    status: o.status,
    created_at: o.created_at,
    table_label: labelByTab.get(o.tab_id) ?? "Balcão",
    note: o.note,
    items: byOrder.get(o.id) ?? [],
  }));
}

/** Avança/define o status de um pedido (KDS). Não deixa mexer em loja de outro dono. */
export async function advanceTabOrder(orderId: number, status: string): Promise<void> {
  const sid = await resolveStoreId();
  await db().from("tab_orders").update({ status }).eq("id", orderId).eq("store_id", sid);
}

export type TabFull = {
  tab: Tab;
  orders: (TabOrder & { items: TabItem[] })[];
  payments: TabPayment[];
  consumoCents: number; // soma dos itens — É A BASE DA TAXA DE SERVIÇO (couvert NÃO entra)
  eligibleCents: number; // consumo só das categorias que pontuam — base da FIDELIDADE
  coverCents: number; // couvert artístico (snapshot) — fora da base da taxa (CDC)
  totalCents: number; // consumo + couvert (sem a taxa, que é opcional no fechamento)
  paidCents: number;
};

/** Comanda completa: tab + pedidos com itens + pagamentos + totais. storeId trava a loja
 *  (sem ele um dono leria comanda de outra loja chutando o tabId — db() bypassa RLS). */
export async function getTabFull(tabId: number, storeId?: string): Promise<TabFull> {
  const d = db();
  const sid = storeId ?? (await resolveStoreId());
  const { data: tab } = await d.from("tabs").select("*").eq("id", tabId).eq("store_id", sid).maybeSingle();
  if (!tab) throw new Error("Comanda não encontrada.");
  const { data: orders } = await d
    .from("tab_orders")
    .select("*")
    .eq("tab_id", tabId)
    .order("created_at");
  const orderIds = (orders ?? []).map((o) => num(o.id));
  const { data: items } = orderIds.length
    ? await d.from("tab_order_items").select("*").in("tab_order_id", orderIds)
    : { data: [] as TabItem[] };
  const { data: payments } = await d
    .from("tab_payments")
    .select("*")
    .eq("tab_id", tabId)
    .order("paid_at");

  const withItems = (orders ?? []).map((o) => ({
    ...(o as TabOrder),
    items: ((items ?? []) as TabItem[])
      .filter((i) => num(i.tab_order_id) === num(o.id))
      .map((i) => ({ ...i, qty: num(i.qty), unit_price_cents: num(i.unit_price_cents) })),
  }));
  const consumoCents = ((items ?? []) as TabItem[]).reduce(
    (s, i) => s + num(i.qty) * num(i.unit_price_cents),
    0,
  );
  // fidelidade por categoria: só os itens cuja categoria pontua (earns_points !== false)
  const eligibleCents = ((items ?? []) as TabItem[]).reduce(
    (s, i) => s + (i.earns_points === false ? 0 : num(i.qty) * num(i.unit_price_cents)),
    0,
  );
  const coverCents = num((tab as Tab).cover_cents); // couvert NÃO entra na base da taxa de serviço
  const totalCents = consumoCents + coverCents;
  const paidCents = ((payments ?? []) as TabPayment[]).reduce((s, p) => s + num(p.amount_cents), 0);

  return {
    tab: tab as Tab,
    orders: withItems,
    payments: (payments ?? []) as TabPayment[],
    consumoCents,
    eligibleCents,
    coverCents,
    totalCents,
    paidCents,
  };
}

/** Cancela unidades de um item de comanda ABERTA: estorna o estoque, registra o motivo
 *  (log auditável — não some sem rastro) e tira da comanda (decrementa a linha; some se
 *  zerar). Se o pedido do KDS esvaziar, apaga o tab_order (sai do quadro de Preparo).
 *  Só comanda aberta — comanda fechada estorna pelo Caixa (cancelar-venda). Anti-IDOR:
 *  trava a loja (sid) em cada passo, já que db() bypassa RLS. */
export async function cancelTabItem(
  itemId: number,
  opts: { units?: number; reason: string; by?: string },
): Promise<{ cancelledQty: number; itemName: string; tabId: number; tabFreed: boolean }> {
  const d = db();
  const sid = await resolveStoreId();
  const reason = (opts.reason ?? "").trim().slice(0, 200);
  if (!reason) throw new Error("Diga o motivo do cancelamento.");

  // 1) item → pedido → comanda (exige item DESTA loja e comanda ABERTA)
  const { data: item } = await d
    .from("tab_order_items").select("*").eq("id", itemId).eq("store_id", sid).maybeSingle();
  if (!item) throw new Error("Item não encontrado.");
  const it = item as TabItem;
  const { data: order } = await d
    .from("tab_orders").select("id, tab_id").eq("id", it.tab_order_id).eq("store_id", sid).maybeSingle();
  if (!order) throw new Error("Pedido não encontrado.");
  const tabId = num((order as { tab_id: number }).tab_id);
  const { data: tab } = await d.from("tabs").select("id, status, cover_cents").eq("id", tabId).eq("store_id", sid).maybeSingle();
  if (!tab) throw new Error("Comanda não encontrada.");
  if ((tab as { status: string }).status !== "aberta") throw new Error("Comanda já fechada — estorne pelo Caixa.");

  const have = num(it.qty);
  const units = Math.max(1, Math.min(opts.units ?? have, have)); // lixeira (units ausente) = linha toda

  // 2) estorna o estoque das unidades canceladas (entrada) — NÃO-FATAL, igual à baixa original
  const today = todayBR();
  for (const c of (it.consumes ?? [])) {
    if (!c.stockId || !(c.qty > 0)) continue;
    try { await moveStock(c.stockId, "entrada", c.qty * units, "Cancelamento de item", today, sid); }
    catch (e) { console.error("cancelTabItem estorno estoque:", e); }
  }

  // 3) registro auditável (o quê, quanto, motivo, quem)
  await d.from("tab_item_cancellations").insert({
    store_id: sid, tab_id: tabId, tab_order_id: it.tab_order_id,
    item_name: it.name, size_label: it.size_label ?? null, qty: units,
    unit_price_cents: it.unit_price_cents, mods: it.mods ?? null,
    reason, cancelled_by: opts.by ?? null,
  });

  // 4) tira da comanda: decrementa; se zerou, apaga a linha; se o pedido esvaziou, apaga o pedido (sai do KDS)
  let tabFreed = false;
  if (units >= have) {
    await d.from("tab_order_items").delete().eq("id", itemId).eq("store_id", sid);
    const { count: itemsInOrder } = await d.from("tab_order_items").select("id", { count: "exact", head: true }).eq("tab_order_id", it.tab_order_id).eq("store_id", sid);
    if (!itemsInOrder) await d.from("tab_orders").delete().eq("id", it.tab_order_id).eq("store_id", sid);

    // comanda esvaziou DE VEZ? (0 itens em qualquer pedido, 0 pago, sem couvert) → libera a mesa.
    // NÃO vira venda R$0: apaga a comanda vazia (mesmo padrão do rollback do lançar). Trava: se
    // sobrou couvert (mesa aberta pro show) ou pagamento parcial, quem decide é o caixa (não libera).
    const { data: orders } = await d.from("tab_orders").select("id").eq("tab_id", tabId).eq("store_id", sid);
    const orderIds = (orders ?? []).map((o) => num((o as { id: number }).id));
    const { count: itemsLeft } = orderIds.length
      ? await d.from("tab_order_items").select("id", { count: "exact", head: true }).in("tab_order_id", orderIds).eq("store_id", sid)
      : { count: 0 };
    const { count: paysLeft } = await d.from("tab_payments").select("id", { count: "exact", head: true }).eq("tab_id", tabId).eq("store_id", sid);
    const coverLeft = num((tab as { cover_cents?: number }).cover_cents);
    if (!itemsLeft && !paysLeft && !coverLeft) {
      await d.from("tab_orders").delete().eq("tab_id", tabId).eq("store_id", sid); // pedidos órfãos (defensivo)
      await d.from("tabs").delete().eq("id", tabId).eq("store_id", sid);           // mt-31: log de cancelamento sobrevive (sem cascade)
      tabFreed = true;
    }
  } else {
    await d.from("tab_order_items").update({ qty: have - units }).eq("id", itemId).eq("store_id", sid);
  }

  return { cancelledQty: units, itemName: it.name, tabId, tabFreed };
}

/** Transfere a comanda pra outra mesa (cliente trocou de lugar). Mesa destino LIVRE → move
 *  (table_id/label). Mesa destino OCUPADA + merge → funde: reatribui pedidos (itens/KDS) e
 *  pagamentos pro tab do destino, soma couvert/pessoas e apaga o tab de origem (mesa de origem
 *  volta pra Livre). Só comanda ABERTA. Anti-IDOR: sid trava a loja em cada passo. */
export async function transferTab(
  tabId: number,
  toTableNumber: number,
  opts: { merge?: boolean } = {},
): Promise<{ mode: "transfer" | "merge"; tabId: number; toTableNumber: number }> {
  const d = db();
  const sid = await resolveStoreId();

  const { data: src } = await d.from("tabs").select("*").eq("id", tabId).eq("store_id", sid).maybeSingle();
  if (!src) throw new Error("Comanda não encontrada.");
  const srcTab = src as Tab;
  if (srcTab.status !== "aberta") throw new Error("Comanda já fechada — não dá pra transferir.");

  const toTableId = await getOrCreateTableByNumber(toTableNumber, sid);
  if (num(srcTab.table_id) === toTableId) throw new Error("A comanda já está nessa mesa.");

  // rótulo pela ÁREA da mesa destino (Balcão N × Mesa N), igual os tiles
  const { data: destTable } = await d.from("tables").select("area").eq("id", toTableId).eq("store_id", sid).maybeSingle();
  const label = ((destTable as { area?: string })?.area === "balcao" ? "Balcão " : "Mesa ") + toTableNumber;

  // chamados pendentes da origem (pediu a conta / atendente) viram atendidos — o cliente saiu de lá
  await d.from("service_calls").update({ status: "atendido" }).eq("tab_id", tabId).eq("store_id", sid).eq("status", "pendente");

  // mesa destino já tem comanda aberta?
  const { data: destRow } = await d.from("tabs").select("*").eq("store_id", sid).eq("table_id", toTableId).eq("status", "aberta").maybeSingle();

  if (!destRow) {
    // TRANSFER: move a comanda pra mesa livre
    const { error } = await d.from("tabs").update({ table_id: toTableId, label }).eq("id", tabId).eq("store_id", sid);
    if (error) {
      // corrida: a mesa destino ficou ocupada entre a checagem e o update (índice tabs_one_open_per_table)
      if ((error as { code?: string }).code === "23505") throw new Error("Mesa destino ficou ocupada agora — tente de novo (dá pra juntar).");
      throw error;
    }
    return { mode: "transfer", tabId, toTableNumber };
  }

  // MERGE: destino ocupado — funde a origem NO destino (destino fica, origem some)
  if (!opts.merge) throw new Error(`Mesa ${toTableNumber} está ocupada. Confirme a junção das comandas.`);
  const destTab = destRow as Tab;
  // 1) reatribui pedidos (itens/KDS) e pagamentos da origem pro destino
  await d.from("tab_orders").update({ tab_id: destTab.id }).eq("tab_id", tabId).eq("store_id", sid);
  await d.from("tab_payments").update({ tab_id: destTab.id }).eq("tab_id", tabId).eq("store_id", sid);
  // 2) couvert/pessoas somam (snapshots do MESMO show → cover/pessoa consistente)
  await d.from("tabs").update({
    cover_cents: num(destTab.cover_cents) + num(srcTab.cover_cents),
    people_count: num(destTab.people_count) + num(srcTab.people_count),
  }).eq("id", destTab.id).eq("store_id", sid);
  // 3) apaga a comanda de origem (já vazia) — mesa de origem volta pra Livre. mt-31: log de
  //    cancelamento da origem sobrevive (sem cascade por tab_id).
  await d.from("tabs").delete().eq("id", tabId).eq("store_id", sid);

  return { mode: "merge", tabId: num(destTab.id), toTableNumber };
}

/** Registra um pagamento na comanda. */
export async function addPayment(
  tabId: number,
  method: string,
  amountCents: number,
  feePercent = 0,
): Promise<TabPayment> {
  const sid = await resolveStoreId();
  // valida que a comanda é DESTA loja antes de registrar pagamento (anti-IDOR)
  const { data: tab } = await db().from("tabs").select("id").eq("id", tabId).eq("store_id", sid).maybeSingle();
  if (!tab) throw new Error("Comanda não encontrada.");
  const { data, error } = await db()
    .from("tab_payments")
    .insert({ store_id: sid, tab_id: tabId, method, amount_cents: amountCents, fee_percent: feePercent })
    .select()
    .single();
  if (error) throw error;
  return data as TabPayment;
}

export type CloseTabOpts = {
  serviceFeeCents?: number;
  coverCents?: number; // se vier (couvert isentado no fechamento), sobrescreve o snapshot na comanda — mantém repasse/relatório certos
  customerPhone?: string;
  customerName?: string;
};

/** Fecha a comanda. Se vier telefone, pontua fidelidade sobre o total dos PRODUTOS (sem taxa). */
export async function closeTab(tabId: number, opts: CloseTabOpts = {}): Promise<{ pointsAwarded: number }> {
  const d = db();
  const sid = await resolveStoreId();

  // fidelidade pontua só sobre o CONSUMO das categorias que pontuam — nunca couvert nem taxa
  const full = await getTabFull(tabId, sid);
  // idempotente: comanda já fechada não pontua de novo (anti duplo-clique/retry)
  if (full.tab.status === "fechada") return { pointsAwarded: 0 };
  const productCents = full.eligibleCents;

  const phone = opts.customerPhone ? normPhone(opts.customerPhone) : "";
  const name = opts.customerName?.trim() || full.tab.customer_name || "";

  const patch: Record<string, unknown> = {
    status: "fechada",
    closed_at: new Date().toISOString(),
    service_fee_cents: opts.serviceFeeCents ?? full.tab.service_fee_cents ?? 0,
  };
  if (opts.coverCents !== undefined) patch.cover_cents = opts.coverCents; // couvert isentado → zera o snapshot
  if (phone) patch.customer_phone = phone;
  if (name) patch.customer_name = name;
  const { error } = await d.from("tabs").update(patch).eq("id", tabId).eq("store_id", sid);
  if (error) throw error;

  // comanda fechada (paga) = tudo já foi servido → tira os pedidos dela do KDS/Preparo (status 'entregue'),
  // senão eles ficam pendurados na fila da cozinha/bar mesmo depois da conta fechada.
  await d.from("tab_orders").update({ status: "entregue" }).eq("tab_id", tabId).eq("store_id", sid).in("status", KDS_STATUSES as unknown as string[]);

  // fidelidade — pontua só sobre os produtos; detecta 1ª compra pelo cadastro
  let pointsAwarded = 0;
  if (phone && productCents > 0) {
    const cfg = await getLoyalty();
    const existing = await getByPhone(phone);
    const isFirstPurchase = !existing;
    pointsAwarded = pointsForSale(productCents, cfg, { isFirstPurchase });
    if (pointsAwarded > 0) {
      const ref = full.tab.table_id ? `Mesa (comanda #${tabId})` : `Comanda #${tabId}`;
      await awardPoints(phone, name || "Cliente", pointsAwarded, ref, new Date().toISOString());
      // persiste os pontos dados → o cancelamento da venda sabe quanto estornar (mt-32)
      await d.from("tabs").update({ points_awarded: pointsAwarded }).eq("id", tabId).eq("store_id", sid);
    }
  }
  return { pointsAwarded };
}

/** Cancela uma VENDA DE MESA (comanda FECHADA) — estorno espelhado no balcão: devolve o estoque,
 *  estorna os pontos e marca a comanda como cancelada (NÃO apaga — auditável). A partir daí ela
 *  sai do caixa/faturamento/CMV/comissão pelos filtros de `cancelled`. Só comanda fechada e ainda
 *  não cancelada. Anti-IDOR: getTabFull trava a loja. Estornos são NÃO-FATAIS (retorna avisos). */
export async function cancelMesaSale(
  tabId: number,
  opts: { reason: string; by?: string },
): Promise<{ warnings: string[] }> {
  const d = db();
  const sid = await resolveStoreId();
  const reason = (opts.reason ?? "").trim().slice(0, 200);
  if (!reason) throw new Error("Diga o motivo do cancelamento.");

  const full = await getTabFull(tabId, sid); // valida a loja + traz itens/pagamentos
  const tab = full.tab as Tab & { cancelled?: boolean; points_awarded?: number };
  if (tab.status !== "fechada") throw new Error("Só venda de mesa FECHADA se cancela aqui (comanda aberta: cancele o item).");
  if (tab.cancelled) throw new Error("Essa venda já foi cancelada.");

  const today = todayBR();
  const warnings: string[] = [];

  // 1) devolve o estoque de TODOS os itens (consumes é POR-UNIDADE → × qty) — não-fatal
  const consumes = full.orders.flatMap((o) => o.items).flatMap((i) => (i.consumes ?? []).map((c) => ({ stockId: c.stockId, qty: num(c.qty) * num(i.qty) })));
  for (const c of consumes) {
    if (!c.stockId || !(c.qty > 0)) continue;
    try { await moveStock(c.stockId, "entrada", c.qty, "Estorno venda de mesa", today, sid); }
    catch { warnings.push(`estoque de ${c.stockId} não voltou`); }
  }

  // 2) estorna os pontos creditados no fechamento — não-fatal
  const pts = num(tab.points_awarded);
  if (pts > 0 && tab.customer_phone) {
    try { await reversePoints(tab.customer_phone, tab.customer_name ?? "Cliente", pts, `Estorno mesa (comanda #${tabId})`, new Date().toISOString()); }
    catch { warnings.push("pontos do cliente não estornaram"); }
  }

  // 3) marca como CANCELADA (não apaga — auditável). Sai de caixa/faturamento/CMV/comissão pelos filtros.
  const { error } = await d.from("tabs").update({
    cancelled: true, cancelled_at: new Date().toISOString(), cancel_reason: reason, cancelled_by: opts.by ?? null,
  }).eq("id", tabId).eq("store_id", sid);
  if (error) throw error;

  return { warnings };
}

// ── Chamados de mesa ─────────────────────────────────────────────────────────

/** Cria um chamado de mesa (cliente pede a conta ou um atendente). */
export async function createServiceCall(
  tableNumber: number,
  type: ServiceCallType,
  tabId?: number | null,
): Promise<ServiceCall> {
  const sid = await resolveStoreId();
  const { data, error } = await db()
    .from("service_calls")
    .insert({ store_id: sid, table_number: tableNumber, type, tab_id: tabId ?? null, status: "pendente" })
    .select()
    .single();
  if (error) throw error;
  return data as ServiceCall;
}

/** Chamados ainda pendentes (fila de atendimento). */
export async function getPendingCalls(): Promise<ServiceCall[]> {
  const sid = await resolveStoreId();
  const { data } = await db()
    .from("service_calls")
    .select("*")
    .eq("store_id", sid)
    .eq("status", "pendente")
    .order("created_at");
  return (data ?? []) as ServiceCall[];
}

/** Marca o chamado como atendido (escopo da loga logada — anti-IDOR). */
export async function markCallAttended(id: number): Promise<void> {
  const sid = await resolveStoreId();
  await db().from("service_calls").update({ status: "atendido" }).eq("id", id).eq("store_id", sid);
}

/** Quita todos os chamados pendentes de uma comanda (ao fechar a conta, o "pediu a conta" some). */
export async function markTabCallsAttended(tabId: number): Promise<void> {
  const sid = await resolveStoreId();
  await db().from("service_calls").update({ status: "atendido" }).eq("tab_id", tabId).eq("store_id", sid).eq("status", "pendente");
}

// ── Receita das mesas para o financeiro/caixa ────────────────────────────────
export type MesaVenda = {
  tabId: string; // comanda de origem — pra contar VENDAS distintas (split não infla o contador)
  display: string;
  date: string; // paid_at
  method: string;
  grossCents: number;
  cardFeeCents: number;
  customerName: string | null;
};

/** Pagamentos de comanda no MESMO formato das vendas, pro financeiro e o caixa. */
export async function listMesaPayments(): Promise<MesaVenda[]> {
  const sid = await resolveStoreId();
  const { data, error } = await db()
    .from("tab_payments")
    .select("tab_id, amount_cents, method, fee_percent, paid_at, tabs(customer_name, label, cancelled, tables(number))")
    .eq("store_id", sid);
  if (error) throw new Error("Erro ao ler pagamentos de mesa: " + error.message);
  return (data ?? []).filter((p) => !(p as { tabs?: { cancelled?: boolean } | null }).tabs?.cancelled).map((p) => {
    const row = p as {
      tab_id: string | number; amount_cents: number; method: string; fee_percent: number | null; paid_at: string;
      tabs?: { customer_name?: string | null; label?: string | null; cancelled?: boolean; tables?: { number?: number } | null } | null;
    };
    const num = row.tabs?.tables?.number;
    return {
      tabId: String(row.tab_id),
      display: num ? `Mesa ${num}` : row.tabs?.label ?? "Comanda",
      date: row.paid_at,
      method: row.method,
      grossCents: row.amount_cents,
      cardFeeCents: Math.round((row.amount_cents * (row.fee_percent ?? 0)) / 100),
      customerName: row.tabs?.customer_name ?? null,
    };
  });
}

export type ItemCancellation = {
  id: number; tabId: number; display: string; itemName: string; qty: number;
  unitPriceCents: number; totalCents: number; reason: string; cancelledBy: string | null; at: string;
};

/** Cancelamentos de item pro relatório do Financeiro (o "deixa registrado" que a casa pediu).
 *  A mesa é resolvida em SEPARADO (a mt-31 tirou a FK pro tab: o log sobrevive à comanda ser
 *  apagada/liberada, então o PostgREST não consegue embutir a relação). Comanda já apagada → usa
 *  o rótulo genérico, mas o registro do cancelamento NUNCA se perde. */
export async function listItemCancellations(limit = 500): Promise<ItemCancellation[]> {
  const d = db();
  const sid = await resolveStoreId();
  const { data } = await d
    .from("tab_item_cancellations")
    .select("id, tab_id, item_name, size_label, qty, unit_price_cents, reason, cancelled_by, created_at")
    .eq("store_id", sid)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as Array<{ id: number; tab_id: number; item_name: string; size_label: string | null; qty: number; unit_price_cents: number; reason: string; cancelled_by: string | null; created_at: string }>;
  if (!rows.length) return [];

  // resolve o número da mesa: tab -> table (2 buscas, sem FK)
  const tabIds = [...new Set(rows.map((r) => num(r.tab_id)))];
  const { data: tabs } = await d.from("tabs").select("id, label, table_id").in("id", tabIds).eq("store_id", sid);
  const tabRows = (tabs ?? []) as Array<{ id: number; label: string | null; table_id: number | null }>;
  const tableIds = [...new Set(tabRows.map((t) => num(t.table_id)).filter((x) => x > 0))];
  const { data: tables } = tableIds.length
    ? await d.from("tables").select("id, number").in("id", tableIds).eq("store_id", sid)
    : { data: [] as Array<{ id: number; number: number }> };
  const numByTable = new Map((tables ?? []).map((t) => [num((t as { id: number }).id), num((t as { number: number }).number)]));
  const displayByTab = new Map<number, string>();
  for (const t of tabRows) {
    const n = t.table_id != null ? numByTable.get(num(t.table_id)) : undefined;
    displayByTab.set(num(t.id), n ? `Mesa ${n}` : (t.label ?? "Comanda"));
  }

  return rows.map((r) => ({
    id: num(r.id),
    tabId: num(r.tab_id),
    display: displayByTab.get(num(r.tab_id)) ?? "Comanda encerrada",
    itemName: r.item_name + (r.size_label ? ` · ${r.size_label}` : ""),
    qty: num(r.qty),
    unitPriceCents: num(r.unit_price_cents),
    totalCents: num(r.qty) * num(r.unit_price_cents),
    reason: r.reason,
    cancelledBy: r.cancelled_by,
    at: r.created_at,
  }));
}

export type MesaSale = { tabId: number; display: string; closedAt: string; totalCents: number; method: string | null; itens: number };

/** Vendas de MESA (comandas fechadas, não canceladas) com pagamento desde `sinceISO` — a lista
 *  que o Caixa mostra pra escolher qual venda de mesa cancelar. totalCents = soma dos pagamentos
 *  (o que entrou no caixa); method = único método, "misto" se vários (split). */
export async function listMesaSales(sinceISO: string, storeId?: string): Promise<MesaSale[]> {
  const d = db();
  const sid = storeId ?? (await resolveStoreId());
  const { data: pays } = await d
    .from("tab_payments")
    .select("tab_id, amount_cents, method, paid_at, tabs!inner(status, cancelled, closed_at, label, tables(number))")
    .eq("store_id", sid)
    .gte("paid_at", sinceISO);

  const byTab = new Map<number, MesaSale & { _methods: Set<string> }>();
  for (const p of (pays ?? []) as Array<{ tab_id: number; amount_cents: number; method: string; tabs?: { status?: string; cancelled?: boolean; closed_at?: string; label?: string | null; tables?: { number?: number } | null } | null }>) {
    const t = p.tabs;
    if (!t || t.cancelled || t.status !== "fechada") continue; // só venda fechada e não cancelada
    const tabId = num(p.tab_id);
    const cur = byTab.get(tabId) ?? { tabId, display: t.tables?.number ? `Mesa ${t.tables.number}` : (t.label ?? "Comanda"), closedAt: t.closed_at ?? "", totalCents: 0, method: null, itens: 0, _methods: new Set<string>() };
    cur.totalCents += num(p.amount_cents);
    cur._methods.add(p.method);
    byTab.set(tabId, cur);
  }

  // conta os itens de cada comanda
  const tabIds = [...byTab.keys()];
  if (tabIds.length) {
    const { data: orders } = await d.from("tab_orders").select("id, tab_id").in("tab_id", tabIds).eq("store_id", sid);
    const orderToTab = new Map<number, number>();
    const orderIds: number[] = [];
    for (const o of (orders ?? []) as Array<{ id: number; tab_id: number }>) { orderToTab.set(num(o.id), num(o.tab_id)); orderIds.push(num(o.id)); }
    if (orderIds.length) {
      const { data: items } = await d.from("tab_order_items").select("tab_order_id, qty").in("tab_order_id", orderIds);
      for (const i of (items ?? []) as Array<{ tab_order_id: number; qty: number }>) {
        const tid = orderToTab.get(num(i.tab_order_id));
        const s = tid != null ? byTab.get(tid) : undefined;
        if (s) s.itens += num(i.qty);
      }
    }
  }

  return [...byTab.values()].map((s) => ({ tabId: s.tabId, display: s.display, closedAt: s.closedAt, totalCents: s.totalCents, method: s._methods.size === 1 ? [...s._methods][0] : (s._methods.size > 1 ? "misto" : null), itens: s.itens }));
}
