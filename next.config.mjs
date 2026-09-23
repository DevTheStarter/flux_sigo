import { fileURLToPath } from "node:url";

const pastaApp = fileURLToPath(new URL("./app", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack(config) {
    // app/landing.html é servida tal e qual por app/route.ts; importa-se como texto.
    config.module.rules.push({ test: /\.html$/, include: pastaApp, type: "asset/source" });
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Content-Security-Policy é definida no middleware, com nonce por pedido (§19).
        ],
      },
    ];
  },
};

export default nextConfig;
