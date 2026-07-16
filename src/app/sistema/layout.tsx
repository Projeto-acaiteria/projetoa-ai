import { redirect } from "next/navigation";
import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";

export const dynamic = "force-dynamic";

// Área do OPERADOR do SaaS (Eduardo), separada do /admin (que é do dono de loja).
// Gate por email de operador — dono de loja logado NÃO entra aqui (não vê leads de todos).
export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const op = await requireOperator();
  if (!op) redirect("/login");

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <header className="border-b border-white/10 bg-[#1e1b4b]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-wide">ComandaPRO</span>
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-200">operador</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/sistema/leads" className="text-white/80 hover:text-white">Leads</Link>
            <span className="text-white/30">·</span>
            <span className="text-white/40">{op.email}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
