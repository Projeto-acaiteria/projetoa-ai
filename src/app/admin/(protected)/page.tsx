import Link from "next/link";
import { PageHeader, StatCard, Card, Badge } from "@/components/admin/ui";
import { brl } from "@/lib/format";
import { dateBR, todayBR } from "@/lib/date-br";
import { getOpenSession } from "@/lib/cash-store";
import { listOrders } from "@/lib/orders-store";
import { listMesaPayments } from "@/lib/tables-store";
import { listExpenses } from "@/lib/expense-store";
import { getStore } from "@/lib/settings-store";
import { getCurrentStore } from "@/lib/auth/store";
import SetupChecklist from "@/components/admin/SetupChecklist";
import { IconWallet, IconReceipt, IconChart, IconMoto, IconBag, IconClock } from "@/components/Icons";

const statusTone = { recebido: "accent", preparo: "gold", saiu: "brand", entregue: "lime" } as const;

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  // caixa fechado NÃO bloqueia mais — vira um aviso suave (login cai no painel, não na tela de abrir caixa)
  const semCaixa = !(await getOpenSession());

  const today = todayBR(); // hoje no fuso do Brasil (não UTC) — senão venda da noite some
  const orders = await listOrders();
  const expenses = await listExpenses();
  const [settings, cur, mesaPagosAll] = await Promise.all([getStore(), getCurrentStore(), listMesaPayments()]);

  const vendasHoje = orders.filter((o) => o.status === "entregue" && dateBR(o.createdAt) === today);
  // vendas de MESA também entram no faturamento (vivem em tab_payments, não em orders).
  // valor = soma dos pagamentos (split soma certo); contagem = comandas DISTINTAS (split não infla).
  const mesaHoje = mesaPagosAll.filter((m) => dateBR(m.date) === today);
  const mesaBrutoHoje = mesaHoje.reduce((s, m) => s + m.grossCents, 0);
  const mesaLiquidoHoje = mesaHoje.reduce((s, m) => s + m.grossCents - m.cardFeeCents, 0);
  const nVendasHoje = vendasHoje.length + new Set(mesaHoje.map((m) => m.tabId)).size;
  const brutoHoje = vendasHoje.reduce((s, o) => s + o.totalCents, 0) + mesaBrutoHoje;
  const liquidoHoje = vendasHoje.reduce((s, o) => s + o.totalCents - (o.cardFeeCents ?? 0), 0) + mesaLiquidoHoje;
  const despHoje = expenses.filter((e) => e.date === today).reduce((s, e) => s + e.amountCents, 0);
  const saldoHoje = liquidoHoje - despHoje;
  const ticket = nVendasHoje ? Math.round(brutoHoje / nVendasHoje) : 0;
  const emPreparo = orders.filter((o) => o.status === "preparo").length;
  const recentes = orders.slice(0, 6);

  // mais vendidos (agrupado por item-base, ex "Copo 500ml")
  const itemCount: Record<string, number> = {};
  for (const o of orders.filter((x) => x.status === "entregue")) {
    for (const it of o.items) {
      const base = it.name.split(" — ")[0].split(" (")[0];
      itemCount[base] = (itemCount[base] || 0) + it.qty;
    }
  }
  const topItems = Object.entries(itemCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topMax = topItems[0]?.[1] || 1;

  return (
    <>
      <PageHeader title="Início" sub="Resumo de hoje" />

      <SetupChecklist hasLogo={!!settings.logoUrl} hasSale={orders.length > 0} slug={cur?.slug ?? ""} />

      {semCaixa && (
        <Link href="/admin/caixa" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-bg-elevated p-3.5 transition hover:border-brand-400">
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-bg-surface-2 text-brand-600"><IconWallet width={18} height={18} /></span>
            <span className="text-sm">
              <span className="block font-bold text-ink">Caixa fechado</span>
              <span className="text-[var(--text-muted)]">Abra o caixa pra controlar o dinheiro do dia (opcional — as vendas funcionam mesmo sem).</span>
            </span>
          </span>
          <span className="shrink-0 rounded-lg brand-gradient px-3 py-2 text-xs font-bold text-white">Abrir caixa</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Faturado hoje" value={brl(brutoHoje)} hint={`${nVendasHoje} vendas`} Icon={IconWallet} tone="lime" />
        <StatCard label="Ticket médio" value={brl(ticket)} hint="por venda" Icon={IconChart} tone="brand" />
        <StatCard label="Despesas hoje" value={brl(despHoje)} hint="lançadas" Icon={IconReceipt} tone="gold" />
        <StatCard label="Saldo do dia" value={brl(saldoHoje)} hint="líquido - despesas" Icon={IconChart} tone={saldoHoje >= 0 ? "accent" : "accent"} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Pedidos / vendas recentes */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Vendas recentes</h2>
            <Badge tone="muted">tempo real</Badge>
          </div>
          {recentes.length === 0 && <div className="py-8 text-center text-sm text-[var(--text-muted)]">Nenhuma venda ainda hoje.</div>}
          <div className="divide-y divide-[var(--line)]">
            {recentes.map((o) => (
              <div key={o.id} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-bg-surface-2 text-brand-600">
                  {o.mode === "entrega" ? <IconMoto width={18} height={18} /> : <IconBag width={18} height={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">{o.display}</span>
                    <span className="truncate text-sm text-ink-2">{o.customerName}</span>
                  </div>
                  <div className="truncate text-xs text-[var(--text-muted)]">{o.items.map((i) => i.name).join(", ")}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-ink">{brl(o.totalCents)}</div>
                  <Badge tone={statusTone[o.status]}>{o.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Resumo do dia */}
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Resumo do dia</h2>
          <div className="space-y-1">
            <Row label="Faturamento (bruto)" value={brl(brutoHoje)} />
            <Row label="Entradas líquidas" value={brl(liquidoHoje)} />
            <Row label="Despesas" value={`− ${brl(despHoje)}`} />
            <div className="mt-1 border-t border-line pt-2">
              <Row label="Saldo do dia" value={brl(saldoHoje)} strong />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <IconClock width={14} height={14} className="text-brand-600" /> {emPreparo} pedido(s) em preparo agora
          </div>
        </Card>
      </div>

      {/* Mais vendidos */}
      {topItems.length > 0 && (
        <Card className="mt-5 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Mais vendidos</h2>
          <div className="space-y-3">
            {topItems.map(([name, qty]) => (
              <div key={name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-semibold text-ink">{name}</span>
                  <span className="font-bold text-[var(--text-muted)]">{qty}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-surface-2">
                  <div className="h-full rounded-full brand-gradient" style={{ width: `${Math.round((qty / topMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-ink-2">{label}</span>
      <span className={strong ? "text-base font-extrabold text-ink" : "font-semibold text-ink"}>{value}</span>
    </div>
  );
}
