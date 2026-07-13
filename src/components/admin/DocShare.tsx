"use client";

// Compartilha o documento A4 (OS ou orçamento): link pro /doc/[code] + envio por WhatsApp.
export default function DocShare({ code, name, phone, storeName, kind = "os" }: { code: string; name: string; phone?: string | null; storeName?: string; kind?: "os" | "orcamento" }) {
  function whats() {
    const url = `${window.location.origin}/doc/${code}`;
    const loja = storeName?.trim() || "nossa loja";
    const primeiroNome = (name || "").trim().split(" ")[0] || "tudo bem";
    const linhas =
      kind === "orcamento"
        ? [
            `Olá, ${primeiroNome}! Aqui é da ${loja}.`,
            `Segue o seu orçamento nº ${code}. Qualquer dúvida, estamos à disposição. 🙂`,
            ``,
            `Para ver os detalhes e aprovar, é só acessar:`,
            url,
          ]
        : [
            `Olá, ${primeiroNome}! Aqui é da ${loja}.`,
            `Segue a sua ordem de serviço nº ${code}. Qualquer dúvida, estamos à disposição. 🙂`,
            ``,
            `Para acompanhar, é só acessar:`,
            url,
          ];
    const msg = linhas.join("\n");
    const d = (phone || "").replace(/\D/g, "");
    window.open(d ? `https://wa.me/55${d}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/doc/${code}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink">Ver documento (A4)</a>
      <button onClick={whats} className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">Enviar por WhatsApp</button>
    </div>
  );
}
