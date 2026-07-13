import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { listStaff } from "@/lib/staff-store";
import NovaOSForm from "./NovaOSForm";

export const dynamic = "force-dynamic";

export default async function NovaOSPage() {
  await requireNavAccess("/admin/os");
  // técnicos ativos (modelo comissão) — a recepção pode já atribuir no check-in
  const tecnicos = (await listStaff()).filter((s) => s.active && s.pay_type === "comissao").map((s) => ({ id: s.id, name: s.name }));
  return (
    <>
      <PageHeader title="Check-in do aparelho" sub="Abrir uma nova ordem de serviço" />
      <NovaOSForm tecnicos={tecnicos} />
    </>
  );
}
