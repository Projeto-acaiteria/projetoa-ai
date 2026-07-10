import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

// PWA da PLATAFORMA: nome/ícone fixos "ComandaPRO" (família PRO, igual AgendaPRO), não por tenant.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ComandaPRO",
    short_name: "ComandaPRO",
    description: "Sistema de gestão para food service.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#030712", // casa com o ícone (splash escuro em vez de tela branca)
    theme_color: "#111827",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
