import { PageHeader, Badge } from "@/components/admin/ui";
import { readBarMenu } from "@/lib/menu-bar-store";
import { getStore } from "@/lib/settings-store";
import BalcaoClient from "./BalcaoClient";

export const dynamic = "force-dynamic";

// Venda de balcão pro menu relacional (bar/grid/marmitaria). Operador pesa/lança e recebe.
export default async function BalcaoPage() {
  const [categories, store] = await Promise.all([readBarMenu(), getStore()]);
  return (
    <>
      <PageHeader title="Balcão" sub="Pese, lance e receba — venda rápida no balcão" action={<Badge tone="lime">bar / a quilo</Badge>} />
      <BalcaoClient categories={categories} storeName={store.name} />
    </>
  );
}
