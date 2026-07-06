import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import GarconsClient from "./GarconsClient";

export const dynamic = "force-dynamic";

export default async function GarconsPage() {
  await requireNavAccess("/admin/garcons");
  return (
    <>
      <PageHeader title="Garçons" sub="Comissão por garçom e acerto (vendido, comissão, gorjeta, a pagar)" action={<Badge tone="lime">bar / restaurante</Badge>} />
      <GarconsClient />
    </>
  );
}
