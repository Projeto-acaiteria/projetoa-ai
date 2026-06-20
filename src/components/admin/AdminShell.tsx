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
  IconUsers,
  IconBox,
  IconCart,
  IconGear,
  IconPrinter,
  IconTable,
} from "@/components/Icons";

const NAV = [
  { href: "/admin", label: "Início", Icon: IconHome },
  { href: "/admin/caixa", label: "Caixa", Icon: IconCart },
  { href: "/admin/mesas", label: "Mesas", Icon: IconTable },
  { href: "/admin/garcons", label: "Garçons", Icon: IconUsers },
  { href: "/admin/pedidos", label: "Pedidos", Icon: IconReceipt },
  { href: "/admin/preparo", label: "Preparo", Icon: IconFlame },
  { href: "/admin/eventos", label: "Shows", Icon: IconMusic },
  { href: "/admin/cardapio", label: "Cardápio", Icon: IconBowl },
  { href: "/admin/estoque", label: "Estoque", Icon: IconBox },
  { href: "/admin/financeiro", label: "Financeiro", Icon: IconWallet },
  { href: "/admin/fidelidade", label: "Fidelidade", Icon: IconStar },
  { href: "/admin/clientes", label: "Clientes", Icon: IconUsers },
  { href: "/admin/impressora", label: "Impressora", Icon: IconPrinter },
  { href: "/admin/configuracoes", label: "Ajustes", Icon: IconGear },
];

export default function AdminShell({ children, storeName }: { children: React.ReactNode; storeName: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, Icon }) => {
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
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar desktop */}
      <aside className="hidden border-r border-line bg-bg-elevated lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl brand-gradient text-white">
            <IconBowl width={22} height={22} />
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
              <IconBowl width={19} height={19} />
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
                  <IconBowl width={22} height={22} />
                </div>
                <span className="text-sm font-extrabold text-ink">{storeName}</span>
              </div>
              <NavLinks onClick={() => setOpen(false)} />
            </div>
          </div>
        )}

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
