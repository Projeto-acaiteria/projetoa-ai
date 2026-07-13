// Documento A4 público (orçamento OU ordem de serviço). Modelo ENQUADRADO (boxes/bordas) no estilo
// do GestãoClick — cabeçalho em quadro, barras de seção, grade de dados com bordas, assinaturas em box.
// White-label: só a marca da loja, SEM marca de terceiro. Imprime / "salvar PDF" pelo navegador.
import PrintButton from "./PrintButton";

export type DocA4Item = { kind: "produto" | "servico"; name: string; detail?: string; qty: number; unitCents: number; subtotalCents: number };
export type DocA4Props = {
  kind: "orcamento" | "os";
  title: string;
  code: string;
  dateLabel: string;
  validadeLabel?: string | null;
  statusLabel?: string | null;
  store: { name: string; logoUrl?: string; cnpj?: string; endereco?: string; tel?: string; email?: string; site?: string; responsavel?: string; garantiaTermos?: string; avisos?: string };
  customer: { name: string; cpf?: string | null; phone?: string | null };
  equipamento?: { device?: string; marca?: string | null; modelo?: string | null; imei?: string | null; condicoes?: string | null; acessorios?: string | null; problem?: string | null; diagnosis?: string | null } | null;
  items: DocA4Item[];
  totals: { produtosCents: number; servicosCents: number; freteCents: number; outrosCents: number; descontoCents: number; totalCents: number };
  observacao?: string | null;
};

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPhone = (s: string) => {
  const d = (s || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s;
};
const fmtDoc = (s: string) => {
  const d = (s || "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
};

const CSS = `
  .wrap{background:#e9edf3;min-height:100vh;padding:20px 12px;font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#111827}
  .bar-top{max-width:210mm;margin:0 auto 12px;display:flex;gap:10px;justify-content:flex-end}
  .a4{max-width:210mm;margin:0 auto;background:#fff;padding:14mm 13mm;box-shadow:0 8px 30px rgba(0,0,0,.15);font-size:12px;line-height:1.45}
  .a4 *{box-sizing:border-box}
  /* cabeçalho em quadro */
  .hdr{display:flex;justify-content:space-between;gap:16px;border:1.5px solid #334155;padding:12px 14px}
  .hdr .left{display:flex;align-items:center;gap:14px}
  .hdr .logo{height:56px;width:auto;max-width:140px;object-fit:contain}
  .hdr .nm{font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-.4px;margin-bottom:2px}
  .hdr .ln{font-size:10.5px;color:#475569;line-height:1.4}
  .hdr .r{text-align:right}
  /* barra de seção (cinza) */
  .bar{background:#e2e8f0;border:1px solid #334155;border-bottom:none;font-weight:800;font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;color:#1e293b;padding:5px 10px;margin-top:12px;display:flex;justify-content:space-between;align-items:center}
  .bar.solo{border-bottom:1px solid #334155}
  .bar .st{font-size:10px;font-weight:800;padding:1px 8px;border-radius:3px;border:1px solid}
  .st-ok{background:#dcfce7;color:#15803d;border-color:#86efac}.st-wait{background:#fef9c3;color:#a16207;border-color:#fde047}.st-no{background:#fee2e2;color:#b91c1c;border-color:#fca5a5}
  /* grade de campos com bordas (dados do cliente / equipamento) */
  table.fields{width:100%;border-collapse:collapse;table-layout:fixed}
  table.fields td{border:1px solid #334155;border-top:none;padding:5px 9px;font-size:11.5px;vertical-align:top;word-break:break-word}
  table.fields td.lb{background:#f1f5f9;font-weight:700;color:#334155;white-space:nowrap;width:120px}
  /* itens */
  table.items{width:100%;border-collapse:collapse;margin-top:0}
  table.items th,table.items td{border:1px solid #334155;padding:6px 8px;font-size:11.5px}
  table.items th{border-top:none;background:#f1f5f9;color:#334155;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px}
  table.items td.r,table.items th.r{text-align:right;white-space:nowrap}
  table.items .tag{font-size:9px;font-weight:800;text-transform:uppercase;padding:1px 5px;border-radius:3px;background:#e0e7ff;color:#3730a3;margin-right:4px}
  table.items .tag.s{background:#dcfce7;color:#166534}
  table.items .det{font-size:10px;color:#64748b;margin-top:2px}
  /* totais em quadro à direita */
  .tot{width:300px;margin:10px 0 0 auto;border:1px solid #334155;border-top:none}
  .tot .row{display:flex;justify-content:space-between;padding:4px 10px;font-size:11.5px;border-top:1px solid #cbd5e1}
  .tot .row.tt{border-top:1.5px solid #334155;background:#f1f5f9;font-size:14px;font-weight:800;color:#0f172a}
  /* caixas de texto (garantia/observações) */
  .box{border:1px solid #334155;border-top:none;padding:8px 11px;font-size:10px;color:#334155;line-height:1.45}
  .box p{margin:2px 0}
  .note{border:1px solid #334155;border-top:none;padding:7px 11px;font-size:11px;color:#1e293b;background:#f8fafc}
  /* assinaturas em quadro */
  .sign{display:flex;border:1px solid #334155;border-top:none;margin-top:0}
  .sign .s{flex:1;text-align:center;font-size:10px;color:#475569;padding:26px 10px 8px}
  .sign .s:first-child{border-right:1px solid #334155}
  .sign .ln{border-top:1px solid #334155;margin:0 8mm 3px}
  .foot{margin-top:12px;text-align:center;font-size:9.5px;color:#94a3b8}
  /* o app tem um @media print global que esconde tudo (body *) menos os cupons 80mm;
     este seletor de classe (maior especificidade) reexibe o documento A4. */
  @media print{
    .wrap,.wrap *{visibility:visible!important}
    .wrap{background:#fff;padding:0;position:absolute;left:0;top:0;width:100%}
    .no-print{display:none!important}
    .a4{box-shadow:none;max-width:none;padding:0}
    @page{size:A4;margin:12mm}
  }
`;

export default function DocA4(d: DocA4Props) {
  const t = d.totals;
  const stClass = d.statusLabel === "Aprovado" ? "st-ok" : d.statusLabel === "Recusado" || d.statusLabel === "Expirado" ? "st-no" : "st-wait";
  const eq = d.equipamento;
  const garantiaLines = (d.store.garantiaTermos || "").split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div className="wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="bar-top no-print"><PrintButton /></div>
      <div className="a4">
        {/* CABEÇALHO EM QUADRO */}
        <div className="hdr">
          <div className="left">
            {d.store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="logo" src={d.store.logoUrl} alt={d.store.name} />
            ) : null}
            <div>
              <div className="nm">{d.store.name || "—"}</div>
              {d.store.cnpj ? <div className="ln">{d.store.cnpj.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ"}: {fmtDoc(d.store.cnpj)}</div> : null}
              {d.store.endereco ? <div className="ln">{d.store.endereco}</div> : null}
            </div>
          </div>
          <div className="r">
            {d.store.tel ? <div className="ln">Tel: {fmtPhone(d.store.tel)}</div> : null}
            {d.store.email ? <div className="ln">{d.store.email}</div> : null}
            {d.store.site ? <div className="ln">{d.store.site}</div> : null}
            {d.store.responsavel ? <div className="ln">Responsável: {d.store.responsavel}</div> : null}
          </div>
        </div>

        {/* BARRA-TÍTULO */}
        <div className="bar solo" style={{ marginTop: 0, borderTop: "none", fontSize: "12px" }}>
          <span>{d.title} Nº {d.code}</span>
          <span style={{ display: "flex", gap: "12px", alignItems: "center", textTransform: "none", letterSpacing: 0 }}>
            <span style={{ fontWeight: 700 }}>{d.dateLabel}</span>
            {d.validadeLabel ? <span style={{ fontWeight: 400 }}>Válido até {d.validadeLabel}</span> : null}
            {d.statusLabel ? <span className={`st ${stClass}`}>{d.statusLabel}</span> : null}
          </span>
        </div>

        {/* DADOS DO CLIENTE */}
        <div className="bar">Dados do cliente</div>
        <table className="fields">
          <tbody>
            <tr>
              <td className="lb">Cliente</td><td>{d.customer.name || "—"}</td>
              <td className="lb">CNPJ/CPF</td><td>{d.customer.cpf ? fmtDoc(d.customer.cpf) : "—"}</td>
            </tr>
            <tr>
              <td className="lb">Telefone</td><td>{d.customer.phone ? fmtPhone(d.customer.phone) : "—"}</td>
              <td className="lb">Data</td><td>{d.dateLabel}</td>
            </tr>
          </tbody>
        </table>

        {/* EQUIPAMENTO (OS) */}
        {eq ? (
          <>
            <div className="bar">Equipamento</div>
            <table className="fields">
              <tbody>
                <tr>
                  <td className="lb">Aparelho</td><td>{eq.device || "—"}</td>
                  <td className="lb">Série / IMEI</td><td>{eq.imei || "—"}</td>
                </tr>
                {(eq.marca || eq.modelo) ? <tr><td className="lb">Marca / modelo</td><td colSpan={3}>{[eq.marca, eq.modelo].filter(Boolean).join(" · ")}</td></tr> : null}
                {eq.condicoes ? <tr><td className="lb">Condições na entrada</td><td colSpan={3}>{eq.condicoes}</td></tr> : null}
                {eq.acessorios ? <tr><td className="lb">Acessórios</td><td colSpan={3}>{eq.acessorios}</td></tr> : null}
                {eq.problem ? <tr><td className="lb">Defeito relatado</td><td colSpan={3}>{eq.problem}</td></tr> : null}
                {eq.diagnosis ? <tr><td className="lb">Laudo / solução</td><td colSpan={3}>{eq.diagnosis}</td></tr> : null}
              </tbody>
            </table>
          </>
        ) : null}

        {/* ITENS */}
        {d.items.length ? (
          <>
            <div className="bar">Itens</div>
            <table className="items">
              <thead>
                <tr><th>Descrição</th><th className="r" style={{ width: 50 }}>Qtd</th><th className="r" style={{ width: 110 }}>Valor un.</th><th className="r" style={{ width: 120 }}>Subtotal</th></tr>
              </thead>
              <tbody>
                {d.items.map((it, i) => (
                  <tr key={i}>
                    <td><span className={`tag ${it.kind === "servico" ? "s" : ""}`}>{it.kind === "servico" ? "Serviço" : "Peça"}</span>{it.name}{it.detail ? <div className="det">{it.detail}</div> : null}</td>
                    <td className="r">{it.qty}</td>
                    <td className="r">{brl(it.unitCents)}</td>
                    <td className="r">{brl(it.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {/* TOTAIS EM QUADRO */}
        <div className="tot">
          {t.produtosCents > 0 ? <div className="row"><span>Peças</span><span>{brl(t.produtosCents)}</span></div> : null}
          {t.servicosCents > 0 ? <div className="row"><span>Serviços / mão de obra</span><span>{brl(t.servicosCents)}</span></div> : null}
          {t.freteCents > 0 ? <div className="row"><span>Frete</span><span>{brl(t.freteCents)}</span></div> : null}
          {t.outrosCents > 0 ? <div className="row"><span>Outros</span><span>{brl(t.outrosCents)}</span></div> : null}
          {t.descontoCents > 0 ? <div className="row"><span>Desconto</span><span>− {brl(t.descontoCents)}</span></div> : null}
          <div className="row tt"><span>Total</span><span>{brl(t.totalCents)}</span></div>
        </div>

        {d.observacao ? <><div className="bar">{d.kind === "orcamento" ? "Observações do orçamento" : "Observações"}</div><div className="note">{d.observacao}</div></> : null}

        {/* TERMOS DE GARANTIA */}
        {garantiaLines.length ? (
          <>
            <div className="bar">Termos de garantia</div>
            <div className="box">
              {garantiaLines.map((l, i) => <p key={i}>{l}</p>)}
              {d.kind === "orcamento" && d.validadeLabel ? <p>Este orçamento é válido até {d.validadeLabel}.</p> : null}
            </div>
          </>
        ) : null}

        {/* OBSERVAÇÕES / AVISOS (só OS) */}
        {d.kind === "os" && d.store.avisos ? (
          <>
            <div className="bar">Avisos importantes</div>
            <div className="box">{d.store.avisos}</div>
          </>
        ) : null}

        {/* ASSINATURAS EM QUADRO */}
        <div className="bar" style={{ borderBottom: "none" }}>Assinaturas</div>
        <div className="sign">
          <div className="s"><div className="ln"></div>Assinatura do cliente</div>
          <div className="s"><div className="ln"></div>{d.kind === "os" ? "Assinatura do técnico" : "Responsável"}</div>
        </div>

        <div className="foot">{d.store.name} — documento gerado em {d.dateLabel}</div>
      </div>
    </div>
  );
}
