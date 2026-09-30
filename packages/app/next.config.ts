import path from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// El .env vive en la raíz del monorepo (un solo archivo para app/db/shared).
config({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/db", "@erp/shared"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Solo la propia app puede enmarcarse: las pestañas del panel son iframes del mismo origen.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
