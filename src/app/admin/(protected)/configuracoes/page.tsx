import Link from "next/link";
import { requireNavAccess } from "@/lib/auth/guard";
import { PageHeader } from "@/components/admin/ui";
import { getCurrentStore } from "@/lib/auth/store";
import { getSubscription, billingView } from "@/lib/auth/subscription";
import ConfigClient from "./ConfigClient";

export const dynamic = "force-dynamic";

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const dmy = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

export default async function ConfiguracoesPage() {
  await requireNavAccess("/admin/configuracoes");
  const loja = await getCurrentStore();
  const sub = loja ? await getSubscription(loja.id) : null;
  const bv = billingView(sub);

  return (
    <>
      <PageHeader title="Ajustes" sub="Configurações da loja" />
      {bv && <PlanoCard bv={bv} />}
      <ConfigClient />
    </>
  );
}

// Seção "Plano" — status da assinatura, vencimento e botão de renovar. Compacta.
function PlanoCard({ bv }: { bv: NonNullable<ReturnType<typeof billingView>> }) {
  const border = bv.tone === "danger" ? "border-[var(--red-no)]" : bv.tone === "warn" ? "border-[var(--gold)]" : "border-line";
  const statusColor = bv.tone === "danger" ? "text-[var(--red-no)]" : bv.tone === "warn" ? "text-gold" : "text-lime";
  return (
    <div className={`card mb-4 border p-4 ${border}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Plano</div>
          <div className="mt-0.5 text-sm font-extrabold text-ink">
            {bv.planoLabel}{bv.planoCents ? ` · ${brl(bv.planoCents)}/mês` : ""}
          </div>
          <div className="mt-0.5 text-xs">
            <span className={`font-bold ${statusColor}`}>{bv.statusLabel}</span>
            {bv.pagoAte && bv.daysLeft != null && (
              <span className="text-[var(--text-muted)]">
                {" · "}
                {bv.daysLeft >= 0
                  ? `vence ${dmy(bv.pagoAte)} (${bv.daysLeft === 0 ? "hoje" : `faltam ${bv.daysLeft} dia${bv.daysLeft === 1 ? "" : "s"}`})`
                  : `venceu ${dmy(bv.pagoAte)}`}
              </span>
            )}
          </div>
        </div>
        {!bv.courtesy && (
          <Link href="/admin/bloqueado" className="shrink-0 rounded-xl border-2 border-brand-600 px-4 py-2 text-sm font-bold text-brand-600">
            {bv.tone === "ok" ? "Renovar" : "Pagar agora"}
          </Link>
        )}
      </div>
    </div>
  );
}
