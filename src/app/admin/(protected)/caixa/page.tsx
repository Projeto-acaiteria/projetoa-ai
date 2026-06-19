import { PageHeader } from "@/components/admin/ui";
import { readMenu } from "@/lib/menu-store";
import { listStock } from "@/lib/stock-store";
import { getFees, getStore } from "@/lib/settings-store";
import CaixaClient from "./CaixaClient";

export const dynamic = "force-dynamic";

const VENDA_CATS = ["sorvete", "picole", "bebida", "salgado", "doce"];

export default async function CaixaPage() {
  const menu = await readMenu();
  const stock = await listStock();
  const fees = await getFees();
  const store = await getStore();
  const produtos = stock
    .filter((i) => VENDA_CATS.includes(i.category) && i.sellPriceCents)
    .map((i) => ({ id: i.id, name: i.name, priceCents: i.sellPriceCents!, qty: i.qty, unit: i.unit }));

  return (
    <>
      <PageHeader title="Caixa" sub="Frente de caixa · abra o caixa e venda" />
      <CaixaClient sizes={menu.sizes} groups={menu.groups} produtos={produtos} fees={fees} storeName={store.name} />
    </>
  );
}
