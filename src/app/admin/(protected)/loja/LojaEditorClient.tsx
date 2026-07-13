"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/admin/ui";
import AtSpecsFields from "@/components/admin/AtSpecsFields";
import ImageUpload from "@/components/admin/ImageUpload";
import type { StockCategory } from "@/lib/stock-store";

// Editor de PRODUTO da Loja Online (site headless AT), estilo Shopify: coluna principal (conteúdo do
// produto) + coluna lateral (publicação/organização). Reusa AtSpecsFields (specs guiadas por categoria
// — o montador do site usa) e ImageUpload (foto real → Storage). Persiste em /api/loja-produtos
// (POST cria rascunho, PATCH edita). λ.prova-na-fonte: só diz "salvo" depois do r.ok.

export type EditorProduct = {
  id: string | null; // null = produto novo (POST)
  name: string;
  description: string;
  category: StockCategory;
  brand: string;
  qty: number;
  sellPriceCents: number;
  image: string;
  images: string[];
  specs: Record<string, string | number | boolean | string[]>;
  highlight: boolean;
  badge: string;
  published: boolean;
};

// as 15 categorias hardware (mesma nomenclatura da tela de Estoque/Loja), agrupadas p/ o select
const CAT_GROUPS: { label: string; cats: { value: StockCategory; label: string }[] }[] = [
  { label: "PCs prontos", cats: [{ value: "computadores", label: "Computadores e notebooks" }] },
  { label: "Peças de PC", cats: [
    { value: "cpu", label: "Processadores (CPU)" },
    { value: "cooler", label: "Coolers e water" },
    { value: "mobo", label: "Placas-mãe" },
    { value: "ram", label: "Memórias (RAM)" },
    { value: "gpu", label: "Placas de vídeo (GPU)" },
    { value: "ssd", label: "SSD e armazenamento" },
    { value: "gabinete", label: "Gabinetes" },
    { value: "fonte", label: "Fontes" },
  ] },
  { label: "Periféricos", cats: [
    { value: "mouse", label: "Mouses" },
    { value: "teclado", label: "Teclados" },
    { value: "mousepad", label: "Mousepads" },
    { value: "monitor", label: "Monitores" },
    { value: "headset", label: "Headsets" },
    { value: "cadeira", label: "Cadeiras gamer" },
  ] },
];
const BADGES = ["Lançamento", "Mais Vendido", "Promo", "OpenBox"];

const inp = "w-full rounded-lg border border-line bg-bg-base px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600";
const lbl = "text-xs font-semibold text-[var(--text-muted)]";

export default function LojaEditorClient({ mode, product }: { mode: "edit" | "new"; product: EditorProduct }) {
  const router = useRouter();
  const isNew = mode === "new";

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [category, setCategory] = useState<StockCategory>(product.category);
  const [brand, setBrand] = useState(product.brand);
  const [qty, setQty] = useState(String(product.qty));
  const [priceReais, setPriceReais] = useState(product.sellPriceCents > 0 ? (product.sellPriceCents / 100).toFixed(2) : "");
  const [images, setImages] = useState<string[]>(product.images);
  const [specs, setSpecs] = useState(product.specs);
  const [highlight, setHighlight] = useState(product.highlight);
  const [badge, setBadge] = useState(product.badge);
  const [published, setPublished] = useState(product.published);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // galeria: substitui/remove por índice; slot vazio no fim adiciona
  function setImageAt(i: number, url: string) {
    setImages((cur) => (url ? cur.map((u, k) => (k === i ? url : u)) : cur.filter((_, k) => k !== i)));
  }

  async function save() {
    setErr("");
    if (!name.trim()) { setErr("Dê um nome ao produto."); return; }
    if (images.length === 0) { setErr("Adicione pelo menos 1 foto."); return; }

    const sellPriceCents = priceReais ? Math.round((parseFloat(priceReais.replace(",", ".")) || 0) * 100) : 0;
    const payload = {
      name: name.trim(),
      description,
      category,
      brand: brand.trim(),
      qty: Number(qty) || 0,
      sellPriceCents,
      images,
      image: images[0] ?? "",
      specs,
      highlight,
      badge,
    };

    setSaving(true);
    try {
      let r: Response;
      if (isNew) {
        // o dono escolhe no toggle se já publica ou entra como rascunho
        r = await fetch("/api/loja-produtos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, published }),
        });
      } else {
        r = await fetch("/api/loja-produtos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: product.id, patch: { ...payload, published } }),
        });
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `Erro ${r.status}`);
      // só navega DEPOIS do ok do servidor (prova-na-fonte)
      router.push("/admin/loja");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não consegui salvar. Tente de novo.");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/admin/loja" className="text-sm font-bold text-[var(--text-muted)] hover:text-ink">← Voltar para a loja</Link>
        <div className="flex items-center gap-2">
          {err && <span className="text-xs font-bold text-red-500">{err}</span>}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-60"
          >
            {saving ? "Salvando…" : isNew ? "Criar produto" : "Salvar"}
          </button>
        </div>
      </div>

      <div className="grid max-w-5xl gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Coluna principal — conteúdo do produto */}
        <div className="space-y-4">
          <Card className="p-5">
            <label className={lbl}>Nome do produto</label>
            <input className={`${inp} mt-1`} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: AMD Ryzen 5 5600" autoFocus />

            <label className={`${lbl} mt-4 block`}>Descrição</label>
            <textarea
              className={`${inp} mt-1 min-h-[120px] resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição que aparece na página do produto. Aceita Markdown simples (**negrito**, listas com -)."
            />
          </Card>

          <Card className="p-5">
            <div className="mb-1 flex items-center justify-between">
              <label className={lbl}>Fotos</label>
              <span className="text-[11px] text-[var(--text-faded)]">A 1ª foto é a capa · pelo menos 1</span>
            </div>
            <div className="mt-2 space-y-2">
              {images.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ImageUpload value={url} onChange={(u) => setImageAt(i, u)} hint={i === 0 ? "Capa" : undefined} />
                </div>
              ))}
              {/* slot para adicionar mais uma foto */}
              <ImageUpload value="" onChange={(u) => { if (u) setImages((cur) => [...cur, u]); }} hint="Adicionar foto" />
            </div>
          </Card>

          <Card className="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={lbl}>Preço de venda</label>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[var(--text-muted)]">R$</span>
                  <input className={inp} inputMode="decimal" value={priceReais} onChange={(e) => setPriceReais(e.target.value)} placeholder="0,00" />
                </div>
              </div>
              <div>
                <label className={lbl}>Estoque (qtd)</label>
                <input className={`${inp} mt-1`} type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>SKU</label>
                <input className={`${inp} mt-1 text-[var(--text-faded)]`} value={isNew ? "gerado ao salvar" : (product.id ?? "")} readOnly disabled />
              </div>
            </div>
          </Card>

          {/* Ficha técnica — specs guiadas por categoria (as que o montador do site usa) */}
          <AtSpecsFields category={category} value={specs} onChange={setSpecs} />

          {/* Variantes — decisão do dono: cada variante é um produto separado (sem funcionalidade) */}
          <Card className="p-4">
            <div className={`${lbl} uppercase tracking-wide`}>Variantes</div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Cada variação (cor, tamanho, capacidade) é cadastrada como um <b className="text-ink">produto separado</b> — mais simples de controlar estoque e preço. Duplique este produto e ajuste o que muda.
            </p>
          </Card>
        </div>

        {/* Coluna lateral — publicação e organização */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className={`${lbl} uppercase tracking-wide`}>Publicação</div>
            <button
              type="button"
              role="switch"
              aria-checked={published}
              onClick={() => setPublished((v) => !v)}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-bg-base px-3 py-2.5"
            >
              <span className="text-sm font-semibold text-ink">{published ? "Aparece no site" : "Fora do site (rascunho)"}</span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${published ? "brand-gradient" : "bg-bg-surface-2"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${published ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {published
                ? "Ao salvar, o produto já aparece no site."
                : "Fica em rascunho — só você vê. Ligue quando quiser publicar."}
            </p>
          </Card>

          <Card className="p-5 space-y-4">
            <div className={`${lbl} uppercase tracking-wide`}>Organização</div>
            <div>
              <label className={lbl}>Categoria</label>
              <select className={`${inp} mt-1`} value={category} onChange={(e) => { setCategory(e.target.value as StockCategory); setSpecs({}); }}>
                {CAT_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Marca</label>
              <input className={`${inp} mt-1`} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="ex: AMD, Kingston, Corsair" />
            </div>
            <div>
              <label className={lbl}>Selo</label>
              <select className={`${inp} mt-1`} value={badge} onChange={(e) => setBadge(e.target.value)}>
                <option value="">Sem selo</option>
                {BADGES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-line bg-bg-base px-3 py-2.5">
              <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
              <span className="text-sm text-ink">Destaque na home</span>
            </label>
          </Card>
        </div>
      </div>
    </>
  );
}
