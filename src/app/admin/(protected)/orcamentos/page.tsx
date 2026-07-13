import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import OrcamentosClient from "./OrcamentosClient";

export const dynamic = "force-dynamic";

export default async function OrcamentosPage() {
  await requireNavAccess("/admin/orcamentos");
  return (
    <>
      <PageHeader title="Orçamentos" sub="Crie, envie por WhatsApp e acompanhe a aprovação" />
      <OrcamentosClient />
    </>
  );
}
