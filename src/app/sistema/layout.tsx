import { redirect } from "next/navigation";
import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { Logo } from "@/components/site/Logo";
import { BRAND } from "@/config/brand";

export const dynamic = "force-dynamic";

// Área do OPERADOR do SaaS (Eduardo), separada do /admin (que é do dono de loja).
// Gate por email de operador — dono de loja logado NÃO entra aqui (não vê leads de todos).
export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const op = await requireOperator();
  if (!op) redirect("/login");

  return (
    <div className="min-h-screen" style={{ background: BRAND.bgSoft }}>
      <header className="border-b bg-white" style={{ borderColor: BRAND.line }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: BRAND.coral }}>operador</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/sistema/leads" className="font-semibold hover:underline" style={{ color: BRAND.ink }}>Leads</Link>
            <span style={{ color: BRAND.line }}>·</span>
            <span style={{ color: BRAND.mut }}>{op.email}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
