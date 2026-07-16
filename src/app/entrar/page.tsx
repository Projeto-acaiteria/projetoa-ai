import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentStore } from "@/lib/auth/store";
import { isOperatorEmail } from "@/lib/auth/operator";

export const dynamic = "force-dynamic";

// Despachante pós-login: manda cada um pra porta certa pelo papel.
// - operador do SaaS  → /sistema/leads (não tem loja; ia rebater no /admin)
// - dono de loja      → /admin
// - logado sem nada    → /cadastro (cria a loja)
// - anônimo            → /login
export default async function EntrarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isOperatorEmail(user.email)) redirect("/sistema/leads");
  const store = await getCurrentStore();
  if (store) redirect("/admin");
  redirect("/cadastro");
}
