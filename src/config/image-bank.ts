// Banco de imagens curado (Unsplash) pra loja que não tem foto própria do produto.
// URLs reais validadas (HTTP 200); fotos de comida/bebida reais (não IA — padrão do projeto).
// A loja escolhe no editor; a URL é gravada em menu_products.img. Crop quadrado 600px.
export type ImageBankCategory = { key: string; label: string; photos: string[] };

const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=600&h=600&fit=crop&q=80`;

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
];
