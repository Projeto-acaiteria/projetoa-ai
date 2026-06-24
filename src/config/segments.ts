// ComandaPRO — segmentos de food service (Fase 4, multi-segmento).
// O onboarding pergunta "que tipo de negócio?" e usa estes DEFAULTS pra ligar as features certas
// (gravadas em store_config) e escolher o MODELO de cardápio. O dono pode ajustar tudo depois.

export type BusinessType =
  | "acaiteria"
  | "sorveteria"
  | "marmitaria"
  | "restaurante"
  | "pizzaria"
  | "sushi"
  | "hamburgueria"
  | "petiscaria"
  | "bar";

// 3 modelos de cardápio público: acai (monta no copo) | bar (comanda estilo Medellín) | grid (foto grande).
export type MenuTemplate = "acai" | "bar" | "grid";

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

export const SEGMENTOS: Record<BusinessType, { label: string; menuTemplate: MenuTemplate; features: Features }> = {
  acaiteria: {
    label: "Açaiteria",
    menuTemplate: "acai",
    features: { sellsByWeight: true, hasBalcao: true, hasTables: true, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: false, loyaltyEnabled: true },
  },
  sorveteria: {
    label: "Sorveteria",
    menuTemplate: "acai",
    features: { sellsByWeight: true, hasBalcao: true, hasTables: false, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: false, loyaltyEnabled: true },
  },
  marmitaria: {
    label: "Marmitaria / Comida a quilo",
    menuTemplate: "grid",
    features: { sellsByWeight: true, hasBalcao: true, hasTables: false, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: false, loyaltyEnabled: false },
  },
  restaurante: {
    label: "Restaurante",
    menuTemplate: "grid",
    features: { sellsByWeight: false, hasBalcao: false, hasTables: true, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: true, loyaltyEnabled: false },
  },
  pizzaria: {
    label: "Pizzaria",
    menuTemplate: "grid",
    features: { sellsByWeight: false, hasBalcao: true, hasTables: true, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: true, loyaltyEnabled: true },
  },
  sushi: {
    label: "Sushi / Japonês",
    menuTemplate: "grid",
    features: { sellsByWeight: false, hasBalcao: true, hasTables: true, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: true, loyaltyEnabled: true },
  },
  hamburgueria: {
    label: "Hamburgueria / Lanchonete",
    menuTemplate: "grid",
    features: { sellsByWeight: false, hasBalcao: true, hasTables: true, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: true, loyaltyEnabled: true },
  },
  petiscaria: {
    label: "Petiscaria / Espetinho",
    menuTemplate: "bar",
    features: { sellsByWeight: false, hasBalcao: true, hasTables: true, hasDelivery: true, coverEnabled: false, stockDose: false, hasStations: true, loyaltyEnabled: false },
  },
  bar: {
    label: "Bar / Choperia",
    menuTemplate: "bar",
    features: { sellsByWeight: false, hasBalcao: true, hasTables: true, hasDelivery: false, coverEnabled: true, stockDose: true, hasStations: true, loyaltyEnabled: false },
  },
};

export const SEGMENTO_LISTA = Object.entries(SEGMENTOS).map(([id, s]) => ({
  id: id as BusinessType,
  label: s.label,
}));
