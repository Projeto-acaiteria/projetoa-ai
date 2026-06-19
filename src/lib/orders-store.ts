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

const ID_BASE = 1042; // continua a numeração dos exemplos

async function readAll(): Promise<Order[]> {
  const { data } = await db().from("orders").select("data");
  return (data ?? []).map((r) => (r as { data: Order }).data);
}

async function writeAll(orders: Order[]): Promise<void> {
  const d = db();
  await d.from("orders").delete().neq("id", -1); // limpa tudo
  if (orders.length) await d.from("orders").insert(orders.map((o) => ({ id: o.id, data: o })));
}

export async function listOrders(): Promise<Order[]> {
  const all = await readAll();
  return all.sort((a, b) => b.id - a.id);
}

export type NewOrder = Omit<Order, "id" | "display" | "createdAt" | "status">;

export async function addOrder(input: NewOrder, nowIso: string, status: OrderStatus = "recebido"): Promise<Order> {
  const all = await readAll();
  const nextId = (all.reduce((m, o) => Math.max(m, o.id), ID_BASE) || ID_BASE) + 1;
  const order: Order = {
    ...input,
    id: nextId,
    display: `#${nextId}`,
    createdAt: nowIso,
    status,
  };
  all.push(order);
  await writeAll(all);
  // read-after-write (λ.prova-na-fonte): confirma que persistiu
  const back = (await readAll()).find((o) => o.id === nextId);
  if (!back) throw new Error("Falha ao persistir o pedido");
  return back;
}

export async function setStatus(id: number, status: OrderStatus): Promise<Order | null> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  all[idx].status = status;
  await writeAll(all);
  return (await readAll()).find((o) => o.id === id) ?? null;
}

export async function markPointsAwarded(id: number, points: number): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === id);
  if (idx < 0) return;
  all[idx].pointsAwarded = points;
  await writeAll(all);
}

export async function markConsumed(id: number): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === id);
  if (idx < 0) return;
  all[idx].consumed = true;
  await writeAll(all);
}
