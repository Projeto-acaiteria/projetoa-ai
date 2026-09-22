import type { MetadataRoute } from "next";
import { MARKETING_ROUTES } from "@/config/marketing";

const BASE = "https://comandapro.net.br";

// Sitemap do SITE institucional: home + todas as segmentadas (/segmentos/<slug>), INCLUINDO os
// segmentos-irmãos (sorveteria, petiscaria, marmitaria). Até 22/09 usava só NICHOS e deixava os
// irmãos de fora — páginas no ar (200) que nenhum buscador/IA era avisado que existiam.
// Não lista o app (admin) nem os cardápios de tenant (/<slug>).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return MARKETING_ROUTES.map((path) => ({
    url: `${BASE}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.8,
  }));
}
