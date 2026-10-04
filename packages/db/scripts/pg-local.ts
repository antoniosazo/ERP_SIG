/**
 * Postgres 18 local para desarrollo y pruebas (binarios del paquete `embedded-postgres`).
 * Uso: pnpm db:local start | stop | status | reset
 *
 * Postgres no corre como root: si este proceso es root (p. ej. WSL), los binarios se copian a
 * /opt/erp-postgres y los datos van a /var/lib/erp-postgres, ambos accesibles al usuario
 * de sistema `postgres`, y los comandos se ejecutan con `runuser`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import pg from "pg";

const esRoot = process.getuid?.() === 0;
/** Igual a la versión de los proyectos Neon de las firmas y a la del paquete `embedded-postgres`. */
const VERSION_MAYOR = "18";
const puerto = Number(process.env.PG_LOCAL_PORT ?? 54320);
const require = createRequire(import.meta.url);

function binariosDelPaquete(): string {
  const plataforma = `@embedded-postgres/${process.platform}-${process.arch}`;
  const desdeEmbedded = createRequire(require.resolve("embedded-postgres"));
  // El paquete solo exporta dist/index.js: los binarios están en ../native respecto de él.
  const nativo = path.resolve(path.dirname(desdeEmbedded.resolve(plataforma)), "..", "native");
  if (!existsSync(path.join(nativo, "bin", "postgres"))) throw new Error(`No se encontraron binarios de Postgres en ${nativo}`);
  return nativo;
}

const raizRepo = path.resolve(import.meta.dirname, "..", "..", "..");
const dirBin = process.env.PG_LOCAL_BIN ?? (esRoot ? `/opt/erp-postgres/${VERSION_MAYOR}` : binariosDelPaquete());
// Los datos van por versión mayor: un directorio de otra versión no es compatible.
const dirDatos = process.env.PG_LOCAL_DATA ?? (esRoot ? `/var/lib/erp-postgres/${VERSION_MAYOR}` : path.join(raizRepo, ".pgdata", VERSION_MAYOR));
const bin = (nombre: string) => path.join(dirBin, "bin", nombre);

function comoPostgres(comando: string, args: string[], opciones: { tolerarError?: boolean } = {}) {
  const [cmd, argv] = esRoot ? ["runuser", ["-u", "postgres", "--", comando, ...args]] : [comando, args];
  const r = spawnSync(cmd, argv, { encoding: "utf8" });
  if (r.status !== 0 && !opciones.tolerarError) {
    throw new Error(`${comando} falló (${r.status}):\n${r.stdout}\n${r.stderr}`);
  }
  return r;
}

function prepararRoot() {
  if (!esRoot) return;
  const origen = binariosDelPaquete();
  const marca = path.join(dirBin, ".origen");
  if (!existsSync(marca) || readFileSync(marca, "utf8") !== origen) {
    rmSync(dirBin, { recursive: true, force: true });
    mkdirSync(path.dirname(dirBin), { recursive: true });
    cpSync(origen, dirBin, { recursive: true, verbatimSymlinks: true });
    writeFileSync(marca, origen);
  }
  const existe = spawnSync("id", ["-u", "postgres"]).status === 0;
  if (!existe) execFileSync("useradd", ["--system", "--no-create-home", "--shell", "/usr/sbin/nologin", "postgres"]);
  mkdirSync(dirDatos, { recursive: true });
  execFileSync("chown", ["-R", "postgres:postgres", path.dirname(dirDatos)]);
}

const corriendo = () => comoPostgres(bin("pg_ctl"), ["-D", dirDatos, "status"], { tolerarError: true }).status === 0;

async function iniciar() {
  prepararRoot();
  if (!existsSync(path.join(dirDatos, "PG_VERSION"))) {
    mkdirSync(dirDatos, { recursive: true });
    if (esRoot) execFileSync("chown", ["postgres:postgres", dirDatos]);
    comoPostgres(bin("initdb"), ["-D", dirDatos, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
  }
  if (!corriendo()) {
    comoPostgres(bin("pg_ctl"), [
      "-D", dirDatos,
      "-l", path.join(dirDatos, "postgres.log"),
      "-o", `-p ${puerto} -k /tmp -c listen_addresses=localhost`,
      "-w", "start",
    ]);
  }
  const cliente = new pg.Client({ connectionString: `postgres://postgres:postgres@localhost:${puerto}/postgres` });
  await cliente.connect();
  const existe = await cliente.query("select 1 from pg_database where datname = 'erp_plataforma'");
  if (existe.rowCount === 0) await cliente.query("create database erp_plataforma");
  await cliente.end();
  console.log(`Postgres local en marcha en el puerto ${puerto} (bases: erp_plataforma y una por firma).`);
}

function detener() {
  if (corriendo()) comoPostgres(bin("pg_ctl"), ["-D", dirDatos, "-m", "fast", "-w", "stop"]);
  console.log("Postgres local detenido.");
}

const accion = process.argv[2] ?? "status";
if (accion === "start") await iniciar();
else if (accion === "stop") detener();
else if (accion === "reset") {
  detener();
  rmSync(dirDatos, { recursive: true, force: true });
  await iniciar();
} else if (accion === "status") {
  console.log(corriendo() ? `En marcha en el puerto ${puerto} (${dirDatos}).` : "Detenido.");
} else {
  console.error("Uso: pg-local start | stop | status | reset");
  process.exit(1);
}
