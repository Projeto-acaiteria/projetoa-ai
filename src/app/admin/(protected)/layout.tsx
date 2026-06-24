import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getStore } from "@/lib/settings-store";
import { getCurrentStore } from "@/lib/auth/store";
import { getSubscription, isBlocked } from "@/lib/auth/subscription";
import { getStoreConfig } from "@/lib/auth/store-config";

export const dynamic = "force-dynamic";

// Gate de BILLING (ComandaPRO 3.3). Login já foi garantido pelo /admin/layout.tsx (acima).
// Aqui: precisa de assinatura ok — senão manda pra /admin/bloqueado (que fica FORA deste group,
// pra não cair em loop de redirect). O AdminShell (painel) só aparece pra quem está liberado.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const loja = await getCurrentStore();
  if (!loja) redirect("/login");

  const sub = await getSubscription(loja.id);
  if (isBlocked(sub)) redirect("/admin/bloqueado");

  const [store, cfg] = await Promise.all([getStore(), getStoreConfig(loja.id)]);
  const nav = {
    template: cfg?.menu_template ?? "acai",
    hasTables: !!cfg?.has_tables,
    hasDelivery: !!cfg?.has_delivery,
    coverEnabled: !!cfg?.cover_enabled,
    hasStations: !!cfg?.has_stations,
    loyaltyEnabled: !!cfg?.loyalty_enabled,
  };
  return <AdminShell storeName={store.name} nav={nav}>{children}</AdminShell>;
}
