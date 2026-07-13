import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import NovaOSForm from "./NovaOSForm";

export const dynamic = "force-dynamic";

export default async function NovaOSPage() {
  await requireNavAccess("/admin/os");
  return (
    <>
      <PageHeader title="Check-in do aparelho" sub="Abrir uma nova ordem de serviço" />
      <NovaOSForm />
    </>
  );
}
