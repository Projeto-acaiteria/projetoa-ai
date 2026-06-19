// Dados de exemplo pro protótipo de front (sem back ainda).

export type OrderStatus = "recebido" | "preparo" | "saiu" | "entregue";

export const ORDERS: {
  id: string;
  customer: string;
  items: string;
  mode: "retirada" | "entrega";
  totalCents: number;
  status: OrderStatus;
  time: string;
}[] = [
  { id: "#1042", customer: "Marina S.", items: "500ml · granola, banana, leite cond.", mode: "entrega", totalCents: 2350, status: "recebido", time: "19:42" },
  { id: "#1041", customer: "João P.", items: "700ml · ovomaltine, Ninho, morango", mode: "entrega", totalCents: 3100, status: "preparo", time: "19:35" },
  { id: "#1040", customer: "Balcão", items: "300ml · paçoca", mode: "retirada", totalCents: 1200, status: "entregue", time: "19:28" },
  { id: "#1039", customer: "Carla M.", items: "500ml · Nutella, KitKat", mode: "retirada", totalCents: 2600, status: "saiu", time: "19:20" },
  { id: "#1038", customer: "Diego A.", items: "700ml · granola, frutas, mel", mode: "entrega", totalCents: 2800, status: "entregue", time: "19:05" },
];

export const TOP_ITEMS = [
  { name: "Copo 500ml", qty: 38, pct: 100 },
  { name: "Copo 700ml", qty: 27, pct: 71 },
  { name: "Adicional Ninho", qty: 24, pct: 63 },
  { name: "Copo 300ml", qty: 19, pct: 50 },
  { name: "Adicional Nutella", qty: 15, pct: 39 },
];

export const CUSTOMERS = [
  { name: "Marina Souza", phone: "(99) 98101-2233", points: 7, visits: 12, lastCents: 2350 },
  { name: "João Pereira", phone: "(99) 98140-5566", points: 3, visits: 5, lastCents: 3100 },
  { name: "Carla Mendes", phone: "(99) 99820-1100", points: 10, visits: 18, lastCents: 2600 },
  { name: "Diego Alves", phone: "(99) 98233-7788", points: 1, visits: 2, lastCents: 2800 },
  { name: "Rita Lopes", phone: "(99) 99511-4321", points: 9, visits: 14, lastCents: 1900 },
];

export const EXPENSES = [
  { name: "Polpa de açaí (fornecedor)", cat: "Insumos", cents: 48000 },
  { name: "Granola e complementos", cat: "Insumos", cents: 16500 },
  { name: "Copos e tampas", cat: "Embalagem", cents: 9200 },
  { name: "Energia", cat: "Utilidades", cents: 31000 },
];
