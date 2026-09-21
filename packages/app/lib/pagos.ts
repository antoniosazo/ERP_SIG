import type { PagoTipo } from "@erp/shared";

/** Textos y rutas de cada sentido de pago. */
export const PAGO_META: Record<
  PagoTipo,
  { slug: string; titulo: string; singular: string; tercero: string; terceroTipo: "Cliente" | "Proveedor"; accion: string }
> = {
  Recibido: {
    slug: "pagos-recibidos",
    titulo: "Pagos recibidos",
    singular: "pago recibido",
    tercero: "Cliente",
    terceroTipo: "Cliente",
    accion: "cobro",
  },
  Efectuado: {
    slug: "pagos-efectuados",
    titulo: "Pagos efectuados",
    singular: "pago efectuado",
    tercero: "Proveedor",
    terceroTipo: "Proveedor",
    accion: "pago",
  },
};
