"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Atualiza a página (server component) periodicamente — pro status do pedido refletir mudanças
// sem o cliente precisar recarregar na mão. Não é tempo real (websocket); é re-fetch leve.
export default function AutoRefresh({ seconds = 25 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), Math.max(10, seconds) * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
