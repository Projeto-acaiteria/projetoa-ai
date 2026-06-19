import { PageHeader, Badge } from "@/components/admin/ui";
import FidelidadeClient from "./FidelidadeClient";

export default function FidelidadePage() {
  return (
    <>
      <PageHeader
        title="Fidelidade"
        sub="Pontos por valor gasto · R$ 1 = 1 ponto"
        action={<Badge tone="lime">ativo</Badge>}
      />
      <FidelidadeClient />
    </>
  );
}
