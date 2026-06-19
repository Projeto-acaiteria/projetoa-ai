import Link from "next/link";
import { getStore } from "@/lib/settings-store";
import { IconBowl, IconArrowRight, IconChart } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const store = await getStore();
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl brand-gradient text-white shadow-[var(--shadow-brand)]">
          <IconBowl width={32} height={32} />
        </div>
        <h1 className="text-3xl font-extrabold text-ink">{store.name}</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Sistema próprio · cardápio digital, pedidos por WhatsApp, fidelidade e gestão.
        </p>

        <div className="mt-8 grid gap-3">
          <Link
            href="/cardapio"
            className="flex items-center justify-between rounded-2xl brand-gradient px-5 py-4 text-left font-bold text-white shadow-[var(--shadow-brand)]"
          >
            <span className="flex items-center gap-3">
              <IconBowl width={22} height={22} /> Ver cardápio (cliente)
            </span>
            <IconArrowRight />
          </Link>
          <Link
            href="/admin"
            className="card flex items-center justify-between px-5 py-4 text-left font-bold text-ink"
          >
            <span className="flex items-center gap-3">
              <IconChart width={22} height={22} className="text-brand-600" /> Painel de gestão
            </span>
            <IconArrowRight className="text-brand-600" />
          </Link>
        </div>

        <p className="mt-6 text-xs text-[var(--text-faded)]">
          Protótipo de front · dados de exemplo · v0.1
        </p>
      </div>
    </main>
  );
}
