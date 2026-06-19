// ComandaPRO — segmentos de food service (Fase 4, multi-segmento).
// O onboarding pergunta "que tipo de negócio?" e usa estes DEFAULTS pra ligar as features certas
// (gravadas em store_config). O dono pode ajustar cada flag depois. Lançamento = os com espelho.

export type BusinessType =
  | "acaiteria"
  | "sorveteria"
  | "marmitaria"
  | "restaurante"
  | "petiscaria"
  | "bar";

export type Features = {
  sellsByWeight: boolean; // balança R$/kg (açaí, sorveteria, marmita a quilo)
  hasBalcao: boolean; // venda de balcão / walk-in
  hasTables: boolean; // mesas + comanda
  hasDelivery: boolean; // pedido por link público
  coverEnabled: boolean; // cover artístico (bar)
  stockDose: boolean; // dose / garrafa (bar)
  hasStations: boolean; // estações cozinha/bar (pedido roteado)
  loyaltyEnabled: boolean; // fidelidade (pontos do cliente)
};

export const SEGMENTOS: Record<BusinessType, { label: string; features: Features }> = {
  acaiteria: {
    label: "Açaiteria",
    features: { sellsByWeight: true, hasBalcao: true, hasTables: true, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: false, loyaltyEnabled: true },
  },
  sorveteria: {
    label: "Sorveteria",
    features: { sellsByWeight: true, hasBalcao: true, hasTables: false, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: false, loyaltyEnabled: true },
  },
  marmitaria: {
    label: "Marmitaria / Comida a quilo",
    features: { sellsByWeight: true, hasBalcao: true, hasTables: false, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: false, loyaltyEnabled: false },
  },
  restaurante: {
    label: "Restaurante",
    features: { sellsByWeight: false, hasBalcao: false, hasTables: true, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: true, loyaltyEnabled: false },
  },
  petiscaria: {
    label: "Petiscaria / Espetinho",
    features: { sellsByWeight: false, hasBalcao: true, hasTables: true, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: true, loyaltyEnabled: false },
  },
  bar: {
    label: "Bar / Choperia",
    features: { sellsByWeight: false, hasBalcao: true, hasTables: true, hasDelivery: false, coverEnabled: true, stockDose: true, hasStations: true, loyaltyEnabled: false },
  },
};

export const SEGMENTO_LISTA = Object.entries(SEGMENTOS).map(([id, s]) => ({
  id: id as BusinessType,
  label: s.label,
}));
