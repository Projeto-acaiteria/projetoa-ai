// ComandaPRO — motor de montagem de PC (portado do site Starteq). Opera sobre itens do ESTOQUE
// (que carregam .specs). Regras híbridas: filtro silencioso (socket/DDR) + validação explícita
// (cooler/gpu condicional, potência 1.5x, GPU vs gabinete). Preços em CENTAVOS.

export type BuildCategory = "cpu" | "cooler" | "mobo" | "ram" | "gpu" | "ssd" | "gabinete" | "fonte";

export type BuildItem = {
  id: string;
  name: string;
  category: string;
  sellPriceCents: number;
  brand?: string;
  specs?: Record<string, string | number | boolean | string[]>;
};

export type Build = Partial<Record<BuildCategory, BuildItem>>;
export type ValidationIssue = { type: "error" | "warn"; field: BuildCategory; message: string };

const spec = (it: BuildItem | undefined, k: string) => it?.specs?.[k];

// 8 obrigatórios (gpu e cooler viram condicionais)
export const REQUIRED_CATEGORIES: BuildCategory[] = ["cpu", "cooler", "mobo", "ram", "gpu", "ssd", "gabinete", "fonte"];

export function isGpuRequired(b: Build): boolean { return !spec(b.cpu, "igpu"); }
export function isCoolerRequired(b: Build): boolean { return b.cpu ? !spec(b.cpu, "cooler_included") : true; }

/** Filtra só o que encaixa no que já foi escolhido (silencioso). */
export function filterCompatible(cands: BuildItem[], b: Build, cat: BuildCategory): BuildItem[] {
  return cands.filter((p) => {
    if (cat === "mobo" && b.cpu) return spec(p, "socket") === spec(b.cpu, "socket");
    if (cat === "cpu" && b.mobo) return spec(p, "socket") === spec(b.mobo, "socket");
    if (cat === "ram" && b.mobo) return spec(p, "ram_type") === spec(b.mobo, "ram_type");
    if (cat === "cooler" && b.cpu) { const s = spec(p, "supports_socket"); return Array.isArray(s) && s.includes(String(spec(b.cpu, "socket"))); }
    if (cat === "gabinete" && b.mobo) { const s = spec(p, "supports_mobo"); return Array.isArray(s) && s.includes(String(spec(b.mobo, "form"))); }
    return true;
  });
}

export function estimateWattage(b: Build): number {
  return Number(spec(b.cpu, "tdp") ?? 0) + Number(spec(b.gpu, "tdp") ?? 0) + 100;
}
export function recommendedWattage(b: Build): number { return Math.ceil((estimateWattage(b) * 1.5) / 50) * 50; }
export function isFonteAdequate(f: BuildItem, b: Build): boolean { return Number(spec(f, "watts") ?? 0) >= recommendedWattage(b); }

export function validateBuild(b: Build): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (isCoolerRequired(b) && !b.cooler) out.push({ type: "error", field: "cooler", message: b.cpu ? `Cooler obrigatório pro ${b.cpu.name} (não acompanha cooler)` : "Cooler obrigatório" });
  if (isGpuRequired(b) && !b.gpu) out.push({ type: "error", field: "gpu", message: "Placa de vídeo obrigatória (CPU sem vídeo integrado)" });
  if (b.cpu && b.mobo && spec(b.cpu, "socket") !== spec(b.mobo, "socket")) out.push({ type: "error", field: "mobo", message: `Placa-mãe ${spec(b.mobo, "socket")} não bate com CPU ${spec(b.cpu, "socket")}` });
  if (b.ram && b.mobo && spec(b.ram, "ram_type") !== spec(b.mobo, "ram_type")) out.push({ type: "error", field: "ram", message: `Memória ${spec(b.ram, "ram_type")} não bate com a placa (${spec(b.mobo, "ram_type")})` });
  if (b.fonte && b.cpu) { const req = recommendedWattage(b); const w = Number(spec(b.fonte, "watts") ?? 0); if (w < req) out.push({ type: "warn", field: "fonte", message: `Fonte ${w}W abaixo do recomendado (~${req}W)` }); }
  if (b.gpu && b.gabinete) { const gl = Number(spec(b.gpu, "length_mm") ?? 0); const max = Number(spec(b.gabinete, "max_gpu_mm") ?? 999); if (gl > max) out.push({ type: "error", field: "gabinete", message: `GPU ${gl}mm não cabe no gabinete (máx ${max}mm)` }); }
  return out;
}

export function buildTotalCents(b: Build): number {
  return Object.values(b).reduce((s: number, p) => s + (p ? p.sellPriceCents : 0), 0);
}

export function buildStatus(b: Build): { filled: number; required: number; pending: BuildCategory[]; percent: number } {
  const req = REQUIRED_CATEGORIES.filter((c) => {
    if (c === "gpu" && !isGpuRequired(b)) return false;
    if (c === "cooler" && !isCoolerRequired(b)) return false;
    return true;
  });
  const filled = req.filter((c) => b[c]).length;
  return { filled, required: req.length, pending: req.filter((c) => !b[c]), percent: Math.round((filled / req.length) * 100) };
}

export const BUILD_LABEL: Record<BuildCategory, string> = {
  cpu: "Processador", cooler: "Cooler", mobo: "Placa-mãe", ram: "Memória RAM",
  gpu: "Placa de vídeo", ssd: "Armazenamento", gabinete: "Gabinete", fonte: "Fonte",
};
