import { getCurrentStore } from "@/lib/auth/store";
import { getSubscription } from "@/lib/auth/subscription";
import { BILLING } from "@/config/billing";
import PagarClient from "./PagarClient";

export const dynamic = "force-dynamic";

// Tela de bloqueio (fora do (protected) — não passa pelo gate de billing, só pelo de login).
// O PagarClient gera o PIX (QR inline) chamando /api/billing/checkout-asaas. — ComandaPRO 3.7
export default async function BloqueadoPage() {
  const loja = await getCurrentStore();
  const sub = loja ? await getSubscription(loja.id) : null;
  const planos = Object.entries(BILLING.planos).map(([id, p]) => ({
    id,
    label: p.label,
    cents: p.cents,
    equivMes: p.equivMes,
    meses: p.meses,
  }));

  const aviso =
    sub?.status === "trial"
      ? "Seu período de teste terminou."
      : sub?.status === "past_due"
        ? "Seu pagamento está em atraso."
        : "Sua assinatura está pendente.";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2a0f3d] to-[#140820] px-4 py-12 text-white">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold">ComandaPRO</h1>
        <p className="mt-2 text-white/70">{aviso} Escolha um plano pra continuar usando o painel:</p>
        <PagarClient planos={planos} lojaNome={loja?.name ?? ""} />
        <p className="mt-6 text-xs text-white/40">Loja: {loja?.name ?? "—"}</p>
      </div>
    </div>
  );
}
