"use client";

import { useEffect } from "react";

// Registra o service worker (necessário pro app ser instalável).
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
