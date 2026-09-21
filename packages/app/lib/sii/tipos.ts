import type { SiiAmbiente, SiiEstadoRcv } from "@erp/shared";

/** Período tributario `YYYYMM` (p. ej. "202609"). */
export type Periodo = string;

/** Una fila del RCV (compra o venta) normalizada. */
export type DocRcv = {
  /** RUT de la contraparte, formato `12345678-9`. */
  rutContraparte: string;
  nombreContraparte?: string;
  /** Código de tipo de DTE del SII: 33, 34, 46, 56, 61, 43, … */
  tipoDte: number;
  folio: string;
  /** `YYYY-MM-DD`. */
  fechaEmision: string;
  fechaRecepcionSii?: string;
  montoExento: number;
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
  montoIvaNoRecuperable?: number;
  /** Código SII de IVA no recuperable (1..9), si aplica. */
  codigoIvaNoRec?: number;
  montoActivoFijo?: number;
  estadoRcv?: SiiEstadoRcv;
  trackId?: string;
  /** Fila tal cual la devolvió el SII (`getDetalleCompra`/`getDetalleVenta`), sin
   * normalizar — para inspeccionar campos que el parser no extrae (ver "Ver datos
   * crudos" → detalle de una factura). No disponible en el cliente mock. */
  crudo?: Record<string, unknown>;
};

export type CredencialesSii =
  | {
      metodo: "clave";
      /** RUT de la empresa a la que se le pide el RCV. */
      rut: string;
      /** RUT con el que se hace login (puede ser un representante/mandatario, distinto
       * de `rut`, operando con su propia Clave Tributaria "a nombre de" la empresa). */
      rutTitular: string;
      clave: string;
      ambiente: SiiAmbiente;
    }
  | {
      metodo: "certificado";
      /** RUT de la empresa a la que se le pide el RCV. */
      rut: string;
      /** RUT del titular del certificado (puede ser un representante, distinto de `rut`). */
      rutTitular: string;
      /** Certificado `.pfx`/`.p12` en base64. */
      certificadoBase64: string;
      certPass?: string;
      ambiente: SiiAmbiente;
    };

export type ResultadoPrueba = { ok: boolean; detalle: string };
