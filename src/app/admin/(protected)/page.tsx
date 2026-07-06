import Link from "next/link";
import { PageHeader, Card, Badge } from "@/components/admin/ui";
import { brl } from "@/lib/format";
import { dateBR, todayBR } from "@/lib/date-br";
import { getOpenSession } from "@/lib/cash-store";
import { listOrders } from "@/lib/orders-store";
import { listMesaPayments } from "@/lib/tables-store";
import { listExpenses } from "@/lib/expense-store";
import { getStore } from "@/lib/settings-store";
import { getCurrentStore } from "@/lib/auth/store";
import { weightSoldPeriods, type WeightSoldReport } from "@/lib/weight-report";
import SetupChecklist from "@/components/admin/SetupChecklist";
import { IconWallet, IconMoto, IconBag, IconClock, IconBowl } from "@/components/Icons";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import { listServiceOrders } from "@/lib/service-orders-store";

const kgFmt = (n: number) => (n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const statusTone = { recebido: "accent", preparo: "gold", saiu: "brand", entregue: "lime" } as const;

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  // vertical-aware: assistência técnica (serviço) tem Início de OS, não o dashboard de food.
  const store0 = await getCurrentStore();
  const cfg0 = store0 ? await getStoreConfig(store0.id) : null;
  if (familyOf(cfg0?.business_type) === "service") return <ATHome />;

  // caixa fechado NÃO bloqueia mais — vira um aviso suave (login cai no painel, não na tela de abrir caixa)
  const semCaixa = !(await getOpenSession());

  const today = todayBR(); // hoje no fuso do Brasil (não UTC) — senão venda da noite some
  const orders = await listOrders();
  const expenses = await listExpenses();
  const [settings, cur, mesaPagosAll, acai] = await Promise.all([getStore(), getCurrentStore(), listMesaPayments(), weightSoldPeriods()]);

  const vendasHoje = orders.filter((o) => o.status === "entregue" && !o.cancelled && dateBR(o.createdAt) === today);
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
  const recentes = orders.filter((o) => !o.cancelled).slice(0, 6);

  // mais vendidos (agrupado por item-base, ex "Copo 500ml")
  const itemCount: Record<string, number> = {};
  for (const o of orders.filter((x) => x.status === "entregue" && !x.cancelled)) {
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

      {/* Número-herói: responde "tá tudo ok?" em 2s — tamanho é hierarquia (DESIGN.md) */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="card stagger-item relative flex flex-col justify-between gap-6 overflow-hidden p-6" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--brand-600) 7%, var(--bg-elevated)) 0%, var(--bg-elevated) 55%)" }}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg, var(--brand-600), transparent)" }} aria-hidden />
          <span className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full blur-3xl" style={{ background: "color-mix(in srgb, var(--brand-600) 20%, transparent)" }} aria-hidden />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Faturado hoje</span>
            <Badge tone="muted">tempo real</Badge>
          </div>
          <div className="relative">
            <div className="text-5xl font-semibold tracking-tight text-ink tabular-nums sm:text-6xl">{brl(brutoHoje)}</div>
            <div className="mt-1.5 text-sm text-[var(--text-muted)]">{nVendasHoje} venda{nVendasHoje === 1 ? "" : "s"} · ticket médio {brl(ticket)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <MiniStat label="Líquido" value={brl(liquidoHoje)} />
          <MiniStat label="Despesas" value={`− ${brl(despHoje)}`} />
          <MiniStat label="Saldo do dia" value={brl(saldoHoje)} accent={saldoHoje >= 0 ? "ok" : "danger"} />
          <MiniStat label="Em preparo" value={`${emPreparo}`} />
        </div>
      </div>

      {/* Açaí vendido (kg) — dia / semana / mês. Só acende pra loja que vende por peso. */}
      {(acai.mes.totalKg > 0 || acai.mes.copoCount > 0) && (
        <Card className="mt-6 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <IconBowl width={17} height={17} className="text-brand-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Açaí vendido</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <AcaiKg label="Hoje" r={acai.hoje} />
            <AcaiKg label="7 dias" r={acai.semana} />
            <AcaiKg label="Este mês" r={acai.mes} />
          </div>
        </Card>
      )}

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

// Início do vertical de ASSISTÊNCIA TÉCNICA: agenda de OS, não vendas/cardápio.
async function ATHome() {
  const orders = await listServiceOrders();
  const abertas = orders.filter((o) => o.status !== "entregue" && o.status !== "cancelado");
  const emReparo = orders.filter((o) => o.status === "em_reparo").length;
  const prontas = orders.filter((o) => o.status === "pronto").length;
  const aguardando = orders.filter((o) => o.status === "aguardando").length;
  const today = todayBR();
  const quitadasHoje = orders.filter((o) => o.paymentStatus === "quitada" && o.paidAt && dateBR(o.paidAt) === today);
  const faturadoHoje = quitadasHoje.reduce((s, o) => s + o.totalCents, 0);

  return (
    <>
      <PageHeader title="Início" sub="Sua assistência técnica hoje" />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="card stagger-item relative flex flex-col justify-between gap-6 overflow-hidden p-6" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--brand-600) 7%, var(--bg-elevated)) 0%, var(--bg-elevated) 55%)" }}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg, var(--brand-600), transparent)" }} aria-hidden />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Faturado hoje (OS quitadas)</span>
            <Badge tone="muted">tempo real</Badge>
          </div>
          <div className="relative">
            <div className="text-5xl font-semibold tracking-tight text-ink tabular-nums sm:text-6xl">{brl(faturadoHoje)}</div>
            <div className="mt-1.5 text-sm text-[var(--text-muted)]">{quitadasHoje.length} OS quitada{quitadasHoje.length === 1 ? "" : "s"} hoje</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <MiniStat label="OS abertas" value={String(abertas.length)} />
          <MiniStat label="Em reparo" value={String(emReparo)} />
          <MiniStat label="Prontas p/ retirada" value={String(prontas)} accent="ok" />
          <MiniStat label="Aguardando" value={String(aguardando)} />
        </div>
      </div>

      <Link href="/admin/os" className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-line bg-bg-elevated p-4 transition hover:border-brand-400">
        <span className="text-sm">
          <span className="block font-bold text-ink">Ordens de serviço</span>
          <span className="text-[var(--text-muted)]">{orders.length === 0 ? "Faça o check-in do primeiro aparelho." : `${abertas.length} em aberto · abrir a agenda completa.`}</span>
        </span>
        <span className="shrink-0 rounded-lg brand-gradient px-3 py-2 text-xs font-bold text-white">Ver OS</span>
      </Link>
    </>
  );
}

function AcaiKg({ label, r }: { label: string; r: WeightSoldReport }) {
  return (
    <div className="rounded-xl border border-line bg-bg-base p-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums text-brand-600">
        {kgFmt(r.totalKg)}<span className="ml-0.5 text-xs font-bold text-[var(--text-muted)]">kg</span>
      </div>
      <div className="mt-0.5 text-[10px] leading-tight text-[var(--text-faded)]">{r.copoCount} copos · {kgFmt(r.pesoKg)}kg peso</div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: "ok" | "danger" }) {
  return (
    <div className="card stagger-item flex flex-col justify-between p-4">
      <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
      <div className={`mt-2 text-xl font-bold tabular-nums ${accent === "danger" ? "text-[var(--red-no)]" : accent === "ok" ? "text-[var(--green-ok)]" : "text-ink"}`}>{value}</div>
    </div>
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
