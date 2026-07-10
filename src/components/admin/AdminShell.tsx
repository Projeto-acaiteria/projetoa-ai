"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  IconBowl,
  IconFlame,
  IconMusic,
  IconHome,
  IconReceipt,
  IconMenu as IconHamburger,
  IconWallet,
  IconStar,
  IconGift,
  IconUsers,
  IconBox,
  IconChart,
  IconCart,
  IconBag,
  IconGear,
  IconPrinter,
  IconTable,
  IconQr,
  IconClock,
} from "@/components/Icons";
import type { Role } from "@/lib/auth/store";
import { canSeeNav } from "@/lib/auth/roles";
import type { Family } from "@/config/segments";
import { brandVars } from "@/lib/brand-theme";

// Marca do painel: logo da loja se houver, senão a INICIAL do nome (neutro — nada de ícone de açaí).
function BrandMark({ logoUrl, name }: { logoUrl?: string; name: string }) {
  if (logoUrl) return <span className="h-full w-full rounded-xl bg-cover bg-center" style={{ backgroundImage: `url("${logoUrl}")` }} aria-hidden />;
  return <span className="font-extrabold">{(name.trim()[0] || "?").toUpperCase()}</span>;
}

// NAV por SEGMENTO: cada negócio vê só o seu sistema (gate pelas flags do store_config).
// "Caixa" aparece pra todos (gestão de caixa); o PDV de copo dentro dele é só pra açaí (ver caixa/page).
// "Balcão" (cardápio relacional) só pra bar/grid; açaí vende pelo Caixa.
export type NavCtx = { template: string; hasTables: boolean; hasDelivery: boolean; coverEnabled: boolean; hasStations: boolean; loyaltyEnabled: boolean; hasEstoque: boolean; role: Role; family: Family };
// family: "food" = cardápio/mesas; "service" = OS/bancada (assistência técnica). Item sem family = core (todo vertical).
type NavItem = { href: string; label: string; Icon: typeof IconHome; show?: (c: NavCtx) => boolean; family?: Family };
// Bar/grid COM mesas → o Caixa vira o hub PDV (mesas + venda avulsa embutidas); Mesas/Balcão sofrem do menu.
const isPdvHub = (c: NavCtx) => c.hasTables && c.template !== "acai";
const NAV: NavItem[] = [
  { href: "/admin", label: "Início", Icon: IconHome },
  { href: "/admin/minha-area", label: "Minha área", Icon: IconClock },
  { href: "/admin/os", label: "Ordens de Serviço", Icon: IconReceipt, family: "service" },
  { href: "/admin/vendas", label: "Vendas", Icon: IconBag, family: "service" },
  { href: "/admin/caixa", label: "Caixa", Icon: IconCart },
  { href: "/admin/balcao", label: "Balcão", Icon: IconBag, show: (c) => c.template !== "acai" && !isPdvHub(c), family: "food" },
  { href: "/admin/mesas", label: "Mesas", Icon: IconTable, show: (c) => c.hasTables && (c.template === "acai" || c.role === "waiter"), family: "food" },
  { href: "/admin/qr-mesas", label: "QR das mesas", Icon: IconQr, show: (c) => c.hasTables, family: "food" },
  { href: "/admin/garcons", label: "Garçons", Icon: IconUsers, show: (c) => c.hasTables, family: "food" },
  { href: "/admin/pedidos", label: "Pedidos", Icon: IconReceipt, show: (c) => c.hasDelivery, family: "food" },
  { href: "/admin/preparo", label: "Preparo", Icon: IconFlame, show: (c) => c.hasStations, family: "food" },
  { href: "/admin/eventos", label: "Shows", Icon: IconMusic, show: (c) => c.coverEnabled, family: "food" },
  { href: "/admin/cardapio", label: "Cardápio", Icon: IconBowl, family: "food" },
  { href: "/admin/estoque", label: "Estoque", Icon: IconBox, show: (c) => c.hasEstoque },
  { href: "/admin/cmv", label: "CMV", Icon: IconChart, show: (c) => c.hasEstoque, family: "food" },
  { href: "/admin/financeiro", label: "Financeiro", Icon: IconWallet },
  { href: "/admin/cupons", label: "Cupons", Icon: IconGift },
  { href: "/admin/fidelidade", label: "Fidelidade", Icon: IconStar, show: (c) => c.loyaltyEnabled, family: "food" },
  { href: "/admin/clientes", label: "Clientes", Icon: IconUsers },
  { href: "/admin/impressora", label: "Impressora", Icon: IconPrinter },
  { href: "/admin/configuracoes", label: "Ajustes", Icon: IconGear },
];

export default function AdminShell({ children, storeName, nav, billing, logoUrl, brandColor }: { children: React.ReactNode; storeName: string; nav: NavCtx; billing?: { text: string; tone: "warn" | "danger" } | null; logoUrl?: string; brandColor?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {NAV.filter((n) => (!n.show || n.show(nav)) && (!n.family || n.family === nav.family) && canSeeNav(nav.role, n.href)).map(({ href, label, Icon }) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              active
                ? "brand-gradient text-white shadow-[var(--shadow-brand)]"
                : "text-ink-2 hover:bg-bg-surface-2"
            }`}
          >
            <Icon width={19} height={19} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]" style={brandVars(brandColor)}>
      {/* Sidebar desktop */}
      <aside className="hidden border-r border-line bg-bg-elevated lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl brand-gradient text-white">
            <BrandMark logoUrl={logoUrl} name={storeName} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold text-ink">{storeName}</div>
            <div className="text-[11px] font-medium text-[var(--text-muted)]">Painel de gestão</div>
          </div>
        </div>
        <div className="px-3">
          <NavLinks />
        </div>
        <div className="mt-auto px-5 py-4 text-[11px] text-[var(--text-faded)]">v0.1 · protótipo</div>
      </aside>

      {/* Topbar mobile */}
      <div className="flex flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg-elevated/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg brand-gradient text-white">
              <BrandMark logoUrl={logoUrl} name={storeName} />
            </div>
            <span className="text-sm font-extrabold text-ink">{storeName}</span>
          </div>
          <button
            onClick={() => setOpen(true)}
            aria-label="Menu"
            className="grid h-10 w-10 place-items-center rounded-xl border border-line text-ink"
          >
            <IconHamburger />
          </button>
        </header>

        {/* Drawer mobile */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 animate-pop bg-bg-elevated p-4 shadow-[var(--shadow-pop)]">
              <div className="mb-4 flex items-center gap-2.5 px-1">
                <div className="grid h-10 w-10 place-items-center rounded-xl brand-gradient text-white">
                  <BrandMark logoUrl={logoUrl} name={storeName} />
                </div>
                <span className="text-sm font-extrabold text-ink">{storeName}</span>
              </div>
              <NavLinks onClick={() => setOpen(false)} />
            </div>
          </div>
        )}

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {billing && (
            <div className={`mb-4 flex items-center justify-between gap-3 rounded-xl border p-3 ${billing.tone === "danger" ? "border-[var(--red-no)] bg-[#FEECEC]" : "border-[var(--gold)] bg-[#FFF8E6]"}`}>
              <span className={`text-sm font-semibold ${billing.tone === "danger" ? "text-[var(--red-no)]" : "text-ink"}`}>{billing.text}</span>
              <Link href="/admin/bloqueado" className="shrink-0 rounded-lg brand-gradient px-3.5 py-1.5 text-xs font-bold text-white">Renovar</Link>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
