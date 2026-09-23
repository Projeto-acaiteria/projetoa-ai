import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import GoogleAnalytics from "@/components/GoogleAnalytics";

// Inter = tipografia de marca (padrão premium — Linear usa). Self-hosted, sem layout shift.
// GA4 do site (propriedade "ComandaPRO", conta Impulso Digital, criada 22/09/2026). O ID de medição
// é PÚBLICO (sai no HTML de todo site com Analytics), então mora no código — sem depender de login
// na Vercel. Liga só no build de produção (VERCEL_ENV=production); NEXT_PUBLIC_GA_ID sobrepõe se existir.
const GA_ID_PRODUCAO = "G-3VZXLSNN7V";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? (process.env.VERCEL_ENV === "production" ? GA_ID_PRODUCAO : undefined);

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://comandapro.net.br"),
  title: "ComandaPRO — Sistema de food service",
  description: "Cardápio digital, comanda, mesa, delivery, balcão e gestão — num sistema só.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ComandaPRO" },
  // Favicon espalhada em TODAS as rotas (root layout): SVG crisp + PNG fallback + apple. Admin,
  // cardápio (/[slug]) e segmentadas herdam daqui (metadata do Next faz merge, não sobrescreve).
  icons: {
    icon: [
      { url: "/comandapro-icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  // Verificação do Search Console (propriedade https://comandapro.net.br, conta edubchaves5).
  // O método "Google Analytics" falhou em 22/09 (o GSC exige o gtag DENTRO do <head>; o nosso sai
  // no <body>), então vai pela tag HTML. O valor é público (sai no HTML) — por isso mora no código.
  // NÃO REMOVER: sem a meta o Search Console perde a verificação.
  verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "MqlbULKlyzQi1GcZ5qZWpXmrTCSxktKKeUxNdynyyDk" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4F46E5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <RegisterSW />
        <GoogleAnalytics gaId={GA_ID} />
        {children}
      </body>
    </html>
  );
}
