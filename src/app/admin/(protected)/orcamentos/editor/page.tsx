import { PageHeader } from "@/components/admin/ui";
import { requireNavAccess } from "@/lib/auth/guard";
import { getBudget } from "@/lib/budgets-store";
import OrcamentoForm from "./OrcamentoForm";

export const dynamic = "force-dynamic";

export default async function OrcamentoEditorPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireNavAccess("/admin/orcamentos");
  const { id } = await searchParams;
  const initial = id ? await getBudget(id) : null;
  return (
    <>
      <PageHeader title={initial ? "Editar orçamento" : "Novo orçamento"} sub="Cliente, itens e valores do orçamento" />
      <OrcamentoForm initial={initial} />
    </>
  );
}
