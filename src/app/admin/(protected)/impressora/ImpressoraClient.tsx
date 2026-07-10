"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";
import { IconPrinter, IconCheck } from "@/components/Icons";
import { qzConnect, qzIsActive, qzListPrinters, qzPrintHtml, qzKickDrawer, getStationPrinter, setStationPrinter } from "@/lib/qz";
import { ticketHtml, stationTicketHtml } from "@/lib/ticket";
import { getPrintWidthMm, setPrintWidthMm, PRINT_WIDTH_PRESETS, widthTestHtml } from "@/lib/print-config";

function caixaTest(loja: string) {
  return ticketHtml({
    loja,
    display: "TESTE",
    dateLabel: new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    modeLabel: "Cupom de teste",
    customerName: "Cliente Teste",
    items: [
      { qty: 2, name: "Item de teste", totalCents: 1000 },
      { qty: 1, name: "Produto exemplo", totalCents: 800 },
    ],
    totalCents: 1800,
    origem: "balcao",
  });
}

function stationTest(station: string) {
  return stationTicketHtml({
    station,
    tableLabel: "Mesa 7",
    dateLabel: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    orderId: 0,
    items:
      station === "bar"
        ? [{ qty: 2, name: "Cerveja", sizeLabel: "600ml" }, { qty: 1, name: "Caipirinha", sizeLabel: "dose" }]
        : [{ qty: 1, name: "Batata frita", sizeLabel: "500g" }, { qty: 1, name: "Frango a passarinho", sizeLabel: "500g" }],
    note: "cupom de teste da estação",
  });
}

function PrinterPicker({
  destKey,
  label,
  hint,
  printers,
  makeTest,
  onMsg,
}: {
  destKey: string;
  label: string;
  hint: string;
  printers: string[];
  makeTest: () => string;
  onMsg: (m: string | null) => void;
}) {
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSel(getStationPrinter(destKey) ?? ""); }, [destKey]);

  function save(name: string) {
    setSel(name);
    setStationPrinter(destKey, name);
    onMsg(name ? `Impressora salva (${label}): ${name}` : null);
  }
  async function test() {
    if (!sel) { onMsg("Escolha a impressora primeiro."); return; }
    setBusy(true);
    onMsg(null);
    try {
      await qzPrintHtml(sel, makeTest());
      onMsg(`Cupom de teste enviado pra "${label}". Confira o papel.`);
    } catch (e) {
      onMsg("Falha ao imprimir: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</h3>
      <p className="mb-3 mt-0.5 text-xs text-[var(--text-faded)]">{hint}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={sel}
          onChange={(e) => save(e.target.value)}
          className="flex-1 rounded-xl border border-line bg-bg-elevated px-4 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-600"
        >
          <option value="">{printers.length ? "Escolha a impressora…" : "Conecte o QZ pra listar"}</option>
          {printers.map((p) => <option key={p} value={p}>{p}</option>)}
          {sel && !printers.includes(sel) && <option value={sel}>{sel} (salva)</option>}
        </select>
        <button onClick={test} disabled={busy || !sel} className="rounded-xl border-2 border-brand-600 px-5 py-2.5 text-sm font-bold text-brand-600 disabled:opacity-40">
          Imprimir teste
        </button>
      </div>
      {sel && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--green-ok)]">
          <IconCheck width={14} height={14} /> {sel}
        </p>
      )}
    </Card>
  );
}

export default function ImpressoraClient({ storeName, stations }: { storeName: string; stations: string[] }) {
  const [active, setActive] = useState<boolean | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // auto-imprimir cupom ao finalizar venda (balcão/mesa) — POR-MÁQUINA, default ligado
  const [printOnSale, setPrintOnSale] = useState(true);
  // imprimir 2 vias (cliente + loja) — POR-MÁQUINA, default ligado
  const [duasVias, setDuasVias] = useState(true);
  // abrir gaveta de dinheiro ao finalizar venda em dinheiro — POR-MÁQUINA, default DESLIGADO (opt-in: só quem tem gaveta)
  const [drawerAuto, setDrawerAuto] = useState(false);
  // imprimir via de preparo (cozinha/bar) no balcão ao finalizar — POR-MÁQUINA, default DESLIGADO (só relacional com estação)
  const [prepAuto, setPrepAuto] = useState(false);
  // imprimir comprovante de sangria/suprimento — POR-MÁQUINA, default LIGADO (rastro físico assinável)
  const [movComp, setMovComp] = useState(true);
  // largura do cupom (mm) — CALIBRÁVEL por máquina; o sistema imprime nesta largura (se adapta à impressora)
  const [widthMm, setWidthMm] = useState(72);

  useEffect(() => { qzIsActive().then(setActive); }, []);
  useEffect(() => { setPrintOnSale(localStorage.getItem("autoprint:venda") !== "0"); }, []);
  useEffect(() => { setDuasVias(localStorage.getItem("print:duasvias") !== "0"); }, []);
  useEffect(() => { setDrawerAuto(localStorage.getItem("drawer:auto") === "1"); }, []);
  useEffect(() => { setPrepAuto(localStorage.getItem("autoprint:preparo") === "1"); }, []);
  useEffect(() => { setMovComp(localStorage.getItem("mov:comprovante") !== "0"); }, []);
  useEffect(() => { setWidthMm(getPrintWidthMm()); }, []);

  function changeWidth(mm: number) {
    const v = Math.max(40, Math.min(80, Math.round(mm || 0)));
    setWidthMm(v);
    setPrintWidthMm(v);
  }
  async function testWidth() {
    const printer = getStationPrinter("caixa");
    if (!printer) { setMsg("Escolha a impressora do caixa (logo abaixo) antes de imprimir a régua."); return; }
    setMsg(null);
    try {
      await qzPrintHtml(printer, widthTestHtml());
      setMsg(`Régua de teste enviada (${widthMm}mm). Veja se a borda direita saiu inteira — se cortou, diminua a largura.`);
    } catch (e) {
      setMsg("Falha ao imprimir: " + (e instanceof Error ? e.message : "erro") + ". Conecte o QZ Tray primeiro.");
    }
  }
  const togglePrintOnSale = () => setPrintOnSale((v) => { const n = !v; localStorage.setItem("autoprint:venda", n ? "1" : "0"); return n; });
  const toggleDuasVias = () => setDuasVias((v) => { const n = !v; localStorage.setItem("print:duasvias", n ? "1" : "0"); return n; });
  const toggleDrawer = () => setDrawerAuto((v) => { const n = !v; localStorage.setItem("drawer:auto", n ? "1" : "0"); return n; });
  const togglePrep = () => setPrepAuto((v) => { const n = !v; localStorage.setItem("autoprint:preparo", n ? "1" : "0"); return n; });
  const toggleMovComp = () => setMovComp((v) => { const n = !v; localStorage.setItem("mov:comprovante", n ? "1" : "0"); return n; });

  // dispara o pulso da gaveta isolado (sem fazer venda) — pra testar o hardware
  async function testDrawer() {
    const printer = getStationPrinter("caixa");
    if (!printer) { setMsg("Escolha a impressora do caixa (logo abaixo) antes de testar a gaveta."); return; }
    setMsg(null);
    try {
      await qzKickDrawer(printer);
      setMsg("Pulso enviado pra gaveta. Se ela não abriu: confira o cabo RJ11 atrás da impressora e se o QZ Tray está conectado.");
    } catch (e) {
      setMsg("Falha ao abrir a gaveta: " + (e instanceof Error ? e.message : "erro") + ". Conecte o QZ Tray primeiro (botão acima).");
    }
  }

  async function connect() {
    setBusy(true);
    setMsg(null);
    try {
      // a 1ª conexão do QZ às vezes demora (cold start do websocket) — corta em 8s com aviso
      // claro em vez de deixar o botão travado em "..." sem feedback (achado do teste na DELL).
      await Promise.race([
        qzConnect(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
      ]);
      setActive(true);
      setPrinters(await qzListPrinters());
      setMsg("QZ Tray conectado — escolha as impressoras abaixo.");
    } catch (e) {
      setActive(false);
      setMsg(
        e instanceof Error && e.message === "timeout"
          ? "O QZ Tray demorou a responder. Confirme que o app QZ Tray está aberto e clique em Conectar de novo (a 1ª conexão às vezes demora)."
          : "Não encontrei o QZ Tray rodando. Abra o app QZ Tray e clique em Conectar de novo.",
      );
    } finally {
      setBusy(false);
    }
  }

  const destinos = [
    { key: "caixa", label: "Caixa · cupom de venda", hint: "Cupom da venda de balcão e dos pedidos do link (com preço e total)." },
    ...stations.map((st) => ({
      key: st,
      label: `Estação · ${st}`,
      hint: `Via de preparo da ${st} — sai aqui quando um pedido da mesa cai nesta estação (sem preço).`,
    })),
  ];

  return (
    <div className="max-w-2xl space-y-4">
      {/* Status do QZ */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl ${active ? "brand-gradient text-white" : "bg-bg-surface-2 text-[var(--text-muted)]"}`}>
              <IconPrinter width={22} height={22} />
            </span>
            <div>
              <div className="font-extrabold text-ink">{active ? "QZ Tray conectado" : "QZ Tray não conectado"}</div>
              <div className="text-xs text-[var(--text-muted)]">{active ? "pronto pra imprimir silencioso" : "necessário pra impressão automática"}</div>
            </div>
          </div>
          <button onClick={connect} disabled={busy} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-60">
            {busy ? "..." : active ? "Atualizar lista" : "Conectar"}
          </button>
        </div>
        {active === false && (
          <div className="mt-3 space-y-3 rounded-xl bg-bg-surface-2 p-3.5">
            <p className="text-sm font-bold text-ink">Ative a impressão neste computador (só 1 vez)</p>
            <a href="/ComandaPRO-Impressao.bat" download className="inline-flex items-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]">
              <IconPrinter width={16} height={16} /> Baixar instalador
            </a>
            <ol className="space-y-1.5 text-sm text-[var(--text-secondary)]">
              <li><b className="text-ink">1.</b> Baixe o arquivo <b className="text-ink">ComandaPRO-Impressao</b> (não precisa extrair nada).</li>
              <li><b className="text-ink">2.</b> <b className="text-ink">Duplo-clique</b> nele → o Windows pede permissão → clique <b className="text-ink">Sim</b> → aguarde ~1 min.</li>
              <li><b className="text-ink">3.</b> Volte aqui e clique <b className="text-ink">Conectar</b>. Pronto — imprime sem aquele aviso de permissão.</li>
            </ol>
            <p className="text-xs text-[var(--text-faded)]">Se o Windows avisar que o arquivo pode ser perigoso, clique em <b>Mais informações → Executar assim mesmo</b> — é o nosso instalador, é seguro. Ele coloca tudo sozinho (o app de impressão + o certificado).</p>
          </div>
        )}
        {active && (
          <p className="mt-3 text-xs text-[var(--text-faded)]">
            Configurar em outro computador?{" "}
            <a href="/ComandaPRO-Impressao.bat" download className="font-bold text-brand-600 underline">Baixar instalador</a>
          </p>
        )}
      </Card>

      {/* Auto-imprimir cupom ao finalizar venda (por-máquina) — desligue numa máquina sem impressora */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-ink">Imprimir cupom ao finalizar venda</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">Vale pro balcão e fechamento de mesa, neste aparelho. Desligue numa máquina sem impressora.</div>
          </div>
          <button
            onClick={togglePrintOnSale}
            role="switch"
            aria-checked={printOnSale}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${printOnSale ? "brand-gradient" : "bg-bg-surface-2"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${printOnSale ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <div>
            <div className="font-bold text-ink">Imprimir 2 vias (cliente + loja)</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">Sai uma via pro cliente e uma pra loja, cada uma rotulada. Vale pra venda, mesa e delivery.</div>
          </div>
          <button
            onClick={toggleDuasVias}
            role="switch"
            aria-checked={duasVias}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${duasVias ? "brand-gradient" : "bg-bg-surface-2"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${duasVias ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-ink">Abrir gaveta ao finalizar (dinheiro)</div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">A gaveta liga na impressora térmica (cabo RJ11). Abre sozinha na venda em dinheiro. Ligue só se tiver gaveta.</div>
            </div>
            <button
              onClick={toggleDrawer}
              role="switch"
              aria-checked={drawerAuto}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${drawerAuto ? "brand-gradient" : "bg-bg-surface-2"}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${drawerAuto ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <button onClick={testDrawer} className="mt-2 rounded-lg border-2 border-brand-600 px-4 py-2 text-xs font-bold text-brand-600">
            Testar gaveta agora
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <div>
            <div className="font-bold text-ink">Via de preparo no balcão (cozinha/bar)</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">Na venda de balcão, manda a via de preparo pra impressora de cada estação (sem preço), igual às mesas. Sai só nas estações que têm impressora configurada abaixo.</div>
          </div>
          <button
            onClick={togglePrep}
            role="switch"
            aria-checked={prepAuto}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${prepAuto ? "brand-gradient" : "bg-bg-surface-2"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${prepAuto ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      </Card>

      {/* Comprovante de sangria/suprimento (por-máquina) */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-ink">Comprovante de sangria/suprimento</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">Ao registrar uma retirada (sangria) ou reforço (suprimento), imprime um comprovante com valor, operador, motivo e saldo. A sangria sai com linha de assinatura.</div>
          </div>
          <button
            onClick={toggleMovComp}
            role="switch"
            aria-checked={movComp}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${movComp ? "brand-gradient" : "bg-bg-surface-2"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${movComp ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      </Card>

      {/* Uma impressora por destino (caixa + estações). Cada aparelho salva a SUA no navegador. */}
      {destinos.map((d) => (
        <PrinterPicker key={d.key} destKey={d.key} label={d.label} hint={d.hint} printers={printers} makeTest={() => (d.key === "caixa" ? caixaTest(storeName) : stationTest(d.key))} onMsg={setMsg} />
      ))}

      {/* Largura do cupom — CALIBRÁVEL: o sistema se adapta à impressora, não o contrário */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Largura do cupom (calibrar)</h3>
        <p className="mb-3 mt-0.5 text-xs text-[var(--text-faded)]">
          Se o cupom corta na direita (ou sobra muito espaço em branco), ajuste a largura até ficar certo. O sistema imprime exatamente nesta largura — você não precisa reconfigurar a impressora.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {PRINT_WIDTH_PRESETS.map((p) => (
            <button key={p} onClick={() => changeWidth(p)} className={`rounded-xl border-2 px-4 py-2 text-sm font-bold transition ${widthMm === p ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>{p}mm</button>
          ))}
          <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-bg-elevated px-3 py-1.5">
            <input type="number" min={40} max={80} value={widthMm} onChange={(e) => changeWidth(+e.target.value)} className="w-14 bg-transparent text-right text-sm font-bold text-ink outline-none" />
            <span className="text-sm font-semibold text-[var(--text-muted)]">mm</span>
          </div>
        </div>
        <button onClick={testWidth} className="rounded-xl border-2 border-brand-600 px-5 py-2.5 text-sm font-bold text-brand-600">
          Imprimir régua de teste
        </button>
      </Card>

      {stations.length > 0 && (
        <p className="rounded-xl bg-bg-surface-2 p-3 text-xs text-[var(--text-muted)]">
          Dica: configure a impressora da <b>cozinha</b> no computador da cozinha e a do <b>bar</b> no balcão. A escolha fica salva por aparelho — assim cada via sai no lugar certo automaticamente quando o KDS está com a impressão automática ligada.
        </p>
      )}

      {msg && <div className="rounded-xl border border-line bg-bg-elevated p-3.5 text-sm font-medium text-ink">{msg}</div>}
    </div>
  );
}
