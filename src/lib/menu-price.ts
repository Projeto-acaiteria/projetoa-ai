import type { BarProduct } from "@/lib/menu-bar-store";

// Preço de exibição no card. Produtos cujo preço vem de grupos OBRIGATÓRIOS (combinado por tamanho,
// pizza por sabor) têm base 0 — mostrar "a partir de R$ X" (base + a opção mais barata de cada grupo
// obrigatório) em vez de "R$ 0,00". Client-safe (só usa o tipo, não o db).
export function fromPrice(p: BarProduct): { cents: number; from: boolean } {
  let base = p.price_cents;
  let from = false;
  for (const g of p.groups) {
    if (g.min_select >= 1 && g.modifiers.length) {
      base += Math.min(...g.modifiers.map((m) => m.price_cents));
      from = true;
    }
  }
  return { cents: base, from };
}
