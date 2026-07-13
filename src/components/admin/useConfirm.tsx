"use client";

import { useCallback, useState } from "react";

// Confirmação in-app (substitui o window.confirm nativo — consistente com o resto da UI e não
// trava automação/kiosk). Uso:  const { ask, confirmDialog } = useConfirm();
//   if (await ask({ message: "Excluir?", danger: true })) { ... }   e renderize {confirmDialog}.
type Opts = { title?: string; message: string; confirmLabel?: string; danger?: boolean };
type State = Opts & { resolve: (v: boolean) => void };

export function useConfirm() {
  const [state, setState] = useState<State | null>(null);

  const ask = useCallback(
    (opts: Opts) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const close = (v: boolean) => { state?.resolve(v); setState(null); };

  const confirmDialog = state ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => close(false)} />
      <div className="relative w-full max-w-sm animate-pop rounded-2xl bg-bg-elevated p-5 shadow-[var(--shadow-pop)]">
        {state.title && <h3 className="mb-1 text-base font-extrabold text-ink">{state.title}</h3>}
        <p className="text-sm text-ink-2">{state.message}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => close(false)} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-[var(--text-muted)]">Cancelar</button>
          <button onClick={() => close(true)} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white ${state.danger ? "bg-[var(--red-no)]" : "brand-gradient"}`}>{state.confirmLabel ?? "Confirmar"}</button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, confirmDialog };
}
