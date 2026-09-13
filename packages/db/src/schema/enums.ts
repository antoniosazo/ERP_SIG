import { pgEnum } from "drizzle-orm/pg-core";
import {
  ASIENTO_ESTADO,
  ASIENTO_TIPO,
  AUDITORIA_ACCION,
  CATEGORIA_APLICA_A,
  CLASE_CUENTA,
  CLASIFICACION_CORRIENTE,
  CUENTA_BANCARIA_TIPO,
  DIRECCION_TIPO,
  DOCUMENTO_COMPRA_ESTADO,
  DOCUMENTO_COMPRA_TIPO,
  DOCUMENTO_VENTA_CLASE,
  DOCUMENTO_VENTA_ESTADO,
  EMPRESA_ESTADO,
  FIRMA_ESTADO,
  IMPUESTO_TIPO,
  IVA_RECUPERABLE,
  SERIE_AMBITO,
  LIBRO_CONTABLE,
  MONEDA_TIPO,
  METODO_VALORACION,
  SII_AMBIENTE,
  SII_METODO_AUTH,
  STOCK_MOVIMIENTO_TIPO,
  NATURALEZA_CUENTA,
  PERIODO_ESTADO,
  PRODUCTO_TIPO,
  TIPO_CUENTA,
  CUENTA_MODO_MONEDA,
  DETERMINACION_CONTEXTO,
  DETERMINACION_ROL,
  PLAN_CONTRATADO,
  ROL,
  TIPO_CAMBIO_ORIGEN,
  TIPO_OPERACION_DOCUMENTO,
  TIPO_TERCERO,
  TOKEN_TIPO,
  USUARIO_ESTADO,
} from "@erp/shared";

export const planContratadoEnum = pgEnum("plan_contratado", [...PLAN_CONTRATADO]);
export const firmaEstadoEnum = pgEnum("firma_estado", [...FIRMA_ESTADO]);
export const empresaEstadoEnum = pgEnum("empresa_estado", [...EMPRESA_ESTADO]);
export const monedaTipoEnum = pgEnum("moneda_tipo", [...MONEDA_TIPO]);
export const tipoCambioOrigenEnum = pgEnum("tipo_cambio_origen", [...TIPO_CAMBIO_ORIGEN]);
export const periodoEstadoEnum = pgEnum("periodo_estado", [...PERIODO_ESTADO]);
export const claseCuentaEnum = pgEnum("clase_cuenta", [...CLASE_CUENTA]);
export const naturalezaCuentaEnum = pgEnum("naturaleza_cuenta", [...NATURALEZA_CUENTA]);
export const tipoCuentaEnum = pgEnum("tipo_cuenta", [...TIPO_CUENTA]);
export const clasificacionCorrienteEnum = pgEnum("clasificacion_corriente", [
  ...CLASIFICACION_CORRIENTE,
]);
export const tipoOperacionDocumentoEnum = pgEnum("tipo_operacion_documento", [
  ...TIPO_OPERACION_DOCUMENTO,
]);
export const tipoTerceroEnum = pgEnum("tipo_tercero", [...TIPO_TERCERO]);
export const categoriaAplicaAEnum = pgEnum("categoria_aplica_a", [...CATEGORIA_APLICA_A]);
export const ivaRecuperableEnum = pgEnum("iva_recuperable", [...IVA_RECUPERABLE]);
export const asientoTipoEnum = pgEnum("asiento_tipo", [...ASIENTO_TIPO]);
export const asientoEstadoEnum = pgEnum("asiento_estado", [...ASIENTO_ESTADO]);
export const libroContableEnum = pgEnum("libro_contable", [...LIBRO_CONTABLE]);
export const rolEnum = pgEnum("rol", [...ROL]);
export const usuarioEstadoEnum = pgEnum("usuario_estado", [...USUARIO_ESTADO]);
export const tokenTipoEnum = pgEnum("token_tipo", [...TOKEN_TIPO]);
export const auditoriaAccionEnum = pgEnum("auditoria_accion", [...AUDITORIA_ACCION]);
export const impuestoTipoEnum = pgEnum("impuesto_tipo", [...IMPUESTO_TIPO]);
export const direccionTipoEnum = pgEnum("direccion_tipo", [...DIRECCION_TIPO]);
export const cuentaBancariaTipoEnum = pgEnum("cuenta_bancaria_tipo", [...CUENTA_BANCARIA_TIPO]);
export const serieAmbitoEnum = pgEnum("serie_ambito", [...SERIE_AMBITO]);
export const documentoVentaClaseEnum = pgEnum("documento_venta_clase", [...DOCUMENTO_VENTA_CLASE]);
export const documentoVentaEstadoEnum = pgEnum("documento_venta_estado", [
  ...DOCUMENTO_VENTA_ESTADO,
]);
export const documentoCompraTipoEnum = pgEnum("documento_compra_tipo", [
  ...DOCUMENTO_COMPRA_TIPO,
]);
export const documentoCompraEstadoEnum = pgEnum("documento_compra_estado", [
  ...DOCUMENTO_COMPRA_ESTADO,
]);
export const productoTipoEnum = pgEnum("producto_tipo", [...PRODUCTO_TIPO]);
export const metodoValoracionEnum = pgEnum("metodo_valoracion", [...METODO_VALORACION]);
export const stockMovimientoTipoEnum = pgEnum("stock_movimiento_tipo", [
  ...STOCK_MOVIMIENTO_TIPO,
]);
export const siiAmbienteEnum = pgEnum("sii_ambiente", [...SII_AMBIENTE]);
export const siiMetodoAuthEnum = pgEnum("sii_metodo_auth", [...SII_METODO_AUTH]);
export const cuentaModoMonedaEnum = pgEnum("cuenta_modo_moneda", [...CUENTA_MODO_MONEDA]);
export const determinacionContextoEnum = pgEnum("determinacion_contexto", [
  ...DETERMINACION_CONTEXTO,
]);
export const determinacionRolEnum = pgEnum("determinacion_rol", [...DETERMINACION_ROL]);
