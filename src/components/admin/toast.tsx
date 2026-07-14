"use client";

import { createContext, useCallback, useContext, useState } from "react";

// Toast global do painel: confirmação visível de toda ação (antes muitas eram silenciosas — só
// router.refresh()). Uso: const toast = useToast();  toast("Peça adicionada");  toast(msg, "error").
type ToastType = "success" | "error" | "info";
type Toast = { id: number; type: ToastType; message: string };

const ToastCtx = createContext<(message: string, type?: ToastType) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++seq;
    setToasts((t) => [...t.slice(-3), { id, type, message }]); // no máx ~4 na tela
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[400] flex flex-col items-center gap-2 p-4 sm:items-end">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => remove(t.id)}
            className={`animate-pop pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-left text-sm font-bold text-white shadow-[var(--shadow-pop)] ${
              t.type === "success" ? "bg-[var(--green-ok)]" : t.type === "error" ? "bg-[var(--red-no)]" : "bg-ink"
            }`}
          >
            <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/25 text-xs">{t.type === "error" ? "!" : t.type === "info" ? "i" : "✓"}</span>
            <span>{t.message}</span>
          </button>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
