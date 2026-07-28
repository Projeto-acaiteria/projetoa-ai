import type { NextConfig } from "next";

// ID do build — muda a cada deploy. Carimbado no cliente (NEXT_PUBLIC) e lido pela /api/version;
// o cliente compara o seu com o do servidor e recarrega quando há versão nova (auto-update do PWA).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || String(Date.now());

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
