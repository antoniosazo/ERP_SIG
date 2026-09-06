import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// El .env vive en la raíz del monorepo (un solo archivo para app/db/shared).
config({ path: path.resolve(process.cwd(), "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida (revisa tu archivo .env)");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
