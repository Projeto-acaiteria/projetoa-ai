import type { MetadataRoute } from "next";
import { getStore } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const store = await getStore();
  return {
    name: store.name,
    short_name: store.name.length > 12 ? "Açaí" : store.name,
    description: "Monte seu açaí, junte pontos e peça pelo celular.",
    start_url: "/cardapio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF7FF",
    theme_color: "#6D28D9",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
