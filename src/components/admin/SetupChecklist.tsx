"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Checklist de primeiros passos na home do admin. Tira o dono da tela vazia logo após o cadastro:
// mostra o que falta (logo, revisar cardápio, compartilhar link, 1ª venda) e some quando os marcos
// detectáveis estão feitos. Dismissível por loja (localStorage). Não substitui Configurações — guia.
export default function SetupChecklist({ hasLogo, hasSale, slug }: { hasLogo: boolean; hasSale: boolean; slug: string }) {
  const [dismissed, setDismissed] = useState(true); // começa oculto até ler o localStorage (evita flash)
  const [copied, setCopied] = useState(false);
  const key = `setup-done-${slug}`;

  useEffect(() => { setDismissed(localStorage.getItem(key) === "1"); }, [key]);

  // os marcos detectáveis (logo + 1ª venda) feitos = onboarding cumprido, esconde sozinho
  if (dismissed || (hasLogo && hasSale)) return null;

  const publicUrl = typeof window !== "undefined" && slug ? `${window.location.origin}/${slug}` : "";

  async function copyLink() {
    if (!publicUrl) return;
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  const Item = ({ done, children }: { done: boolean; children: React.ReactNode }) => (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${done ? "bg-lime text-white" : "border border-line text-[var(--text-faded)]"}`}>{done ? "✓" : ""}</span>
      <div className={`text-sm ${done ? "text-[var(--text-faded)] line-through" : "text-ink"}`}>{children}</div>
    </div>
  );

  return (
    <div className="mb-4 rounded-xl border border-brand-400 bg-bg-elevated p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-ink">Primeiros passos</h2>
        <button onClick={() => { localStorage.setItem(key, "1"); setDismissed(true); }} className="text-xs font-semibold text-[var(--text-muted)] hover:text-ink">dispensar</button>
      </div>
      <div className="divide-y divide-line">
        <Item done={hasLogo}>
          <Link href="/admin/configuracoes" className="font-semibold underline-offset-2 hover:underline">Envie sua logo e cor</Link> — sua marca no cardápio e no cupom.
        </Item>
        <Item done={false}>
          <Link href="/admin/cardapio" className="font-semibold underline-offset-2 hover:underline">Revise o cardápio e os preços</Link> — já deixamos um exemplo pra você ajustar.
        </Item>
        <Item done={false}>
          <button onClick={copyLink} className="font-semibold underline-offset-2 hover:underline">{copied ? "Link copiado ✓" : "Compartilhe seu link"}</button>
          {publicUrl ? <span className="text-[var(--text-muted)]"> — {publicUrl}</span> : null}
        </Item>
        <Item done={hasSale}>Faça a primeira venda — pelo balcão ou pelo link.</Item>
      </div>
    </div>
  );
}
