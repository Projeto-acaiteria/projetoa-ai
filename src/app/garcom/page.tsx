import type { Metadata } from "next";
import GarcomEntrarClient from "./GarcomEntrarClient";

export const metadata: Metadata = { title: "Garçom · ComandaPRO", robots: { index: false, follow: false } };

// Porta de entrada do GARÇOM (mt-38): instala o app e digita o código de 6 dígitos que o gerente
// gerou. Pública de propósito — é aqui que a sessão dele nasce. Sem email, sem senha.
export default function GarcomPage() {
  return <GarcomEntrarClient />;
}
