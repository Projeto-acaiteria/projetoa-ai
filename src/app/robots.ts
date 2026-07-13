import type { MetadataRoute } from "next";

const BASE = "https://comandapro.net.br";

// Libera o site + os cardápios públicos dos tenants (bom pra SEO local das lojas); bloqueia o
// app interno (admin/api/login/cadastro). O llms.txt fica em /llms.txt (public/), lido direto.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/login", "/cadastro", "/meus-pontos"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
