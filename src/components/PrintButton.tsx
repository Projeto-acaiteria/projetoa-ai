"use client";

// Botão de imprimir / salvar PDF do documento A4 público. Some na impressão (.no-print).
export default function PrintButton({ label = "Imprimir / Salvar PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
    >
      🖨 {label}
    </button>
  );
}
