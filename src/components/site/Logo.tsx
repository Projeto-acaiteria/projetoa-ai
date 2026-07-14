// LOGO ComandaPRO — Direção A do estudo de nicho food-tech (validada por Eduardo, 07/2026).
// Wordmark "Comanda" + pílula "PRO" em gradiente CORAL/LARANJA quente (apetite/comida) — contrasta
// com o índigo do site e foge do azul do AgendaPRO (mesma FAMÍLIA, identidade própria). Com PERFURAÇÃO
// de canhoto de comanda (tracejado + furo translúcido): único aceno ao "ticket", sutil, sem virar cupom.
// `light` = "Comanda" branco (sobre header/fundo colorido ou escuro). A pílula é sempre colorida.
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-[9px] text-xl font-extrabold tracking-tight">
      <span style={{ color: light ? "#FFFFFF" : "#141018", letterSpacing: "-0.03em" }}>Comanda</span>
      <span
        className="relative inline-flex items-center text-[0.78em] font-black leading-none text-white"
        style={{
          letterSpacing: "-0.02em",
          background: "linear-gradient(135deg, #FF8A3D 0%, #F5480C 100%)",
          borderRadius: 9,
          padding: "4px 11px 4px 15px",
          boxShadow: "0 4px 12px rgba(245,72,12,0.4)",
        }}
      >
        <span aria-hidden className="absolute" style={{ left: 7, top: 4, bottom: 4, borderLeft: "1.5px dashed rgba(255,255,255,0.6)" }} />
        <span aria-hidden className="absolute rounded-full" style={{ left: "6px", top: "50%", width: 3.5, height: 3.5, marginTop: -1.75, background: "rgba(255,255,255,0.85)" }} />
        PRO
      </span>
    </span>
  );
}
