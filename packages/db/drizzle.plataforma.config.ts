import { defineConfig } from "drizzle-kit";

/** Esquema de la base de plataforma (firmas, cuentas de usuario, tokens). */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/plataforma/schema.ts",
  out: "./migrations/plataforma",
  strict: true,
  verbose: true,
});
