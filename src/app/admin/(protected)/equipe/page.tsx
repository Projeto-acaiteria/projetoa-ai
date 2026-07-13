import { redirect } from "next/navigation";
import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getCurrentStore } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import EquipeClient from "./EquipeClient";

export const dynamic = "force-dynamic";

// Equipe — o dono (Junior) cadastra e gerencia técnicos e recepção do vertical SERVICE (Starteq).
// Gate em 3 camadas: nav (family==="service" no AdminShell) + guard (requireNavAccess, só owner) +
// este redirect de family por URL. Food (Cantinho/Medellín) nunca chega aqui.
export default async function EquipePage() {
  await requireNavAccess("/admin/equipe");
  const store = await getCurrentStore();
  const cfg = store ? await getStoreConfig(store.id) : null;
  if (familyOf(cfg?.business_type) !== "service") redirect("/admin");

  return (
    <>
      <PageHeader
        title="Equipe"
        sub="Técnicos e recepção: cadastro, login de acesso e comissão por período"
        action={<Badge tone="lime">assistência técnica</Badge>}
      />
      <EquipeClient />
    </>
  );
}
