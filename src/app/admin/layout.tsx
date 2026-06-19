import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentStore } from "@/lib/auth/store";

export const dynamic = "force-dynamic";

// Gate de LOGIN (ComandaPRO). Envolve TUDO sob /admin — inclusive /admin/bloqueado.
// O gate de BILLING + o AdminShell ficam no (protected)/layout.tsx (só rotas liberadas),
// pra a tela de bloqueio não cair em loop de redirect.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const loja = await getCurrentStore();
  if (!loja) redirect("/login");
  return <>{children}</>;
}
