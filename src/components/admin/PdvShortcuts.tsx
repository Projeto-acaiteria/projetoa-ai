"use client";
// Atalhos de teclado da frente de caixa (PC fixo) — familiaridade de PDV BR.
// Compartilhado pelos 2 fronts de venda (PDV açaí + Balcão bar/grid). F-keys
// escolhidas pra NÃO colidir com o Chrome (sem F3/F5/F6/F11/F12) e funcionarem
// mesmo com foco num input (F-keys não digitam texto). F1 abre a lista embutida.
import { useEffect, useRef } from "react";

export type PdvHotkeys = {
  onHelp: () => void; // F1  — mostra/oculta a lista de atalhos
  onSearch?: () => void; // F2  — focar a busca de produto
  onCharge?: () => void; // F4  — cobrar / finalizar a venda
  onDiscount?: () => void; // F7  — focar o desconto
  onClear?: () => void; // F8  — limpar a comanda
  onEscape?: () => void; // Esc — fechar/cancelar
};

const KEYS: { key: string; label: string }[] = [
  { key: "F1", label: "Mostrar / ocultar esta lista" },
  { key: "F2", label: "Buscar produto" },
  { key: "F4", label: "Cobrar / finalizar venda" },
  { key: "F7", label: "Desconto" },
  { key: "F8", label: "Limpar a comanda" },
  { key: "Esc", label: "Fechar / cancelar" },
];

export function usePdvHotkeys(h: PdvHotkeys) {
  // ref sempre com os handlers do render atual (fecham sobre o estado fresco),
  // mas o listener registra UMA vez — sem re-bind a cada tecla digitada.
  const ref = useRef(h);
  ref.current = h;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cur = ref.current;
      switch (e.key) {
        case "F1": e.preventDefault(); cur.onHelp(); break;
        case "F2": if (cur.onSearch) { e.preventDefault(); cur.onSearch(); } break;
        case "F4": if (cur.onCharge) { e.preventDefault(); cur.onCharge(); } break;
        case "F7": if (cur.onDiscount) { e.preventDefault(); cur.onDiscount(); } break;
        case "F8": if (cur.onClear) { e.preventDefault(); cur.onClear(); } break;
        case "Escape": cur.onEscape?.(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

// Lista de atalhos (overlay) — escondida no touch via hint, aberta no F1. Discovery embutida.
export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-sm animate-pop rounded-t-3xl bg-bg-elevated p-5 shadow-[var(--shadow-pop)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <h2 className="mb-4 text-lg font-extrabold text-ink">Atalhos de teclado</h2>
        <div className="divide-y divide-[var(--line)]">
          {KEYS.map((k) => (
            <div key={k.key} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-ink-2">{k.label}</span>
              <kbd className="rounded-md border border-line bg-bg-surface-2 px-2 py-1 text-xs font-bold text-ink">{k.key}</kbd>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-[var(--text-faded)]">Funciona no computador do caixa. No tablet/celular, use os botões.</p>
      </div>
    </div>
  );
}

// Hint clicável "atalhos · F1" pra descoberta no rodapé da comanda.
export function ShortcutsHint({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-2 hidden w-full items-center justify-center gap-1.5 text-[11px] font-semibold text-[var(--text-faded)] hover:text-brand-600 lg:flex">
      atalhos de teclado <kbd className="rounded border border-line bg-bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold">F1</kbd>
    </button>
  );
}
