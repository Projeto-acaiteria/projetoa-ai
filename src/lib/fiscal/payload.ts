// Montadores do JSON de emissão da Focus NFe, a partir dos NOSSOS dados
// (store.fiscal = emitente · produto ncm/cfop/cest/origem = itens · cliente = destinatário).
//
// ⚠ PONTO DE PARTIDA, não a verdade final: os campos de SITUAÇÃO TRIBUTÁRIA (CSOSN/CST, PIS, COFINS)
// dependem do REGIME do Junior — a confirmar na reunião com o contador. Default aqui = Simples Nacional
// (CSOSN 102). Trocar em produção conforme o regime real. A estrutura e os campos de item/valor estão certos.
import type { StoreSettings } from "@/lib/settings-store";

// valor em centavos → string decimal que a Focus espera ("1234" → "12.34")
const reais = (cents: number) => (Math.max(0, Math.round(cents)) / 100).toFixed(2);

export type FiscalItem = {
  descricao: string;
  qty: number;
  unitCents: number;
  codigo?: string; // SKU interno
  ncm?: string; cfop?: string; cest?: string; origem?: string; // dados fiscais do produto
  unidade?: string; // un, pc...
};
export type FiscalDestinatario = {
  nome?: string;
  cpf?: string; // só dígitos
  cnpj?: string; // só dígitos
  // endereço (obrigatório em NF-e a CNPJ; opcional em NFC-e consumidor)
  logradouro?: string; numero?: string; bairro?: string; municipio?: string; uf?: string; cep?: string; codMunicipio?: string;
} | null;

// CSOSN (Simples) ou CST (regime normal) por item, conforme o regime da loja.
function tributacaoItem(regime: StoreSettings["fiscal"]["regime"], origem: string) {
  const org = /^[0-8]$/.test(origem) ? origem : "0";
  if (regime === "presumido" || regime === "real") {
    return { icms_origem: org, icms_situacao_tributaria: "00", icms_aliquota: "0.00", icms_base_calculo: "0.00", icms_valor: "0.00" };
  }
  // Simples Nacional (default): CSOSN 102 (sem permissão de crédito)
  return { icms_origem: org, icms_csosn: "102" };
}

function mapItens(itens: FiscalItem[], regime: StoreSettings["fiscal"]["regime"]) {
  return itens.map((it, i) => {
    const bruto = it.qty * it.unitCents;
    return {
      numero_item: i + 1,
      codigo_produto: it.codigo || String(i + 1),
      descricao: it.descricao.slice(0, 120),
      cfop: (it.cfop || "5102").replace(/\D+/g, "").slice(0, 4), // 5102 = venda de mercadoria (padrão)
      codigo_ncm: (it.ncm || "").replace(/\D+/g, "").slice(0, 8),
      ...(it.cest ? { cest: it.cest.replace(/\D+/g, "").slice(0, 7) } : {}),
      unidade_comercial: it.unidade || "UN",
      quantidade_comercial: String(it.qty),
      valor_unitario_comercial: reais(it.unitCents),
      unidade_tributavel: it.unidade || "UN",
      quantidade_tributavel: String(it.qty),
      valor_unitario_tributavel: reais(it.unitCents),
      valor_bruto: reais(bruto),
      ...tributacaoItem(regime, it.origem || "0"),
      // PIS/COFINS: no Simples normalmente CST "49"/"99" — CONFIRMAR com o contador na reunião.
      pis_situacao_tributaria: "49",
      cofins_situacao_tributaria: "49",
    };
  });
}

function emitente(store: StoreSettings) {
  const f = store.fiscal;
  return {
    cnpj_emitente: (store.cnpj || "").replace(/\D+/g, ""),
    nome_emitente: f.razaoSocial || store.name,
    nome_fantasia_emitente: store.name,
    inscricao_estadual_emitente: f.inscricaoEstadual || undefined,
    logradouro_emitente: f.logradouro || undefined,
    numero_emitente: f.numero || undefined,
    bairro_emitente: f.bairro || undefined,
    municipio_emitente: f.municipio || undefined,
    uf_emitente: f.uf || undefined,
    cep_emitente: f.cep || undefined,
    codigo_municipio_emitente: f.codMunicipio || undefined,
  };
}

function destinatario(dest: FiscalDestinatario) {
  if (!dest) return {};
  const d: Record<string, unknown> = {};
  if (dest.nome) d.nome_destinatario = dest.nome.slice(0, 60);
  if (dest.cnpj) d.cnpj_destinatario = dest.cnpj.replace(/\D+/g, "");
  else if (dest.cpf) d.cpf_destinatario = dest.cpf.replace(/\D+/g, "");
  if (dest.logradouro) d.logradouro_destinatario = dest.logradouro;
  if (dest.numero) d.numero_destinatario = dest.numero;
  if (dest.bairro) d.bairro_destinatario = dest.bairro;
  if (dest.municipio) d.municipio_destinatario = dest.municipio;
  if (dest.uf) d.uf_destinatario = dest.uf;
  if (dest.cep) d.cep_destinatario = dest.cep.replace(/\D+/g, "");
  if (dest.codMunicipio) d.codigo_municipio_destinatario = dest.codMunicipio;
  return d;
}

// NFC-e (cupom fiscal ao consumidor no balcão) — venda de peça/produto. Autorização síncrona.
export function buildNFCePayload(store: StoreSettings, itens: FiscalItem[], opts: { dataEmissaoIso: string; formaPagamento?: string; totalCents: number; dest?: FiscalDestinatario }) {
  return {
    ...emitente(store),
    natureza_operacao: "Venda de mercadoria",
    data_emissao: opts.dataEmissaoIso,
    presenca_comprador: "1", // operação presencial
    modalidade_frete: "9", // sem frete
    local_destino: "1", // operação interna
    ...destinatario(opts.dest ?? null),
    items: mapItens(itens, store.fiscal.regime),
    formas_pagamento: [{ forma_pagamento: opts.formaPagamento || "01", valor_pagamento: reais(opts.totalCents) }], // 01=dinheiro
  };
}

// NF-e (modelo 55) — venda a CNPJ ou nota de serviço+peça. Autorização assíncrona (consultar depois).
export function buildNFePayload(store: StoreSettings, itens: FiscalItem[], opts: { dataEmissaoIso: string; dest: FiscalDestinatario; naturezaOperacao?: string }) {
  return {
    ...emitente(store),
    natureza_operacao: opts.naturezaOperacao || "Venda",
    data_emissao: opts.dataEmissaoIso,
    tipo_documento: "1", // 1 = saída
    finalidade_emissao: "1", // 1 = normal
    local_destino: "1",
    modalidade_frete: "9",
    ...destinatario(opts.dest),
    items: mapItens(itens, store.fiscal.regime),
  };
}
