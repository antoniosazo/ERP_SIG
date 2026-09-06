import path from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// El .env vive en la raíz del monorepo (un solo archivo para app/db/shared).
config({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/db", "@erp/shared"],
};

export default nextConfig;
