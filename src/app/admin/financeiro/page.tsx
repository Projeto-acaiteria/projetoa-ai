import { PageHeader } from "@/components/admin/ui";
import FinanceiroClient from "./FinanceiroClient";

export const dynamic = "force-dynamic";

export default function FinanceiroPage() {
  return (
    <>
      <PageHeader title="Financeiro" sub="Fluxo de caixa, despesas e resultado" />
      <FinanceiroClient />
    </>
  );
}
