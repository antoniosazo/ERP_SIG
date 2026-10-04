/**
 * Aplica las migraciones: primero la base de plataforma y después la de cada firma.
 * Uso: pnpm db:migrate           (todas las firmas)
 *      pnpm db:migrate <firmaId> (una sola firma, p. ej. para reintentar una que quedó en error)
 */
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const { cerrarConexiones, migrarBaseFirma, migrarPlataforma, migrarTodasLasFirmas } = await import("../src/index");

async function main() {
  console.log("Plataforma: aplicando migraciones…");
  await migrarPlataforma();
  const soloFirma = process.argv[2];
  if (soloFirma) {
    const r = await migrarBaseFirma(soloFirma);
    console.log(r.ok ? `✓ Firma ${soloFirma} → ${r.version}` : `✗ Firma ${soloFirma}: ${r.error}`);
    return r.ok;
  }
  const r = await migrarTodasLasFirmas({ alAvanzar: (linea) => console.log(linea) });
  console.log(`Firmas migradas: ${r.migradas}. Con error: ${r.errores.length}.`);
  return r.errores.length === 0;
}

main()
  .then(async (ok) => {
    await cerrarConexiones();
    process.exit(ok ? 0 : 1);
  })
  .catch(async (error) => {
    console.error("Error aplicando migraciones:", error);
    await cerrarConexiones();
    process.exit(1);
  });
