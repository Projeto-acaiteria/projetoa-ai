// Banco de imagens curado (Unsplash) pra loja que não tem foto própria do produto.
// URLs reais validadas (HTTP 200); fotos de comida/bebida reais (não IA — padrão do projeto).
// A loja escolhe no editor; a URL é gravada em menu_products.img. Crop quadrado 600px.
export type ImageBankCategory = { key: string; label: string; photos: string[] };

const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=600&h=600&fit=crop&q=80`;
const uw = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&h=500&fit=crop&q=80`; // banner wide

// Fotos por CHAVE do modelo (o cardápio-modelo referencia img_key). Unsplash real, validado 200 e
// conferido visualmente. Servidas do CDN Unsplash (zero egress Supabase). esfiha sem match no
// Unsplash (só lahmacun turco) → fica sem foto (fallback). Vamos preenchendo por segmento.
export const MODEL_IMAGES: Record<string, string> = {
  pizza: u("1594007654729-407eedc4be65"),
  pizza_doce: u("1716237387656-420e73661519"),
  refrigerante: u("1554866585-cd94860890b7"),
  suco: u("1600271886742-f049cd451bba"),
  agua: u("1561041695-d2fadf9f318c"),
};
// Banners wide de categoria (proporção larga).
export const MODEL_BANNERS: Record<string, string> = {
  pizza: uw("1594007654729-407eedc4be65"),
};
export const modelImage = (key?: string) => (key ? MODEL_IMAGES[key] ?? "" : "");
export const modelBanner = (key?: string) => (key ? MODEL_BANNERS[key] ?? "" : "");

export const IMAGE_BANK: ImageBankCategory[] = [
  {
    key: "fritos",
    label: "Fritos & petiscos",
    photos: ["1541592106381-b31e9677c0e5", "1625940951329-4e8d09f87692", "1569058242253-92a9c755a0ec", "1525351484163-7529414344d8"].map(u),
  },
  {
    key: "carnes",
    label: "Carnes & churrasco",
    photos: ["1555939594-58d7cb561ad1", "1588168333986-5078d3ae3976", "1633436375795-12b3b339712f", "1603360946369-dc9bb6258143"].map(u),
  },
  {
    key: "lanches",
    label: "Lanches & burgers",
    photos: ["1568901346375-23c9450c58cd", "1572802419224-296b0aeee0d9", "1571091718767-18b5b1457add", "1550547660-d9450f859349"].map(u),
  },
  {
    key: "cervejas",
    label: "Cervejas",
    photos: ["1571613316887-6f8d5cbf7ef7", "1566633806327-68e152aaf26d", "1608270586620-248524c67de9", "1546622891-02c72c1537b6"].map(u),
  },
  {
    key: "drinks",
    label: "Drinks & coquetéis",
    photos: ["1609951651556-5334e2706168", "1551024709-8f23befc6f87", "1514362545857-3bc16c4c7d1b", "1570598912132-0ba1dc952b7d"].map(u),
  },
  {
    key: "acai",
    label: "Açaí & sobremesas",
    photos: ["1654923064926-be7e64267a31", "1590288488147-f46142daf112", "1533324050617-905a80c167eb", "1562166453-2783119c313a"].map(u),
  },
  {
    key: "sushi",
    label: "Sushi & japonês",
    photos: ["1553621042-f6e147245754", "1611143669185-af224c5e3252", "1617196034796-73dfa7b1fd56", "1587334207810-4915c4e40c67", "1591632288574-a387f820a1ca", "1571987530791-58e3e7744d99", "1601059286024-61032e83b203", "1610722839611-f7837e1dd39f"].map(u),
  },
];

// Banco achatado pro PICKER do montador (o dono escolhe a foto do produto). "Do seu ramo" =
// fotos do segmento (MODEL_IMAGES); depois as categorias gerais do banco Unsplash.
export const PICKER_GROUPS: { label: string; photos: string[] }[] = [
  { label: "Do seu ramo", photos: Array.from(new Set(Object.values(MODEL_IMAGES))) },
  ...IMAGE_BANK.map((c) => ({ label: c.label, photos: c.photos })),
];
