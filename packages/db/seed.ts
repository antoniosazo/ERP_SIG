import path from "node:path";
import { config } from "dotenv";
import type { ClaseCuenta, NaturalezaCuenta, TipoCuenta } from "@erp/shared";

// Debe cargarse antes de importar "./src/client" (que crea el Pool al importarse).
config({ path: path.resolve(process.cwd(), "../../.env") });

const { db } = await import("./src/client");
const { bancos, impuestos, monedas, planCuentas, planCuentasPlantillas, tiposDocumento } =
  await import("./src/schema");

type CuentaSeed = {
  codigo: string;
  nombre: string;
  naturaleza: NaturalezaCuenta;
  tipoCuenta?: TipoCuenta;
  clasificacionCorriente?: "Corriente" | "No Corriente";
  hijos?: CuentaSeed[];
};

type RaizSeed = {
  clase: ClaseCuenta;
  cuenta: CuentaSeed;
};

/**
 * Plantilla mínima "PYME Genérico Chile": respeta las 6 clases fijas de nivel 1 (3.2)
 * con suficientes cuentas de ejemplo (cuentas puente de terceros, IVA, gastos típicos)
 * para poder probar de punta a punta el flujo de alta de empresa (Proceso 0).
 */
const PLANTILLA_PYME_GENERICO: RaizSeed[] = [
  {
    clase: "Activo",
    cuenta: {
      codigo: "1",
      nombre: "Activo",
      naturaleza: "Deudora",
      hijos: [
        {
          codigo: "1.1",
          nombre: "Activo Corriente",
          naturaleza: "Deudora",
          hijos: [
            { codigo: "1.1.1", nombre: "Caja y Bancos", naturaleza: "Deudora", tipoCuenta: "Banco", clasificacionCorriente: "Corriente" },
            { codigo: "1.1.2", nombre: "Clientes Nacionales", naturaleza: "Deudora", tipoCuenta: "Cliente", clasificacionCorriente: "Corriente" },
            { codigo: "1.1.3", nombre: "IVA Crédito Fiscal", naturaleza: "Deudora", tipoCuenta: "Impuesto", clasificacionCorriente: "Corriente" },
          ],
        },
        {
          codigo: "1.2",
          nombre: "Activo No Corriente",
          naturaleza: "Deudora",
          hijos: [
            { codigo: "1.2.1", nombre: "Activo Fijo", naturaleza: "Deudora", tipoCuenta: "ActivoFijo", clasificacionCorriente: "No Corriente" },
            { codigo: "1.2.2", nombre: "Depreciación Acumulada", naturaleza: "Acreedora", tipoCuenta: "ActivoFijo", clasificacionCorriente: "No Corriente" },
          ],
        },
      ],
    },
  },
  {
    clase: "Pasivo",
    cuenta: {
      codigo: "2",
      nombre: "Pasivo",
      naturaleza: "Acreedora",
      hijos: [
        {
          codigo: "2.1",
          nombre: "Pasivo Corriente",
          naturaleza: "Acreedora",
          hijos: [
            { codigo: "2.1.1", nombre: "Proveedores Nacionales", naturaleza: "Acreedora", tipoCuenta: "Proveedor", clasificacionCorriente: "Corriente" },
            { codigo: "2.1.2", nombre: "IVA Débito Fiscal", naturaleza: "Acreedora", tipoCuenta: "Impuesto", clasificacionCorriente: "Corriente" },
            { codigo: "2.1.3", nombre: "Retenciones por Pagar", naturaleza: "Acreedora", tipoCuenta: "Impuesto", clasificacionCorriente: "Corriente" },
          ],
        },
        {
          codigo: "2.2",
          nombre: "Pasivo No Corriente",
          naturaleza: "Acreedora",
          hijos: [
            { codigo: "2.2.1", nombre: "Préstamos Bancarios Largo Plazo", naturaleza: "Acreedora", clasificacionCorriente: "No Corriente" },
          ],
        },
      ],
    },
  },
  {
    clase: "Patrimonio",
    cuenta: {
      codigo: "3",
      nombre: "Patrimonio",
      naturaleza: "Acreedora",
      hijos: [
        { codigo: "3.1", nombre: "Capital", naturaleza: "Acreedora", tipoCuenta: "Patrimonio" },
        { codigo: "3.2", nombre: "Resultados Acumulados", naturaleza: "Acreedora", tipoCuenta: "Patrimonio" },
        { codigo: "3.3", nombre: "Resultado del Ejercicio", naturaleza: "Acreedora", tipoCuenta: "Patrimonio" },
      ],
    },
  },
  {
    clase: "Ingresos",
    cuenta: {
      codigo: "4",
      nombre: "Ingresos",
      naturaleza: "Acreedora",
      hijos: [
        {
          codigo: "4.1",
          nombre: "Ingresos Operacionales",
          naturaleza: "Acreedora",
          hijos: [
            { codigo: "4.1.1", nombre: "Ventas", naturaleza: "Acreedora", tipoCuenta: "Ingreso" },
            { codigo: "4.1.2", nombre: "Servicios Prestados", naturaleza: "Acreedora", tipoCuenta: "Ingreso" },
          ],
        },
        {
          codigo: "4.2",
          nombre: "Ingresos No Operacionales",
          naturaleza: "Acreedora",
          hijos: [{ codigo: "4.2.1", nombre: "Otros Ingresos", naturaleza: "Acreedora", tipoCuenta: "Ingreso" }],
        },
      ],
    },
  },
  {
    clase: "Costos y Gastos",
    cuenta: {
      codigo: "5",
      nombre: "Costos y Gastos",
      naturaleza: "Deudora",
      hijos: [
        { codigo: "5.1", nombre: "Costo de Ventas", naturaleza: "Deudora", tipoCuenta: "Costo" },
        {
          codigo: "5.2",
          nombre: "Gastos de Administración",
          naturaleza: "Deudora",
          hijos: [
            { codigo: "5.2.1", nombre: "Gastos Básicos - Electricidad", naturaleza: "Deudora", tipoCuenta: "Gasto" },
            { codigo: "5.2.2", nombre: "Arriendo", naturaleza: "Deudora", tipoCuenta: "Gasto" },
            { codigo: "5.2.3", nombre: "Honorarios Profesionales", naturaleza: "Deudora", tipoCuenta: "Gasto" },
            { codigo: "5.2.4", nombre: "Materiales de Oficina", naturaleza: "Deudora", tipoCuenta: "Gasto" },
          ],
        },
        { codigo: "5.3", nombre: "Gastos Financieros", naturaleza: "Deudora", tipoCuenta: "Gasto" },
      ],
    },
  },
  {
    clase: "Cuentas de Orden",
    cuenta: {
      codigo: "6",
      nombre: "Cuentas de Orden",
      naturaleza: "Deudora",
      hijos: [
        { codigo: "6.1", nombre: "Cuentas de Orden Deudoras", naturaleza: "Deudora", tipoCuenta: "Orden" },
        { codigo: "6.2", nombre: "Cuentas de Orden Acreedoras", naturaleza: "Acreedora", tipoCuenta: "Orden" },
      ],
    },
  },
];

const MONEDAS_SEED = [
  { codigo: "CLP", nombre: "Peso Chileno", tipo: "Moneda" as const, simbolo: "$", decimales: 0 },
  { codigo: "USD", nombre: "Dólar Americano", tipo: "Moneda" as const, simbolo: "US$", decimales: 2 },
  { codigo: "UF", nombre: "Unidad de Fomento", tipo: "Unidad de Reajuste" as const, simbolo: "UF", decimales: 4 },
  { codigo: "UTM", nombre: "Unidad Tributaria Mensual", tipo: "Unidad de Reajuste" as const, simbolo: "UTM", decimales: 0 },
];

const TIPOS_DOCUMENTO_SEED = [
  { codigoSii: "33", nombre: "Factura Electrónica", tipoOperacion: "Ambos" as const, afectoIva: true, documentoRelacionable: true },
  { codigoSii: "34", nombre: "Factura Exenta Electrónica", tipoOperacion: "Ambos" as const, afectoIva: false, documentoRelacionable: true },
  { codigoSii: "39", nombre: "Boleta Electrónica", tipoOperacion: "Venta" as const, afectoIva: true, documentoRelacionable: true },
  { codigoSii: "56", nombre: "Nota de Débito Electrónica", tipoOperacion: "Ambos" as const, afectoIva: true, documentoRelacionable: true },
  { codigoSii: "61", nombre: "Nota de Crédito Electrónica", tipoOperacion: "Ambos" as const, afectoIva: true, documentoRelacionable: true },
  { codigoSii: "HON", nombre: "Boleta de Honorarios Electrónica", tipoOperacion: "Compra" as const, afectoIva: false, documentoRelacionable: false },
];

// Impuestos plantilla (empresa_id NULL) — se clonan a cada empresa al crearla.
const IMPUESTOS_SEED = [
  { codigo: "IVA-DF", nombre: "IVA Débito Fiscal", tipo: "IVA Débito" as const, tasa: "19", aplicaA: "Venta" as const, recuperableDefault: null },
  { codigo: "IVA-CF", nombre: "IVA Crédito Fiscal", tipo: "IVA Crédito" as const, tasa: "19", aplicaA: "Compra" as const, recuperableDefault: "Total" as const },
  { codigo: "EXE", nombre: "Exento", tipo: "Exento" as const, tasa: "0", aplicaA: "Ambos" as const, recuperableDefault: null },
  { codigo: "NAF", nombre: "No Afecto", tipo: "No Afecto" as const, tasa: "0", aplicaA: "Ambos" as const, recuperableDefault: null },
];

const BANCOS_SEED = [
  { nombre: "Banco de Chile", codigoSbif: "001" },
  { nombre: "Banco Estado", codigoSbif: "012" },
  { nombre: "Banco Santander", codigoSbif: "037" },
  { nombre: "Banco de Crédito e Inversiones (BCI)", codigoSbif: "016" },
  { nombre: "Scotiabank Chile", codigoSbif: "014" },
];

async function sembrarMonedas() {
  await db.insert(monedas).values(MONEDAS_SEED).onConflictDoNothing();
  console.log(`Monedas: ${MONEDAS_SEED.length} sembradas (o ya existentes).`);
}

async function sembrarImpuestos() {
  await db.insert(impuestos).values(IMPUESTOS_SEED).onConflictDoNothing();
  console.log(`Impuestos: ${IMPUESTOS_SEED.length} plantillas sembradas (o ya existentes).`);
}

async function sembrarTiposDocumento() {
  await db.insert(tiposDocumento).values(TIPOS_DOCUMENTO_SEED).onConflictDoNothing();
  console.log(`Tipos de documento: ${TIPOS_DOCUMENTO_SEED.length} sembrados (o ya existentes).`);
}

async function sembrarBancos() {
  await db.insert(bancos).values(BANCOS_SEED).onConflictDoNothing();
  console.log(`Bancos: ${BANCOS_SEED.length} sembrados (o ya existentes).`);
}

async function sembrarPlantillaPlanCuentas() {
  const [plantilla] = await db
    .insert(planCuentasPlantillas)
    .values({
      codigo: "PYME-CL",
      nombre: "PYME Genérico Chile",
      descripcion: "Plantilla mínima de plan de cuentas respetando las 6 clases fijas de nivel 1.",
    })
    .onConflictDoNothing()
    .returning();

  if (!plantilla) {
    console.log("Plantilla de plan de cuentas ya existía, se omite el árbol de cuentas.");
    return;
  }

  const plantillaId = plantilla.id;

  async function insertarCuenta(
    cuenta: CuentaSeed,
    clase: ClaseCuenta,
    cuentaPadreId: string | null,
  ) {
    const esHoja = !cuenta.hijos || cuenta.hijos.length === 0;
    const [nueva] = await db
      .insert(planCuentas)
      .values({
        plantillaId,
        empresaId: null,
        cuentaPadreId,
        codigoCuenta: cuenta.codigo,
        nombreCuenta: cuenta.nombre,
        clase,
        naturaleza: cuenta.naturaleza,
        tipoCuenta: cuenta.tipoCuenta ?? "Otra",
        clasificacionCorriente: cuenta.clasificacionCorriente ?? "No Aplica",
        nivelImputable: esHoja,
      })
      .returning({ id: planCuentas.id });

    if (!nueva) throw new Error(`No se pudo insertar la cuenta ${cuenta.codigo}`);

    for (const hijo of cuenta.hijos ?? []) {
      await insertarCuenta(hijo, clase, nueva.id);
    }
  }

  for (const raiz of PLANTILLA_PYME_GENERICO) {
    await insertarCuenta(raiz.cuenta, raiz.clase, null);
  }

  console.log("Plantilla 'PYME Genérico Chile' sembrada con su árbol de cuentas.");
}

async function main() {
  await sembrarMonedas();
  await sembrarImpuestos();
  await sembrarTiposDocumento();
  await sembrarBancos();
  await sembrarPlantillaPlanCuentas();
  console.log("Seed completo.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Error en el seed:", error);
  process.exit(1);
});
