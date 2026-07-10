import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { readMenu } from "@/lib/menu-store";
import { readBarMenu, getStations } from "@/lib/menu-bar-store";
import { listStock } from "@/lib/stock-store";
import { getFees, getStore, getCardMachines, hasCashPin } from "@/lib/settings-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { getActiveEvent } from "@/lib/events-store";
import { listStaff } from "@/lib/staff-store";
import { familyOf } from "@/config/segments";
import { resolveStoreId } from "@/lib/auth/current";
import CaixaClient from "./CaixaClient";
import CallsAlert from "@/components/admin/CallsAlert";

export const dynamic = "force-dynamic";

const VENDA_CATS = ["sorvete", "picole", "bebida", "salgado", "doce"];

export default async function CaixaPage() {
  await requireNavAccess("/admin/caixa");
  const menu = await readMenu();
  const stock = await listStock();
  const fees = await getFees();
  const store = await getStore();
  const machines = await getCardMachines();
  // PDV de copo (montagem açaí) só pra loja template "acai"; bar/grid vendem pelo Balcão
  const storeId = await resolveStoreId();
  const cfg = await getStoreConfig(storeId);
  const showPdv = cfg?.menu_template === "acai";
  const family = familyOf(cfg?.business_type); // service (AT) vende no balcão de peças, não em mesas
  const cashPinSet = await hasCashPin();
  const produtos = stock
    .filter((i) => VENDA_CATS.includes(i.category) && i.sellPriceCents)
    .map((i) => ({ id: i.id, name: i.name, priceCents: i.sellPriceCents!, qty: i.qty, unit: i.unit }));

  // Hub PDV do bar: o Caixa embute a grade de mesas + venda avulsa. Só pra bar/grid COM mesas (food).
  const isPdvHub = (cfg?.menu_template === "bar" || cfg?.menu_template === "grid") && !!cfg?.has_tables && family === "food";
  const [barCategories, coverShow, staff, stations] = isPdvHub
    ? await Promise.all([
        readBarMenu(storeId),
        cfg?.cover_enabled ? getActiveEvent(storeId).then((ev) => (ev ? { artist: ev.artist, coverCents: ev.cover_cents } : null)) : Promise.resolve(null),
        listStaff(storeId).then((s) => s.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name }))),
        getStations(storeId),
      ])
    : [[], null, [], []];

  return (
    <>
      <PageHeader title="Caixa" sub={isPdvHub ? "Frente de caixa · mesas, venda avulsa e gestão" : "Frente de caixa · abra o caixa e venda"} />
      {cfg?.has_tables && <CallsAlert />}
      <CaixaClient sizes={menu.sizes} groups={menu.groups} produtos={produtos} fees={fees} storeName={store.name} machines={machines} endereco={store.endereco} cnpj={store.cnpj} tel={store.whatsapp} cupomRodape={store.cupomRodape} showPdv={showPdv} pricePerKgCents={store.pricePerKgCents} cashPinSet={cashPinSet} family={family} pdvHub={isPdvHub} barCategories={barCategories} coverShow={coverShow} staff={staff} loyaltyEnabled={!!cfg?.loyalty_enabled} stations={stations} />
    </>
  );
}
