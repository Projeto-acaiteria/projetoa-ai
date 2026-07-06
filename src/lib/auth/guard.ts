import "server-only";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/store";
import { canSeeNav } from "@/lib/auth/roles";

// Guard SERVER-SIDE por página. Espelha a matriz de nav (canSeeNav) — fonte única: se o papel
// não enxerga a rota no menu, também não acessa digitando a URL. Sem isso, o filtro de nav é só
// cosmético (técnico/recepção furavam por URL). Para OWNER é sempre no-op (vê tudo) → food intacto.
// `href` = a rota canônica de nav da página (ex.: /admin/os cobre /admin/os/[id] e /admin/os/montar).
export async function requireNavAccess(href: string): Promise<void> {
  const role = await getCurrentRole();
  if (!role) redirect("/login");
  if (!canSeeNav(role, href)) {
    // técnico só tem a área dele; recepção/owner-bloqueado voltam pro início
    redirect(role === "technician" ? "/admin/minha-area" : "/admin");
  }
}
