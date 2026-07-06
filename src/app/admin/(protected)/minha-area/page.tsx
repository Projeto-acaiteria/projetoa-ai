import { redirect } from "next/navigation";
import { PageHeader, Badge, Card } from "@/components/admin/ui";
import { getCurrentMembership } from "@/lib/auth/store";

export const dynamic = "force-dynamic";

// Área do TÉCNICO: a agenda de serviços dele + a comissão dele (λ.garcom-app-so-pedidos:
// vê o próprio trabalho e o próprio ganho, nunca o financeiro da loja).
// A grade real de OS chega com o vertical de assistência técnica (service_orders).
export default async function MinhaAreaPage() {
  const m = await getCurrentMembership();
  if (!m) redirect("/login");

  return (
    <>
      <PageHeader
        title="Minha área"
        sub="Sua agenda de serviços e sua comissão"
        action={<Badge tone="lime">{m.role === "technician" ? "técnico" : m.role}</Badge>}
      />
      <Card className="max-w-xl p-6">
        <h3 className="mb-1 text-base font-bold text-ink">Olá</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Aqui vai aparecer <strong>a sua agenda de serviços</strong> — as ordens de serviço atribuídas a você,
          por situação, e a sua comissão (apurada e paga). Você vê só o seu trabalho e o seu ganho; o financeiro
          da loja fica com o dono.
        </p>
        <p className="mt-3 text-xs text-[var(--text-faded)]">
          A grade de OS entra com o módulo de assistência técnica (em construção).
        </p>
      </Card>
    </>
  );
}
