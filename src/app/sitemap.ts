import type { MetadataRoute } from "next";

const BASE = "https://comandapro.net.br";

// Sitemap do SITE institucional. Só emite rotas QUE JÁ EXISTEM (senão aponta pra 404 = ruim p/
// SEO). Conforme /funcionalidades e /segmentos/* forem construídas, adicionar aqui (a lista-alvo
// completa está em MARKETING_ROUTES no config/marketing.ts). Não lista o app nem os tenants.
const LIVE_ROUTES = ["/"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return LIVE_ROUTES.map((path) => ({
    url: `${BASE}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.8,
  }));
}
