// SISTEMA DE MARCA ComandaPRO — front-stage (site, cadastro, login, pagamentos).
// Coral protagonista (a cor do logo oficial) sobre neutros. Cara food-tech, quente, apetite.
//
// NÃO confundir com:
//  - globals.css `--brand-*`  → P&B do PAINEL multi-tenant (a cor vem de CADA tenant; regra dura)
//  - brand-theme.ts           → aplica a cor do tenant no admin/cardápio público
// Este arquivo é SÓ a marca do produto ComandaPRO (o que a Impulso vende), nas telas de aquisição.
export const BRAND = {
  // coral — a primária (CTA, links, destaques, foco)
  coral: "#F5480C",
  coralLight: "#FF8A3D",
  coralGrad: "linear-gradient(135deg, #FF8A3D 0%, #F5480C 100%)",
  coralSoft: "#FFF1EA", // wash bem claro pra fundos de destaque/realce
  coralRing: "rgba(245,72,12,0.35)", // foco/aro

  // neutros (quase-preto do logo + escala fria-neutra, sem o "quente" antigo do creme)
  ink: "#141018", // texto forte / fundo escuro
  ink2: "#3F3B40", // texto secundário
  mut: "#8B858E", // labels / terciário
  line: "#ECE9E7", // bordas sutis
  bg: "#FFFFFF", // fundo base
  bgSoft: "#FAF8F7", // off-white pra seções

  // sombras
  shadowCoral: "0 12px 34px rgba(245,72,12,0.28)",
  shadowCard: "0 1px 2px rgba(20,16,24,0.04), 0 10px 30px rgba(20,16,24,0.06)",
} as const;
