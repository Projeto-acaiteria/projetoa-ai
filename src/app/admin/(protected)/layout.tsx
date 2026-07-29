import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import OrderWatcher from "@/components/admin/OrderWatcher";
import OfflineIndicator from "@/components/admin/OfflineIndicator";
import { getStore } from "@/lib/settings-store";
import { getStations } from "@/lib/menu-bar-store";
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
  const stations = cfg?.has_stations ? await getStations(loja.id) : []; // pro vigia de preparo global (imprime só na máquina do caixa)
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
    <AdminShell storeName={store.name} nav={nav} billing={billingBanner(sub)} logoUrl={store.logoUrl} brandColor={store.primaryColor} prepStations={stations}>
      {/* vigia global: apita + imprime pedido novo do link em QUALQUER tela (não só na Pedidos).
          Só monta onde faz sentido (perf 29/07): loja SEM delivery não recebe pedido de link — no
          Medellín ele ficava perguntando 900x/hora por pedido que nunca existiria. E garçom não
          atende delivery (não vê nem imprime), então o celular dele também não precisa vigiar. */}
      {cfg?.has_delivery !== false && (nav.role === "owner" || nav.role === "reception") && (
        <OrderWatcher storeName={store.name} endereco={store.endereco} cnpj={store.cnpj} tel={store.whatsapp} cupomRodape={store.cupomRodape} />
      )}
      {/* offline (resiliência a quedas): motor de plataforma. Montado GLOBAL pra qualquer loja com
          offline ligado (drena a fila no reconnect + router.refresh) — senão vendas offline feitas no
          Caixa/PDV/Balcão nunca sincronizam (só a tela de Mesas tinha o drenador). service = Starteq. */}
      {(nav.family === "service" || !!cfg?.offline_enabled) && <OfflineIndicator />}
      {children}
    </AdminShell>
  );
}
