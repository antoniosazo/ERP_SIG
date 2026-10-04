/**
 * Aislamiento entre firmas con bases reales. Necesita el Postgres local (`pnpm db:local start`)
 * y las variables PLATAFORMA_DATABASE_URL / FIRMAS_DATABASE_URL; sin ellas se omite.
 * Crea dos firmas de prueba y borra sus bases al terminar.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { config } from "dotenv";
import { eq, isNull } from "drizzle-orm";
import pg from "pg";

config({ path: path.resolve(import.meta.dirname, "../../../../.env"), quiet: true });
// Siempre en el Postgres local: las pruebas nunca crean proyectos Neon.
process.env.FIRMAS_PROVEEDOR = "servidor";
const disponible = !!process.env.PLATAFORMA_DATABASE_URL && !!process.env.FIRMAS_DATABASE_URL;

describe("base por firma", { skip: !disponible && "sin Postgres local configurado" }, () => {
  const sufijo = Date.now().toString().slice(-7);
  let m: typeof import("../index");
  let firmaA: string;
  let firmaB: string;
  let empresaA: string;
  const bases: string[] = [];
  const firmasExtra: string[] = [];

  before(async () => {
    m = await import("../index");
    await m.migrarPlataforma();
    const a = await m.crearFirmaContable({ rut: `7${sufijo}-1`, razonSocial: "Prueba A", planContratado: "Basico", estado: "Activa" });
    const b = await m.crearFirmaContable({ rut: `8${sufijo}-2`, razonSocial: "Prueba B", planContratado: "Basico", estado: "Activa" });
    firmaA = a.id;
    firmaB = b.id;
    bases.push(a.baseDatos!, b.baseDatos!);
    empresaA = await m.conFirma(firmaA, async () => {
      const [moneda] = await m.db.select().from(m.monedas).where(isNull(m.monedas.empresaId)).limit(1);
      const [plantilla] = await m.db.select().from(m.planCuentasPlantillas).limit(1);
      const empresa = await m.crearEmpresaConInicializacion({
        rut: `9${sufijo}-3`,
        razonSocial: "Empresa de A",
        giro: "Servicios",
        regimenTributario: "General",
        monedaFuncionalId: moneda!.id,
        permiteMultimoneda: false,
        aplicaIfrs: false,
        planCuentasPlantillaId: plantilla!.id,
        fechaPrimerPeriodoContable: "2026-01-01",
        estado: "Activa",
      } as never);
      return empresa.id;
    });
    await m.crearUsuarioActivoConPassword({
      firmaContableId: firmaA,
      nombre: "Contador A",
      email: `contador-a-${sufijo}@test.local`,
      password: "clave-de-prueba",
      empresas: [{ empresaId: empresaA, rol: "Contador" }],
    });
  });

  after(async () => {
    if (!m) return;
    const { usuarios: cuentas, membresias, firmasContables } = m.plataforma;
    for (const id of [firmaA, firmaB, ...firmasExtra].filter(Boolean)) {
      const miembros = await m.dbPlataforma.select({ id: membresias.usuarioId }).from(membresias).where(eq(membresias.firmaContableId, id));
      for (const u of miembros) await m.dbPlataforma.delete(cuentas).where(eq(cuentas.id, u.id)); // la membresía se va con la cuenta
      await m.dbPlataforma.delete(firmasContables).where(eq(firmasContables.id, id));
    }
    await m.cerrarConexiones();
    const admin = new pg.Client({ connectionString: process.env.FIRMAS_DATABASE_URL });
    await admin.connect();
    for (const base of bases) await admin.query(`drop database if exists "${base}" with (force)`);
    await admin.end();
  });

  test("cada firma tiene su base, migrada y con catálogos", async () => {
    for (const firma of [firmaA, firmaB]) {
      const tipos = await m.conFirma(firma, () => m.db.select().from(m.tiposDocumento));
      assert.ok(tipos.length > 0);
    }
    const [registro] = await m.dbPlataforma.select().from(m.plataforma.firmasContables).where(eq(m.plataforma.firmasContables.id, firmaA));
    assert.equal(registro!.estadoBase, "lista");
    assert.equal(registro!.versionEsquema, m.versionEsquemaFirma());
  });

  test("una empresa de otra firma no existe en la base consultada", async () => {
    assert.ok(await m.conFirma(firmaA, () => m.obtenerEmpresa(empresaA)));
    assert.equal(await m.conFirma(firmaB, () => m.obtenerEmpresa(empresaA)), null);
    assert.deepEqual(await m.conFirma(firmaB, () => m.listarEmpresas()), []);
  });

  test("sin firma activa la base de firma no responde", async () => {
    await assert.rejects(
      () => m.listarEmpresas(),
      (e: Error) => /No hay una firma activa/.test(`${e.message} ${(e.cause as Error | undefined)?.message ?? ""}`),
    );
  });

  test("las transacciones se ejecutan completas en la base de su firma", async () => {
    await assert.rejects(() =>
      m.conFirma(firmaB, () =>
        m.db.transaction(async (tx) => {
          await tx.insert(m.usuarios).values({ nombre: "Temporal", email: `temporal-${sufijo}@test.local` });
          throw new Error("revertir");
        }),
      ),
    );
    const quedo = await m.conFirma(firmaB, () => m.db.select().from(m.usuarios).where(eq(m.usuarios.email, `temporal-${sufijo}@test.local`)));
    assert.equal(quedo.length, 0);
  });

  test("el login trae los roles desde la base de la firma del usuario", async () => {
    const u = await m.verificarCredenciales(`contador-a-${sufijo}@test.local`, "clave-de-prueba");
    assert.deepEqual(u?.firmas.map((f) => f.id), [firmaA]);
    assert.deepEqual(u?.empresasPorFirma[firmaA], [{ empresaId: empresaA, rol: "Contador" }]);
    assert.equal(await m.verificarCredenciales(`contador-a-${sufijo}@test.local`, "otra"), null);
  });

  test("un administrador no puede resetear la contraseña de un usuario de otra firma", async () => {
    const [cuenta] = await m.dbPlataforma.select().from(m.plataforma.usuarios).where(eq(m.plataforma.usuarios.email, `contador-a-${sufijo}@test.local`));
    const actor = { id: cuenta!.id, nombre: "Contador A", esSuperAdmin: false };
    await assert.rejects(() => m.generarTokenReset(cuenta!.id, firmaB, actor), /no pertenece a tu firma/);
    assert.match(await m.generarTokenReset(cuenta!.id, firmaA, actor), /^[0-9a-f]{64}$/);
  });

  test("una firma con la base desactualizada queda en mantenimiento sin afectar a las demás", async () => {
    const { firmasContables } = m.plataforma;
    await m.dbPlataforma.update(firmasContables).set({ versionEsquema: null }).where(eq(firmasContables.id, firmaB));
    m.olvidarConexionFirma(firmaB);
    try {
      await assert.rejects(
        () => m.conFirma(firmaB, () => m.listarEmpresas()),
        (e: Error) => /pendiente de actualización/.test(`${e.message} ${(e.cause as Error | undefined)?.message ?? ""}`),
      );
      assert.equal((await m.conFirma(firmaA, () => m.listarEmpresas())).length, 1);
    } finally {
      await m.migrarBaseFirma(firmaB);
    }
    assert.deepEqual(await m.conFirma(firmaB, () => m.listarEmpresas()), []);
  });

  test("si falla la base, la firma queda en error con su admin invitado y el reintento termina el alta", async () => {
    const { firmasContables, usuarios: cuentas } = m.plataforma;
    const servidor = process.env.FIRMAS_DATABASE_URL!;
    process.env.FIRMAS_DATABASE_URL = "postgres://postgres:postgres@localhost:1/postgres";
    let firmaId = "";
    try {
      await assert.rejects(() =>
        m.crearFirmaConAdmin({
          firma: { rut: `6${sufijo}-4`, razonSocial: "Prueba Reintento", planContratado: "Basico", estado: "Activa" },
          admin: { nombre: "Admin Reintento", email: `admin-reintento-${sufijo}@test.local` },
        }),
      );
    } finally {
      process.env.FIRMAS_DATABASE_URL = servidor;
    }
    const [firma] = await m.dbPlataforma.select().from(firmasContables).where(eq(firmasContables.rut, `6${sufijo}-4`));
    firmaId = firma!.id;
    assert.equal(firma!.estadoBase, "error");
    assert.equal(firma!.conexionCifrada, null);
    const [admin] = await m.dbPlataforma.select().from(cuentas).where(eq(cuentas.email, `admin-reintento-${sufijo}@test.local`));
    assert.equal(admin!.estado, "Invitado");

    const invitaciones = await m.reintentarBaseFirma(firmaId);
    const [lista] = await m.dbPlataforma.select().from(firmasContables).where(eq(firmasContables.id, firmaId));
    bases.push(lista!.baseDatos!);
    firmasExtra.push(firmaId);
    assert.equal(lista!.estadoBase, "lista");
    assert.deepEqual(invitaciones.map((i) => i.email), [`admin-reintento-${sufijo}@test.local`]);
    const reflejo = await m.conFirma(firmaId, () => m.db.select().from(m.usuarios));
    assert.deepEqual(reflejo.map((u) => u.id), [admin!.id]);
    // Reintentar de nuevo no duplica nada.
    await m.reintentarBaseFirma(firmaId);
    assert.equal((await m.conFirma(firmaId, () => m.db.select().from(m.usuarios))).length, 1);
  });

  test("la sesión deja de ser vigente si la cuenta desaparece o se queda sin firmas vigentes", async () => {
    const [cuenta] = await m.dbPlataforma.select().from(m.plataforma.usuarios).where(eq(m.plataforma.usuarios.email, `contador-a-${sufijo}@test.local`));
    const vigente = await m.sesionVigente(cuenta!.id);
    assert.deepEqual(vigente?.firmas.map((f) => f.id), [firmaA]);
    assert.deepEqual(vigente?.empresasPorFirma[firmaA], [{ empresaId: empresaA, rol: "Contador" }]);
    assert.equal(await m.sesionVigente("00000000-0000-4000-8000-000000000000"), null);
    const { firmasContables } = m.plataforma;
    await m.dbPlataforma.update(firmasContables).set({ estado: "Suspendida" }).where(eq(firmasContables.id, firmaA));
    try {
      assert.equal(await m.sesionVigente(cuenta!.id), null);
    } finally {
      await m.dbPlataforma.update(firmasContables).set({ estado: "Activa" }).where(eq(firmasContables.id, firmaA));
    }
  });

  test("una firma suspendida no permite iniciar sesión, pero el superadmin no se queda fuera", async () => {
    const { firmasContables } = m.plataforma;
    const superEmail = `super-${sufijo}@test.local`;
    await m.crearUsuarioActivoConPassword({ firmaContableId: firmaB, nombre: "Super B", email: superEmail, password: "clave-super-1", esAdminFirma: true, esSuperAdmin: true, empresas: [] });
    const contador = `contador-a-${sufijo}@test.local`;
    try {
      assert.ok(await m.verificarCredenciales(contador, "clave-de-prueba"));
      await m.dbPlataforma.update(firmasContables).set({ estado: "Suspendida" }).where(eq(firmasContables.id, firmaA));
      await m.dbPlataforma.update(firmasContables).set({ estado: "Suspendida" }).where(eq(firmasContables.id, firmaB));
      assert.equal(await m.verificarCredenciales(contador, "clave-de-prueba"), null);
      const s = await m.verificarCredenciales(superEmail, "clave-super-1");
      assert.equal(s?.esSuperAdmin, true);
      assert.deepEqual(s?.firmas, []); // su firma está suspendida: entra, pero elige otra desde Firmas
      assert.ok(await m.sesionVigente(s!.id));
      assert.equal(await m.esSuperAdminVigente(s!.id), true);
      // Si además la base de su firma no responde, igual puede entrar a corregirlo.
      await m.dbPlataforma.update(firmasContables).set({ estadoBase: "error" }).where(eq(firmasContables.id, firmaB));
      m.olvidarConexionFirma(firmaB);
      assert.equal((await m.verificarCredenciales(superEmail, "clave-super-1"))?.esSuperAdmin, true);
    } finally {
      await m.dbPlataforma.update(firmasContables).set({ estado: "Activa" }).where(eq(firmasContables.id, firmaA));
      await m.dbPlataforma.update(firmasContables).set({ estado: "Activa", estadoBase: "lista" }).where(eq(firmasContables.id, firmaB));
      m.olvidarConexionFirma(firmaB);
    }
  });

  test("las consultas concurrentes de distintas firmas no se mezclan", async () => {
    const [a, b] = await Promise.all([
      m.conFirma(firmaA, () => m.listarEmpresas()),
      m.conFirma(firmaB, () => m.listarEmpresas()),
    ]);
    assert.equal(a.length, 1);
    assert.equal(b.length, 0);
  });
});
