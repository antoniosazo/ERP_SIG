/**
 * Alta de una firma contable desde la consola: la registra en la plataforma, le crea su
 * base (migrada y con catálogos) y su primer Administrador activo con contraseña. Sirve
 * para el primer arranque (antes de que exista un superadmin que use la pantalla de firmas).
 *
 * Uso interactivo:  pnpm crear-firma [--superadmin]
 * Uso no interactivo: variables FIRMA_RUT, FIRMA_RAZON_SOCIAL, ADMIN_NOMBRE, ADMIN_EMAIL, ADMIN_PASSWORD
 */
import path from "node:path";
import readline from "node:readline/promises";
import { config } from "dotenv";

config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const { cerrarConexiones, crearFirmaContable, crearUsuarioActivoConPassword, migrarPlataforma } = await import("../src/index");

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
    const rut = await preguntar(rl, "RUT de la firma", "FIRMA_RUT");
    const razonSocial = await preguntar(rl, "Razón social de la firma", "FIRMA_RAZON_SOCIAL");
    const nombre = await preguntar(rl, "Nombre del Administrador", "ADMIN_NOMBRE");
    const email = await preguntar(rl, "Email del Administrador", "ADMIN_EMAIL");
    const password = await preguntar(rl, "Contraseña del Administrador (mín. 8 caracteres)", "ADMIN_PASSWORD");
    if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

    await migrarPlataforma();
    const firma = await crearFirmaContable({ rut, razonSocial, planContratado: "Profesional", estado: "Activa" });
    console.log(`Firma creada: ${firma.razonSocial} (${firma.id}), base ${firma.baseDatos}`);
    const { usuarioId } = await crearUsuarioActivoConPassword({
      firmaContableId: firma.id,
      nombre,
      email,
      password,
      esAdminFirma: true,
      esSuperAdmin: process.argv.includes("--superadmin"),
      empresas: [],
    });
    console.log(`Administrador creado: ${email} (${usuarioId}). Ya puedes iniciar sesión en /login.`);
  } finally {
    rl.close();
  }
}

main()
  .then(async () => {
    await cerrarConexiones();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Error creando la firma:", error instanceof Error ? error.message : error);
    await cerrarConexiones();
    process.exit(1);
  });
