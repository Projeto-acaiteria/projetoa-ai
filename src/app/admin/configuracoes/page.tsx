import { PageHeader } from "@/components/admin/ui";
import ConfigClient from "./ConfigClient";

export default function ConfiguracoesPage() {
  return (
    <>
      <PageHeader title="Ajustes" sub="Configurações da loja" />
      <ConfigClient />
    </>
  );
}
