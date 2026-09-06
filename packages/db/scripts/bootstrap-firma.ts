/**
 * Script one-off: crea la firma contable real y su primer usuario Administrador.
 * No está expuesto en la UI a propósito (ver decisión de producto: "uso interno, una
 * sola firma", sin registro público). Se ejecuta una sola vez.
 *
 * Uso interactivo:  pnpm bootstrap-firma
 * Uso no interactivo (CI / scripting): variables de entorno
 *   FIRMA_RUT, FIRMA_RAZON_SOCIAL, ADMIN_NOMBRE, ADMIN_EMAIL, ADMIN_PASSWORD
 */
import path from "node:path";
import readline from "node:readline/promises";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), "../../.env") });

const { crearFirmaContable } = await import("../src/queries/firmas");
const { crearUsuarioActivoConPassword } = await import("../src/queries/usuarios");

async function preguntar(rl: readline.Interface, etiqueta: string, envVar: string): Promise<string> {
  const desdeEnv = process.env[envVar];
  if (desdeEnv) return desdeEnv;
  const respuesta = await rl.question(`${etiqueta}: `);
  if (!respuesta.trim()) throw new Error(`${etiqueta} es requerido`);
  return respuesta.trim();
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log("== Bootstrap de la firma contable ==\n");

    const rut = await preguntar(rl, "RUT de la firma", "FIRMA_RUT");
    const razonSocial = await preguntar(rl, "Razón social de la firma", "FIRMA_RAZON_SOCIAL");
    const nombreAdmin = await preguntar(rl, "Nombre del Administrador", "ADMIN_NOMBRE");
    const emailAdmin = await preguntar(rl, "Email del Administrador", "ADMIN_EMAIL");
    const passwordAdmin = await preguntar(rl, "Contraseña del Administrador (min 8 caracteres)", "ADMIN_PASSWORD");

    if (passwordAdmin.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres");
    }

    const firma = await crearFirmaContable({
      rut,
      razonSocial,
      planContratado: "Profesional",
      estado: "Activa",
    });
    console.log(`\nFirma creada: ${firma.razonSocial} (${firma.id})`);

    const { usuarioId } = await crearUsuarioActivoConPassword({
      firmaContableId: firma.id,
      nombre: nombreAdmin,
      email: emailAdmin,
      password: passwordAdmin,
      esAdminFirma: true,
      empresas: [],
    });
    console.log(`Usuario Administrador creado: ${emailAdmin} (${usuarioId})`);
    console.log("\nListo. Ya puedes iniciar sesión en /login con ese email y contraseña.");
  } finally {
    rl.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nError en el bootstrap:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
