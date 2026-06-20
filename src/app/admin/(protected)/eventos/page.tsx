import { PageHeader, Badge } from "@/components/admin/ui";
import EventosClient from "./EventosClient";

export const dynamic = "force-dynamic";

export default function EventosPage() {
  return (
    <>
      <PageHeader title="Shows & Cover" sub="Agenda da casa, cover por pessoa e repasse do artista" action={<Badge tone="lime">bar / music bar</Badge>} />
      <EventosClient />
    </>
  );
}
