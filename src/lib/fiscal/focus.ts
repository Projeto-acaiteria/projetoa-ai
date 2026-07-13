// Cliente da API Focus NFe (v2). Emite via REST: nosso sistema monta o JSON e faz POST; a Focus
// assina com o certificado A1 (que o Junior sobe LÁ) e transmite pra SEFAZ. A gente nunca encosta
// no certificado nem na SEFAZ direto.
//
// PRÉ-PRONTO: toda a fiação está aqui. Falta só (depois da reunião com o Junior):
//   1. o TOKEN da Focus (colado em Ajustes → Integração fiscal)
//   2. o certificado A1 + IE (o Junior sobe o certificado no painel da Focus)
//   3. confirmar o regime tributário (fecha os campos de imposto no payload)
// Sem token/ligado, NADA é emitido — retorna { status: "nao_configurado" } (nunca finge autorização).
import { getFiscalIntegracao, type FiscalIntegracao } from "@/lib/settings-store";

// URLs base da Focus por ambiente (padrão documentado da Focus NFe v2).
const BASE = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao: "https://api.focusnfe.com.br",
} as const;

export type FocusResult = {
  ok: boolean;
  status: string; // "autorizado" | "processando_autorizacao" | "erro_autorizacao" | "nao_configurado" | "erro_conexao" | ...
  httpStatus?: number;
  message?: string; // mensagem legível (mensagem_sefaz / erros)
  ref?: string;
  numero?: string;
  serie?: string;
  chave?: string; // chave de acesso (44 díg)
  caminhoDanfe?: string; // path relativo do DANFE/PDF na Focus
  caminhoXml?: string;
  raw?: unknown; // corpo bruto da resposta (debug)
};

const authHeader = (token: string) => "Basic " + Buffer.from(token + ":").toString("base64");

/** Escolhe token+URL do ambiente ativo. Retorna null (com motivo) se não dá pra emitir ainda. */
function resolve(cfg: FiscalIntegracao): { base: string; token: string } | { erro: FocusResult } {
  if (!cfg.ligado) return { erro: { ok: false, status: "nao_configurado", message: "Integração fiscal desligada. Ative em Ajustes → Integração fiscal." } };
  const token = cfg.ambiente === "producao" ? cfg.tokenProducao : cfg.tokenHomologacao;
  if (!token) return { erro: { ok: false, status: "nao_configurado", message: `Sem token de ${cfg.ambiente}. Cole o token da Focus em Ajustes.` } };
  return { base: BASE[cfg.ambiente], token };
}

async function call(method: "GET" | "POST", path: string, body?: unknown, storeId?: string): Promise<FocusResult> {
  const cfg = await getFiscalIntegracao(storeId);
  const r = resolve(cfg);
  if ("erro" in r) return r.erro;
  try {
    const res = await fetch(r.base + path, {
      method,
      headers: { Authorization: authHeader(r.token), "Content-Type": "application/json" },
      body: body != null ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return normalize(res.status, data);
  } catch (e) {
    return { ok: false, status: "erro_conexao", message: (e as Error).message };
  }
}

function normalize(httpStatus: number, d: Record<string, unknown>): FocusResult {
  const status = String(d.status ?? (httpStatus >= 200 && httpStatus < 300 ? "ok" : "erro"));
  // mensagem: Focus manda mensagem_sefaz, ou um array/objeto de erros
  const msg = (d.mensagem_sefaz as string) || (d.mensagem as string) || (Array.isArray(d.erros) ? (d.erros as { mensagem?: string }[]).map((e) => e.mensagem).filter(Boolean).join("; ") : "") || undefined;
  return {
    ok: httpStatus >= 200 && httpStatus < 300 && status !== "erro_autorizacao",
    status,
    httpStatus,
    message: msg,
    ref: d.ref as string | undefined,
    numero: d.numero as string | undefined,
    serie: d.serie as string | undefined,
    chave: (d.chave_nfe as string) || (d.chave_nfce as string) || undefined,
    caminhoDanfe: (d.caminho_danfe as string) || (d.caminho_danfe_nfce as string) || undefined,
    caminhoXml: (d.caminho_xml_nota_fiscal as string) || undefined,
    raw: d,
  };
}

/** Testa se o token/ambiente respondem (lista empresas do token). Não emite nada. */
export async function testarConexao(storeId?: string): Promise<FocusResult> {
  return call("GET", "/v2/empresas", undefined, storeId);
}

export async function emitirNFe(ref: string, payload: unknown, storeId?: string): Promise<FocusResult> {
  return call("POST", `/v2/nfe?ref=${encodeURIComponent(ref)}`, payload, storeId);
}
export async function emitirNFCe(ref: string, payload: unknown, storeId?: string): Promise<FocusResult> {
  return call("POST", `/v2/nfce?ref=${encodeURIComponent(ref)}`, payload, storeId);
}
/** Consulta o status de uma nota já enviada (a autorização é assíncrona na NF-e). */
export async function consultarNota(tipo: "nfe" | "nfce", ref: string, storeId?: string): Promise<FocusResult> {
  return call("GET", `/v2/${tipo}/${encodeURIComponent(ref)}?completa=1`, undefined, storeId);
}

/** URL pública do DANFE/PDF na Focus (a partir do caminho relativo devolvido). */
export async function danfeUrl(caminho: string, storeId?: string): Promise<string | null> {
  const cfg = await getFiscalIntegracao(storeId);
  if (!caminho) return null;
  return (cfg.ambiente === "producao" ? BASE.producao : BASE.homologacao) + caminho;
}
