// Prioridade da OS — módulo PURO (sem imports de servidor), pra usar no server E no client.
export type OSPriority = "muito_urgente" | "urgente" | "alta" | "media" | "baixa";

export const OS_PRIORITY_ORDER: OSPriority[] = ["muito_urgente", "urgente", "alta", "media", "baixa"];

export const OS_PRIORITY_META: Record<OSPriority, { label: string; color: string; rank: number }> = {
  muito_urgente: { label: "Muito urgente", color: "#991b1b", rank: 5 },
  urgente: { label: "Urgente", color: "#ef4444", rank: 4 },
  alta: { label: "Alta", color: "#f97316", rank: 3 },
  media: { label: "Média", color: "#eab308", rank: 2 },
  baixa: { label: "Baixa", color: "#16a34a", rank: 1 },
};

export const asPriority = (v: unknown): OSPriority | null => (OS_PRIORITY_ORDER.includes(v as OSPriority) ? (v as OSPriority) : null);
