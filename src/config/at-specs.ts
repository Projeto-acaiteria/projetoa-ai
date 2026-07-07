// Contrato de SPECS do vertical ASSISTÊNCIA TÉCNICA (loja de PC/games). Config de PLATAFORMA:
// todo tenant AT (Starteq + futuros) compartilha este schema — food não usa. É o que o montador de
// PC do site exige pra validar compatibilidade (socket, ram_type, watts, supports_mobo...). Sem
// preencher certo aqui, o produto entra sem specs e o montador quebra. Editor guiado por isto.
import type { StockCategory } from "@/lib/stock-store";

export type SpecFieldType = "text" | "number" | "boolean" | "select" | "multiselect";
export type SpecField = {
  key: string;              // chave gravada em stock_items.data.specs
  label: string;
  type: SpecFieldType;
  options?: string[];       // select / multiselect
  unit?: string;            // sufixo visual (W, mm, GB...)
  hint?: string;
};

// listas reusadas
const SOCKETS = ["AM4", "AM5", "LGA1700", "LGA1200", "AM3+"];
const RAM_TYPES = ["DDR4", "DDR5", "DDR3"];
const FORMS = ["ITX", "mATX", "ATX", "E-ATX"];
const PSU_CERTS = ["80+ White", "80+ Bronze", "80+ Silver", "80+ Gold", "80+ Platinum"];
const SSD_IFACE = ["NVMe PCIe 4.0", "NVMe PCIe 3.0", "SATA III"];

// Specs por categoria. Ordem = ordem no form. Categorias do MONTADOR (críticas) vêm completas;
// periféricos ficam com specs de exibição (leves) ou nenhuma.
export const AT_SPECS: Partial<Record<StockCategory, SpecField[]>> = {
  cpu: [
    { key: "socket", label: "Socket", type: "select", options: SOCKETS },
    { key: "ram_type", label: "Memória suportada", type: "select", options: RAM_TYPES, hint: "AM5/LGA1700 novos = DDR5" },
    { key: "tdp", label: "TDP", type: "number", unit: "W" },
    { key: "cores", label: "Núcleos", type: "number" },
    { key: "threads", label: "Threads", type: "number" },
    { key: "gen", label: "Geração", type: "text", hint: "ex: Zen 4, 14ª" },
    { key: "igpu", label: "Vídeo integrado", type: "boolean" },
    { key: "cooler_included", label: "Vem com cooler", type: "boolean" },
  ],
  cooler: [
    { key: "type", label: "Tipo", type: "text", hint: "ex: Air, AIO 240mm" },
    { key: "supports_socket", label: "Sockets suportados", type: "multiselect", options: SOCKETS },
    { key: "max_tdp", label: "TDP máx. dissipado", type: "number", unit: "W" },
    { key: "height_mm", label: "Altura", type: "number", unit: "mm" },
  ],
  mobo: [
    { key: "socket", label: "Socket", type: "select", options: SOCKETS },
    { key: "ram_type", label: "Memória", type: "select", options: RAM_TYPES },
    { key: "form", label: "Formato", type: "select", options: FORMS },
    { key: "ram_slots", label: "Slots de RAM", type: "number" },
    { key: "sata_ports", label: "Portas SATA", type: "number" },
  ],
  ram: [
    { key: "ram_type", label: "Tipo", type: "select", options: RAM_TYPES },
    { key: "capacity_gb", label: "Capacidade", type: "number", unit: "GB" },
    { key: "freq_mhz", label: "Frequência", type: "number", unit: "MHz" },
    { key: "slots_used", label: "Pentes (slots usados)", type: "number", hint: "1 = single, 2 = dual" },
  ],
  gpu: [
    { key: "chip", label: "Chip", type: "text", hint: "ex: RTX 4060" },
    { key: "vram_gb", label: "VRAM", type: "number", unit: "GB" },
    { key: "tdp", label: "TDP", type: "number", unit: "W" },
    { key: "length_mm", label: "Comprimento", type: "number", unit: "mm", hint: "pra caber no gabinete" },
  ],
  ssd: [
    { key: "capacity_gb", label: "Capacidade", type: "number", unit: "GB" },
    { key: "interface", label: "Interface", type: "select", options: SSD_IFACE },
    { key: "read_mb", label: "Leitura", type: "number", unit: "MB/s" },
  ],
  gabinete: [
    { key: "form", label: "Formato máx. suportado", type: "select", options: FORMS },
    { key: "supports_mobo", label: "Placas que aceita", type: "multiselect", options: FORMS },
    { key: "max_gpu_mm", label: "GPU máx.", type: "number", unit: "mm" },
    { key: "max_cooler_mm", label: "Cooler máx.", type: "number", unit: "mm" },
  ],
  fonte: [
    { key: "watts", label: "Potência", type: "number", unit: "W" },
    { key: "certification", label: "Certificação", type: "select", options: PSU_CERTS },
    { key: "modular", label: "Modular", type: "boolean" },
  ],
};

/** Categorias que têm contrato de specs (as do montador). */
export const AT_SPEC_CATEGORIES = Object.keys(AT_SPECS) as StockCategory[];
export const specFieldsFor = (c: StockCategory): SpecField[] => AT_SPECS[c] ?? [];
