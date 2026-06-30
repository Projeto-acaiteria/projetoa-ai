import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { getStore } from "@/lib/settings-store";
import { brandVars } from "@/lib/brand-theme";
import { IconStar } from "@/components/Icons";
import MeusPontosClient from "../../meus-pontos/MeusPontosClient";

export const dynamic = "force-dynamic";

// Loyalty do cliente POR LOJA — resolve o tenant pelo slug (não pelo contexto, que cairia no
// Cantinho default). Passa o storeId pro client, que consulta /api/pontos?store=storeId.
export default async function LojaMeusPontos({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: loja } = await db().from("stores").select("id").eq("slug", slug).eq("active", true).maybeSingle();
  if (!loja) notFound();
  const storeId = (loja as { id: string }).id;
  const store = await getStore(storeId);

  return (
    <main className="min-h-screen" style={brandVars(store.primaryColor)}>
      <header className="brand-gradient text-white">
        <div className="mx-auto max-w-md px-4 pb-7 pt-9">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-white/15 backdrop-blur">
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <IconStar width={24} height={24} />
              )}
            </div>
            <div>
              <h1 className="text-xl font-extrabold leading-none">Meus Pontos</h1>
              <p className="mt-1 text-sm text-white/80">{store.name}</p>
            </div>
          </div>
        </div>
      </header>
      <MeusPontosClient storeId={storeId} backHref={`/${slug}`} />
    </main>
  );
}
