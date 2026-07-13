import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import ContasClient from "./ContasClient";

export const dynamic = "force-dynamic";

export default async function ContasPage() {
  await requireNavAccess("/admin/contas");
  return (
    <>
      <PageHeader title="Contas" sub="A pagar e a receber, com vencimento e baixa — controle de quem deve e do que vence" />
      <ContasClient />
    </>
  );
}
