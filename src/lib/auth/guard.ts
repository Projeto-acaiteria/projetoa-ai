import "server-only";
import { redirect } from "next/navigation";
import { getCurrentRole, getCurrentMembership } from "@/lib/auth/store";
import { canSeeNav } from "@/lib/auth/roles";
import { checkInStaff } from "@/lib/staff-store";

// Guard SERVER-SIDE por página. Espelha a matriz de nav (canSeeNav) — fonte única: se o papel
// não enxerga a rota no menu, também não acessa digitando a URL. Sem isso, o filtro de nav é só
// cosmético (técnico/recepção furavam por URL). Para OWNER é sempre no-op (vê tudo) → food intacto.
// `href` = a rota canônica de nav da página (ex.: /admin/os cobre /admin/os/[id] e /admin/os/montar).
export async function requireNavAccess(href: string): Promise<void> {
  const role = await getCurrentRole();
  if (!role) redirect("/login");
  if (!canSeeNav(role, href)) {
    // técnico → área dele; garçom → mesas (não vê o dashboard); recepção/owner → início
    redirect(role === "technician" ? "/admin/minha-area" : role === "waiter" ? "/admin/mesas" : "/admin");
  }
  // CHECK-IN da diária (mt-33): garçom que entra no sistema bate ponto na noite operacional.
  // Idempotente (1 por noite) e nunca lança — presença não pode derrubar a navegação dele.
  if (role === "waiter") {
    const staffId = (await getCurrentMembership())?.staffId;
    if (staffId) await checkInStaff(staffId);
  }
}
