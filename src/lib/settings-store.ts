// Configurações da loja · taxas da maquininha por forma de pagamento.
// Percentual sobre o valor da venda (ex: 3.5 = 3,5%). JSON → tabela Supabase.
// Multi-tenant: lê/escreve a config DA LOJA (store_id). Default = Cantinho durante a transição
// da ativação (enquanto os callers não passam storeId). Ver src/lib/tenant.ts.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import type { PaymentMethod } from "@/lib/orders-store";
import type { BusinessType } from "@/config/segments";

export type PaymentFees = Record<PaymentMethod, number>; // % por método

export type DeliveryZone = { bairro: string; feeCents: number };
export type OpenHours = { open: string; close: string; closed: boolean }; // por dia (HH:MM)
// mensagens do WhatsApp por status (editáveis pelo dono). Placeholders: {nome} {codigo} {loja}
export type WaMsgs = { recebido: string; preparo: string; saiu: string; entregue: string };

export type StoreSettings = {
  name: string;
  tagline: string;
  whatsapp: string; // só dígitos, com DDI (ex: 5599...)
  deliveryMode: "fixed" | "zones"; // como cobra a entrega: taxa única OU por bairro/região
  deliveryFeeCents: number; // taxa única (modo fixed)
  minOrderCents: number;
  deliveryZones: DeliveryZone[]; // taxa por bairro (modo zones)
  hours: OpenHours[]; // 7 posições, domingo→sábado
  pricePerKgCents: number; // preço do açaí por kg (modo balança no balcão/mesa)
  doseMl: number; // BAR: tamanho da dose em ml (ex.: 50). doses/garrafa = garrafa(ml) ÷ doseMl
  // identidade visual da loja (cardápio público) — opt-in, cada loja com a própria cara
  logoUrl: string; // logo no header (vazio = só o nome)
  bannerUrl: string; // foto de fundo do header/hero (vazio = gradiente padrão do template)
  primaryColor: string; // cor de destaque (#RRGGBB) aplicada no CTA principal (vazio = padrão do template)
  // dados do cabeçalho do cupom (impressão térmica) — cada loja preenche os seus
  endereco: string; // endereço completo (ex: "Quadra Arse 14, Alameda 17 - Palmas/TO")
  cnpj: string; // CNPJ ou CPF do negócio (sai no cabeçalho do cupom)
  cupomRodape: string; // mensagem do rodapé do cupom (vazio = "Obrigado! Volte sempre :)")
  waMsgs: WaMsgs; // mensagens do WhatsApp por status (semi-auto ao avançar pedido)
  pixDiscountPercent: number; // % de desconto quando o cliente paga no PIX (o Adm define; 0 = sem)
};

// taxas padrão de mercado (editáveis pelo adm)
const DEFAULT_FEES: PaymentFees = {
  dinheiro: 0,
  pix: 0,
  debito: 2.0,
  credito: 3.5,
};

// mensagens padrão genéricas (fallback). {nome} {codigo} {loja}
export const WA_MSG_DEFAULTS: WaMsgs = {
  recebido: "Olá {nome}! Recebemos seu pedido {codigo} aqui na {loja}. Já vamos preparar!",
  preparo: "Oi {nome}, seu pedido {codigo} já está em preparo!",
  saiu: "{nome}, seu pedido {codigo} saiu para entrega — chega já!",
  entregue: "Pedido {codigo} entregue. Obrigado, {nome}!",
};

// nicho → como chamar o item + emoji, pra personalizar as mensagens POR NEGÓCIO
const WA_NOUN: Record<BusinessType, { noun: string; emoji: string }> = {
  acaiteria: { noun: "seu açaí", emoji: "🍧" },
  sorveteria: { noun: "seu sorvete", emoji: "🍨" },
  marmitaria: { noun: "sua marmita", emoji: "🍱" },
  restaurante: { noun: "seu pedido", emoji: "🍽️" },
  pizzaria: { noun: "sua pizza", emoji: "🍕" },
  sushi: { noun: "seu pedido", emoji: "🍣" },
  hamburgueria: { noun: "seu lanche", emoji: "🍔" },
  assistencia_tecnica: { noun: "seu aparelho", emoji: "🔧" },
  petiscaria: { noun: "seu pedido", emoji: "🍢" },
  bar: { noun: "seu pedido", emoji: "🍻" },
};

/** Defaults do WhatsApp JÁ com o tom do nicho (semeado no cadastro; o dono edita depois). */
export function waMsgsForSegment(seg: BusinessType): WaMsgs {
  const { noun } = WA_NOUN[seg] ?? { noun: "seu pedido" };
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  return {
    recebido: `Olá {nome}! Recebemos ${noun} {codigo} na {loja}. Já vamos preparar!`,
    preparo: `Oi {nome}, ${noun} {codigo} já está sendo preparado!`,
    saiu: `{nome}, ${noun} {codigo} saiu para entrega — chega já!`,
    entregue: `${Noun} {codigo} entregue. Obrigado, {nome}!`,
  };
}

const DEFAULT_STORE: StoreSettings = {
  name: "Açaí do Vidal",
  tagline: "Cremoso de verdade. Monte do seu jeito.",
  whatsapp: "5599810420160",
  deliveryMode: "fixed",
  deliveryFeeCents: 500,
  minOrderCents: 1500,
  deliveryZones: [],
  hours: Array.from({ length: 7 }, () => ({ open: "10:00", close: "22:00", closed: false })),
  pricePerKgCents: 4990, // R$ 49,90/kg (placeholder — confirmar com o Vidal)
  doseMl: 50, // dose padrão do bar: 50ml (o dono ajusta em Configurações)
  logoUrl: "",
  bannerUrl: "",
  primaryColor: "",
  endereco: "",
  cnpj: "",
  cupomRodape: "",
  waMsgs: WA_MSG_DEFAULTS,
  pixDiscountPercent: 0,
};

// Maquininha (cartão): cada loja cadastra suas máquinas com a taxa que o provedor cobra.
// Modelo food-service (opção B): por máquina, SEM bandeira — débito / crédito à vista / crédito
// parcelado. A taxa escolhida é fotografada no pedido na hora de receber (histórico imutável).
export type CardMachine = {
  id: string;
  name: string;
  debito: number; // % débito
  credito: number; // % crédito à vista
  creditoParcelado: number; // % crédito parcelado (taxa única — simplificação p/ food-service)
  maxParcelas: number; // teto de parcelas (1–12)
  active: boolean;
};

// cashPin: chave IRMÃ de `store` (NÃO entra no StoreSettings). Crítico: `getStore()` só
// expõe `raw.store` → o cardápio público nunca recebe o PIN. Validação é 100% server-side.
type SettingsBlob = { fees?: Partial<PaymentFees>; store?: Partial<StoreSettings>; machines?: CardMachine[]; cashPin?: string };

async function readSettings(storeId: string): Promise<SettingsBlob> {
  const { data } = await db().from("app_settings").select("data").eq("store_id", storeId).maybeSingle();
  return (data?.data as SettingsBlob) ?? {};
}
async function writeSettings(storeId: string, data: SettingsBlob) {
  await db().from("app_settings").upsert({ store_id: storeId, data }, { onConflict: "store_id" });
}

export async function getStore(storeId?: string): Promise<StoreSettings> {
  const raw = await readSettings(storeId ?? (await resolveStoreId()));
  const s = { ...DEFAULT_STORE, ...(raw.store || {}) };
  s.waMsgs = { ...WA_MSG_DEFAULTS, ...(s.waMsgs || {}) }; // robusto contra dado antigo/parcial
  return s;
}

export async function setStore(
  store: Partial<StoreSettings>,
  storeId?: string,
): Promise<StoreSettings> {
  storeId = storeId ?? (await resolveStoreId());
  const raw = await readSettings(storeId);
  const clean: StoreSettings = { ...DEFAULT_STORE, ...(raw.store || {}) };
  if (typeof store.name === "string") clean.name = store.name.trim().slice(0, 60) || DEFAULT_STORE.name;
  if (typeof store.tagline === "string") clean.tagline = store.tagline.trim().slice(0, 100);
  if (typeof store.whatsapp === "string") clean.whatsapp = store.whatsapp.replace(/\D+/g, "");
  if (store.deliveryFeeCents != null) clean.deliveryFeeCents = Math.max(0, Math.round(Number(store.deliveryFeeCents)));
  if (store.minOrderCents != null) clean.minOrderCents = Math.max(0, Math.round(Number(store.minOrderCents)));
  if (store.pricePerKgCents != null) clean.pricePerKgCents = Math.max(0, Math.round(Number(store.pricePerKgCents)));
  if (store.doseMl != null) clean.doseMl = Math.max(1, Math.round(Number(store.doseMl) || 50));
  if (store.deliveryMode === "fixed" || store.deliveryMode === "zones") clean.deliveryMode = store.deliveryMode;
  // identidade: URLs do nosso storage (passthrough com teto) + cor hex validada
  if (typeof store.endereco === "string") clean.endereco = store.endereco.trim().slice(0, 120);
  if (typeof store.cnpj === "string") clean.cnpj = store.cnpj.trim().slice(0, 24);
  if (typeof store.cupomRodape === "string") clean.cupomRodape = store.cupomRodape.trim().slice(0, 120);
  if (store.pixDiscountPercent != null) clean.pixDiscountPercent = Math.max(0, Math.min(100, Number(store.pixDiscountPercent) || 0));
  if (store.waMsgs && typeof store.waMsgs === "object") {
    const m = store.waMsgs as Partial<WaMsgs>;
    const pick = (v: unknown, def: string) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 280) : def);
    clean.waMsgs = {
      recebido: pick(m.recebido, WA_MSG_DEFAULTS.recebido),
      preparo: pick(m.preparo, WA_MSG_DEFAULTS.preparo),
      saiu: pick(m.saiu, WA_MSG_DEFAULTS.saiu),
      entregue: pick(m.entregue, WA_MSG_DEFAULTS.entregue),
    };
  }
  if (typeof store.logoUrl === "string") clean.logoUrl = store.logoUrl.trim().slice(0, 500);
  if (typeof store.bannerUrl === "string") clean.bannerUrl = store.bannerUrl.trim().slice(0, 500);
  if (typeof store.primaryColor === "string") {
    const c = store.primaryColor.trim();
    clean.primaryColor = /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : "";
  }
  if (Array.isArray(store.deliveryZones)) {
    clean.deliveryZones = store.deliveryZones
      .map((z) => ({ bairro: String(z.bairro || "").trim().slice(0, 40), feeCents: Math.max(0, Math.round(Number(z.feeCents) || 0)) }))
      .filter((z) => z.bairro);
  }
  if (Array.isArray(store.hours) && store.hours.length === 7) {
    clean.hours = store.hours.map((h) => ({
      open: /^\d{2}:\d{2}$/.test(h.open) ? h.open : "10:00",
      close: /^\d{2}:\d{2}$/.test(h.close) ? h.close : "22:00",
      closed: Boolean(h.closed),
    }));
  }
  await writeSettings(storeId, { ...raw, store: clean });
  return clean;
}

// loja aberta agora? Usa o fuso do BRASIL (a Vercel roda em UTC — senão abre/fecha 3h errado).
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function isOpenNow(hours: OpenHours[], now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = DOW[get("weekday")] ?? now.getDay();
  const hh = get("hour") === "24" ? "00" : get("hour").padStart(2, "0");
  const h = hours[day];
  if (!h || h.closed) return false;
  const cur = `${hh}:${get("minute").padStart(2, "0")}`;
  return cur >= h.open && cur <= h.close;
}

export async function getFees(storeId?: string): Promise<PaymentFees> {
  const raw = await readSettings(storeId ?? (await resolveStoreId()));
  return { ...DEFAULT_FEES, ...(raw.fees || {}) };
}

export async function setFees(
  fees: Partial<PaymentFees>,
  storeId?: string,
): Promise<PaymentFees> {
  storeId = storeId ?? (await resolveStoreId());
  const raw = await readSettings(storeId);
  const clean: PaymentFees = { ...DEFAULT_FEES };
  for (const k of Object.keys(clean) as PaymentMethod[]) {
    const v = Number(fees[k]);
    if (!Number.isNaN(v)) clean[k] = Math.max(0, Math.min(100, v));
  }
  await writeSettings(storeId, { ...raw, fees: clean });
  return clean;
}

export function feeCentsFor(method: PaymentMethod, totalCents: number, fees: PaymentFees): number {
  return Math.round((totalCents * (fees[method] || 0)) / 100);
}

// PIN do caixa (autoriza sangria). SERVER-ONLY: nunca devolvido a nenhum client —
// o caixa manda o PIN digitado e o servidor compara. Vazio = sem trava (só registra operador).
export async function getCashPin(storeId?: string): Promise<string> {
  const raw = await readSettings(storeId ?? (await resolveStoreId()));
  return typeof raw.cashPin === "string" ? raw.cashPin : "";
}

export async function hasCashPin(storeId?: string): Promise<boolean> {
  return (await getCashPin(storeId)).length > 0;
}

// Define/limpa o PIN. Só dígitos, 4–6; string vazia limpa (volta a não travar).
export async function setCashPin(pin: string, storeId?: string): Promise<boolean> {
  storeId = storeId ?? (await resolveStoreId());
  const raw = await readSettings(storeId);
  const clean = String(pin ?? "").replace(/\D+/g, "").slice(0, 6);
  const next = clean.length >= 4 ? clean : ""; // <4 dígitos = limpa
  await writeSettings(storeId, { ...raw, cashPin: next });
  return next.length > 0;
}

function sanitizeMachine(m: Partial<CardMachine>): CardMachine {
  const pct = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0));
  return {
    id: typeof m.id === "string" && m.id ? m.id : crypto.randomUUID(),
    name: String(m.name ?? "").trim().slice(0, 40) || "Maquininha",
    debito: pct(m.debito),
    credito: pct(m.credito),
    creditoParcelado: pct(m.creditoParcelado),
    maxParcelas: Math.max(1, Math.min(12, Math.round(Number(m.maxParcelas) || 12))),
    active: m.active !== false,
  };
}

export async function getCardMachines(storeId?: string): Promise<CardMachine[]> {
  const raw = await readSettings(storeId ?? (await resolveStoreId()));
  return Array.isArray(raw.machines) ? raw.machines.map(sanitizeMachine) : [];
}

export async function setCardMachines(machines: Partial<CardMachine>[], storeId?: string): Promise<CardMachine[]> {
  storeId = storeId ?? (await resolveStoreId());
  const raw = await readSettings(storeId);
  const clean = (Array.isArray(machines) ? machines : []).slice(0, 20).map(sanitizeMachine);
  await writeSettings(storeId, { ...raw, machines: clean });
  return clean;
}

/** Taxa da máquina pra um tipo de cobrança. tipo: 'debito' | 'credito' | 'parcelado'. */
export function machineFeeCentsFor(
  machine: CardMachine | undefined,
  tipo: "debito" | "credito" | "parcelado",
  totalCents: number,
): number {
  if (!machine) return 0;
  const rate = tipo === "debito" ? machine.debito : tipo === "parcelado" ? machine.creditoParcelado : machine.credito;
  return Math.round((totalCents * (rate || 0)) / 100);
}

/** Taxa de cartão de uma venda: usa a MÁQUINA escolhida (snapshot) ou cai na taxa flat por método.
 *  crédito com parcelas>1 = taxa de parcelado. Resolve a máquina no SERVIDOR (não confia no client). */
export async function resolveCardFee(
  method: PaymentMethod,
  totalCents: number,
  storeId: string,
  opts?: { machineId?: string; parcelas?: number },
): Promise<{ feeCents: number; feePercent: number; machineId?: string; machineName?: string; parcelas: number }> {
  const parcelas = Math.max(1, Math.min(12, Math.round(Number(opts?.parcelas) || 1)));
  if ((method === "debito" || method === "credito") && opts?.machineId) {
    const machine = (await getCardMachines(storeId)).find((m) => m.id === opts.machineId && m.active);
    if (machine) {
      const tipo = method === "debito" ? "debito" : parcelas > 1 ? "parcelado" : "credito";
      const feePercent = tipo === "debito" ? machine.debito : tipo === "parcelado" ? machine.creditoParcelado : machine.credito;
      return { feeCents: machineFeeCentsFor(machine, tipo, totalCents), feePercent, machineId: machine.id, machineName: machine.name, parcelas: method === "credito" ? parcelas : 1 };
    }
  }
  const fees = await getFees(storeId);
  return { feeCents: feeCentsFor(method, totalCents, fees), feePercent: fees[method] || 0, parcelas: 1 };
}

/** Taxa de cartão num SPLIT: soma a taxa de CADA parcela em cartão (ex: débito + crédito),
 *  não só a 1ª. Mantém maquininha/percentual do MAIOR pagamento pra exibição no cupom. */
export async function resolveSplitCardFee(
  cardPays: { method: PaymentMethod; amountCents: number }[],
  storeId: string,
  opts?: { machineId?: string; parcelas?: number },
): Promise<{ feeCents: number; feePercent: number; machineId?: string; machineName?: string; parcelas: number }> {
  let feeCents = 0;
  let dom: { feePercent: number; machineId?: string; machineName?: string; parcelas: number; amt: number } | null = null;
  for (const cp of cardPays) {
    const f = await resolveCardFee(cp.method, cp.amountCents, storeId, { machineId: opts?.machineId, parcelas: cp.method === "credito" ? opts?.parcelas : 1 });
    feeCents += f.feeCents;
    if (!dom || cp.amountCents > dom.amt) dom = { feePercent: f.feePercent, machineId: f.machineId, machineName: f.machineName, parcelas: f.parcelas, amt: cp.amountCents };
  }
  return { feeCents, feePercent: dom?.feePercent ?? 0, machineId: dom?.machineId, machineName: dom?.machineName, parcelas: dom?.parcelas ?? 1 };
}
