// Documento A4 público (orçamento OU ordem de serviço). White-label: só a marca da loja,
// SEM marca de terceiro (≠ GestãoClick, que assina "emitida no GestãoClick"). Viável de imprimir
// ou "salvar como PDF" pelo navegador. Renderizado na rota pública /doc/[code].
import PrintButton from "./PrintButton";

export type DocA4Item = { kind: "produto" | "servico"; name: string; detail?: string; qty: number; unitCents: number; subtotalCents: number };
export type DocA4Props = {
  kind: "orcamento" | "os";
  title: string;
  code: string;
  dateLabel: string;
  validadeLabel?: string | null;
  statusLabel?: string | null;
  store: { name: string; cnpj?: string; endereco?: string; tel?: string; email?: string; site?: string; responsavel?: string };
  customer: { name: string; cpf?: string | null; phone?: string | null };
  equipamento?: { device?: string; imei?: string | null; condicoes?: string | null; acessorios?: string | null; problem?: string | null; diagnosis?: string | null } | null;
  items: DocA4Item[];
  totals: { produtosCents: number; servicosCents: number; freteCents: number; outrosCents: number; descontoCents: number; totalCents: number };
  observacao?: string | null;
};

const brl = (c: number) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCpf = (s: string) => {
  const d = s.replace(/\D/g, "");
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : d;
};

const CSS = `
  .a4-wrap{background:#e9edf3;min-height:100vh;padding:20px 12px;font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1f2937}
  .a4-bar{max-width:210mm;margin:0 auto 12px;display:flex;gap:10px;justify-content:flex-end}
  .a4{max-width:210mm;margin:0 auto;background:#fff;padding:16mm 15mm;box-shadow:0 8px 30px rgba(0,0,0,.15);font-size:12.5px;line-height:1.5}
  .a4 h1,.a4 h2,.a4 h3{margin:0}
  .a4 .top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #0f172a;padding-bottom:12px}
  .a4 .store .nm{font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-.4px}
  .a4 .store .ln{font-size:11px;color:#64748b;line-height:1.4}
  .a4 .doc{text-align:right;min-width:150px}
  .a4 .doc .t{font-size:13px;font-weight:800;color:#2563eb;letter-spacing:1px;text-transform:uppercase}
  .a4 .doc .cd{font-size:20px;font-weight:800;color:#0f172a}
  .a4 .doc .mt{font-size:11px;color:#64748b}
  .a4 .pill{display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;padding:2px 9px;border-radius:20px;margin-top:5px}
  .a4 .p-ok{background:#dcfce7;color:#15803d}.a4 .p-wait{background:#fef9c3;color:#a16207}.a4 .p-no{background:#fee2e2;color:#b91c1c}
  .a4 .sec{margin-top:16px}
  .a4 .sec .h{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#2563eb;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px}
  .a4 .grid2{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}
  .a4 .kv{font-size:12px}.a4 .kv b{color:#0f172a}
  .a4 .blk{font-size:12px;margin:3px 0}.a4 .blk b{color:#0f172a}
  table.items{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px}
  table.items th{background:#f1f5f9;color:#334155;text-align:left;padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid #cbd5e1}
  table.items td{padding:7px 8px;border-bottom:1px solid #eef2f7;vertical-align:top}
  table.items td.r,table.items th.r{text-align:right;white-space:nowrap}
  table.items .tag{font-size:9px;font-weight:800;text-transform:uppercase;padding:1px 6px;border-radius:4px;background:#eef2ff;color:#4338ca}
  table.items .tag.s{background:#ecfdf5;color:#047857}
  table.items .det{font-size:10.5px;color:#64748b}
  .a4 .tot{margin-top:14px;margin-left:auto;width:280px;font-size:12.5px}
  .a4 .tot .row{display:flex;justify-content:space-between;padding:3px 0}
  .a4 .tot .row.tt{border-top:2px solid #0f172a;margin-top:5px;padding-top:7px;font-size:16px;font-weight:800;color:#0f172a}
  .a4 .note{margin-top:14px;font-size:11px;color:#475569;background:#f8fafc;border-left:3px solid #2563eb;padding:8px 12px;border-radius:0 6px 6px 0}
  .a4 .termo{margin-top:12px;font-size:9.5px;color:#64748b;line-height:1.4;text-align:justify}
  .a4 .sign{display:flex;gap:40px;margin-top:34px}
  .a4 .sign .s{flex:1;text-align:center;font-size:10.5px;color:#475569}
  .a4 .sign .ln{border-top:1px solid #94a3b8;margin-bottom:3px}
  .a4 .foot{margin-top:18px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
  @media print{
    .a4-wrap{background:#fff;padding:0}.no-print{display:none!important}
    .a4{box-shadow:none;max-width:none;padding:0}
    @page{size:A4;margin:14mm}
  }
`;

export default function DocA4(d: DocA4Props) {
  const t = d.totals;
  const statusClass = d.statusLabel === "Aprovado" ? "p-ok" : d.statusLabel === "Recusado" || d.statusLabel === "Expirado" ? "p-no" : "p-wait";
  return (
    <div className="a4-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="a4-bar no-print"><PrintButton /></div>
      <div className="a4">
        <div className="top">
          <div className="store">
            <div className="nm">{d.store.name || "—"}</div>
            {d.store.cnpj ? <div className="ln">{d.store.cnpj.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ"}: {fmtCpf(d.store.cnpj)}</div> : null}
            {d.store.endereco ? <div className="ln">{d.store.endereco}</div> : null}
            {d.store.tel ? <div className="ln">Tel: {d.store.tel}</div> : null}
            {d.store.email ? <div className="ln">{d.store.email}</div> : null}
            {d.store.site ? <div className="ln">{d.store.site}</div> : null}
            {d.store.responsavel ? <div className="ln">Responsável: {d.store.responsavel}</div> : null}
          </div>
          <div className="doc">
            <div className="t">{d.title}</div>
            <div className="cd">Nº {d.code}</div>
            <div className="mt">{d.dateLabel}</div>
            {d.validadeLabel ? <div className="mt">Válido até {d.validadeLabel}</div> : null}
            {d.statusLabel ? <div><span className={`pill ${statusClass}`}>{d.statusLabel}</span></div> : null}
          </div>
        </div>

        <div className="sec">
          <div className="h">Cliente</div>
          <div className="grid2">
            <div className="kv"><b>{d.customer.name || "—"}</b></div>
            {d.customer.cpf ? <div className="kv">CPF/CNPJ: {fmtCpf(d.customer.cpf)}</div> : null}
            {d.customer.phone ? <div className="kv">Telefone: {d.customer.phone}</div> : null}
          </div>
        </div>

        {d.equipamento ? (
          <div className="sec">
            <div className="h">Equipamento</div>
            {d.equipamento.device ? <div className="blk"><b>Aparelho:</b> {d.equipamento.device}{d.equipamento.imei ? ` · Série/IMEI: ${d.equipamento.imei}` : ""}</div> : null}
            {d.equipamento.condicoes ? <div className="blk"><b>Condições na entrada:</b> {d.equipamento.condicoes}</div> : null}
            {d.equipamento.acessorios ? <div className="blk"><b>Acessórios:</b> {d.equipamento.acessorios}</div> : null}
            {d.equipamento.problem ? <div className="blk"><b>Defeito relatado:</b> {d.equipamento.problem}</div> : null}
            {d.equipamento.diagnosis ? <div className="blk"><b>Laudo / solução:</b> {d.equipamento.diagnosis}</div> : null}
          </div>
        ) : null}

        {d.items.length ? (
          <div className="sec">
            <div className="h">Itens</div>
            <table className="items">
              <thead>
                <tr><th>Descrição</th><th className="r">Qtd</th><th className="r">Valor un.</th><th className="r">Subtotal</th></tr>
              </thead>
              <tbody>
                {d.items.map((it, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`tag ${it.kind === "servico" ? "s" : ""}`}>{it.kind === "servico" ? "Serviço" : "Peça"}</span>{" "}
                      {it.name}
                      {it.detail ? <div className="det">{it.detail}</div> : null}
                    </td>
                    <td className="r">{it.qty}</td>
                    <td className="r">{brl(it.unitCents)}</td>
                    <td className="r">{brl(it.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="tot">
          {t.produtosCents > 0 ? <div className="row"><span>Peças</span><span>{brl(t.produtosCents)}</span></div> : null}
          {t.servicosCents > 0 ? <div className="row"><span>Serviços / mão de obra</span><span>{brl(t.servicosCents)}</span></div> : null}
          {t.freteCents > 0 ? <div className="row"><span>Frete</span><span>{brl(t.freteCents)}</span></div> : null}
          {t.outrosCents > 0 ? <div className="row"><span>Outros</span><span>{brl(t.outrosCents)}</span></div> : null}
          {t.descontoCents > 0 ? <div className="row"><span>Desconto</span><span>− {brl(t.descontoCents)}</span></div> : null}
          <div className="row tt"><span>Total</span><span>{brl(t.totalCents)}</span></div>
        </div>

        {d.observacao ? <div className="note">{d.observacao}</div> : null}

        <div className="termo">
          Garantia de 90 dias sobre o serviço executado e peças fornecidas pela loja; não cobre mau uso, quedas ou contato com líquidos.
          {d.kind === "os" ? " Aparelho não retirado em até 90 dias corridos pode ser considerado abandonado (Art. 1.275 do Código Civil)." : d.validadeLabel ? ` Este orçamento é válido até ${d.validadeLabel}.` : ""}
        </div>

        <div className="sign">
          <div className="s"><div className="ln"></div>Assinatura do cliente</div>
          <div className="s"><div className="ln"></div>{d.kind === "os" ? "Assinatura do técnico" : "Responsável"}</div>
        </div>

        <div className="foot">{d.store.name} — documento gerado em {d.dateLabel}</div>
      </div>
    </div>
  );
}
