// Contas a pagar / a receber com vencimento (vertical SERVICE). Livro de ACOMPANHAMENTO standalone:
// NÃO posta no fluxo de caixa (receita entra pela OS quitada/venda; despesa por Despesas/Compras),
// então dar baixa aqui NÃO duplica receita/despesa. Só controla vencimentos e quanto já foi pago/recebido.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

export type BillKind = "pagar" | "receber";
export type BillStatus = "pendente" | "parcial" | "pago"; // "pago" = quitado (a receber = recebido)
export type BillPayment = { amountCents: number; date: string; note?: string | null };

export type Bill = {
  id: string;
  code: string;
  kind: BillKind;
  description: string;
  party: string | null; // fornecedor (a pagar) ou cliente (a receber)
  amountCents: number; // valor total da conta
  dueDate: string; // YYYY-MM-DD (vencimento)
  payments: BillPayment[]; // baixas parciais (histórico)
  notes: string | null;
  settledAt: string | null; // quando ficou 100% quitada
  createdAt: string;
};

const num = (v: unknown) => Math.max(0, Math.round(Number(v ?? 0)));
const isDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

/** Total já pago/recebido (soma das baixas). */
export function billPaidCents(b: Pick<Bill, "payments">): number {
  return (b.payments ?? []).reduce((s, p) => s + num(p.amountCents), 0);
}
/** Saldo em aberto (nunca negativo). */
export function billOpenCents(b: Pick<Bill, "amountCents" | "payments">): number {
  return Math.max(0, num(b.amountCents) - billPaidCents(b));
}
/** Status derivado das baixas (fonte da verdade = payments, nunca um campo solto). */
export function billStatus(b: Pick<Bill, "amountCents" | "payments">): BillStatus {
  const paid = billPaidCents(b);
  if (paid <= 0) return "pendente";
  if (paid >= num(b.amountCents)) return "pago";
  return "parcial";
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(kind: BillKind): string {
  let s = kind === "pagar" ? "CP" : "CR";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

const sanitizePayments = (raw: unknown): BillPayment[] =>
  (Array.isArray(raw) ? raw : [])
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return { amountCents: num(o.amountCents), date: isDate(o.date) ? String(o.date) : "", note: o.note ? String(o.note).slice(0, 120) : null };
    })
    .filter((p) => p.amountCents > 0 && p.date);

export async function listBills(kind?: BillKind, storeId?: string): Promise<Bill[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("bills").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler contas: " + error.message);
  let bills = ((data ?? []) as { data: Bill }[]).map((r) => r.data);
  if (kind) bills = bills.filter((b) => b.kind === kind);
  // em aberto primeiro, por vencimento crescente; quitadas no fim
  return bills.sort((a, b) => {
    const aq = billStatus(a) === "pago", bq = billStatus(b) === "pago";
    if (aq !== bq) return aq ? 1 : -1;
    return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
  });
}

export async function getBill(id: string, storeId?: string): Promise<Bill | null> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("bills").select("data").eq("store_id", sid).eq("id", id).maybeSingle();
  return data ? (data as { data: Bill }).data : null;
}

export type NewBillInput = {
  kind?: string;
  description?: string;
  party?: string;
  amountCents?: number;
  dueDate?: string;
  notes?: string;
};

export async function createBill(input: NewBillInput, storeId?: string): Promise<Bill> {
  const sid = storeId ?? (await resolveStoreId());
  const now = new Date().toISOString();
  const kind: BillKind = input.kind === "receber" ? "receber" : "pagar";
  const b: Bill = {
    id: "bl" + Math.random().toString(36).slice(2, 10),
    code: genCode(kind),
    kind,
    description: input.description?.trim().slice(0, 160) || (kind === "pagar" ? "Conta a pagar" : "Conta a receber"),
    party: input.party?.trim().slice(0, 120) || null,
    amountCents: num(input.amountCents),
    dueDate: isDate(input.dueDate) ? String(input.dueDate) : now.slice(0, 10),
    payments: [],
    notes: input.notes?.trim().slice(0, 300) || null,
    settledAt: null,
    createdAt: now,
  };
  const { error } = await db().from("bills").insert({ id: b.id, store_id: sid, data: b });
  if (error) throw new Error("Falha ao criar conta: " + error.message);
  return b;
}

export async function updateBill(id: string, input: NewBillInput, storeId?: string): Promise<Bill> {
  const sid = storeId ?? (await resolveStoreId());
  const cur = await getBill(id, sid);
  if (!cur) throw new Error("Conta não encontrada.");
  const b: Bill = {
    ...cur,
    description: input.description?.trim().slice(0, 160) || cur.description,
    party: input.party != null ? (input.party.trim().slice(0, 120) || null) : cur.party,
    amountCents: input.amountCents != null ? num(input.amountCents) : cur.amountCents,
    dueDate: isDate(input.dueDate) ? String(input.dueDate) : cur.dueDate,
    notes: input.notes != null ? (input.notes.trim().slice(0, 300) || null) : cur.notes,
  };
  b.settledAt = billStatus(b) === "pago" ? (cur.settledAt ?? new Date().toISOString()) : null;
  const { error } = await db().from("bills").update({ data: b }).eq("id", id).eq("store_id", sid);
  if (error) throw new Error("Falha ao salvar conta: " + error.message);
  return b;
}

/** Baixa: registra um pagamento/recebimento. amountCents<=0 usa o saldo em aberto (quita). */
export async function payBill(id: string, amountCents: number, dateBRStr: string, note: string | undefined, storeId?: string): Promise<Bill> {
  const sid = storeId ?? (await resolveStoreId());
  const cur = await getBill(id, sid);
  if (!cur) throw new Error("Conta não encontrada.");
  const open = billOpenCents(cur);
  if (open <= 0) throw new Error("Essa conta já está quitada.");
  // valor da baixa: o informado (limitado ao saldo) ou o saldo inteiro se não vier valor
  const amt = amountCents > 0 ? Math.min(num(amountCents), open) : open;
  const date = isDate(dateBRStr) ? dateBRStr : new Date().toISOString().slice(0, 10);
  const b: Bill = { ...cur, payments: [...cur.payments, { amountCents: amt, date, note: note?.trim().slice(0, 120) || null }] };
  b.settledAt = billStatus(b) === "pago" ? new Date().toISOString() : null;
  const { error } = await db().from("bills").update({ data: b }).eq("id", id).eq("store_id", sid);
  if (error) throw new Error("Falha ao dar baixa: " + error.message);
  return b;
}

/** Estorna a última baixa (correção de engano). */
export async function undoLastPayment(id: string, storeId?: string): Promise<Bill> {
  const sid = storeId ?? (await resolveStoreId());
  const cur = await getBill(id, sid);
  if (!cur) throw new Error("Conta não encontrada.");
  if (!cur.payments.length) throw new Error("Sem baixas para estornar.");
  const b: Bill = { ...cur, payments: cur.payments.slice(0, -1) };
  b.settledAt = billStatus(b) === "pago" ? cur.settledAt : null;
  const { error } = await db().from("bills").update({ data: b }).eq("id", id).eq("store_id", sid);
  if (error) throw new Error("Falha ao estornar baixa: " + error.message);
  return b;
}

export async function deleteBill(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const { error } = await db().from("bills").delete().eq("id", id).eq("store_id", sid);
  if (error) throw new Error("Falha ao excluir conta: " + error.message);
}
