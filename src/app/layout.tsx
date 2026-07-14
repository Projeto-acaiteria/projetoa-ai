import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

// Inter = tipografia de marca (padrão premium — Linear usa). Self-hosted, sem layout shift.
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
        {children}
      </body>
    </html>
  );
}
