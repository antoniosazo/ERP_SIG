import { z } from "zod";

export const fechaConsultaCuentaSchema = z.iso.date("Indica una fecha válida (AAAA-MM-DD)")
  .refine((v) => !v.startsWith("0000"), "El año debe ser mayor que cero");
export const rangoConsultaCuentaSchema = z.object({
  desde: fechaConsultaCuentaSchema,
  hasta: fechaConsultaCuentaSchema,
}).refine((v) => v.desde <= v.hasta, { message: "La fecha Desde no puede ser posterior a Hasta", path: ["desde"] });

/** Valida también parámetros repetidos o manipulados en la URL, antes de consultar. */
export function fechasConsultaCuenta(params: { desde?: unknown; hasta?: unknown }, hoy: string) {
  const hasta = params.hasta === undefined ? hoy : params.hasta;
  const desde = params.desde === undefined
    ? `${typeof hasta === "string" && fechaConsultaCuentaSchema.safeParse(hasta).success ? hasta.slice(0, 4) : hoy.slice(0, 4)}-01-01`
    : params.desde;
  const resultado = rangoConsultaCuentaSchema.safeParse({ desde, hasta });
  return {
    desde: fechaConsultaCuentaSchema.safeParse(desde).success ? desde as string : "",
    hasta: fechaConsultaCuentaSchema.safeParse(hasta).success ? hasta as string : "",
    error: resultado.success ? null : resultado.error.issues[0]!.message,
  };
}
