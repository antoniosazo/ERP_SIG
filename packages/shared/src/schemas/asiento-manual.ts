import { z } from "zod";
import { LIBRO_CONTABLE } from "../enums";
import { uuid } from "./primitives";
import { fechaConsultaCuentaSchema as fechaISO, rangoConsultaCuentaSchema } from "../consulta-plan-cuentas";

/**
 * Tipos que el usuario puede elegir en un asiento manual. `automatico` queda reservado a
 * los módulos; `ajuste` es el asiento de ajuste de cierre (columna aparte en el balance).
 */
export const ASIENTO_MANUAL_TIPO = ["traspaso", "ingreso", "egreso", "ajuste"] as const;
export type AsientoManualTipo = (typeof ASIENTO_MANUAL_TIPO)[number];

/** Tolerancia de cuadratura en moneda funcional (mismo criterio que pagos). */
export const TOLERANCIA_CUADRATURA = 0.005;

// Los manuales se registran en centavos: no aceptar cifras que luego se pierdan
// al redondear ni montos fuera de la precisión segura de JavaScript.
const monto = z.number().min(0, "Los montos no pueden ser negativos")
  .max(90_000_000_000_000, "El monto supera la precisión permitida")
  .multipleOf(0.01, "Los montos admiten como máximo dos decimales");

export const ROLES_FINANZAS = ["Administrador", "Contador"];
export function puedeEditarFinanzas(esAdminFirma: boolean, rol: string | null) {
  return esAdminFirma || (rol !== null && ROLES_FINANZAS.includes(rol));
}

export const TIPO_ASIENTO_LABEL: Record<string, string> = {
  traspaso: "Traspaso", ingreso: "Ingreso", egreso: "Egreso", ajuste: "Ajuste de cierre",
  manual: "Manual", automatico: "Automático",
};

/** Valida también parámetros repetidos en la URL antes de consultar el diario. */
export const filtrosAsientosSchema = rangoConsultaCuentaSchema.safeExtend({
  estado: z.enum(["", "borrador", "contabilizado"]).optional(),
  origen: z.enum(["", "manual", "automatico"]).optional(),
  q: z.string().trim().max(200).optional(),
});

export function validarFiltrosAsientos(params: Record<string, unknown>, hoy: string) {
  const hasta = params.hasta === undefined ? hoy : params.hasta;
  const desde = params.desde === undefined
    ? `${typeof hasta === "string" && fechaISO.safeParse(hasta).success ? hasta.slice(0, 7) : hoy.slice(0, 7)}-01`
    : params.desde;
  return filtrosAsientosSchema.safeParse({ ...params, desde, hasta });
}

/**
 * Línea del asiento, como en SAP B1 ("Cuenta de mayor / Código SN"): se indica la cuenta y,
 * opcionalmente, el socio de negocio. Si se indica solo el socio, el servidor usa su cuenta
 * asociada (cuenta de control). Cada línea lleva debe o haber, nunca ambos.
 */
export const asientoLineaManualSchema = z
  .object({
    cuentaId: uuid.nullish(),
    terceroId: uuid.nullish(),
    centroCostoId: uuid.nullish(),
    glosa: z.string().trim().max(250).nullish(),
    debe: monto,
    haber: monto,
  })
  .superRefine((l, ctx) => {
    if (!l.cuentaId && !l.terceroId) {
      ctx.addIssue({ code: "custom", path: ["cuentaId"], message: "Cada línea necesita una cuenta o un socio de negocio" });
    }
    if (l.debe > 0 && l.haber > 0) {
      ctx.addIssue({ code: "custom", path: ["debe"], message: "Una línea lleva monto en el debe o en el haber, no en ambos" });
    }
    if (l.debe === 0 && l.haber === 0) {
      ctx.addIssue({ code: "custom", path: ["debe"], message: "Cada línea debe tener un monto en el debe o en el haber" });
    }
  });
export type AsientoLineaManualInput = z.infer<typeof asientoLineaManualSchema>;

/** Totales del asiento en moneda funcional, redondeados a 2 decimales. */
export function totalesAsiento(lineas: readonly { debe: number; haber: number }[]) {
  if (lineas.some((l) => !Number.isFinite(l.debe) || !Number.isFinite(l.haber) || Math.abs(l.debe) >= 1e14 || Math.abs(l.haber) >= 1e14)) {
    return { debe: NaN, haber: NaN, diferencia: NaN, cuadra: false };
  }
  // Los automáticos pueden traer los cuatro decimales almacenados en la base.
  // Se suman antes de redondear el total; los manuales solo admiten dos.
  const sumar = (campo: "debe" | "haber") => lineas.reduce(
    (total, l) => total + BigInt(l[campo].toFixed(4).replace(".", "")), BigInt(0),
  );
  const centavos = (total: bigint) => (total + (total < BigInt(0) ? -BigInt(50) : BigInt(50))) / BigInt(100);
  const debeCentavos = Number(centavos(sumar("debe")));
  const haberCentavos = Number(centavos(sumar("haber")));
  return {
    debe: debeCentavos / 100,
    haber: haberCentavos / 100,
    diferencia: (debeCentavos - haberCentavos) / 100,
    cuadra: Number.isSafeInteger(debeCentavos) && Number.isSafeInteger(haberCentavos) && debeCentavos === haberCentavos,
  };
}

/**
 * Asiento manual. `contabilizar = false` lo guarda como borrador (no afecta saldos ni
 * consume correlativo). Un borrador puede quedar descuadrado; al contabilizar se exige
 * debe = haber.
 */
export const asientoManualSchema = z
  .object({
    fecha: fechaISO,
    glosa: z.string().trim().min(1, "Indica la glosa del asiento").max(500),
    tipo: z.enum(ASIENTO_MANUAL_TIPO).default("traspaso"),
    libro: z.enum(LIBRO_CONTABLE).default("Ambos"),
    referencia: z.string().trim().max(80).nullish(),
    fechaReversa: fechaISO.nullish(),
    lineas: z.array(asientoLineaManualSchema).min(2, "El asiento necesita al menos dos líneas").max(500),
    contabilizar: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.fechaReversa && v.fechaReversa <= v.fecha) {
      ctx.addIssue({ code: "custom", path: ["fechaReversa"], message: "La fecha de reversión debe ser posterior a la fecha del asiento" });
    }
    const t = totalesAsiento(v.lineas);
    if (t.debe > 90_000_000_000_000 || t.haber > 90_000_000_000_000) {
      ctx.addIssue({ code: "custom", path: ["lineas"], message: "El total supera la precisión permitida" });
    }
    if (v.contabilizar) {
      if (!t.cuadra) {
        ctx.addIssue({
          code: "custom",
          path: ["lineas"],
          message: `El asiento no cuadra: debe ${t.debe} vs. haber ${t.haber} (diferencia ${t.diferencia})`,
        });
      }
    }
  });
export type AsientoManualInput = z.input<typeof asientoManualSchema>;
export type AsientoManualData = z.output<typeof asientoManualSchema>;

/** Anulación (SAP: Datos → Cancelar): crea la reversa en la fecha indicada. */
export const anularAsientoSchema = z.object({
  motivo: z.string().trim().min(1, "Indica el motivo").max(500),
  fecha: fechaISO,
});
export type AnularAsientoInput = z.infer<typeof anularAsientoSchema>;
