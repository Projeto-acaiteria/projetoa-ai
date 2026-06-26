// Store de clientes + pontos · protótipo sem Supabase (arquivo JSON).
// Vira tabelas `customers` + `points_transactions` no Supabase depois.
// Chave do cliente = telefone só com dígitos.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

export type PointsTx = {
  type: "earn" | "redeem" | "adjust" | "expire"; // expire = baixa do cron (auditoria); FIFO ignora
  points: number; // earn/adjust positivo, redeem/expire negativo
  ref: string; // ex: "#1043" ou "Açaí 300ml grátis"
  at: string;
};

export type Customer = {
  phone: string; // só dígitos
  name: string;
  points: number;
  createdAt: string;
  history: PointsTx[];
  birthday?: string; // YYYY-MM-DD (pra cupom de aniversário)
};

export const normPhone = (s: string) => (s || "").replace(/\D+/g, "");

async function readAll(storeId?: string): Promise<Customer[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("customers").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler clientes: " + error.message); // nunca tratar erro como vazio
  return (data ?? []).map((r) => (r as { data: Customer }).data);
}

export async function listCustomers(): Promise<Customer[]> {
  return (await readAll()).sort((a, b) => b.points - a.points);
}

export async function getByPhone(phone: string, storeId?: string): Promise<Customer | null> {
  const key = normPhone(phone);
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("customers").select("data").eq("store_id", sid).eq("phone", key).maybeSingle();
  if (error) throw new Error("Erro ao ler cliente: " + error.message);
  return data ? (data as { data: Customer }).data : null;
}

// patch por-linha: lê 1 cliente, muta o data, grava SÓ ele via upsert (não toca o resto).
async function upsert(
  phone: string,
  name: string,
  tx: PointsTx,
): Promise<Customer> {
  const key = normPhone(phone);
  const sid = await resolveStoreId();
  const d = db();
  const { data: row, error } = await d.from("customers").select("data").eq("store_id", sid).eq("phone", key).maybeSingle();
  if (error) throw new Error("Erro ao ler cliente: " + error.message);
  let c = row ? (row as { data: Customer }).data : null;
  if (!c) {
    c = { phone: key, name: name || "Cliente", points: 0, createdAt: tx.at, history: [] };
  }
  if (name && c.name === "Cliente") c.name = name;
  c.points = Math.max(0, c.points + tx.points);
  c.history.unshift(tx);
  const { error: e2 } = await d.from("customers").upsert({ store_id: sid, phone: key, data: c });
  if (e2) throw new Error("Falha ao persistir cliente: " + e2.message);
  return c;
}

export function awardPoints(phone: string, name: string, points: number, ref: string, at: string) {
  return upsert(phone, name, { type: "earn", points, ref, at });
}

// cadastro rápido (sem pontos) — cria ou atualiza nome/aniversário
export async function saveCustomer(phone: string, name: string, birthday: string | undefined, at: string): Promise<Customer> {
  const key = normPhone(phone);
  const sid = await resolveStoreId();
  const d = db();
  const { data: row, error } = await d.from("customers").select("data").eq("store_id", sid).eq("phone", key).maybeSingle();
  if (error) throw new Error("Erro ao ler cliente: " + error.message);
  let c = row ? (row as { data: Customer }).data : null;
  if (!c) {
    c = { phone: key, name: name?.trim() || "Cliente", points: 0, createdAt: at, history: [], birthday };
  } else {
    if (name?.trim()) c.name = name.trim();
    if (birthday !== undefined) c.birthday = birthday;
  }
  const { error: e2 } = await d.from("customers").upsert({ store_id: sid, phone: key, data: c });
  if (e2) throw new Error("Falha ao salvar cliente: " + e2.message);
  return c;
}

export async function searchCustomers(q: string): Promise<Customer[]> {
  const term = q.trim().toLowerCase();
  const digits = q.replace(/\D+/g, "");
  const all = await listCustomers();
  if (!term) return all;
  return all.filter((c) => c.name.toLowerCase().includes(term) || (digits && c.phone.includes(digits)));
}

export function redeem(phone: string, points: number, rewardLabel: string, at: string) {
  return upsert(phone, "", { type: "redeem", points: -Math.abs(points), ref: rewardLabel, at });
}
