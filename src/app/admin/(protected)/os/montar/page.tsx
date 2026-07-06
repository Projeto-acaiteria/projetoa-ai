import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { listStock } from "@/lib/stock-store";
import type { BuildItem } from "@/lib/pc-builder";
import MontadorClient from "./MontadorClient";

export const dynamic = "force-dynamic";

const BUILD_CATS = new Set(["cpu", "cooler", "mobo", "ram", "gpu", "ssd", "gabinete", "fonte"]);

export default async function MontarPage() {
  await requireNavAccess("/admin/os");
  const stock = await listStock();
  const items: BuildItem[] = stock
    .filter((s) => BUILD_CATS.has(s.category))
    .map((s) => ({ id: s.id, name: s.name, category: s.category, sellPriceCents: s.sellPriceCents ?? 0, brand: s.brand, specs: s.specs }));

  return (
    <>
      <PageHeader
        title="Montar PC"
        sub="Escolha os componentes compatíveis → gera a OS de montagem com as peças"
        action={<Badge tone="lime">montador</Badge>}
      />
      <MontadorClient items={items} />
    </>
  );
}
