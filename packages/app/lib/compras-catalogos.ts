import type {
  listarCategorias,
  listarCentrosCosto,
  listarImpuestosDeEmpresa,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
  listarProductosParaCompra,
  listarTerceros,
  listarTiposDocumento,
  listarDocumentosCompra,
} from "@erp/db";
import { CODIGOS_SII_COMPRA_POR_TIPO, type DocumentoCompraTipo } from "@erp/shared";

type Retorno<F extends (...a: never[]) => unknown> = Awaited<ReturnType<F>>;

export type CatalogosCompraCrudos = {
  terceros: Retorno<typeof listarTerceros>;
  tiposDoc: Retorno<typeof listarTiposDocumento>;
  cuentas: Retorno<typeof listarPlanCuentasDeEmpresa>;
  categorias: Retorno<typeof listarCategorias>;
  centros: Retorno<typeof listarCentrosCosto>;
  impuestos: Retorno<typeof listarImpuestosDeEmpresa>;
  monedas: Retorno<typeof listarMonedasDeEmpresa>;
  productos: Retorno<typeof listarProductosParaCompra>;
  facturasReferencia: Retorno<typeof listarDocumentosCompra>;
};

/** Opciones de los selectores del formulario de compras, iguales para un documento nuevo y uno existente. */
export function opcionesFormularioCompra(
  c: CatalogosCompraCrudos,
  docTipo: DocumentoCompraTipo,
  opciones: { proveedorActualId?: string; excluirDocumentoId?: string } = {},
) {
  const codigosPermitidos = CODIGOS_SII_COMPRA_POR_TIPO[docTipo] ? new Set(CODIGOS_SII_COMPRA_POR_TIPO[docTipo]) : null;
  return {
    proveedores: c.terceros
      .filter((t) => t.tipoTercero === "Proveedor" && ((t.activo && !t.bloqueado) || t.id === opciones.proveedorActualId))
      .map((t) => ({ id: t.id, label: t.razonSocial, condicionPagoDias: t.condicionPagoDias })),
    tiposDocumento: c.tiposDoc
      .filter((t) => (codigosPermitidos ? codigosPermitidos.has(t.codigoSii) : t.tipoOperacion === "Compra" || t.tipoOperacion === "Ambos"))
      .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}`, codigoSii: t.codigoSii })),
    cuentas: c.cuentas
      .filter((x) => x.nivelImputable && x.activa)
      .map((x) => ({ id: x.id, label: `${x.codigoCuenta} — ${x.nombreCuenta}` })),
    categorias: c.categorias
      .filter((x) => x.aplicaA === "Compra" || x.aplicaA === "Ambos")
      .map((x) => ({ id: x.id, label: x.nombre, ivaRecuperableDefault: x.ivaRecuperableDefault })),
    centrosCosto: c.centros.filter((x) => x.estado === "Activo").map((x) => ({ id: x.id, label: `${x.codigo} — ${x.nombre}` })),
    impuestos: c.impuestos
      .filter((i) => i.activo && (i.aplicaA === "Compra" || i.aplicaA === "Ambos"))
      .map((i) => ({ id: i.id, label: `${i.codigo} — ${i.nombre}`, tasa: Number(i.tasa) })),
    monedas: c.monedas.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` })),
    productos: c.productos.map((p) => ({
      id: p.id,
      label: `${p.codigo} — ${p.nombre}`,
      cuentaImputacionId: p.cuentaImputacionId,
      impuestoId: p.impuestoId,
      centroCostoId: p.centroCostoId,
      categoriaContableId: p.categoriaContableId,
      precioUnitario: p.precioUnitario,
      glosaSugerida: p.glosaSugerida,
    })),
    docsReferencia: c.facturasReferencia
      .filter((f) => f.id !== opciones.excluirDocumentoId)
      .map((f) => ({
        id: f.id,
        label: `${f.numeroInterno ?? ""} · folio ${f.folio ?? "—"}`,
        terceroId: f.terceroId,
        monedaId: f.monedaId,
      })),
  };
}

/** Tipo SII que casi siempre corresponde a cada documento, para no pedirlo en cada alta. */
export const CODIGO_SII_HABITUAL: Partial<Record<DocumentoCompraTipo, string>> = {
  factura: "33",
  nota_credito: "61",
  nota_debito: "56",
};
