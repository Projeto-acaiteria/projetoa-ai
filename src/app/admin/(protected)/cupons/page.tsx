import { PageHeader, Badge } from "@/components/admin/ui";
import CuponsClient from "./CuponsClient";

export const dynamic = "force-dynamic";

export default function CuponsPage() {
  return (
    <>
      <PageHeader
        title="Cupons de desconto"
        sub="Código com regra (validade, mínimo, teto, limite) em vez de desconto digitado na mão"
        action={<Badge tone="lime">todos os segmentos</Badge>}
      />
      <CuponsClient />
    </>
  );
}
