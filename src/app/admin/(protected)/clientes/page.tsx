import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getStore } from "@/lib/settings-store";
import ClientesClient from "./ClientesClient";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  await requireNavAccess("/admin/clientes");
  const store = await getStore();
  return (
    <>
      <PageHeader title="Clientes" sub="Base de clientes · aniversariantes e sumidos pra reativar" />
      <ClientesClient storeName={store.name} />
    </>
  );
}
