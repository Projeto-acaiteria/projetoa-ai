import { notFound } from "next/navigation";
import { getBudgetByCode, budgetTotals, itemSubtotalCents, BUDGET_STATUS_LABEL } from "@/lib/budgets-store";
import { getServiceOrderByCode, OS_STATUS_LABEL } from "@/lib/service-orders-store";
import { getStore } from "@/lib/settings-store";
import DocA4, { type DocA4Item } from "@/components/DocA4";

// Documento A4 PÚBLICO (sem login) — orçamento ou OS pelo código. É o link que vai no WhatsApp.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `Documento ${code}` };
}

const dmy = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso.slice(0, 10).split("-").reverse().join("/");
  }
};
const ymdToBr = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : null);

export default async function DocPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // 1) orçamento?
  const b = await getBudgetByCode(code);
  if (b) {
    const s = await getStore(b.storeId);
    const items: DocA4Item[] = b.budget.items.map((it) => ({
      kind: it.kind, name: it.name, detail: it.detail, qty: it.qty, unitCents: it.unitCents, subtotalCents: itemSubtotalCents(it),
    }));
    return (
      <DocA4
        kind="orcamento"
        title="Orçamento"
        code={b.budget.code}
        dateLabel={dmy(b.budget.createdAt)}
        validadeLabel={ymdToBr(b.budget.validadeAt)}
        statusLabel={BUDGET_STATUS_LABEL[b.budget.status]}
        store={{ name: s.name, logoUrl: s.logoUrl, cnpj: s.cnpj, endereco: s.endereco, tel: s.whatsapp, email: s.email, site: s.site, responsavel: s.responsavel, garantiaTermos: s.garantiaTermos, avisos: s.avisos }}
        customer={{ name: b.budget.customerName, cpf: b.budget.cpf, phone: b.budget.customerPhone }}
        items={items}
        totals={budgetTotals(b.budget)}
        observacao={b.budget.observacao}
      />
    );
  }

  // 2) ordem de serviço?
  const r = await getServiceOrderByCode(code);
  if (r) {
    const s = await getStore(r.storeId);
    const os = r.os;
    const partsRows: DocA4Item[] = r.parts.map((p) => ({
      kind: "produto", name: p.name, qty: p.qty, unitCents: p.unitCostCents, subtotalCents: p.qty * p.unitCostCents,
    }));
    const partsSum = partsRows.reduce((sum, x) => sum + x.subtotalCents, 0);
    const items: DocA4Item[] = [...partsRows];
    if (partsSum === 0 && os.partsValueCents > 0) items.push({ kind: "produto", name: "Peças", qty: 1, unitCents: os.partsValueCents, subtotalCents: os.partsValueCents });
    if (os.serviceValueCents > 0) items.push({ kind: "servico", name: "Serviço / mão de obra", qty: 1, unitCents: os.serviceValueCents, subtotalCents: os.serviceValueCents });
    const produtosCents = partsSum > 0 ? partsSum : os.partsValueCents;
    return (
      <DocA4
        kind="os"
        title="Ordem de Serviço"
        code={os.code || os.id.slice(0, 6)}
        dateLabel={dmy(os.createdAt)}
        statusLabel={OS_STATUS_LABEL[os.status]}
        store={{ name: s.name, logoUrl: s.logoUrl, cnpj: s.cnpj, endereco: s.endereco, tel: s.whatsapp, email: s.email, site: s.site, responsavel: s.responsavel, garantiaTermos: s.garantiaTermos, avisos: s.avisos }}
        customer={{ name: os.customerName, cpf: os.cpf, phone: os.customerPhone }}
        equipamento={{ device: os.device, marca: os.marca, modelo: os.modelo, imei: os.imei, condicoes: os.condicoes, acessorios: os.acessorios, problem: os.problem, diagnosis: os.diagnosis }}
        items={items}
        totals={{ produtosCents, servicosCents: os.serviceValueCents, freteCents: 0, outrosCents: 0, descontoCents: os.discountCents, totalCents: os.totalCents }}
        observacao={os.printObs}
      />
    );
  }

  notFound();
}
