import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { getOrderByCode, type OrderStatus } from "@/lib/orders-store";
import { getStore } from "@/lib/settings-store";

export const dynamic = "force-dynamic"; // status sempre fresco (cliente atualiza a página)

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");

// Passos do rastreio por tipo de pedido. O índice do status atual marca feito/atual/pendente.
const STEPS: Record<"entrega" | "retirada", { key: OrderStatus; label: string; sub: string }[]> = {
  entrega: [
    { key: "recebido", label: "Recebido", sub: "A loja recebeu seu pedido" },
    { key: "preparo", label: "Em preparo", sub: "Seu pedido está sendo feito" },
    { key: "saiu", label: "Saiu para entrega", sub: "Já está a caminho" },
    { key: "entregue", label: "Entregue", sub: "Bom apetite!" },
  ],
  retirada: [
    { key: "recebido", label: "Recebido", sub: "A loja recebeu seu pedido" },
    { key: "preparo", label: "Em preparo", sub: "Seu pedido está sendo feito" },
    { key: "saiu", label: "Pronto", sub: "Pode vir buscar" },
    { key: "entregue", label: "Retirado", sub: "Bom apetite!" },
  ],
};

export default async function StatusPedido({ params }: { params: Promise<{ slug: string; code: string }> }) {
  const { slug, code } = await params;
  const { data: loja } = await db().from("stores").select("id").eq("slug", slug).eq("active", true).maybeSingle();
  if (!loja) notFound();
  const storeId = (loja as { id: string }).id;

  const [order, store] = await Promise.all([getOrderByCode(storeId, code), getStore(storeId)]);
  const accent = store.primaryColor || "#7C3AED";

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} className="h-11 w-11 rounded-xl object-cover" />
          ) : null}
          <div>
            <h1 className="text-lg font-extrabold leading-tight">{store.name}</h1>
            <p className="text-xs text-zinc-500">Acompanhamento de pedido</p>
          </div>
        </div>

        {!order ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
            <p className="text-lg font-bold">Pedido não encontrado</p>
            <p className="mt-1 text-sm text-zinc-500">Confira o código <b>{code.toUpperCase()}</b> — ele tem 5 caracteres e está na sua confirmação.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">Código</p>
                  <p className="text-2xl font-extrabold tracking-[0.2em]" style={{ color: accent }}>{order.code}</p>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: accent }}>
                  {order.mode === "entrega" ? "Entrega" : "Retirada"}
                </span>
              </div>

              {/* timeline */}
              <ol className="mt-6 space-y-0">
                {(() => {
                  const steps = STEPS[order.mode === "entrega" ? "entrega" : "retirada"];
                  const curIdx = steps.findIndex((s) => s.key === order.status);
                  return steps.map((s, i) => {
                    const done = i < curIdx;
                    const current = i === curIdx;
                    const last = i === steps.length - 1;
                    return (
                      <li key={s.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={done || current ? { background: accent, color: "#fff" } : { background: "#E4E4E7", color: "#A1A1AA" }}>
                            {done ? "✓" : i + 1}
                          </span>
                          {!last && <span className="my-0.5 w-0.5 flex-1" style={{ background: done ? accent : "#E4E4E7", minHeight: 22 }} />}
                        </div>
                        <div className={`pb-5 ${current ? "" : "opacity-70"}`}>
                          <p className="font-bold leading-tight" style={current ? { color: accent } : undefined}>{s.label}</p>
                          <p className="text-xs text-zinc-500">{s.sub}</p>
                        </div>
                      </li>
                    );
                  });
                })()}
              </ol>
            </div>

            {/* resumo */}
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="mb-2 text-sm font-extrabold">Resumo</p>
              <ul className="space-y-1 text-sm">
                {order.items.filter((it) => it.name).map((it, i) => (
                  <li key={i} className="flex justify-between gap-3 text-zinc-600">
                    <span>{it.qty}× {it.name}</span>
                    {it.paidCents > 0 && <span className="tabular-nums">{brl(it.paidCents)}</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-sm">
                {order.feeCents > 0 && <div className="flex justify-between text-zinc-500"><span>Taxa de entrega</span><span className="tabular-nums">{brl(order.feeCents)}</span></div>}
                <div className="flex justify-between font-extrabold"><span>Total</span><span className="tabular-nums" style={{ color: accent }}>{brl(order.totalCents)}</span></div>
              </div>
              {order.mode === "entrega" && order.address && (
                <p className="mt-3 text-xs text-zinc-500">Entrega em: {order.address}{order.bairro ? ` — ${order.bairro}` : ""}</p>
              )}
              {order.paymentMethod && (
                <p className="mt-1 text-xs text-zinc-500">Pagamento na entrega: {order.paymentMethod === "pix" ? "PIX" : order.paymentMethod === "dinheiro" ? "Dinheiro" : "Cartão"}</p>
              )}
            </div>

            <a href={`/${slug}/pedido/${order.code}`} className="mt-4 block rounded-xl border border-zinc-200 bg-white py-3 text-center text-sm font-bold text-zinc-600 active:scale-[0.99]">
              Atualizar status
            </a>
          </>
        )}
      </div>
    </main>
  );
}
