import type { MetadataRoute } from "next";
import { NICHOS } from "@/config/marketing";

const BASE = "https://comandapro.net.br";

// Sitemap do SITE institucional. Home + as 4 segmentadas (/segmentos/<slug>), que já existem.
// Não lista o app (admin) nem os cardápios de tenant (/<slug>).
const LIVE_ROUTES = ["/", ...NICHOS.map((n) => `/segmentos/${n.slug}`)];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return LIVE_ROUTES.map((path) => ({
    url: `${BASE}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.8,
  }));
}
