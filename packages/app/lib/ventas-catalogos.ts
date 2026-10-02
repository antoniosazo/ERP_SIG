import type {
  listarCategorias,
  listarCentrosCosto,
  listarDocumentosVenta,
  listarImpuestosDeEmpresa,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
  listarProductosParaDocumento,
  listarTerceros,
  listarTiposDocumento,
  listarUsuariosDeEmpresa,
} from "@erp/db";
import { CODIGOS_SII_VENTA_POR_CLASE, type DocumentoVentaClase } from "@erp/shared";

type Retorno<F extends (...a: never[]) => unknown> = Awaited<ReturnType<F>>;

export type CatalogosVentaCrudos = {
  terceros: Retorno<typeof listarTerceros>;
  tiposDoc: Retorno<typeof listarTiposDocumento>;
  cuentas: Retorno<typeof listarPlanCuentasDeEmpresa>;
  categorias: Retorno<typeof listarCategorias>;
  centros: Retorno<typeof listarCentrosCosto>;
  impuestos: Retorno<typeof listarImpuestosDeEmpresa>;
  monedas: Retorno<typeof listarMonedasDeEmpresa>;
  productos: Retorno<typeof listarProductosParaDocumento>;
  vendedores: Retorno<typeof listarUsuariosDeEmpresa>;
  facturas: Retorno<typeof listarDocumentosVenta>;
};

/** Opciones de los selectores del formulario de ventas, iguales para un documento nuevo y uno existente. */
export function opcionesFormularioVenta(
  c: CatalogosVentaCrudos,
  clase: DocumentoVentaClase,
  opciones: { clienteActualId?: string; excluirDocumentoId?: string } = {},
) {
  const codigosPermitidos = new Set(CODIGOS_SII_VENTA_POR_CLASE[clase]);
  return {
    clientes: c.terceros
      .filter((t) => t.tipoTercero === "Cliente" && ((t.activo && !t.bloqueado) || t.id === opciones.clienteActualId))
      .map((t) => ({ id: t.id, label: t.razonSocial, condicionPagoDias: t.condicionPagoDias })),
    tiposDocumento: c.tiposDoc
      .filter((t) => codigosPermitidos.has(t.codigoSii))
      .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}`, codigoSii: t.codigoSii })),
    cuentas: c.cuentas
      .filter((x) => x.nivelImputable && x.activa)
      .map((x) => ({ id: x.id, label: `${x.codigoCuenta} — ${x.nombreCuenta}` })),
    categorias: c.categorias
      .filter((x) => x.aplicaA === "Venta" || x.aplicaA === "Ambos")
      .map((x) => ({ id: x.id, label: x.nombre })),
    centrosCosto: c.centros.filter((x) => x.estado === "Activo").map((x) => ({ id: x.id, label: `${x.codigo} — ${x.nombre}` })),
    impuestos: c.impuestos
      .filter((i) => i.activo && (i.aplicaA === "Venta" || i.aplicaA === "Ambos"))
      .map((i) => ({ id: i.id, label: `${i.codigo} — ${i.nombre}`, tasa: Number(i.tasa) })),
    monedas: c.monedas.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` })),
    vendedores: c.vendedores.map((u) => ({ id: u.id, label: u.nombre })),
    productos: c.productos.map((p) => ({
      id: p.id,
      label: `${p.codigo} — ${p.nombre}`,
      cuentaIngresoId: p.cuentaIngresoId,
      impuestoId: p.impuestoId,
      centroCostoId: p.centroCostoId,
      categoriaContableId: p.categoriaContableId,
      precioUnitario: p.precioUnitario,
      glosaSugerida: p.glosaSugerida,
    })),
    docsReferencia: c.facturas
      .filter((f) => f.clase === "Factura" && f.id !== opciones.excluirDocumentoId)
      .map((f) => ({ id: f.id, label: `${f.numeroInterno ?? ""} folio ${f.folio ?? "—"}` })),
  };
}

/** Tipo SII que casi siempre corresponde a cada clase, para no pedirlo en cada alta. */
export const CODIGO_SII_HABITUAL_VENTA: Record<DocumentoVentaClase, string> = {
  Factura: "33",
  "Nota de Crédito": "61",
  "Nota de Débito": "56",
};
