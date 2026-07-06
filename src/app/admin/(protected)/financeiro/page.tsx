import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import FinanceiroClient from "./FinanceiroClient";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  await requireNavAccess("/admin/financeiro");
  return (
    <>
      <PageHeader title="Financeiro" sub="Fluxo de caixa, despesas e resultado" />
      <FinanceiroClient />
    </>
  );
}
