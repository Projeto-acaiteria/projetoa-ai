import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import FidelidadeClient from "./FidelidadeClient";

export default async function FidelidadePage() {
  await requireNavAccess("/admin/fidelidade");
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
