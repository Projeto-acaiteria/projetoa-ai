/**
 * Asaas — Wrapper de chamadas API (ComandaPRO). Portado 1:1 do AgendaPRO (validado em produção),
 * sem o toAsaasParams (que é específico dos planos do AgendaPRO) e com getNextDueDate em fuso BR.
 *
 * Auth: header `access_token: $aact_xxx`. Base: prod https://api.asaas.com/v3 | sandbox api-sandbox.
 * Eventos webhook: PAYMENT_CONFIRMED / PAYMENT_RECEIVED (libera), PAYMENT_OVERDUE, PAYMENT_REFUNDED.
 */

const ASAAS_PROD_BASE = "https://api.asaas.com/v3";
const ASAAS_SANDBOX_BASE = "https://api-sandbox.asaas.com/v3";

export type AsaasBillingType = "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED";
export type AsaasCycle =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "YEARLY";

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY não configurada");
  return key;
}

function getBaseUrl(): string {
  const apiKey = getApiKey();
  if (process.env.ASAAS_ENV === "sandbox" || apiKey.startsWith("$aact_hmlg_")) {
    return ASAAS_SANDBOX_BASE;
  }
  return ASAAS_PROD_BASE;
}

async function asaasFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", access_token: apiKey, ...(init.headers ?? {}) },
    });
    const text = await res.text();
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const errorMsg =
        (data as { errors?: Array<{ description?: string }> })?.errors?.[0]?.description ||
        (data as { message?: string })?.message ||
        text ||
        `HTTP ${res.status}`;
      return { ok: false, status: res.status, data, error: errorMsg };
    }
    return { ok: true, status: res.status, data, error: null };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err instanceof Error ? err.message : "network_error" };
  }
}

// ── CUSTOMER ──────────────────────────────────────────────────────
export type AsaasCustomer = {
  id: string;
  name: string;
  email?: string;
  cpfCnpj?: string;
  externalReference?: string;
  dateCreated?: string;
};

export async function createCustomer(input: {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
}) {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj,
      email: input.email,
      mobilePhone: input.mobilePhone,
      externalReference: input.externalReference,
      notificationDisabled: true, // ComandaPRO manda email próprio; não expõe o CNPJ do Asaas
    }),
  });
}

export async function getCustomerById(id: string) {
  return asaasFetch<AsaasCustomer>(`/customers/${id}`, { method: "GET" });
}

// Busca customer por externalReference (= store_id no ComandaPRO)
export async function findCustomerByExternalReference(externalRef: string) {
  return asaasFetch<{ data: AsaasCustomer[]; totalCount: number }>(
    `/customers?externalReference=${encodeURIComponent(externalRef)}&limit=1`,
    { method: "GET" },
  );
}

// ── SUBSCRIPTION (recorrente, cartão) ─────────────────────────────
export type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  cycle: AsaasCycle;
  description?: string;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  externalReference?: string;
};

export async function createSubscription(input: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  cycle: AsaasCycle;
  description?: string;
  externalReference?: string;
  endDate?: string;
  maxPayments?: number;
}) {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return asaasFetch<{ deleted: boolean; id: string }>(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
}

export async function listSubscriptionPayments(subscriptionId: string) {
  return asaasFetch<{ data: AsaasPayment[]; totalCount: number }>(
    `/subscriptions/${subscriptionId}/payments`,
    { method: "GET" },
  );
}

// ── PAYMENT (avulso, PIX único) ───────────────────────────────────
export type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string;
  billingType: AsaasBillingType;
  value: number;
  netValue?: number;
  status:
    | "PENDING"
    | "RECEIVED"
    | "CONFIRMED"
    | "OVERDUE"
    | "REFUNDED"
    | "RECEIVED_IN_CASH"
    | "REFUND_REQUESTED"
    | "CHARGEBACK_REQUESTED"
    | "CHARGEBACK_DISPUTE"
    | "AWAITING_CHARGEBACK_REVERSAL"
    | "DUNNING_REQUESTED"
    | "DUNNING_RECEIVED"
    | "AWAITING_RISK_ANALYSIS";
  dueDate: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
  externalReference?: string;
};

export async function createPayment(input: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
}) {
  return asaasFetch<AsaasPayment>("/payments", { method: "POST", body: JSON.stringify(input) });
}

export async function getPaymentById(paymentId: string) {
  return asaasFetch<AsaasPayment>(`/payments/${paymentId}`, { method: "GET" });
}

// ── PIX QR CODE (renderizado inline, cliente não sai do app) ──────
export type AsaasPixQrCode = {
  encodedImage: string; // base64 PNG
  payload: string; // copia-cola
  expirationDate: string;
  success: boolean;
};

export async function getPixQrCode(paymentId: string) {
  return asaasFetch<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`, { method: "GET" });
}

// ── REFUND ────────────────────────────────────────────────────────
export type AsaasRefundResult = {
  id: string;
  status: string;
  value: number;
  description?: string;
  refundDate?: string;
};

export async function refundPayment(input: { paymentId: string; value?: number; description?: string }) {
  return asaasFetch<AsaasRefundResult>(`/payments/${input.paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({
      value: input.value,
      description: input.description ?? "Cancelamento dentro do prazo de 7 dias (CDC art. 49)",
    }),
  });
}

// ── HELPERS ───────────────────────────────────────────────────────
/**
 * Data do próximo vencimento (YYYY-MM-DD) no fuso BR (America/Sao_Paulo).
 * BUG CORRIGIDO (vs AgendaPRO): o toISOString() cortava em UTC → tarde da noite no BR já
 * virava o dia seguinte, e o "D-3" do cron escorregava 1 dia. Aqui calcula no fuso correto.
 */
export function getNextDueDate(daysFromNow = 1): string {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  br.setDate(br.getDate() + daysFromNow);
  const y = br.getFullYear();
  const m = String(br.getMonth() + 1).padStart(2, "0");
  const d = String(br.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
