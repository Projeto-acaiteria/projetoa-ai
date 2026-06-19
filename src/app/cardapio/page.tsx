import Link from "next/link";
import { readMenu } from "@/lib/menu-store";
import { getStore, isOpenNow } from "@/lib/settings-store";
import { IconClock, IconStar, IconArrowRight } from "@/components/Icons";
import AcaiBuilder from "./AcaiBuilder";
import InstallApp from "@/components/InstallApp";

export const dynamic = "force-dynamic"; // reflete edições do adm na hora

export default async function CardapioPage() {
  const menu = await readMenu();
  const store = await getStore();
  const aberto = isOpenNow(store.hours);
  return (
    <main className="theme-dark relative min-h-screen">
      {/* Fundo aurora — um só, animado, do topo ao fim */}
      <div className="aurora-wrap" aria-hidden>
        <div className="aurora-orb" style={{ width: "72vw", height: "72vw", left: "-18vw", top: "-8vh", background: "radial-gradient(circle, #7C3AED 0%, transparent 70%)", opacity: 0.55, animation: "aurora-a 24s ease-in-out infinite" }} />
        <div className="aurora-orb" style={{ width: "66vw", height: "66vw", right: "-22vw", top: "32vh", background: "radial-gradient(circle, #6D28D9 0%, transparent 70%)", opacity: 0.5, animation: "aurora-b 31s ease-in-out infinite" }} />
        <div className="aurora-orb" style={{ width: "62vw", height: "62vw", left: "0vw", top: "72vh", background: "radial-gradient(circle, #4C1D95 0%, transparent 72%)", opacity: 0.55, animation: "aurora-c 27s ease-in-out infinite" }} />
        <div className="aurora-orb" style={{ width: "42vw", height: "42vw", right: "-4vw", top: "52vh", background: "radial-gradient(circle, #E0A82E 0%, transparent 75%)", opacity: 0.13, animation: "aurora-a 36s ease-in-out infinite" }} />
      </div>

      <div className="relative z-10">
      {/* ─────────── Tela de entrada imersiva (cara de app) ─────────── */}
      <section className="relative flex min-h-[92vh] flex-col justify-end overflow-hidden">
        {/* foto do produto — funde no fundo aurora (sem emenda) */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url(/menu/hero-cantinho.jpg)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 48%, transparent 92%)",
            maskImage: "linear-gradient(to bottom, #000 0%, #000 48%, transparent 92%)",
          }}
        />
        {/* overlay leve só pra legibilidade do texto */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(22,8,35,0.12) 0%, rgba(22,8,35,0.18) 45%, rgba(22,8,35,0.52) 100%)" }}
        />
        {/* vinheta radial — profundidade premium nos cantos */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(125% 75% at 50% 28%, transparent 48%, rgba(15,5,24,0.42) 100%)" }}
        />

        {/* barra de status no topo */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-6">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white backdrop-blur ${aberto ? "bg-white/15" : "bg-[#EF4444]/90"}`}>
            <IconClock width={13} height={13} /> {aberto ? "Aberto agora" : "Fechado"}
          </span>
          <Link href="/meus-pontos" className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25">
            <IconStar width={13} height={13} /> Meus pontos
          </Link>
        </div>

        {/* conteúdo */}
        <div className="relative z-10 mx-auto w-full max-w-2xl px-6 pb-12 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-cantinho.png"
            alt="Cantinho do Açaí"
            className="mx-auto w-60 rounded-2xl drop-shadow-[0_6px_20px_rgba(0,0,0,0.55)] sm:w-72"
          />
          <p className="mx-auto mt-4 max-w-sm text-base font-medium text-white/85 sm:text-lg">
            O sabor que conquista toda a família
          </p>

          <a
            href="#montar"
            className="mt-7 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full px-7 py-4 text-base font-extrabold text-[#2E1065] shadow-[0_14px_40px_rgba(240,188,74,0.4)] transition active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #F4C95C 0%, #E0A82E 100%)" }}
          >
            Fazer meu pedido <IconArrowRight width={18} height={18} />
          </a>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-semibold text-white/65">
            <span>Pontos a cada compra</span>
            <span className="opacity-40">·</span>
            <span>Entrega no seu bairro</span>
            <span className="opacity-40">·</span>
            <span>Peça sem cadastro</span>
          </div>
        </div>
      </section>

      <div id="montar" className="scroll-mt-4" />
      <InstallApp storeName={store.name} />

      <AcaiBuilder
        sizes={menu.sizes}
        groups={menu.groups}
        isOpen={aberto}
        brand={{ name: store.name, whatsapp: store.whatsapp, deliveryFeeCents: store.deliveryFeeCents, minOrderCents: store.minOrderCents, deliveryZones: store.deliveryZones }}
      />
      </div>
    </main>
  );
}
