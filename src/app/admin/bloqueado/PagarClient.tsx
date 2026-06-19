"use client";

import { useState } from "react";

type Plano = { id: string; label: string; cents: number; equivMes: number; meses: number };
const brl = (cents: number) => "R$ " + (cents / 100).toFixed(2).replace(".", ",");

export default function PagarClient({ planos, lojaNome }: { planos: Plano[]; lojaNome: string }) {
  const [planoId, setPlanoId] = useState(planos[0]?.id ?? "");
  const [nome, setNome] = useState(lojaNome);
  const [cpf, setCpf] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [pix, setPix] = useState<{ qrImage: string | null; qrPayload: string | null; invoiceUrl: string } | null>(
    null,
  );

  async function pagar() {
    setErro("");
    setCarregando(true);
    setPix(null);
    try {
      const res = await fetch("/api/billing/checkout-asaas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plano: planoId, forma: "pix", nome: nome.trim(), cpfCnpj: cpf.replace(/\D/g, "") }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErro(data.error ?? "Não consegui gerar o PIX. Confere os dados e tenta de novo.");
        return;
      }
      setPix({ qrImage: data.qrImage, qrPayload: data.qrPayload, invoiceUrl: data.invoiceUrl });
    } catch {
      setErro("Falha de conexão. Tenta de novo.");
    } finally {
      setCarregando(false);
    }
  }

  if (pix) {
    return (
      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5 text-center">
        <h2 className="font-semibold">Pague com PIX pra liberar</h2>
        {pix.qrImage && (
          <img
            src={`data:image/png;base64,${pix.qrImage}`}
            alt="QR Code PIX"
            className="mx-auto my-4 h-52 w-52 rounded-lg bg-white p-2"
          />
        )}
        {pix.qrPayload && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(pix.qrPayload!);
              setCopiado(true);
            }}
            className="w-full rounded-lg bg-purple-600 py-2.5 font-semibold hover:bg-purple-500"
          >
            {copiado ? "Código copiado ✓" : "Copiar código PIX"}
          </button>
        )}
        {pix.invoiceUrl && (
          <a href={pix.invoiceUrl} target="_blank" rel="noopener" className="mt-3 block text-sm text-white/60 underline">
            Abrir página de pagamento
          </a>
        )}
        <p className="mt-4 text-xs text-white/50">
          Assim que o pagamento cair, seu painel libera sozinho (alguns segundos).
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {planos.map((p) => (
        <button
          key={p.id}
          onClick={() => setPlanoId(p.id)}
          className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
            planoId === p.id ? "border-purple-400 bg-purple-500/20" : "border-white/10 bg-white/5"
          }`}
        >
          <div>
            <div className="font-semibold">{p.label}</div>
            <div className="text-sm text-white/60">{brl(p.equivMes * 100)}/mês</div>
          </div>
          <div className="text-right">
            <div className="font-bold">{brl(p.cents)}</div>
            {p.meses > 1 && <div className="text-xs text-white/50">{p.meses} meses</div>}
          </div>
        </button>
      ))}

      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome ou razão social"
        className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white outline-none focus:border-purple-400"
      />
      <input
        value={cpf}
        onChange={(e) => setCpf(e.target.value)}
        inputMode="numeric"
        placeholder="CPF ou CNPJ"
        className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-white outline-none focus:border-purple-400"
      />

      {erro && <p className="text-sm text-red-300">{erro}</p>}

      <button
        onClick={pagar}
        disabled={carregando || cpf.replace(/\D/g, "").length < 11 || !nome.trim()}
        className="w-full rounded-lg bg-purple-600 py-3 font-semibold transition hover:bg-purple-500 disabled:opacity-50"
      >
        {carregando ? "Gerando PIX…" : "Pagar com PIX"}
      </button>
    </div>
  );
}
