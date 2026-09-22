// Peças da central de respostas. Não usa SiteNav/SiteFooter do site de propósito: os links deles são
// âncoras da própria página (#precos, #faq), que numa resposta não existem — aqui tudo aponta pra URL.
import Link from "next/link";
import { Logo } from "@/components/site/Logo";
import { NICHOS } from "@/config/marketing";
import { ACCENT, CREAM, INK, MUT } from "@/components/site/parts";

export { ACCENT, CREAM, INK, MUT };
export const BASE = "https://comandapro.net.br";

export function RespHeader() {
  return (
    <div className="sticky top-0 z-30 text-white shadow-lg" style={{ background: "linear-gradient(90deg, #FF8A3D 0%, #F5480C 100%)" }}>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
        <Link href="/" aria-label="ComandaPRO"><Logo light /></Link>
        <Link href="/cadastro" className="rounded-full bg-white px-4 py-2 text-sm font-extrabold transition hover:bg-white/90" style={{ color: ACCENT }}>
          Testar grátis
        </Link>
      </header>
    </div>
  );
}

export function RespFooter() {
  return (
    <footer className="mt-16 text-white" style={{ background: "linear-gradient(135deg, #241C17 0%, #141018 100%)" }}>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="text-sm font-bold">Sistema para cada tipo de negócio</div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
          {NICHOS.map((n) => (
            <li key={n.slug}><Link href={`/segmentos/${n.slug}`} className="transition hover:text-white">{n.nome}</Link></li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-5 text-sm text-white/60">
          <Link href="/" className="transition hover:text-white">ComandaPRO</Link>
          <Link href="/respostas" className="transition hover:text-white">Respostas</Link>
          <Link href="/cadastro" className="transition hover:text-white">Começar grátis</Link>
        </div>
        <div className="mt-8 border-t border-white/10 pt-5 text-xs text-white/45">© 2026 ComandaPRO · Impulso Digital</div>
      </div>
    </footer>
  );
}

export function Crumbs({ items }: { items: { nome: string; href?: string }[] }) {
  return (
    <nav className="mb-8 text-xs sm:text-sm" style={{ color: MUT }}>
      {items.map((it, i) => (
        <span key={it.nome}>
          {i > 0 && <span className="mx-2">/</span>}
          {it.href ? <Link href={it.href} className="hover:underline">{it.nome}</Link> : <span>{it.nome}</span>}
        </span>
      ))}
    </nav>
  );
}

export const ORG_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE}/#organization`,
  name: "ComandaPRO",
  url: BASE,
  parentOrganization: { "@type": "Organization", name: "Impulso Digital" },
};

export function Ld({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export const INK_SOFT = "#5A4F45";
