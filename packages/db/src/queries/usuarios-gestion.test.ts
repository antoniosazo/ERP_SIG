/**
 * Gestión de usuarios de una firma con bases reales (necesita el Postgres local: `pnpm db:local start`).
 * Crea dos firmas de prueba y borra sus bases al terminar; sin Postgres local se omite.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { config } from "dotenv";
import { and, eq, isNull } from "drizzle-orm";
import pg from "pg";

config({ path: path.resolve(import.meta.dirname, "../../../../.env"), quiet: true });
process.env.FIRMAS_PROVEEDOR = "servidor";
const disponible = !!process.env.PLATAFORMA_DATABASE_URL && !!process.env.FIRMAS_DATABASE_URL;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

describe("gestión de usuarios", { skip: !disponible && "sin Postgres local configurado" }, () => {
  const sufijo = Date.now().toString().slice(-7);
  const correo = (n: string) => `${n}-${sufijo}@test.local`;
  let m: typeof import("../index");
  let firma: string;
  let otraFirma: string;
  let empresa: string;
  let empresaAjena: string;
  let admin: { id: string; nombre: string; esSuperAdmin: boolean };
  let adminDos: { id: string; nombre: string; esSuperAdmin: boolean };
  let superadmin: { id: string; nombre: string; esSuperAdmin: boolean };
  let adminB: { id: string; nombre: string; esSuperAdmin: boolean };
  const bases: string[] = [];
  const firmasCreadas: string[] = [];

  const crearEmpresa = (f: string, rut: string) =>
    m.conFirma(f, async () => {
      const [moneda] = await m.db.select().from(m.monedas).where(isNull(m.monedas.empresaId)).limit(1);
      const [plantilla] = await m.db.select().from(m.planCuentasPlantillas).limit(1);
      return (
        await m.crearEmpresaConInicializacion({ rut, razonSocial: `Empresa ${rut}`, giro: "x", regimenTributario: "General", monedaFuncionalId: moneda!.id, permiteMultimoneda: false, aplicaIfrs: false, planCuentasPlantillaId: plantilla!.id, fechaPrimerPeriodoContable: "2026-01-01", estado: "Activa" } as never)
      ).id;
    });
  const cuenta = async (email: string) => (await m.dbPlataforma.select().from(m.plataforma.usuarios).where(eq(m.plataforma.usuarios.email, email)))[0];
  const membresia = async (email: string, f = firma) => {
    const c = await cuenta(email);
    return c && (await m.dbPlataforma.select().from(m.plataforma.membresias).where(and(eq(m.plataforma.membresias.usuarioId, c.id), eq(m.plataforma.membresias.firmaContableId, f))))[0];
  };
  const invitar = async (email: string, extra: Partial<Parameters<typeof m.crearUsuarioInvitado>[1]> = {}) => {
    const r = await m.crearUsuarioInvitado(firma, { nombre: "Persona", email, esAdminFirma: false, empresas: [{ empresaId: empresa, rol: "Contador" }], ...extra }, admin);
    return { ...r, token: r.token! };
  };
  const activar = async (token: string, clave = "clave-segura-1") => m.activarCuentaConToken(token, clave);
  const rechazaCon = (re: RegExp) => (e: Error) => re.test(`${e.message} ${(e.cause as Error | undefined)?.message ?? ""}`);

  before(async () => {
    m = await import("../index");
    await m.migrarPlataforma();
    const a = await m.crearFirmaContable({ rut: `7${sufijo}-1`, razonSocial: "Gestión A", planContratado: "Basico", estado: "Activa" });
    const b = await m.crearFirmaContable({ rut: `8${sufijo}-2`, razonSocial: "Gestión B", planContratado: "Basico", estado: "Activa" });
    firma = a.id;
    otraFirma = b.id;
    firmasCreadas.push(a.id, b.id);
    bases.push(a.baseDatos!, b.baseDatos!);
    empresa = await crearEmpresa(firma, `9${sufijo}-3`);
    empresaAjena = await crearEmpresa(otraFirma, `6${sufijo}-4`);
    const crearAdmin = async (n: string, extra: { esSuperAdmin?: boolean } = {}) => {
      const r = await m.crearUsuarioActivoConPassword({ firmaContableId: firma, nombre: n, email: correo(n.toLowerCase()), password: "clave-admin-1", esAdminFirma: true, esSuperAdmin: extra.esSuperAdmin, empresas: [] });
      return { id: r.usuarioId, nombre: n, esSuperAdmin: !!extra.esSuperAdmin };
    };
    admin = await crearAdmin("Admin1");
    adminDos = await crearAdmin("Admin2");
    superadmin = await crearAdmin("Super", { esSuperAdmin: true });
    const rB = await m.crearUsuarioActivoConPassword({ firmaContableId: otraFirma, nombre: "AdminB", email: correo("adminb"), password: "clave-admin-1", esAdminFirma: true, empresas: [] });
    adminB = { id: rB.usuarioId, nombre: "AdminB", esSuperAdmin: false };
  });

  after(async () => {
    if (!m) return;
    const { usuarios: cuentas, membresias, firmasContables } = m.plataforma;
    for (const id of firmasCreadas) {
      const miembros = await m.dbPlataforma.select({ id: membresias.usuarioId }).from(membresias).where(eq(membresias.firmaContableId, id));
      for (const u of miembros) await m.dbPlataforma.delete(cuentas).where(eq(cuentas.id, u.id)); // la membresía se va con la cuenta
    }
    for (const id of firmasCreadas) await m.dbPlataforma.delete(firmasContables).where(eq(firmasContables.id, id));
    await m.cerrarConexiones();
    const servidor = new pg.Client({ connectionString: process.env.FIRMAS_DATABASE_URL });
    await servidor.connect();
    for (const base of bases) await servidor.query(`drop database if exists "${base}" with (force)`);
    await servidor.end();
  });

  test("el email se normaliza y no se puede repetir cambiando mayúsculas", async () => {
    const r = await invitar(`  Nuevo.${sufijo}@TEST.local `);
    assert.equal((await cuenta(`nuevo.${sufijo}@test.local`))?.id, r.usuarioId);
    await assert.rejects(() => invitar(`NUEVO.${sufijo}@test.local`), /ya pertenece a esta firma/);
    assert.equal(await m.verificarCredenciales(`NUEVO.${sufijo}@test.local`, "x"), null); // existe pero sin activar
    await activar(r.token);
    assert.equal((await m.verificarCredenciales(` Nuevo.${sufijo}@Test.LOCAL`, "clave-segura-1"))?.id, r.usuarioId);
  });

  test("los errores de asignación son claros y no dejan cuentas a medias", async () => {
    await assert.rejects(() => invitar(correo("dup"), { empresas: [{ empresaId: empresa, rol: "Contador" }, { empresaId: empresa, rol: "Asistente" }] }), /solo puede asignarse una vez/);
    await assert.rejects(() => invitar(correo("ajena"), { empresas: [{ empresaId: empresaAjena, rol: "Contador" }] }), /no pertenece a esta firma/);
    assert.equal(await cuenta(correo("dup")), undefined);
    assert.equal(await cuenta(correo("ajena")), undefined);
  });

  test("el link se guarda con hash y el nuevo deja sin efecto al anterior", async () => {
    const r = await invitar(correo("links"));
    const { tokensAcceso } = m.plataforma;
    assert.equal((await m.dbPlataforma.select().from(tokensAcceso).where(eq(tokensAcceso.token, r.token))).length, 0);
    assert.equal((await m.dbPlataforma.select().from(tokensAcceso).where(eq(tokensAcceso.token, sha(r.token)))).length, 1);
    assert.ok(await m.obtenerTokenValido(r.token));
    const nuevo = await m.reenviarInvitacion(r.usuarioId, firma, admin);
    assert.equal(await m.obtenerTokenValido(r.token), null);
    assert.ok(await m.obtenerTokenValido(nuevo));
    assert.equal(await activar(r.token), false);
    assert.equal(await activar(nuevo), true);
    assert.equal(await m.obtenerTokenValido(nuevo), null);
    await assert.rejects(() => m.reenviarInvitacion(r.usuarioId, firma, admin), /aún no activa su cuenta/);
  });

  test("suspender bloquea el acceso, anula los links y un link no lo reactiva", async () => {
    const r = await invitar(correo("susp"));
    await activar(r.token);
    const sesion = await m.verificarCredenciales(correo("susp"), "clave-segura-1");
    assert.ok(sesion && (await m.sesionVigente(sesion.id)));
    const reset = await m.generarTokenReset(r.usuarioId, firma, admin);

    assert.deepEqual(await m.cambiarEstadoUsuario(r.usuarioId, firma, "suspender", admin, "Se fue de la firma"), { estado: "Suspendido" });
    assert.equal(await m.verificarCredenciales(correo("susp"), "clave-segura-1"), null);
    assert.equal(await m.sesionVigente(sesion!.id), null);
    assert.equal(await m.obtenerTokenValido(reset), null);
    assert.equal(await activar(reset), false);
    await assert.rejects(() => m.generarTokenReset(r.usuarioId, firma, admin), /suspendida/);
    await assert.rejects(() => m.cambiarEstadoUsuario(r.usuarioId, firma, "suspender", admin), /ya está suspendida/);

    assert.deepEqual(await m.cambiarEstadoUsuario(r.usuarioId, firma, "reactivar", admin), { estado: "Activo" });
    assert.ok(await m.verificarCredenciales(correo("susp"), "clave-segura-1"));
    await assert.rejects(() => m.cambiarEstadoUsuario(r.usuarioId, firma, "reactivar", admin), /Solo se reactivan/);

    const historial = await m.historialDeUsuario(r.usuarioId, firma, admin);
    assert.deepEqual(historial.map((h) => h.accion).sort(), ["cambio_estado", "cambio_estado", "crear", "editar"]);
    assert.equal(historial.find((h) => h.motivo)?.motivo, "Se fue de la firma");
    assert.ok(historial.every((h) => h.usuarioNombre));
  });

  test("quien nunca activó su cuenta vuelve a Invitado al reactivarlo", async () => {
    const r = await invitar(correo("nunca"));
    await m.cambiarEstadoUsuario(r.usuarioId, firma, "suspender", admin);
    assert.equal(await activar(r.token), false);
    assert.deepEqual(await m.cambiarEstadoUsuario(r.usuarioId, firma, "reactivar", admin), { estado: "Invitado" });
    assert.equal(await m.obtenerTokenValido(r.token), null);
    assert.ok(await m.obtenerTokenValido(await m.reenviarInvitacion(r.usuarioId, firma, admin)));
  });

  test("nadie se suspende a sí mismo ni deja la firma sin administrador", async () => {
    await assert.rejects(() => m.cambiarEstadoUsuario(admin.id, firma, "suspender", admin), /tu propia cuenta/);

    // Una firma con exactamente dos administradores.
    const solo = await m.crearFirmaContable({ rut: `5${sufijo}-5`, razonSocial: "Gestión Solo", planContratado: "Basico", estado: "Activa" });
    firmasCreadas.push(solo.id);
    bases.push(solo.baseDatos!);
    const crear = async (n: string) => {
      const r = await m.crearUsuarioActivoConPassword({ firmaContableId: solo.id, nombre: n, email: correo(n.toLowerCase()), password: "clave-admin-1", esAdminFirma: true, empresas: [] });
      return { id: r.usuarioId, nombre: n, esSuperAdmin: false };
    };
    const uno = await crear("Primero");
    const dos = await crear("Segundo");

    await m.cambiarEstadoUsuario(dos.id, solo.id, "suspender", uno); // queda uno activo: permitido
    // Con uno solo activo, no se le puede quitar el nivel de administrador ni suspenderlo.
    await assert.rejects(() => m.editarUsuario(uno.id, solo.id, { nombre: "Primero", esAdminFirma: false, empresas: [] }, dos), /tu propio nivel|al menos un administrador activo/);
    await assert.rejects(() => m.cambiarEstadoUsuario(uno.id, solo.id, "suspender", dos), /al menos un administrador activo/);
    await m.cambiarEstadoUsuario(dos.id, solo.id, "reactivar", uno);
    await m.cambiarEstadoUsuario(uno.id, solo.id, "suspender", dos); // hay otro activo: permitido
  });

  test("un administrador de firma no puede gestionar la cuenta de un superadmin", async () => {
    const soloEsAdmin = /Solo un superadmin/;
    await assert.rejects(() => m.generarTokenReset(superadmin.id, firma, admin), soloEsAdmin);
    await assert.rejects(() => m.cambiarEstadoUsuario(superadmin.id, firma, "suspender", admin), soloEsAdmin);
    await assert.rejects(() => m.editarUsuario(superadmin.id, firma, { nombre: "X", esAdminFirma: true, empresas: [] }, admin), soloEsAdmin);
    await assert.rejects(() => m.historialDeUsuario(superadmin.id, firma, admin), soloEsAdmin);
    assert.match(await m.generarTokenReset(superadmin.id, firma, superadmin), /^[0-9a-f]{64}$/);
  });

  test("editar cambia nombre, empresas y roles en la plataforma y en la firma", async () => {
    const segunda = await crearEmpresa(firma, `4${sufijo}-6`);
    const r = await invitar(correo("edit"));
    await m.editarUsuario(r.usuarioId, firma, { nombre: "Nombre Nuevo", esAdminFirma: false, empresas: [{ empresaId: empresa, rol: "Asistente" }, { empresaId: segunda, rol: "Administrador" }] }, admin);
    const fila = (await m.listarUsuariosDeFirma(firma)).find((u) => u.id === r.usuarioId)!;
    assert.equal(fila.nombre, "Nombre Nuevo");
    assert.deepEqual(fila.asignaciones.map((a) => `${a.empresaId}:${a.rol}`).sort(), [`${empresa}:Asistente`, `${segunda}:Administrador`].sort());
    assert.ok(fila.invitacionVenceEn);
    assert.equal(fila.tieneClave, false);
    assert.equal((await m.conFirma(firma, () => m.db.select().from(m.usuarios).where(eq(m.usuarios.id, r.usuarioId))))[0]!.nombre, "Nombre Nuevo");
    const h = await m.historialDeUsuario(r.usuarioId, firma, admin);
    const edicion = h.find((x) => x.accion === "editar" && (x.valoresAnteriores as { nombre?: string } | null)?.nombre === "Persona");
    assert.ok(edicion, "la edición queda en la bitácora con el antes y el después");
  });

  test("editar valida: empresas repetidas o ajenas, email solo si está invitado y nivel de admin", async () => {
    const r = await invitar(correo("edit2"));
    const base = { nombre: "N", esAdminFirma: false };
    await assert.rejects(() => m.editarUsuario(r.usuarioId, firma, { ...base, empresas: [{ empresaId: empresa, rol: "Contador" }, { empresaId: empresa, rol: "Contador" }] }, admin), /solo puede asignarse una vez/);
    await assert.rejects(() => m.editarUsuario(r.usuarioId, firma, { ...base, empresas: [{ empresaId: empresaAjena, rol: "Contador" }] }, admin), /no pertenece a esta firma/);
    // Invitado: puede corregir el email, pero no tomar uno ajeno.
    await assert.rejects(() => m.editarUsuario(r.usuarioId, firma, { ...base, email: correo("admin1"), empresas: [{ empresaId: empresa, rol: "Contador" }] }, admin), /Ya existe un usuario con ese email/);
    await m.editarUsuario(r.usuarioId, firma, { ...base, email: correo("corregido").toUpperCase(), empresas: [{ empresaId: empresa, rol: "Contador" }] }, admin);
    assert.ok(await cuenta(correo("corregido")));
    assert.equal((await m.conFirma(firma, () => m.db.select().from(m.usuarios).where(eq(m.usuarios.id, r.usuarioId))))[0]!.email, correo("corregido"));
    // Ya activo: el email no cambia.
    await activar(await m.reenviarInvitacion(r.usuarioId, firma, admin));
    await assert.rejects(() => m.editarUsuario(r.usuarioId, firma, { ...base, email: correo("otro-mail"), empresas: [{ empresaId: empresa, rol: "Contador" }] }, admin), /solo se corrige mientras la invitación está pendiente/);
    // Nivel de administrador: no el propio, y no al último activo.
    await assert.rejects(() => m.editarUsuario(admin.id, firma, { nombre: "Admin1", esAdminFirma: false, empresas: [{ empresaId: empresa, rol: "Contador" }] }, admin), /tu propio nivel/);
    await m.editarUsuario(r.usuarioId, firma, { ...base, esAdminFirma: true, empresas: [] }, admin);
    assert.equal((await membresia(correo("corregido")))!.esAdminFirma, true);
  });

  /** Una persona con cuenta activa en la firma A, lista para sumarla a la B. */
  const personaActiva = async (nombre: string) => {
    const email = correo(nombre);
    const r = await invitar(email);
    await activar(r.token, "clave-persona-1");
    return { id: r.usuarioId, email, nombre };
  };
  const invitarEnB = (email: string, rol: "Contador" | "Asistente" = "Asistente") =>
    m.crearUsuarioInvitado(otraFirma, { nombre: "Otro nombre", email, esAdminFirma: false, empresas: [{ empresaId: empresaAjena, rol }] }, adminB);

  test("una cuenta activa se suma a otra firma con su misma contraseña y sin link", async () => {
    const p = await personaActiva("multi");
    const r = await invitarEnB(p.email.toUpperCase());
    assert.deepEqual({ yaTeniaCuenta: r.yaTeniaCuenta, token: r.token, mismaCuenta: r.usuarioId === p.id }, { yaTeniaCuenta: true, token: null, mismaCuenta: true });
    assert.equal((await m.dbPlataforma.select().from(m.plataforma.usuarios).where(eq(m.plataforma.usuarios.email, p.email))).length, 1);

    const sesion = await m.verificarCredenciales(p.email, "clave-persona-1");
    assert.deepEqual(sesion?.firmas.map((f) => f.id).sort(), [firma, otraFirma].sort());
    assert.deepEqual(sesion?.empresasPorFirma[firma], [{ empresaId: empresa, rol: "Contador" }]);
    assert.deepEqual(sesion?.empresasPorFirma[otraFirma], [{ empresaId: empresaAjena, rol: "Asistente" }]);
    // Cada firma ve solo lo suyo: nunca los roles de la otra.
    assert.equal((await m.listarUsuariosDeFirma(otraFirma)).find((u) => u.id === p.id)!.asignaciones.length, 1);
    assert.equal((await m.listarUsuariosDeFirma(firma)).find((u) => u.id === p.id)!.otrasFirmas, 1);
    assert.equal((await m.conFirma(otraFirma, () => m.db.select().from(m.usuarios).where(eq(m.usuarios.id, p.id)))).length, 1);
  });

  test("suspender en una firma no afecta el acceso a las otras", async () => {
    const p = await personaActiva("susp-uno");
    await invitarEnB(p.email);
    await m.cambiarEstadoUsuario(p.id, otraFirma, "suspender", adminB);
    const sesion = await m.verificarCredenciales(p.email, "clave-persona-1");
    assert.deepEqual(sesion?.firmas.map((f) => f.id), [firma]);
    assert.ok(await m.sesionVigente(p.id));
    assert.equal((await m.listarUsuariosDeFirma(otraFirma)).find((u) => u.id === p.id)!.estado, "Suspendido");
    assert.equal((await m.listarUsuariosDeFirma(firma)).find((u) => u.id === p.id)!.estado, "Activo");
    // Si la suspenden también en la otra, ya no tiene a dónde entrar.
    await m.cambiarEstadoUsuario(p.id, firma, "suspender", admin);
    assert.equal(await m.verificarCredenciales(p.email, "clave-persona-1"), null);
    assert.equal(await m.sesionVigente(p.id), null);
    await m.cambiarEstadoUsuario(p.id, otraFirma, "reactivar", adminB);
    assert.deepEqual((await m.verificarCredenciales(p.email, "clave-persona-1"))?.firmas.map((f) => f.id), [otraFirma]);
  });

  test("una firma no puede tomar ni renombrar una cuenta que trabaja en otras firmas", async () => {
    const p = await personaActiva("compartida");
    await invitarEnB(p.email);
    const compartida = /también trabaja en otras firmas/;
    await assert.rejects(() => m.generarTokenReset(p.id, firma, admin), compartida);
    await assert.rejects(() => m.generarTokenReset(p.id, otraFirma, adminB), compartida);
    await assert.rejects(() => m.editarUsuario(p.id, firma, { nombre: "Nombre distinto", esAdminFirma: false, empresas: [{ empresaId: empresa, rol: "Contador" }] }, admin), compartida);
    // Lo que es de la firma sí se edita: sus roles y su nivel aquí no tocan a las otras firmas.
    await m.editarUsuario(p.id, firma, { nombre: p.nombre === "compartida" ? "Persona" : p.nombre, esAdminFirma: false, empresas: [{ empresaId: empresa, rol: "Administrador" }] }, admin);
    const sesion = await m.verificarCredenciales(p.email, "clave-persona-1");
    assert.deepEqual(sesion?.empresasPorFirma[firma], [{ empresaId: empresa, rol: "Administrador" }]);
    assert.equal(sesion?.empresasPorFirma[otraFirma]?.[0]?.rol, "Asistente");
    // Un superadmin sí puede generar el reseteo.
    assert.match(await m.generarTokenReset(p.id, firma, superadmin), /^[0-9a-f]{64}$/);
  });

  test("sumar una cuenta existente a una firma tiene condiciones", async () => {
    const p = await personaActiva("cond");
    await invitarEnB(p.email);
    await assert.rejects(() => invitarEnB(p.email), /ya pertenece a esta firma/);
    // Con invitación pendiente en otra firma, no se disputa su link.
    const pendiente = await invitar(correo("pendiente"));
    await assert.rejects(() => invitarEnB(correo("pendiente")), /invitación pendiente en otra firma/);
    assert.ok(await m.obtenerTokenValido(pendiente.token));
    // La cuenta de un superadmin no se menciona a quien no lo es.
    await assert.rejects(() => invitarEnB(correo("super")), /Ya existe un usuario con ese email/);
    // Empresa de la otra firma: mensaje claro y sin dejar un acceso a medias.
    await assert.rejects(() => m.crearUsuarioInvitado(otraFirma, { nombre: "x", email: p.email.replace("cond", "cond2"), esAdminFirma: false, empresas: [{ empresaId: empresa, rol: "Contador" }] }, adminB), /no pertenece a esta firma/);
    const sinMembresia = await m.dbPlataforma.select().from(m.plataforma.usuarios).where(eq(m.plataforma.usuarios.email, p.email.replace("cond", "cond2")));
    assert.equal(sinMembresia.length, 0);
  });

  test("al crear una firma con un administrador que ya tiene cuenta, se le da acceso con esa cuenta", async () => {
    const p = await personaActiva("fundador");
    const r = await m.crearFirmaConAdmin({
      firma: { rut: `3${sufijo}-7`, razonSocial: "Gestión Tres", planContratado: "Basico", estado: "Activa" },
      admin: { nombre: "Otro nombre", email: p.email.toUpperCase() },
    });
    const [nueva] = await m.dbPlataforma.select().from(m.plataforma.firmasContables).where(eq(m.plataforma.firmasContables.id, r.firmaId));
    firmasCreadas.push(r.firmaId);
    bases.push(nueva!.baseDatos!);
    assert.deepEqual({ token: r.token, yaTeniaCuenta: r.yaTeniaCuenta, mismaCuenta: r.usuarioId === p.id }, { token: null, yaTeniaCuenta: true, mismaCuenta: true });
    const miembro = (await m.listarUsuariosDeFirma(r.firmaId)).find((u) => u.id === p.id)!;
    assert.deepEqual({ admin: miembro.esAdminFirma, otras: miembro.otrasFirmas }, { admin: true, otras: 1 });
    assert.deepEqual((await m.conFirma(r.firmaId, () => m.db.select().from(m.usuarios))).map((u) => u.id), [p.id]);
    const sesion = await m.verificarCredenciales(p.email, "clave-persona-1");
    assert.equal(sesion?.firmas.find((f) => f.id === r.firmaId)?.esAdminFirma, true);
    assert.equal(sesion?.firmas.find((f) => f.id === firma)?.esAdminFirma, false);
    // Con una invitación pendiente no se puede: sería disputar su link.
    const pendiente = await invitar(correo("pend-fundador"));
    await assert.rejects(() => m.crearFirmaConAdmin({ firma: { rut: `2${sufijo}-8`, razonSocial: "Gestión Cuatro", planContratado: "Basico", estado: "Activa" }, admin: { nombre: "x", email: correo("pend-fundador") } }), /invitación pendiente en otra firma/);
    assert.equal((await m.dbPlataforma.select().from(m.plataforma.firmasContables).where(eq(m.plataforma.firmasContables.rut, `2${sufijo}-8`))).length, 0);
    assert.ok(await m.obtenerTokenValido(pendiente.token));
  });

  test("resetear la contraseña exige una cuenta activa y deja constancia", async () => {
    const r = await invitar(correo("reset"));
    await assert.rejects(() => m.generarTokenReset(r.usuarioId, firma, admin), /reenvía la invitación/);
    await activar(r.token);
    const a = await m.generarTokenReset(r.usuarioId, firma, admin);
    const b = await m.generarTokenReset(r.usuarioId, firma, admin);
    assert.equal(await m.obtenerTokenValido(a), null);
    assert.ok(await m.obtenerTokenValido(b));
    assert.equal(await activar(b, "otra-clave-9"), true);
    assert.ok(await m.verificarCredenciales(correo("reset"), "otra-clave-9"));
    const h = await m.historialDeUsuario(r.usuarioId, firma, admin);
    assert.equal(h.filter((x) => (x.valoresNuevos as { evento?: string } | null)?.evento === "reseteo_de_contraseña").length, 2);
  });
});
