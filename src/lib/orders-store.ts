// Store de pedidos · protótipo sem Supabase ainda (arquivo JSON local).
// No sistema final isto vira tabela `orders` no Supabase. A interface é a mesma.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

export type OrderStatus = "recebido" | "preparo" | "saiu" | "entregue";

export type OrderItem = {
  group: string;
  name: string;
  qty: number;
  paidCents: number; // total cobrado deste item (0 = grátis)
  note?: string; // observação livre do operador (ex: "sem granola", "pra viagem")
  earnsPoints?: boolean; // fidelidade: a categoria deste item pontua? (ausente = sim, default)
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
  discountCents?: number; // desconto aplicado na venda (balcão/PDV)
  payments?: { method: PaymentMethod; amountCents: number }[]; // split (>1 forma); ausente = forma única em paymentMethod
  status: OrderStatus;
  pointsAwarded?: number; // pontos já creditados (evita duplicar)
  paymentMethod?: PaymentMethod; // venda de balcão
  cardFeeCents?: number; // taxa da maquininha cobrada (líquido = total - cardFee)
  cardMachineId?: string; // máquina usada na cobrança (snapshot imutável)
  cardMachineName?: string; // nome da máquina no momento da venda
  cardFeePercent?: number; // % da taxa fotografado
  parcelas?: number; // nº de parcelas (crédito; 1 = à vista)
  consumes?: { stockId: string; qty: number; costCents?: number }[]; // ficha técnica (baixa + custo congelado p/ CMV)
  consumed?: boolean; // estoque já abatido (evita duplicar na entrega)
  bairro?: string; // zona de entrega (delivery)
  code?: string; // código de rastreio (curto, aleatório) — cliente consulta o status por ele
  // ESTORNO: venda cancelada (bateu errado, cliente desistiu). NÃO deleta — vira registro auditável
  // e é excluída de caixa/receita/CMV/açaí-vendido; estoque e pontos são revertidos na ação.
  cancelled?: boolean;
  cancelledAt?: string;
  cancelReason?: string;
  cancelledBy?: string; // email do operador logado que cancelou
};

// código curto sem caracteres ambíguos (sem O/0/I/1/L) — fácil de ditar e digitar
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(): string {
  // 6 chars (~887M combinações) — colisão por loja desprezível sem precisar consultar o banco
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

export type PaymentMethod = "dinheiro" | "pix" | "debito" | "credito";

async function readAll(storeId?: string): Promise<Order[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("orders").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler pedidos: " + error.message); // nunca tratar erro como vazio
  return (data ?? []).map((r) => (r as { data: Order }).data);
}

export async function listOrders(storeId?: string): Promise<Order[]> {
  return (await readAll(storeId)).sort((a, b) => b.id - a.id);
}

export type NewOrder = Omit<Order, "id" | "display" | "createdAt" | "status">;

// INSERT de UMA linha — o banco gera o id (identity). Sem race de id, sem delete-all.
export async function addOrder(input: NewOrder, nowIso: string, status: OrderStatus = "recebido", storeId?: string): Promise<Order> {
  const d = db();
  const sid = storeId ?? (await resolveStoreId());
  const base = { ...input, code: input.code || genCode(), createdAt: nowIso, status };
  const { data: row, error } = await d.from("orders").insert({ data: base, store_id: sid }).select("id").single();
  if (error || !row) throw new Error("Falha ao criar o pedido: " + (error?.message ?? "sem retorno"));
  const id = Number((row as { id: number }).id);
  const order: Order = { ...base, id, display: `#${id}` };
  const { error: e2 } = await d.from("orders").update({ data: order }).eq("id", id);
  if (e2) throw new Error("Falha ao gravar o pedido: " + e2.message);
  return order;
}

// patch por-linha: lê 1 row, muta o data, atualiza só dela (não toca o resto da tabela).
// storeId OBRIGATÓRIO: filtra por loja nas DUAS queries — senão um dono mexe em pedido de
// outra loja chutando o id sequencial (IDOR). db() é service-role e bypassa RLS.
async function patchOrder(id: number, storeId: string, mut: (o: Order) => Order): Promise<Order | null> {
  const d = db();
  const { data: row, error } = await d.from("orders").select("data").eq("id", id).eq("store_id", storeId).maybeSingle();
  if (error) throw new Error("Erro ao ler pedido: " + error.message);
  if (!row) return null;
  const order = mut((row as { data: Order }).data);
  const { error: e2 } = await d.from("orders").update({ data: order }).eq("id", id).eq("store_id", storeId);
  if (e2) throw new Error("Erro ao atualizar pedido: " + e2.message);
  return order;
}

/** Busca pública pelo código de rastreio (case-insensitive), restrita à loja. Não expõe lista. */
export async function getOrderByCode(storeId: string, code: string): Promise<Order | null> {
  const c = (code || "").trim().toUpperCase();
  if (c.length < 4) return null;
  const all = await readAll(storeId);
  return all.find((o) => (o.code || "").toUpperCase() === c) ?? null;
}

export async function setStatus(id: number, status: OrderStatus, storeId?: string): Promise<Order | null> {
  const sid = storeId ?? (await resolveStoreId());
  return patchOrder(id, sid, (o) => ({ ...o, status }));
}
export async function markPointsAwarded(id: number, points: number, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await patchOrder(id, sid, (o) => ({ ...o, pointsAwarded: points }));
}
export async function markConsumed(id: number, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await patchOrder(id, sid, (o) => ({ ...o, consumed: true }));
}

/** Uma order pelo id, restrita à loja (pra ação de cancelamento reverter estoque/pontos). */
export async function getOrder(id: number, storeId?: string): Promise<Order | null> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("orders").select("data").eq("id", id).eq("store_id", sid).maybeSingle();
  if (error) throw new Error("Erro ao ler pedido: " + error.message);
  return data ? (data as { data: Order }).data : null;
}

/** Marca a venda como CANCELADA (estorno). Idempotente: se já cancelada, patchOrder não duplica
 *  (o chamador checa antes de reverter estoque/pontos). NÃO deleta — mantém pro histórico. */
export async function cancelOrder(id: number, reason: string, by: string | undefined, at: string, storeId?: string): Promise<Order | null> {
  const sid = storeId ?? (await resolveStoreId());
  return patchOrder(id, sid, (o) => ({ ...o, cancelled: true, cancelledAt: at, cancelReason: reason, cancelledBy: by }));
}

/** Confirma um pedido de balcão RECEBIDO (vindo do site): vira venda ENTREGUE, grava a forma de
 *  pagamento e o custo congelado (CMV), marca consumed e move o createdAt pro momento da confirmação
 *  (é quando o dinheiro entra → bucket de receita no dia certo). O chamador aplica a baixa depois. */
export async function confirmBalcaoPedido(
  id: number,
  paymentMethod: PaymentMethod,
  consumes: Order["consumes"],
  at: string,
  storeId?: string,
  pricing?: {
    totalCents?: number;
    discountCents?: number;
    card?: { feeCents: number; feePercent: number; machineId?: string; machineName?: string; parcelas: number };
  },
): Promise<Order | null> {
  const sid = storeId ?? (await resolveStoreId());
  return patchOrder(id, sid, (o) => ({
    ...o,
    status: "entregue",
    paymentMethod,
    consumes: consumes ?? o.consumes,
    consumed: true,
    createdAt: at,
    ...(pricing?.totalCents != null ? { totalCents: pricing.totalCents } : {}),
    ...(pricing?.discountCents != null ? { discountCents: pricing.discountCents || undefined } : {}),
    ...(pricing?.card
      ? {
          cardFeeCents: pricing.card.feeCents || undefined,
          cardMachineId: pricing.card.machineId,
          cardMachineName: pricing.card.machineName,
          cardFeePercent: pricing.card.feePercent || undefined,
          parcelas: pricing.card.parcelas > 1 ? pricing.card.parcelas : undefined,
        }
      : {}),
  }));
}
