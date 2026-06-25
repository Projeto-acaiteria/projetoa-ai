import { getStore } from "@/lib/settings-store";
import { IconStar } from "@/components/Icons";
import MeusPontosClient from "./MeusPontosClient";

export const dynamic = "force-dynamic";

// clareia (amt>0) ou escurece (amt<0) um hex — pra derivar os tons da cor da loja
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

export default async function MeusPontosPage() {
  const store = await getStore();
  // White-label: tematiza a página inteira pra cor da loja (override dos brand tokens).
  // Vazio = cai no índigo padrão do sistema.
  const accent = /^#[0-9a-fA-F]{6}$/.test(store.primaryColor) ? store.primaryColor : null;
  const themeVars = accent
    ? ({
        "--brand-800": shade(accent, -0.28),
        "--brand-700": shade(accent, -0.18),
        "--brand-600": accent,
        "--brand-500": shade(accent, 0.1),
        "--brand-400": shade(accent, 0.35),
        "--shadow-brand": `0 10px 30px ${accent}4d`,
      } as React.CSSProperties)
    : undefined;

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
