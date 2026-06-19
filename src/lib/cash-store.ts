// Sessão de caixa · abertura, sangria, suprimento, fechamento com conferência.
// Modelo de PDV sério (espelha o caixa do palace-system). JSON → tabela Supabase.
import { db } from "@/lib/supabase";

export type CashMovement = {
  type: "sangria" | "suprimento";
  amountCents: number;
  reason: string;
  at: string;
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
};

async function readAll(): Promise<CashSession[]> {
  const { data } = await db().from("cash_sessions").select("data");
  return (data ?? []).map((r) => (r as { data: CashSession }).data);
}
async function writeAll(s: CashSession[]) {
  const d = db();
  await d.from("cash_sessions").delete().neq("id", -1); // limpa tudo
  if (s.length) await d.from("cash_sessions").insert(s.map((x) => ({ id: x.id, data: x })));
}

export async function getOpenSession(): Promise<CashSession | null> {
  return (await readAll()).find((s) => s.status === "aberto") ?? null;
}

export async function listClosedSessions(): Promise<CashSession[]> {
  return (await readAll())
    .filter((s) => s.status === "fechado")
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));
}

export async function openCash(floatCents: number, at: string, operator?: string): Promise<CashSession> {
  const all = await readAll();
  if (all.some((s) => s.status === "aberto")) throw new Error("Já existe caixa aberto");
  const id = (all.reduce((m, s) => Math.max(m, s.id), 0) || 0) + 1;
  const session: CashSession = {
    id,
    openedAt: at,
    operator,
    openingFloatCents: Math.max(0, Math.round(floatCents)),
    movements: [],
    status: "aberto",
  };
  all.push(session);
  await writeAll(all);
  return session;
}

export async function addMovement(type: "sangria" | "suprimento", amountCents: number, reason: string, at: string): Promise<CashSession | null> {
  const all = await readAll();
  const s = all.find((x) => x.status === "aberto");
  if (!s) return null;
  s.movements.unshift({ type, amountCents: Math.max(0, Math.round(amountCents)), reason, at });
  await writeAll(all);
  return s;
}

export async function closeCash(countedCents: number, expectedCents: number, salesCashCents: number, salesTotalCents: number, at: string): Promise<CashSession | null> {
  const all = await readAll();
  const s = all.find((x) => x.status === "aberto");
  if (!s) return null;
  s.status = "fechado";
  s.closedAt = at;
  s.countedCents = Math.max(0, Math.round(countedCents));
  s.expectedCents = expectedCents;
  s.diffCents = s.countedCents - expectedCents;
  s.salesCashCents = salesCashCents;
  s.salesTotalCents = salesTotalCents;
  await writeAll(all);
  return s;
}
