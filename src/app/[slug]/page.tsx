import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/supabase";
import { readMenu } from "@/lib/menu-store";
import { readBarMenu } from "@/lib/menu-bar-store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { getActiveEvent } from "@/lib/events-store";
import { getStore, isOpenNow } from "@/lib/settings-store";
import { IconClock, IconStar, IconArrowRight } from "@/components/Icons";
import AcaiBuilder from "../cardapio/AcaiBuilder";
import TemplateBar from "@/components/bar/TemplateBar";
import TemplateGrid from "@/components/grid/TemplateGrid";
import InstallApp from "@/components/InstallApp";

export const dynamic = "force-dynamic"; // reflete edições do adm na hora

// Cardápio público POR LOJA (ComandaPRO — ativação). Resolve o tenant pelo slug da URL
// (comandapro.com.br/cantinho) e passa o storeId pros stores. Visual genérico (qualquer loja).
export default async function LojaCardapio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: loja } = await db()
    .from("stores")
    .select("id")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (!loja) notFound();

  const storeId = (loja as { id: string }).id;

  // switch(menu_template): cada modelo de cardápio tem sua própria tela pública.
  const cfg = await getStoreConfig(storeId);
  if (cfg?.menu_template === "bar" || cfg?.menu_template === "grid") {
    const [categories, lojaStore, ev] = await Promise.all([
      readBarMenu(storeId),
      getStore(storeId),
      cfg.cover_enabled ? getActiveEvent(storeId) : Promise.resolve(null),
    ]);
    const coverNotice = ev ? { artist: ev.artist, coverCents: ev.cover_cents } : null;
    const props = {
      storeName: lojaStore.name,
      tagline: lojaStore.tagline,
      aberto: isOpenNow(lojaStore.hours),
      categories,
      slug,
      coverNotice,
      branding: { logoUrl: lojaStore.logoUrl, bannerUrl: lojaStore.bannerUrl, primaryColor: lojaStore.primaryColor },
    };
    return cfg.menu_template === "grid" ? (
      <TemplateGrid
        {...props}
        hasDelivery={cfg.has_delivery !== false}
        whatsapp={lojaStore.whatsapp}
        deliveryFeeCents={lojaStore.deliveryFeeCents}
        minOrderCents={lojaStore.minOrderCents}
        deliveryZones={lojaStore.deliveryZones}
      />
    ) : (
      <TemplateBar {...props} />
    );
  }
  // default = açaí (montagem no copo).

  const menu = await readMenu(storeId);
  const store = await getStore(storeId);
  const aberto = isOpenNow(store.hours);

  return (
    <main className="theme-dark relative min-h-screen">
      <div className="aurora-wrap" aria-hidden>
        <div className="aurora-orb" style={{ width: "72vw", height: "72vw", left: "-18vw", top: "-8vh", background: "radial-gradient(circle, #7C3AED 0%, transparent 70%)", opacity: 0.55, animation: "aurora-a 24s ease-in-out infinite" }} />
        <div className="aurora-orb" style={{ width: "66vw", height: "66vw", right: "-22vw", top: "32vh", background: "radial-gradient(circle, #6D28D9 0%, transparent 70%)", opacity: 0.5, animation: "aurora-b 31s ease-in-out infinite" }} />
        <div className="aurora-orb" style={{ width: "62vw", height: "62vw", left: "0vw", top: "72vh", background: "radial-gradient(circle, #4C1D95 0%, transparent 72%)", opacity: 0.55, animation: "aurora-c 27s ease-in-out infinite" }} />
      </div>

      <div className="relative z-10">
        <section className="relative flex min-h-[64vh] flex-col justify-center overflow-hidden px-6 py-20 text-center">
          {store.bannerUrl && (
            <div className="absolute inset-0 z-0" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={store.bannerUrl} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-[#140820]" />
            </div>
          )}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-6">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white backdrop-blur ${aberto ? "bg-white/15" : "bg-[#EF4444]/90"}`}>
              <IconClock width={13} height={13} /> {aberto ? "Aberto agora" : "Fechado"}
            </span>
            <Link href={`/${slug}/meus-pontos`} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25">
              <IconStar width={13} height={13} /> Meus pontos
            </Link>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-2xl">
            {store.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} className="mx-auto mb-5 h-24 w-24 rounded-2xl object-cover shadow-[0_8px_30px_rgba(0,0,0,0.4)]" />
            )}
            <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)] sm:text-5xl">
              {store.name}
            </h1>
            {store.tagline && (
              <p className="mx-auto mt-4 max-w-sm text-base font-medium text-white/85 sm:text-lg">{store.tagline}</p>
            )}
            <a
              href="#montar"
              className="mt-8 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full px-7 py-4 text-base font-extrabold shadow-[0_14px_40px_rgba(0,0,0,0.3)] transition active:scale-[0.98]"
              style={store.primaryColor ? { background: store.primaryColor, color: "#fff" } : { background: "linear-gradient(135deg, #F4C95C 0%, #E0A82E 100%)", color: "#2E1065" }}
            >
              Fazer meu pedido <IconArrowRight width={18} height={18} />
            </a>
          </div>
        </section>

        <div id="montar" className="scroll-mt-4" />
        <InstallApp storeName={store.name} />

        <AcaiBuilder
          sizes={menu.sizes}
          groups={menu.groups}
          isOpen={aberto}
          brand={{ name: store.name, whatsapp: store.whatsapp, deliveryFeeCents: store.deliveryFeeCents, minOrderCents: store.minOrderCents, deliveryZones: store.deliveryZones, slug, hasDelivery: cfg?.has_delivery !== false }}
        />
      </div>
    </main>
  );
}
