// Store de pedidos · protótipo sem Supabase ainda (arquivo JSON local).
// No sistema final isto vira tabela `orders` no Supabase. A interface é a mesma.
import { db } from "@/lib/supabase";

export type OrderStatus = "recebido" | "preparo" | "saiu" | "entregue";

export type OrderItem = {
  group: string;
  name: string;
  qty: number;
  paidCents: number; // total cobrado deste item (0 = grátis)
};

export type Order = {
  id: number;
  display: string; // "#1043"
  createdAt: string;
  customerName: string;
  phone: string;
  address?: string;
  mode: "retirada" | "entrega" | "balcao";
  sizeLabel: string;
  items: OrderItem[];
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
  status: OrderStatus;
  pointsAwarded?: number; // pontos já creditados (evita duplicar)
  paymentMethod?: PaymentMethod; // venda de balcão
  cardFeeCents?: number; // taxa da maquininha cobrada (líquido = total - cardFee)
  consumes?: { stockId: string; qty: number }[]; // ficha técnica (baixa de estoque)
  consumed?: boolean; // estoque já abatido (evita duplicar na entrega)
  bairro?: string; // zona de entrega (delivery)
};

export type PaymentMethod = "dinheiro" | "pix" | "debito" | "credito";

async function readAll(): Promise<Order[]> {
  const { data, error } = await db().from("orders").select("data");
  if (error) throw new Error("Erro ao ler pedidos: " + error.message); // nunca tratar erro como vazio
  return (data ?? []).map((r) => (r as { data: Order }).data);
}

export async function listOrders(): Promise<Order[]> {
  return (await readAll()).sort((a, b) => b.id - a.id);
}

export type NewOrder = Omit<Order, "id" | "display" | "createdAt" | "status">;

// INSERT de UMA linha — o banco gera o id (identity). Sem race de id, sem delete-all.
export async function addOrder(input: NewOrder, nowIso: string, status: OrderStatus = "recebido"): Promise<Order> {
  const d = db();
  const base = { ...input, createdAt: nowIso, status };
  const { data: row, error } = await d.from("orders").insert({ data: base }).select("id").single();
  if (error || !row) throw new Error("Falha ao criar o pedido: " + (error?.message ?? "sem retorno"));
  const id = Number((row as { id: number }).id);
  const order: Order = { ...base, id, display: `#${id}` };
  const { error: e2 } = await d.from("orders").update({ data: order }).eq("id", id);
  if (e2) throw new Error("Falha ao gravar o pedido: " + e2.message);
  return order;
}

// patch por-linha: lê 1 row, muta o data, atualiza só dela (não toca o resto da tabela).
async function patchOrder(id: number, mut: (o: Order) => Order): Promise<Order | null> {
  const d = db();
  const { data: row, error } = await d.from("orders").select("data").eq("id", id).maybeSingle();
  if (error) throw new Error("Erro ao ler pedido: " + error.message);
  if (!row) return null;
  const order = mut((row as { data: Order }).data);
  const { error: e2 } = await d.from("orders").update({ data: order }).eq("id", id);
  if (e2) throw new Error("Erro ao atualizar pedido: " + e2.message);
  return order;
}

export async function setStatus(id: number, status: OrderStatus): Promise<Order | null> {
  return patchOrder(id, (o) => ({ ...o, status }));
}
export async function markPointsAwarded(id: number, points: number): Promise<void> {
  await patchOrder(id, (o) => ({ ...o, pointsAwarded: points }));
}
export async function markConsumed(id: number): Promise<void> {
  await patchOrder(id, (o) => ({ ...o, consumed: true }));
}
