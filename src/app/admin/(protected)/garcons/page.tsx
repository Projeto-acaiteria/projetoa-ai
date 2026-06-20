import { PageHeader, Badge } from "@/components/admin/ui";
import GarconsClient from "./GarconsClient";

export const dynamic = "force-dynamic";

export default function GarconsPage() {
  return (
    <>
      <PageHeader title="Garçons" sub="Comissão por garçom e acerto (vendido, comissão, gorjeta, a pagar)" action={<Badge tone="lime">bar / restaurante</Badge>} />
      <GarconsClient />
    </>
  );
}
