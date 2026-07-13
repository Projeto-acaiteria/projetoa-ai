// Orçamentos (vertical SERVICE). Itens de linha (produto/serviço), validade e status.
// Vira documento A4 público (link no WhatsApp). Server-side, por loja, em centavos.
// Tabela budgets {id, store_id, data jsonb} — service-only (food não usa).
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

export type BudgetItemKind = "produto" | "servico";
export type BudgetItem = {
  kind: BudgetItemKind;
  name: string;
  detail?: string;
  qty: number;
  unitCents: number; // preço unitário
  discountCents: number; // desconto da linha
};
export type BudgetStatus = "pendente" | "aprovado" | "recusado" | "expirado";

export type Budget = {
  id: string;
  code: string; // código público (link A4)
  customerName: string;
  customerPhone: string;
  cpf: string | null;
  items: BudgetItem[];
  freteCents: number;
  outrosCents: number;
  discountCents: number; // desconto global (além dos por-linha)
  validadeAt: string | null; // YYYY-MM-DD
  observacao: string | null;
  status: BudgetStatus;
  osId: string | null; // OS gerada na aprovação (trava anti-duplicação)
  osCode: string | null;
  createdAt: string;
  approvedAt: string | null;
};

const num = (v: unknown) => Math.max(0, Math.round(Number(v ?? 0)));

/** Subtotal de uma linha: qty × unit − desconto da linha (nunca negativo). */
export function itemSubtotalCents(it: BudgetItem): number {
  return Math.max(0, num(it.qty) * num(it.unitCents) - num(it.discountCents));
}

/** Totais do orçamento: por tipo, frete, outros, desconto global e total final. */
export function budgetTotals(b: Pick<Budget, "items" | "freteCents" | "outrosCents" | "discountCents">) {
  let produtosCents = 0;
  let servicosCents = 0;
  for (const it of b.items ?? []) {
    if (it.kind === "servico") servicosCents += itemSubtotalCents(it);
    else produtosCents += itemSubtotalCents(it);
  }
  const brutoCents = produtosCents + servicosCents + num(b.freteCents) + num(b.outrosCents);
  const totalCents = Math.max(0, brutoCents - num(b.discountCents));
  return { produtosCents, servicosCents, freteCents: num(b.freteCents), outrosCents: num(b.outrosCents), descontoCents: num(b.discountCents), totalCents };
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(): string {
  let s = "OR";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

const sanitizeItems = (raw: unknown): BudgetItem[] =>
  (Array.isArray(raw) ? raw : [])
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        kind: o.kind === "servico" ? "servico" : "produto",
        name: String(o.name ?? "").trim().slice(0, 120),
        detail: o.detail ? String(o.detail).trim().slice(0, 200) : undefined,
        qty: Math.max(1, Math.round(Number(o.qty ?? 1))),
        unitCents: num(o.unitCents),
        discountCents: num(o.discountCents),
      } as BudgetItem;
    })
    .filter((it) => it.name);

const asStatus = (v: unknown): BudgetStatus =>
  v === "aprovado" ? "aprovado" : v === "recusado" ? "recusado" : v === "expirado" ? "expirado" : "pendente";

export async function listBudgets(storeId?: string): Promise<Budget[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("budgets").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler orçamentos: " + error.message);
  return ((data ?? []) as { data: Budget }[]).map((r) => r.data).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getBudget(id: string, storeId?: string): Promise<Budget | null> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("budgets").select("data").eq("store_id", sid).eq("id", id).maybeSingle();
  return data ? (data as { data: Budget }).data : null;
}

/** Busca pública pelo código (link A4) — varre todas as lojas service (código é único). */
export async function getBudgetByCode(code: string): Promise<{ storeId: string; budget: Budget } | null> {
  const { data } = await db().from("budgets").select("store_id, data").eq("data->>code", code).maybeSingle();
  if (!data) return null;
  const r = data as { store_id: string; data: Budget };
  return { storeId: r.store_id, budget: r.data };
}

export type NewBudgetInput = {
  customerName: string;
  customerPhone?: string;
  cpf?: string;
  items: unknown;
  freteCents?: number;
  outrosCents?: number;
  discountCents?: number;
  validadeAt?: string;
  observacao?: string;
};

export async function createBudget(input: NewBudgetInput, storeId?: string): Promise<Budget> {
  const sid = storeId ?? (await resolveStoreId());
  const now = new Date().toISOString();
  const b: Budget = {
    id: "b" + Math.random().toString(36).slice(2, 10),
    code: genCode(),
    customerName: input.customerName.trim() || "Cliente",
    customerPhone: (input.customerPhone ?? "").trim(),
    cpf: input.cpf?.replace(/\D/g, "") || null,
    items: sanitizeItems(input.items),
    freteCents: num(input.freteCents),
    outrosCents: num(input.outrosCents),
    discountCents: num(input.discountCents),
    validadeAt: /^\d{4}-\d{2}-\d{2}$/.test(String(input.validadeAt ?? "")) ? String(input.validadeAt) : null,
    observacao: input.observacao?.trim() || null,
    status: "pendente",
    osId: null,
    osCode: null,
    createdAt: now,
    approvedAt: null,
  };
  const { error } = await db().from("budgets").insert({ id: b.id, store_id: sid, data: b });
  if (error) throw new Error("Falha ao criar orçamento: " + error.message);
  return b;
}

export async function updateBudget(id: string, input: NewBudgetInput, storeId?: string): Promise<Budget> {
  const sid = storeId ?? (await resolveStoreId());
  const cur = await getBudget(id, sid);
  if (!cur) throw new Error("Orçamento não encontrado.");
  const b: Budget = {
    ...cur,
    customerName: input.customerName.trim() || cur.customerName,
    customerPhone: (input.customerPhone ?? "").trim(),
    cpf: input.cpf?.replace(/\D/g, "") || null,
    items: sanitizeItems(input.items),
    freteCents: num(input.freteCents),
    outrosCents: num(input.outrosCents),
    discountCents: num(input.discountCents),
    validadeAt: /^\d{4}-\d{2}-\d{2}$/.test(String(input.validadeAt ?? "")) ? String(input.validadeAt) : null,
    observacao: input.observacao?.trim() || null,
  };
  const { error } = await db().from("budgets").update({ data: b }).eq("id", id).eq("store_id", sid);
  if (error) throw new Error("Falha ao salvar orçamento: " + error.message);
  return b;
}

export async function setBudgetStatus(id: string, status: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const cur = await getBudget(id, sid);
  if (!cur) throw new Error("Orçamento não encontrado.");
  const st = asStatus(status);
  const b: Budget = { ...cur, status: st, approvedAt: st === "aprovado" ? new Date().toISOString() : cur.approvedAt };
  const { error } = await db().from("budgets").update({ data: b }).eq("id", id).eq("store_id", sid);
  if (error) throw new Error("Falha ao atualizar status: " + error.message);
}

/** Marca o orçamento como aprovado e vincula à OS gerada (trava anti-duplicação). */
export async function linkBudgetToOS(id: string, osId: string, osCode: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const cur = await getBudget(id, sid);
  if (!cur) throw new Error("Orçamento não encontrado.");
  const b: Budget = { ...cur, status: "aprovado", osId, osCode, approvedAt: cur.approvedAt || new Date().toISOString() };
  const { error } = await db().from("budgets").update({ data: b }).eq("id", id).eq("store_id", sid);
  if (error) throw new Error("Falha ao vincular OS: " + error.message);
}

export async function deleteBudget(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const { error } = await db().from("budgets").delete().eq("id", id).eq("store_id", sid);
  if (error) throw new Error("Falha ao excluir orçamento: " + error.message);
}

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
};
