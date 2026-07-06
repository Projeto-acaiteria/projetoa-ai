import { PageHeader, Badge } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import EventosClient from "./EventosClient";

export const dynamic = "force-dynamic";

export default async function EventosPage() {
  await requireNavAccess("/admin/eventos");
  return (
    <>
      <PageHeader title="Shows & Cover" sub="Agenda da casa, cover por pessoa e repasse do artista" action={<Badge tone="lime">bar / music bar</Badge>} />
      <EventosClient />
    </>
  );
}
