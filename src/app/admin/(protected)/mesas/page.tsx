import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getStore, getCardMachines } from "@/lib/settings-store";
import { readMenu } from "@/lib/menu-store";
import { readBarMenu } from "@/lib/menu-bar-store";
import { listStock } from "@/lib/stock-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { getActiveEvent } from "@/lib/events-store";
import { listStaff } from "@/lib/staff-store";
import { resolveStoreId } from "@/lib/auth/current";
import MesasClient from "./MesasClient";
import MesasBarClient from "./MesasBarClient";

export const dynamic = "force-dynamic";

export default async function MesasPage() {
  await requireNavAccess("/admin/mesas");
  const storeId = await resolveStoreId();
  const cfg = await getStoreConfig(storeId);
  const isRelacional = cfg?.menu_template === "bar" || cfg?.menu_template === "grid";

  // show de hoje (couvert): só pergunta nº de pessoas ao abrir mesa se a loja tem cover + atração ao vivo hoje
  const ev = cfg?.cover_enabled ? await getActiveEvent(storeId) : null;
  const coverShow = ev ? { artist: ev.artist, coverCents: ev.cover_cents } : null;
  const staff = (await listStaff(storeId)).filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }));

  const header = (
    <PageHeader title="Mesas" sub="Salão · abra a comanda, lance itens e feche a conta" action={<Badge tone="lime">tempo real</Badge>} />
  );

  // bar/grid (menu relacional): comanda do operador espelhada do Medellín
  if (isRelacional) {
    const [categories, store, machines] = await Promise.all([readBarMenu(storeId), getStore(storeId), getCardMachines(storeId)]);
    return <>{header}<MesasBarClient categories={categories} coverShow={coverShow} staff={staff} storeName={store.name} machines={machines} endereco={store.endereco} cnpj={store.cnpj} tel={store.whatsapp} cupomRodape={store.cupomRodape} /></>;
  }

  // açaí (copo/peso): fluxo existente
  const [store, menu, stock] = await Promise.all([getStore(storeId), readMenu(storeId), listStock(storeId)]);
  const sizes = menu.sizes.map((s) => ({ id: s.id, label: s.label, priceCents: s.priceCents, ml: s.ml }));
  // produtos de revenda (refri, picolé, água…) — mesma fonte do Caixa, pra vender também na mesa
  const VENDA_CATS = ["sorvete", "picole", "bebida", "bebida_alcoolica", "salgado", "doce"];
  const produtos = stock
    .filter((i) => VENDA_CATS.includes(i.category) && i.sellPriceCents)
    .map((i) => ({ id: i.id, name: i.name, priceCents: i.sellPriceCents!, qty: i.qty, unit: i.unit }));
  return <>{header}<MesasClient pricePerKgCents={store.pricePerKgCents} sizes={sizes} produtos={produtos} coverShow={coverShow} staff={staff} storeName={store.name} endereco={store.endereco} cnpj={store.cnpj} tel={store.whatsapp} cupomRodape={store.cupomRodape} /></>;
}
