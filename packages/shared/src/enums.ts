/**
 * Enums del dominio contable, compartidos entre el schema de Drizzle (packages/db)
 * y los schemas de validación de Zod (packages/shared, packages/app).
 *
 * Los que llevan la nota "[documento]" están tomados literalmente de las secciones
 * 3.x / 4.x del diseño técnico. Los que llevan "[inferido]" corresponden a campos
 * que el diseño menciona pero no detalla con un set de valores cerrado (ej. v0.1,
 * que no forma parte de los documentos leídos) — quedan como supuesto razonable,
 * ajustable sin tocar el resto del modelo.
 */

// firmas_contables.plan_contratado — [inferido]
export const PLAN_CONTRATADO = ["Basico", "Profesional", "Enterprise"] as const;

// firmas_contables.estado — [documento] 3.0
export const FIRMA_ESTADO = ["Activa", "Suspendida"] as const;

// empresas.estado — [inferido]
export const EMPRESA_ESTADO = ["Activa", "Inactiva"] as const;

// monedas.tipo — [documento] 3.9
export const MONEDA_TIPO = ["Moneda", "Unidad de Reajuste"] as const;

// tipos_cambio.origen — [documento] 3.9
export const TIPO_CAMBIO_ORIGEN = [
  "Manual",
  "Importado archivo",
  "Sincronizado API",
] as const;

// periodos_contables.estado — espejo de "Status del período" de SAP Business One.
// (Reemplaza el trío Abierto/Cerrado/Reabierto de v0.x — ver plan de Períodos Contables.)
export const PERIODO_ESTADO = [
  "Desbloqueado",
  "Período de cierre",
  "Bloqueado",
  "Bloqueado excepto ventas",
] as const;

/** Estados en los que el periodo acepta asientos ("Período de cierre" solo con permiso especial). */
export const PERIODO_ESTADOS_ABIERTOS = ["Desbloqueado", "Período de cierre"] as const;
/** Estados que impiden (total o parcialmente) contabilizar en el periodo. */
export const PERIODO_ESTADOS_BLOQUEADOS = ["Bloqueado", "Bloqueado excepto ventas"] as const;

// plan_cuentas.clase — [documento] 3.2, clase fija de nivel 1
export const CLASE_CUENTA = [
  "Activo",
  "Pasivo",
  "Patrimonio",
  "Ingresos",
  "Costos y Gastos",
  "Cuentas de Orden",
] as const;

// plan_cuentas.naturaleza — [inferido]
export const NATURALEZA_CUENTA = ["Deudora", "Acreedora"] as const;

/** Profundidad máxima del árbol de cuentas: la cuenta raíz es nivel 1. */
export const MAX_PROFUNDIDAD_CUENTA = 4;

// plan_cuentas.tipo_cuenta — rol funcional de la cuenta (alimenta determinación,
// conciliación bancaria y reportes). Reemplaza al texto libre `tipo`.
export const TIPO_CUENTA = [
  "Banco",
  "Caja",
  "Cliente",
  "Proveedor",
  "Impuesto",
  "Remuneraciones",
  "ActivoFijo",
  "Ingreso",
  "Costo",
  "Gasto",
  "Patrimonio",
  "Orden",
  "Otra",
] as const;

// plan_cuentas.clasificacion_corriente — [documento] 3.2
export const CLASIFICACION_CORRIENTE = [
  "Corriente",
  "No Corriente",
  "No Aplica",
] as const;

// tipos_documento.tipo_operacion — [inferido]
export const TIPO_OPERACION_DOCUMENTO = ["Compra", "Venta", "Ambos"] as const;

// terceros.tipo_tercero — [inferido]
export const TIPO_TERCERO = [
  "Cliente",
  "Proveedor",
  "Prestador Honorarios",
  "Otro",
] as const;

// categorias_contables.aplica_a — [documento] 3.11
export const CATEGORIA_APLICA_A = ["Compra", "Venta", "Honorario", "Ambos"] as const;

// categorias_contables.iva_recuperable_default y documento_detalle_cuenta.iva_recuperable — [documento] 4.2
export const IVA_RECUPERABLE = ["Total", "Parcial", "No Recuperable"] as const;

// asientos_contables.tipo — [documento] 4.1
export const ASIENTO_TIPO = [
  "manual",
  "traspaso",
  "ingreso",
  "egreso",
  "ajuste",
  "automatico",
] as const;

// asientos_contables.estado — [documento] 4.1
export const ASIENTO_ESTADO = ["borrador", "contabilizado", "anulado"] as const;

// asientos_contables.libro / activos_fijos.libro / depreciaciones.libro / pasivos.libro — [documento] 3.1 (aplica_ifrs), 4.1
export const LIBRO_CONTABLE = ["Tributario", "IFRS", "Ambos"] as const;

// usuario_empresa.rol — [decisión de producto, confirmada con el usuario]. Catálogo fijo por
// ahora (enum, no tabla `roles` con permisos configurables — ver plan de Usuarios y Roles).
export const ROL = ["Administrador", "Contador", "Asistente"] as const;

// usuarios.estado — [decisión de producto]. Invitado = creado pero sin password aún.
export const USUARIO_ESTADO = ["Invitado", "Activo", "Suspendido"] as const;

// tokens_acceso.tipo — [decisión de producto]. Un solo mecanismo para invitación y reset
// de contraseña (sin envío de email por ahora: el link se muestra en pantalla).
export const TOKEN_TIPO = ["invitacion", "reset_password"] as const;

// empresas.separador_decimal / separador_miles — config de "Visualización" (estilo SAP B1).
export const SEPARADOR_DECIMAL = [",", "."] as const;
export const SEPARADOR_MILES = [".", ",", " ", ""] as const;

// bitacora_auditoria.accion — [documento] 3.8
export const AUDITORIA_ACCION = ["crear", "editar", "eliminar", "cambio_estado"] as const;

// impuestos.tipo — maestro de impuestos (enfoque Chile). Sin retenciones por ahora.
export const IMPUESTO_TIPO = [
  "IVA Débito",
  "IVA Crédito",
  "Impuesto Adicional",
  "Exento",
  "No Afecto",
] as const;

// terceros_direcciones.tipo — sub-entidad del maestro de socios de negocio.
export const DIRECCION_TIPO = ["Facturación", "Despacho"] as const;

// terceros_cuentas_bancarias.tipo_cuenta
// Pagos recibidos / efectuados (módulo de tesorería, al estilo Pagos recibidos / Pagos efectuados de SAP B1).
export const METODO_PAGO_TIPO = ["Efectivo", "Cheque", "Transferencia", "Tarjeta"] as const;
export type MetodoPagoTipo = (typeof METODO_PAGO_TIPO)[number];
/** Para qué sentido sirve un método de pago: cobros (recibido), pagos (efectuado) o ambos. */
export const METODO_PAGO_SENTIDO = ["Recibido", "Efectuado", "Ambos"] as const;
export type MetodoPagoSentido = (typeof METODO_PAGO_SENTIDO)[number];

export const PAGO_TIPO = ["Recibido", "Efectuado"] as const;
export type PagoTipo = (typeof PAGO_TIPO)[number];
/** Un pago se contabiliza al registrarse (sin borrador); solo puede anularse. */
export const PAGO_ESTADO = ["contabilizado", "anulado"] as const;
export type PagoEstado = (typeof PAGO_ESTADO)[number];

export const CUENTA_BANCARIA_TIPO = ["Corriente", "Vista", "Ahorro", "Otra"] as const;

// series_numeracion.ambito — serie de numeración reutilizable.
export const SERIE_AMBITO = ["tercero", "venta", "producto", "compra", "pago"] as const;

// documentos_venta.clase — determina el signo contable (61 = NC, 56 = ND).
export const DOCUMENTO_VENTA_CLASE = ["Factura", "Nota de Crédito", "Nota de Débito"] as const;

// documentos_venta.estado
export const DOCUMENTO_VENTA_ESTADO = ["borrador", "contabilizado", "anulado"] as const;

// documentos_compra.doc_tipo — flujo documental de compras (SAP: OPOR/OPDN/OPCH).
// `entrada_mercaderia` se define ya pero su flujo se implementa en la Fase B.
// documentos_compra/venta.modalidad — como el tipo "Artículo / Servicio" de SAP Business One:
// "Servicio" lleva líneas de solo descripción + cuenta + impuesto + importe, sin ítem del maestro.
export const DOCUMENTO_MODALIDAD = ["Artículo", "Servicio"] as const;
export type DocumentoModalidad = (typeof DOCUMENTO_MODALIDAD)[number];

export const DOCUMENTO_COMPRA_TIPO = [
  "pedido",
  "entrada_mercaderia",
  "factura",
  "nota_credito",
  "nota_debito",
] as const;

// documentos_compra.estado — `pedido` usa borrador→abierto→cerrado/anulado (no contabiliza);
// factura/nc/nd usan borrador→contabilizado→anulado.
export const DOCUMENTO_COMPRA_ESTADO = [
  "borrador",
  "abierto",
  "contabilizado",
  "cerrado",
  "anulado",
] as const;

// productos.tipo — catálogo de productos/servicios.
export const PRODUCTO_TIPO = ["Producto", "Servicio"] as const;

// productos.metodo_valoracion — valoración de inventario. "FIFO" reservado (aún no seleccionable).
export const METODO_VALORACION = ["Promedio", "FIFO"] as const;

// stock_movimientos.tipo — Kardex de inventario (1 almacén implícito por empresa).
export const STOCK_MOVIMIENTO_TIPO = ["entrada", "salida", "ajuste"] as const;

// sii_credenciales.ambiente — certificación (maullín) vs producción (palena).
export const SII_AMBIENTE = ["certificacion", "produccion"] as const;
// sii_credenciales.metodo_auth — con qué se autentica contra el SII.
export const SII_METODO_AUTH = ["clave", "certificado"] as const;
// Estado de un documento dentro del Registro de Compras y Ventas del SII.
export const SII_ESTADO_RCV = ["REGISTRO", "PENDIENTE", "NO_INCLUIR", "RECLAMADO"] as const;
// sii_credenciales.tipo_facturador — con qué emite/recibe DTE el cliente; determina qué
// vía de importación tiene sentido ofrecerle (ej. subir XML solo aplica a "SII Gratuito").
export const TIPO_FACTURADOR = ["SII Gratuito", "Facturador comercial", "No emite DTE"] as const;

// plan_cuentas.modo_moneda — restricción de moneda para contabilizar contra la cuenta.
export const CUENTA_MODO_MONEDA = ["Local", "Funcional", "Extranjera fija", "Cualquiera"] as const;

// reglas_determinacion_cuenta.contexto / .rol — motor de determinación de cuentas (nivel GENERAL).
export const DETERMINACION_CONTEXTO = ["venta", "compra", "impuesto", "general"] as const;
export const DETERMINACION_ROL = [
  "ingreso",
  "ingreso_exento",
  "iva_debito",
  "iva_credito",
  "cuenta_por_cobrar",
  "cuenta_por_pagar",
  "descuento_venta",
  "diferencia_cambio",
  "ajuste",
  "gasto",
  "inventario",
  "gr_ir",
  "costo_venta",
] as const;

export type PlanContratado = (typeof PLAN_CONTRATADO)[number];
export type FirmaEstado = (typeof FIRMA_ESTADO)[number];
export type EmpresaEstado = (typeof EMPRESA_ESTADO)[number];
export type MonedaTipo = (typeof MONEDA_TIPO)[number];
export type TipoCambioOrigen = (typeof TIPO_CAMBIO_ORIGEN)[number];
export type PeriodoEstado = (typeof PERIODO_ESTADO)[number];
export type ClaseCuenta = (typeof CLASE_CUENTA)[number];
export type NaturalezaCuenta = (typeof NATURALEZA_CUENTA)[number];
export type TipoCuenta = (typeof TIPO_CUENTA)[number];

/**
 * Naturaleza (Deudora/Acreedora) que corresponde por defecto a una clase. Es una
 * sugerencia para el formulario de alta —el usuario la puede sobrescribir para
 * contra‑cuentas (p. ej. Depreciación Acumulada dentro de Activo es Acreedora).
 */
export function naturalezaSugerida(clase: ClaseCuenta): NaturalezaCuenta {
  return clase === "Activo" || clase === "Costos y Gastos" ? "Deudora" : "Acreedora";
}
export type ClasificacionCorriente = (typeof CLASIFICACION_CORRIENTE)[number];
export type TipoOperacionDocumento = (typeof TIPO_OPERACION_DOCUMENTO)[number];
export type TipoTercero = (typeof TIPO_TERCERO)[number];
export type CategoriaAplicaA = (typeof CATEGORIA_APLICA_A)[number];
export type IvaRecuperable = (typeof IVA_RECUPERABLE)[number];
export type AsientoTipo = (typeof ASIENTO_TIPO)[number];
export type AsientoEstado = (typeof ASIENTO_ESTADO)[number];
export type LibroContable = (typeof LIBRO_CONTABLE)[number];
export type Rol = (typeof ROL)[number];
export type UsuarioEstado = (typeof USUARIO_ESTADO)[number];
export type TokenTipo = (typeof TOKEN_TIPO)[number];
export type SeparadorDecimal = (typeof SEPARADOR_DECIMAL)[number];
export type SeparadorMiles = (typeof SEPARADOR_MILES)[number];
export type AuditoriaAccion = (typeof AUDITORIA_ACCION)[number];
export type ImpuestoTipo = (typeof IMPUESTO_TIPO)[number];
export type DireccionTipo = (typeof DIRECCION_TIPO)[number];
export type CuentaBancariaTipo = (typeof CUENTA_BANCARIA_TIPO)[number];
export type SerieAmbito = (typeof SERIE_AMBITO)[number];
export type DocumentoVentaClase = (typeof DOCUMENTO_VENTA_CLASE)[number];
export type DocumentoVentaEstado = (typeof DOCUMENTO_VENTA_ESTADO)[number];
export type DocumentoCompraTipo = (typeof DOCUMENTO_COMPRA_TIPO)[number];
export type DocumentoCompraEstado = (typeof DOCUMENTO_COMPRA_ESTADO)[number];
export type ProductoTipo = (typeof PRODUCTO_TIPO)[number];
export type MetodoValoracion = (typeof METODO_VALORACION)[number];
export type StockMovimientoTipo = (typeof STOCK_MOVIMIENTO_TIPO)[number];
export type SiiAmbiente = (typeof SII_AMBIENTE)[number];
export type SiiMetodoAuth = (typeof SII_METODO_AUTH)[number];
export type SiiEstadoRcv = (typeof SII_ESTADO_RCV)[number];
export type TipoFacturador = (typeof TIPO_FACTURADOR)[number];
export type CuentaModoMoneda = (typeof CUENTA_MODO_MONEDA)[number];
export type DeterminacionContexto = (typeof DETERMINACION_CONTEXTO)[number];
export type DeterminacionRol = (typeof DETERMINACION_ROL)[number];
