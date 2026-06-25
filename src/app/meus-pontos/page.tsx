import { getStore } from "@/lib/settings-store";
import { brandVars } from "@/lib/brand-theme";
import { IconStar } from "@/components/Icons";
import MeusPontosClient from "./MeusPontosClient";

export const dynamic = "force-dynamic";

export default async function MeusPontosPage() {
  const store = await getStore();
  const themeVars = brandVars(store.primaryColor); // white-label: veste a cor da loja

  return (
    <main className="min-h-screen" style={themeVars}>
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
      <MeusPontosClient />
    </main>
  );
}
