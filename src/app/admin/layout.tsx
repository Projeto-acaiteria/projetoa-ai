import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getStore } from "@/lib/settings-store";
import { getCurrentUser, getCurrentStore } from "@/lib/auth/store";

export const dynamic = "force-dynamic";

// Gate (ComandaPRO Fase 2.4): só entra no painel quem está LOGADO e tem LOJA vinculada.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const loja = await getCurrentStore();
  if (!loja) redirect("/login");

  const store = await getStore();
  return <AdminShell storeName={store.name}>{children}</AdminShell>;
}
