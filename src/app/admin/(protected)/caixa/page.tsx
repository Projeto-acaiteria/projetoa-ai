import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { readMenu } from "@/lib/menu-store";
import { listStock } from "@/lib/stock-store";
import { getFees, getStore, getCardMachines, hasCashPin } from "@/lib/settings-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { resolveStoreId } from "@/lib/auth/current";
import CaixaClient from "./CaixaClient";

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
  const cfg = await getStoreConfig(await resolveStoreId());
  const showPdv = cfg?.menu_template === "acai";
  const cashPinSet = await hasCashPin();
  const produtos = stock
    .filter((i) => VENDA_CATS.includes(i.category) && i.sellPriceCents)
    .map((i) => ({ id: i.id, name: i.name, priceCents: i.sellPriceCents!, qty: i.qty, unit: i.unit }));

  return (
    <>
      <PageHeader title="Caixa" sub="Frente de caixa · abra o caixa e venda" />
      <CaixaClient sizes={menu.sizes} groups={menu.groups} produtos={produtos} fees={fees} storeName={store.name} machines={machines} endereco={store.endereco} cnpj={store.cnpj} tel={store.whatsapp} cupomRodape={store.cupomRodape} showPdv={showPdv} pricePerKgCents={store.pricePerKgCents} cashPinSet={cashPinSet} />
    </>
  );
}
