// Configurações da loja · taxas da maquininha por forma de pagamento.
// Percentual sobre o valor da venda (ex: 3.5 = 3,5%). JSON → tabela Supabase.
// Multi-tenant: lê/escreve a config DA LOJA (store_id). Default = Cantinho durante a transição
// da ativação (enquanto os callers não passam storeId). Ver src/lib/tenant.ts.
import { db } from "@/lib/supabase";
import { CANTINHO_STORE_ID } from "@/lib/tenant";
import type { PaymentMethod } from "@/lib/orders-store";

export type PaymentFees = Record<PaymentMethod, number>; // % por método

export type DeliveryZone = { bairro: string; feeCents: number };
export type OpenHours = { open: string; close: string; closed: boolean }; // por dia (HH:MM)

export type StoreSettings = {
  name: string;
  tagline: string;
  whatsapp: string; // só dígitos, com DDI (ex: 5599...)
  deliveryFeeCents: number;
  minOrderCents: number;
  deliveryZones: DeliveryZone[]; // taxa por bairro (vazio = taxa única)
  hours: OpenHours[]; // 7 posições, domingo→sábado
  pricePerKgCents: number; // preço do açaí por kg (modo balança no balcão/mesa)
};

// taxas padrão de mercado (editáveis pelo adm)
const DEFAULT_FEES: PaymentFees = {
  dinheiro: 0,
  pix: 0,
  debito: 2.0,
  credito: 3.5,
};

const DEFAULT_STORE: StoreSettings = {
  name: "Açaí do Vidal",
  tagline: "Cremoso de verdade. Monte do seu jeito.",
  whatsapp: "5599810420160",
  deliveryFeeCents: 500,
  minOrderCents: 1500,
  deliveryZones: [],
  hours: Array.from({ length: 7 }, () => ({ open: "10:00", close: "22:00", closed: false })),
  pricePerKgCents: 4990, // R$ 49,90/kg (placeholder — confirmar com o Vidal)
};

type SettingsBlob = { fees?: Partial<PaymentFees>; store?: Partial<StoreSettings> };

async function readSettings(storeId: string): Promise<SettingsBlob> {
  const { data } = await db().from("app_settings").select("data").eq("store_id", storeId).maybeSingle();
  return (data?.data as SettingsBlob) ?? {};
}
async function writeSettings(storeId: string, data: SettingsBlob) {
  await db().from("app_settings").upsert({ store_id: storeId, data }, { onConflict: "store_id" });
}

export async function getStore(storeId: string = CANTINHO_STORE_ID): Promise<StoreSettings> {
  const raw = await readSettings(storeId);
  return { ...DEFAULT_STORE, ...(raw.store || {}) };
}

export async function setStore(
  store: Partial<StoreSettings>,
  storeId: string = CANTINHO_STORE_ID,
): Promise<StoreSettings> {
  const raw = await readSettings(storeId);
  const clean: StoreSettings = { ...DEFAULT_STORE, ...(raw.store || {}) };
  if (typeof store.name === "string") clean.name = store.name.trim().slice(0, 60) || DEFAULT_STORE.name;
  if (typeof store.tagline === "string") clean.tagline = store.tagline.trim().slice(0, 100);
  if (typeof store.whatsapp === "string") clean.whatsapp = store.whatsapp.replace(/\D+/g, "");
  if (store.deliveryFeeCents != null) clean.deliveryFeeCents = Math.max(0, Math.round(Number(store.deliveryFeeCents)));
  if (store.minOrderCents != null) clean.minOrderCents = Math.max(0, Math.round(Number(store.minOrderCents)));
  if (store.pricePerKgCents != null) clean.pricePerKgCents = Math.max(0, Math.round(Number(store.pricePerKgCents)));
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

// loja aberta agora? (com base no horário do dia)
export function isOpenNow(hours: OpenHours[], now = new Date()): boolean {
  const h = hours[now.getDay()];
  if (!h || h.closed) return false;
  const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return cur >= h.open && cur <= h.close;
}

export async function getFees(storeId: string = CANTINHO_STORE_ID): Promise<PaymentFees> {
  const raw = await readSettings(storeId);
  return { ...DEFAULT_FEES, ...(raw.fees || {}) };
}

export async function setFees(
  fees: Partial<PaymentFees>,
  storeId: string = CANTINHO_STORE_ID,
): Promise<PaymentFees> {
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
