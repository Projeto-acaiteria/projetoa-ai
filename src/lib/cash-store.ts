// Sessão de caixa · abertura, sangria, suprimento, fechamento com conferência.
// Modelo de PDV sério (espelha o caixa do palace-system). JSON → tabela Supabase.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

export type CashMovement = {
  type: "sangria" | "suprimento";
  amountCents: number;
  reason: string;
  at: string;
  by?: string; // operador que fez (trilha de auditoria) — nome digitado no caixa
};

export type CashSession = {
  id: number;
  openedAt: string;
  operator?: string;
  openingFloatCents: number; // fundo de troco
  movements: CashMovement[];
  status: "aberto" | "fechado";
  closedAt?: string;
  countedCents?: number; // dinheiro contado no fechamento
  expectedCents?: number; // esperado em caixa
  diffCents?: number; // contado - esperado (quebra/sobra)
  salesCashCents?: number; // snapshot vendas dinheiro
  salesTotalCents?: number; // snapshot total vendido
  // conferência tripla (fechamento) — cartão e pix além do dinheiro
  salesCardCents?: number; // bruto cartão (débito+crédito) na sessão
  salesPixCents?: number; // bruto pix na sessão
  cardFeeCents?: number; // taxa de maquininha total das vendas em cartão
  cardNetCents?: number; // líquido cartão (bruto − taxa)
  cardCountedCents?: number; // cartão conferido (relatório da maquininha)
  pixCountedCents?: number; // pix conferido (extrato)
  cardDiffCents?: number; // conferido − bruto cartão
  pixDiffCents?: number; // conferido − bruto pix
  closedBy?: string; // quem fechou (email do operador logado)
  // OS de assistência técnica quitadas na sessão (reconciliação da gaveta). Só o dinheiro entra no
  // saldo físico; total é auditoria. Food não tem OS → ambos ficam undefined/0.
  osCashCents?: number; // dinheiro de OS quitada na sessão (JÁ somado ao saldo esperado)
  osTotalCents?: number; // bruto de OS quitada na sessão (todos os métodos)
};

async function readAll(storeId?: string): Promise<CashSession[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("cash_sessions").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler caixa: " + error.message); // nunca tratar erro como vazio
  return (data ?? []).map((r) => (r as { data: CashSession }).data);
}

export async function getOpenSession(): Promise<CashSession | null> {
  return (await readAll()).find((s) => s.status === "aberto") ?? null;
}

export async function listClosedSessions(): Promise<CashSession[]> {
  return (await readAll())
    .filter((s) => s.status === "fechado")
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));
}

// patch por-linha: lê 1 row, muta o data, atualiza só dela (não toca o resto da tabela).
async function patchSession(id: number, mut: (s: CashSession) => CashSession): Promise<CashSession | null> {
  const d = db();
  const { data: row, error } = await d.from("cash_sessions").select("data").eq("id", id).maybeSingle();
  if (error) throw new Error("Erro ao ler caixa: " + error.message);
  if (!row) return null;
  const session = mut((row as { data: CashSession }).data);
  const { error: e2 } = await d.from("cash_sessions").update({ data: session }).eq("id", id);
  if (e2) throw new Error("Erro ao atualizar caixa: " + e2.message);
  return session;
}

// INSERT de UMA linha — o banco gera o id (identity). Sem race de id, sem delete-all.
export async function openCash(floatCents: number, at: string, operator?: string): Promise<CashSession> {
  const d = db();
  if (await getOpenSession()) throw new Error("Já existe caixa aberto");
  const base = {
    openedAt: at,
    operator,
    openingFloatCents: Math.max(0, Math.round(floatCents)),
    movements: [] as CashMovement[],
    status: "aberto" as const,
  };
  const sid = await resolveStoreId();
  const { data: row, error } = await d.from("cash_sessions").insert({ data: base, store_id: sid }).select("id").single();
  if (error || !row) throw new Error("Falha ao abrir o caixa: " + (error?.message ?? "sem retorno"));
  const id = Number((row as { id: number }).id);
  const session: CashSession = { ...base, id };
  const { error: e2 } = await d.from("cash_sessions").update({ data: session }).eq("id", id);
  if (e2) throw new Error("Falha ao gravar o caixa: " + e2.message);
  return session;
}

export async function addMovement(type: "sangria" | "suprimento", amountCents: number, reason: string, at: string, by?: string): Promise<CashSession | null> {
  const open = await getOpenSession();
  if (!open) return null;
  return patchSession(open.id, (s) => ({
    ...s,
    movements: [{ type, amountCents: Math.max(0, Math.round(amountCents)), reason, at, by: by?.trim() || undefined }, ...s.movements],
  }));
}

export type CloseCashInput = {
  at: string;
  closedBy?: string;
  countedCents: number; // dinheiro contado
  cardCountedCents?: number; // cartão conferido (relatório maquininha)
  pixCountedCents?: number; // pix conferido (extrato)
  expectedCents: number; // dinheiro esperado (saldo de caixa)
  salesCashCents: number;
  salesCardCents: number;
  salesPixCents: number;
  salesTotalCents: number;
  cardFeeCents: number;
  osCashCents?: number; // dinheiro de OS quitada na sessão (já embutido no expectedCents)
  osTotalCents?: number; // bruto de OS quitada na sessão (auditoria)
};
export async function closeCash(input: CloseCashInput): Promise<CashSession | null> {
  const open = await getOpenSession();
  if (!open) return null;
  const counted = Math.max(0, Math.round(input.countedCents));
  const cardCounted = input.cardCountedCents != null ? Math.max(0, Math.round(input.cardCountedCents)) : undefined;
  const pixCounted = input.pixCountedCents != null ? Math.max(0, Math.round(input.pixCountedCents)) : undefined;
  return patchSession(open.id, (s) => ({
    ...s,
    status: "fechado",
    closedAt: input.at,
    closedBy: input.closedBy,
    countedCents: counted,
    expectedCents: input.expectedCents,
    diffCents: counted - input.expectedCents,
    salesCashCents: input.salesCashCents,
    salesCardCents: input.salesCardCents,
    salesPixCents: input.salesPixCents,
    salesTotalCents: input.salesTotalCents,
    cardFeeCents: input.cardFeeCents,
    cardNetCents: input.salesCardCents - input.cardFeeCents,
    cardCountedCents: cardCounted,
    pixCountedCents: pixCounted,
    cardDiffCents: cardCounted != null ? cardCounted - input.salesCardCents : undefined,
    pixDiffCents: pixCounted != null ? pixCounted - input.salesPixCents : undefined,
    osCashCents: input.osCashCents,
    osTotalCents: input.osTotalCents,
  }));
}
