import Link from "next/link";
import { requireNavAccess } from "@/lib/auth/guard";
import { PageHeader, Card, Badge } from "@/components/admin/ui";
import { brl } from "@/lib/format";
import { dateBR, todayBR } from "@/lib/date-br";
import { getOpenSession } from "@/lib/cash-store";
import { listOrders } from "@/lib/orders-store";
import { listMesaPayments } from "@/lib/tables-store";
import { listExpenses } from "@/lib/expense-store";
import { getStore } from "@/lib/settings-store";
import { getCurrentStore, getCurrentRole } from "@/lib/auth/store";
import { weightSoldPeriods, type WeightSoldReport } from "@/lib/weight-report";
import SetupChecklist from "@/components/admin/SetupChecklist";
import RecepcaoProntaAcoes from "@/components/admin/RecepcaoProntaAcoes";
import BuscaOS from "@/components/admin/BuscaOS";
import AtribuirTecnico from "@/components/admin/AtribuirTecnico";
import PedidosPendentes from "./vendas/PedidosPendentes";
import { listStaff } from "@/lib/staff-store";
import NovaOSButton from "./os/NovaOSButton";
import { IconWallet, IconMoto, IconBag, IconClock, IconBowl } from "@/components/Icons";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import { listServiceOrders } from "@/lib/service-orders-store";
import { listStock } from "@/lib/stock-store";

const kgFmt = (n: number) => (n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const prontaDias = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const prontaHa = (iso: string) => { const d = prontaDias(iso); return d <= 0 ? "hoje" : d === 1 ? "há 1 dia" : `há ${d} dias`; };

const statusTone = { recebido: "accent", preparo: "gold", saiu: "brand", entregue: "lime" } as const;

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireNavAccess("/admin");
  // vertical-aware: assistência técnica (serviço) tem Início de OS, não o dashboard de food.
  const store0 = await getCurrentStore();
  const cfg0 = store0 ? await getStoreConfig(store0.id) : null;
  if (familyOf(cfg0?.business_type) === "service") {
    // recepção tem cockpit de OPERAÇÃO (sem o faturamento da loja — ela é bloqueada do Financeiro);
    // owner segue no dashboard AT com o número-herói de faturamento.
    const role = await getCurrentRole();
    return role === "reception" ? <ReceptionHome /> : <ATHome />;
  }

  // caixa fechado NÃO bloqueia mais — vira um aviso suave (login cai no painel, não na tela de abrir caixa)
  const session = await getOpenSession();
  const semCaixa = !session;

  const today = todayBR(); // hoje no fuso do Brasil (não UTC) — senão venda da noite some
  // BAR atravessa a meia-noite: enquanto o CAIXA está aberto, "hoje" = desde a abertura do caixa
  // (senão às 00h o faturado zera no dashboard, mas a venda da noite continua no caixa — divergência).
  // Sem caixa aberto, cai no dia-calendário normal.
  const sessStart = session?.openedAt ? new Date(session.openedAt).getTime() : null;
  const isToday = (iso: string) => (sessStart !== null ? new Date(iso).getTime() >= sessStart : dateBR(iso) === today);
  const orders = await listOrders();
  const expenses = await listExpenses();
  const [settings, cur, mesaPagosAll, acai] = await Promise.all([getStore(), getCurrentStore(), listMesaPayments(), weightSoldPeriods()]);

  const vendasHoje = orders.filter((o) => o.status === "entregue" && !o.cancelled && isToday(o.createdAt));
  // vendas de MESA também entram no faturamento (vivem em tab_payments, não em orders).
  // valor = soma dos pagamentos (split soma certo); contagem = comandas DISTINTAS (split não infla).
  const mesaHoje = mesaPagosAll.filter((m) => isToday(m.date));
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
  const [orders, stock] = await Promise.all([listServiceOrders(), listStock()]);
  const lowStock = stock.filter((i) => i.qty <= i.minQty).length;
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

      {lowStock > 0 && (
        <Link href="/admin/estoque" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--red-no)]/40 bg-[var(--red-no)]/5 p-4 transition hover:border-[var(--red-no)]">
          <span className="text-sm">
            <span className="block font-bold text-ink">{lowStock} {lowStock === 1 ? "item no estoque mínimo" : "itens no estoque mínimo"}</span>
            <span className="text-[var(--text-muted)]">Veja o que repor e registre a compra.</span>
          </span>
          <span className="shrink-0 rounded-lg brand-gradient px-3 py-2 text-xs font-bold text-white">Ver estoque</span>
        </Link>
      )}
    </>
  );
}

// Cockpit da RECEPÇÃO (assistência técnica): operação de front-desk — vender, montar PC, abrir OS,
// receber/entregar, caixa. SEM o faturamento da loja (recepção é bloqueada do Financeiro).
async function ReceptionHome() {
  const [orders, os, session, store, staffRaw, stock] = await Promise.all([listOrders(), listServiceOrders(), getOpenSession(), getStore(), listStaff(), listStock()]);
  const staff = staffRaw.map((s) => ({ id: s.id, name: s.name }));
  const lowStock = stock.filter((i) => i.qty <= i.minQty).length;
  const prontas = os.filter((o) => o.status === "pronto");
  const aguardando = os.filter((o) => o.status === "aguardando");
  const emReparo = os.filter((o) => o.status === "em_reparo");
  const pedidosSiteOrders = orders.filter((o) => o.mode === "balcao" && o.status === "recebido" && !o.cancelled);
  const pedidosSite = pedidosSiteOrders.map((o) => ({ id: o.id, display: o.display, code: o.code ?? null, customerName: o.customerName, phone: o.phone, totalCents: o.totalCents, items: o.items.map((i) => ({ name: i.name, qty: i.qty })) }));

  // PAINEL DE ATENÇÃO (Fase D): o que precisa de ação agora
  const now = Date.now();
  const atrasadas = os.filter((o) => o.estimatedAt && (o.status === "aguardando" || o.status === "em_reparo") && new Date(o.estimatedAt).getTime() < now);
  const encalhadas = prontas.filter((o) => o.readyAt && prontaDias(o.readyAt) >= 3);
  const temAtencao = atrasadas.length > 0 || encalhadas.length > 0 || pedidosSite.length > 0 || lowStock > 0;

  return (
    <>
      <PageHeader title="Início" sub="Atendimento, vendas e caixa" action={<Badge tone="lime">recepção</Badge>} />

      {/* BUSCA de balcão — acha a OS na hora que o cliente chega */}
      <BuscaOS />

      {/* CAIXA — abrir/fechar (recepção opera o dinheiro do dia) */}
      <Link href="/admin/caixa" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-bg-elevated p-3.5 transition hover:border-brand-400">
        <span className="flex items-center gap-2.5">
          <span className={`grid h-9 w-9 place-items-center rounded-lg bg-bg-surface-2 ${session ? "text-[var(--green-ok)]" : "text-brand-600"}`}><IconWallet width={18} height={18} /></span>
          <span className="text-sm">
            <span className="block font-bold text-ink">{session ? "Caixa aberto" : "Caixa fechado"}</span>
            <span className="text-[var(--text-muted)]">{session ? "Registrar vendas e fechar o caixa no fim do dia." : "Abra o caixa pra começar a vender."}</span>
          </span>
        </span>
        <span className="shrink-0 rounded-lg brand-gradient px-3 py-2 text-xs font-bold text-white">{session ? "Ir pro caixa" : "Abrir caixa"}</span>
      </Link>

      {/* PAINEL DE ATENÇÃO — o que precisa de ação agora (Fase D) */}
      {temAtencao && (
        <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-gold/40 bg-gold/5 p-3">
          <span className="text-xs font-bold uppercase tracking-wide text-gold">⚠ Precisa de atenção</span>
          {atrasadas.length > 0 && <Badge tone="accent">{atrasadas.length} OS atrasada{atrasadas.length === 1 ? "" : "s"}</Badge>}
          {encalhadas.length > 0 && <Badge tone="gold">{encalhadas.length} pronta{encalhadas.length === 1 ? "" : "s"} há 3+ dias</Badge>}
          {pedidosSite.length > 0 && <Badge tone="brand">{pedidosSite.length} pedido{pedidosSite.length === 1 ? "" : "s"} do site pra confirmar</Badge>}
          {lowStock > 0 && <Link href="/admin/estoque"><Badge tone="accent">{lowStock} {lowStock === 1 ? "item" : "itens"} no estoque mínimo</Badge></Link>}
        </div>
      )}

      {/* AÇÕES RÁPIDAS — o que a recepção faz o dia todo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NovaOSButton />
        <AcaoCard href="/admin/vendas" label="Nova venda" hint="peça / balcão" />
        <AcaoCard href="/admin/os/montar" label="Montar PC" hint="montador" />
        <AcaoCard href="/admin/os" label="Ver OS" hint="agenda completa" />
      </div>

      {/* PRONTAS P/ RETIRADA — avisar cliente + receber e entregar */}
      <Card className="mt-6 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Prontas p/ retirada</h2>
          <Badge tone={prontas.length ? "lime" : "muted"}>{prontas.length}</Badge>
        </div>
        {prontas.length === 0 ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">Nada pra entregar agora.</div>
        ) : (
          <div className="space-y-3">
            {prontas.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                <Link href={`/admin/os/${o.id}`} className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-brand-600">{o.code ?? o.id.slice(0, 8)}</span>
                    {o.readyAt && <span className={`text-[10px] font-semibold ${prontaDias(o.readyAt) >= 3 ? "text-gold" : "text-[var(--text-faded)]"}`}>pronta {prontaHa(o.readyAt)}</span>}
                    {o.notifiedAt && <span className="text-[10px] font-bold text-[var(--green-ok)]">✓ avisado</span>}
                  </span>
                  <span className="block truncate text-sm text-ink">{o.customerName || "—"} · {o.device || "—"}</span>
                </Link>
                <RecepcaoProntaAcoes id={o.id} customerName={o.customerName} customerPhone={o.customerPhone} device={o.device} quitada={o.paymentStatus === "quitada"} notified={!!o.notifiedAt} storeName={store.name} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* PEDIDOS DO SITE — confirmar venda direto (inline, reusa o componente do Vendas) */}
      <div className="mt-6">
        <PedidosPendentes pedidos={pedidosSite} />
      </div>

      {/* AGUARDANDO — novas OS, atribuir técnico sem sair do cockpit */}
      <Card className="mt-2 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Aguardando · atribuir técnico</h2>
          <Badge tone={aguardando.length ? "gold" : "muted"}>{aguardando.length}</Badge>
        </div>
        {aguardando.length === 0 ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">Nenhuma OS esperando.</div>
        ) : (
          <div className="space-y-3">
            {aguardando.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                <Link href={`/admin/os/${o.id}`} className="min-w-0">
                  <span className="font-mono text-xs text-brand-600">{o.code ?? o.id.slice(0, 8)}</span>
                  <span className="block truncate text-sm text-ink">{o.customerName || "—"} · {o.device || "—"}</span>
                </Link>
                <AtribuirTecnico id={o.id} staffId={o.staffId} staff={staff} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-bg-elevated px-4 py-3 text-sm">
        <IconClock width={15} height={15} className="text-brand-600" />
        <span className="text-ink-2"><b className="text-ink">{emReparo.length}</b> em reparo com o técnico agora</span>
      </div>
    </>
  );
}

function AcaoCard({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href} className="card flex flex-col justify-between gap-2 p-4 transition hover:border-brand-400">
      <span className="text-sm font-bold text-ink">{label}</span>
      <span className="text-[11px] text-[var(--text-muted)]">{hint}</span>
    </Link>
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
