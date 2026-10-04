import { defineConfig } from "drizzle-kit";

/** Esquema de las bases de firma (todo lo contable). Las migraciones se aplican con `db:migrate`. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations/firma",
  strict: true,
  verbose: true,
});
