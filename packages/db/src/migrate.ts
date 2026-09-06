import path from "node:path";
import { config } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

config({ path: path.resolve(process.cwd(), "../../.env") });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida (revisa tu archivo .env)");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log("Aplicando migraciones...");
  await migrate(db, { migrationsFolder: "./migrations" });
  console.log("Migraciones aplicadas correctamente.");

  await pool.end();
}

main().catch((error) => {
  console.error("Error aplicando migraciones:", error);
  process.exit(1);
});
