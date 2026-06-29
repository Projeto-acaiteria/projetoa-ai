import type { Order } from "@/lib/orders-store";
import type { TicketData } from "@/lib/ticket";

// Rótulos de pagamento/modo do cupom — compartilhados entre a tela Pedidos e o vigia global.
export const PAY_LABEL: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Cartão débito", credito: "Cartão crédito" };
export const MODE_LABEL: Record<string, string> = { balcao: "Balcão", retirada: "Retirada", entrega: "Entrega" };

// Monta o cupom térmico (auto-impressão) a partir de um pedido. Extraído do PedidosClient pra ser
// reusado pelo OrderWatcher (vigia global que imprime/apita pedido novo em QUALQUER tela do admin).
export function ticketFromOrder(o: Order, storeName: string, head: { endereco: string; cnpj: string; tel: string; rodape?: string }): TicketData {
  const d = new Date(o.createdAt);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    loja: storeName, endereco: head.endereco, cnpj: head.cnpj, tel: head.tel, rodape: head.rodape,
    display: o.display,
    dateLabel: `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`,
    modeLabel: MODE_LABEL[o.mode] ?? o.mode,
    paymentLabel: o.paymentMethod ? PAY_LABEL[o.paymentMethod] : undefined,
    customerName: o.customerName,
    phone: o.phone || undefined,
    address: o.address,
    bairro: o.bairro,
    feeCents: o.feeCents || undefined,
    // sizeLabel "Delivery"/"Retirada" é só marcador de tipo (já vai no modeLabel) — não vira item
    items: [
      ...(o.sizeLabel && o.sizeLabel !== "Delivery" && o.sizeLabel !== "Retirada" ? [{ qty: 1, name: o.sizeLabel }] : []),
      ...o.items.map((it) => ({ qty: it.qty, name: it.name, totalCents: it.paidCents > 0 ? it.paidCents : undefined })),
    ],
    totalCents: o.totalCents,
    code: o.code,
    // não processamos pagamento: em pedido do link (entrega/retirada) o entregador/balcão RECEBE o total
    collectCents: o.mode !== "balcao" ? o.totalCents : undefined,
    pointsInfo: o.pointsAwarded ? `Pontos ganhos: +${o.pointsAwarded}` : undefined,
    origem: o.mode === "balcao" ? "balcao" : "link",
  };
}
