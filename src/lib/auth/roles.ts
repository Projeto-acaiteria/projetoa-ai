import type { Role } from "@/lib/auth/store";

// Papéis de funcionário (ComandaPRO). Matriz cravada 05/07 — ver COMANDAPRO-PAPEIS-PLANO.md.
// Owner vê tudo. Recepção = operação de balcão/atendimento. Técnico = só a agenda dele.

// Rotas de nav que a RECEPÇÃO enxerga (opera, mas sem financeiro/config/cupom-gestão/estoque).
const RECEPTION_NAV = new Set<string>([
  "/admin",
  "/admin/os", // recepção recebe o cliente e monta/abre a OS (assistência técnica)
  "/admin/vendas", // recepção opera o balcão de peças/periféricos
  "/admin/caixa",
  "/admin/balcao",
  "/admin/mesas",
  "/admin/qr-mesas",
  "/admin/preparo",
  "/admin/pedidos",
  "/admin/clientes",
  "/admin/impressora",
]);

/** Gate de NAV por papel. Owner vê tudo (menos a área exclusiva do técnico). */
export function canSeeNav(role: Role, href: string): boolean {
  if (role === "technician") return href === "/admin/minha-area";
  if (href === "/admin/minha-area") return false; // exclusiva do técnico
  if (role === "reception") return RECEPTION_NAV.has(href);
  return true; // owner
}
