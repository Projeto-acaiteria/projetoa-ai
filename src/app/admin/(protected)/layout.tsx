import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import OrderWatcher from "@/components/admin/OrderWatcher";
import OfflineIndicator from "@/components/admin/OfflineIndicator";
import { getStore } from "@/lib/settings-store";
import { getCurrentStore, getCurrentRole } from "@/lib/auth/store";
import { getSubscription, isBlocked, billingBanner } from "@/lib/auth/subscription";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";

export const dynamic = "force-dynamic";

// Gate de BILLING (ComandaPRO 3.3). Login já foi garantido pelo /admin/layout.tsx (acima).
// Aqui: precisa de assinatura ok — senão manda pra /admin/bloqueado (que fica FORA deste group,
// pra não cair em loop de redirect). O AdminShell (painel) só aparece pra quem está liberado.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const loja = await getCurrentStore();
  if (!loja) redirect("/login");

  const sub = await getSubscription(loja.id);
  if (isBlocked(sub)) redirect("/admin/bloqueado");

  const [store, cfg, role] = await Promise.all([getStore(), getStoreConfig(loja.id), getCurrentRole()]);
  const nav = {
    template: cfg?.menu_template ?? "acai",
    hasTables: !!cfg?.has_tables,
    hasDelivery: !!cfg?.has_delivery,
    coverEnabled: !!cfg?.cover_enabled,
    hasStations: !!cfg?.has_stations,
    loyaltyEnabled: !!cfg?.loyalty_enabled,
    hasEstoque: !!cfg?.has_estoque,
    role: role ?? "owner",
    family: familyOf(cfg?.business_type),
  };
  return (
    <AdminShell storeName={store.name} nav={nav} billing={billingBanner(sub)} logoUrl={store.logoUrl} brandColor={store.primaryColor}>
      {/* vigia global: apita + imprime pedido novo do link em QUALQUER tela (não só na Pedidos) */}
      <OrderWatcher storeName={store.name} endereco={store.endereco} cnpj={store.cnpj} tel={store.whatsapp} cupomRodape={store.cupomRodape} />
      {/* offline (resiliência a quedas): motor de plataforma, ativado por ora só no vertical service
          (Starteq) — food/Cantinho NÃO recebe agora (não é cobaia; entra depois, com impacto). */}
      {nav.family === "service" && <OfflineIndicator />}
      {children}
    </AdminShell>
  );
}
