import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import { listStock } from "@/lib/stock-store";
import { listOrders } from "@/lib/orders-store";
import { getCardMachines, getStore } from "@/lib/settings-store";
import VendasClient from "./VendasClient";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  // tela EXCLUSIVA da vertical de serviço (AT). Food vende pelo Balcão/Caixa.
  const store = await getCurrentStore();
  const cfg = store ? await getStoreConfig(store.id) : null;
  if (familyOf(cfg?.business_type) !== "service") redirect("/admin");

  const [stock, orders, machinesRaw, storeSettings] = await Promise.all([listStock(), listOrders(), getCardMachines(), getStore()]);
  const machines = machinesRaw.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name, maxParcelas: m.maxParcelas }));
  const pixDiscountPercent = Number(storeSettings.pixDiscountPercent ?? 0);
  const products = stock
    .filter((s) => Number(s.sellPriceCents ?? 0) > 0)
    .map((s) => ({ sku: s.id, name: s.name, category: String(s.category), priceCents: Number(s.sellPriceCents), stock: Number(s.qty ?? 0) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const recentes = orders
    .filter((o) => o.mode === "balcao" && o.status === "entregue" && !o.cancelled)
    .slice(0, 8)
    .map((o) => ({ display: o.display, totalCents: o.totalCents, paymentMethod: o.paymentMethod ?? null, count: o.items.reduce((n, i) => n + i.qty, 0) }));

  // pedidos que o SITE mandou (recebido, ainda não confirmados no balcão)
  const pedidos = orders
    .filter((o) => o.mode === "balcao" && o.status === "recebido" && !o.cancelled)
    .sort((a, b) => b.id - a.id)
    .map((o) => ({
      id: o.id,
      display: o.display,
      code: o.code ?? null,
      customerName: o.customerName,
      phone: o.phone,
      totalCents: o.totalCents,
      items: o.items.map((i) => ({ name: i.name, qty: i.qty })),
    }));

  return <VendasClient products={products} recentes={recentes} pedidos={pedidos} machines={machines} pixDiscountPercent={pixDiscountPercent} />;
}
