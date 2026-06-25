import type { CSSProperties } from "react";

// clareia (amt>0) ou escurece (amt<0) um hex — pra derivar os tons da cor da loja
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

// White-label: override dos tokens de marca (brand-*) pra cor da loja. Aplicado no wrapper de uma
// página/template → tudo que usa brand-gradient/brand-600/etc herda a cor da loja de uma vez.
// Vazio/ inválido = undefined (cai no índigo padrão do sistema).
export function brandVars(primaryColor: string | null | undefined): CSSProperties | undefined {
  const c = primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : null;
  if (!c) return undefined;
  return {
    "--brand-800": shade(c, -0.28),
    "--brand-700": shade(c, -0.18),
    "--brand-600": c,
    "--brand-500": shade(c, 0.1),
    "--brand-400": shade(c, 0.35),
    "--shadow-brand": `0 10px 30px ${c}4d`,
  } as CSSProperties;
}
