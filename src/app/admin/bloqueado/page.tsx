import { getCurrentStore } from "@/lib/auth/store";
import { getSubscription } from "@/lib/auth/subscription";
import { BILLING } from "@/config/billing";

export const dynamic = "force-dynamic";

const brl = (cents: number) => "R$ " + (cents / 100).toFixed(2).replace(".", ",");

// Tela de bloqueio (fora do (protected) — não passa pelo gate de billing, só pelo de login).
// Por ora informativa; o seletor de plano + checkout Asaas entram na fatia 3.7.
export default async function BloqueadoPage() {
  const loja = await getCurrentStore();
  const sub = loja ? await getSubscription(loja.id) : null;
  const planos = Object.values(BILLING.planos);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2a0f3d] to-[#140820] px-4 py-12 text-white">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold">ComandaPRO</h1>
        <p className="mt-2 text-white/70">
          {sub?.status === "trial"
            ? "Seu período de teste terminou."
            : "Sua assinatura está pendente."}{" "}
          Pra continuar usando o painel, escolha um plano:
        </p>

        <div className="mt-6 space-y-3">
          {planos.map((p) => (
            <div
              key={p.label}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div>
                <div className="font-semibold">{p.label}</div>
                <div className="text-sm text-white/60">{brl(p.equivMes * 100)}/mês</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{brl(p.cents)}</div>
                {p.meses > 1 && <div className="text-xs text-white/50">{p.meses} meses</div>}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-white/40">
          O pagamento (cartão recorrente ou PIX) entra na próxima etapa. Loja: {loja?.name ?? "—"}.
        </p>
      </div>
    </div>
  );
}
