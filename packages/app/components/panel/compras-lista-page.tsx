import {
  db,
  listarDocumentosCompraPaginados,
  listarMonedasDeEmpresa,
  listarTerceros,
  listarTiposDocumento,
  saldosDocumentos,
} from "@erp/db";
import {
  CODIGOS_SII_COMPRA_POR_TIPO,
  puedeEditarFinanzas,
  type DocumentoCompraTipo,
} from "@erp/shared";
import { notFound } from "next/navigation";
import { DocumentosCompraLista } from "@/components/panel/documentos-compra-lista";
import { COMPRA_TIPO_META } from "@/lib/compras";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { TypographyHeading } from "@/components/ui/typography";

type Filtros = {
  estado?: string;
  q?: string;
  desde?: string;
  hasta?: string;
  terceroId?: string;
  pagina?: string;
};

const ESTADOS = new Set(["borrador", "abierto", "contabilizado", "cerrado", "anulado"]);
const fechaValida = (v?: string) => {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const fecha = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === v ? v : undefined;
};

/** Lista operativa de compras con filtros, vencimientos, saldos y permisos efectivos. */
export async function ComprasListaPage({
  empresaId,
  docTipo,
  filtros = {},
}: {
  empresaId: string;
  docTipo: DocumentoCompraTipo;
  filtros?: Filtros;
}) {
  const meta = COMPRA_TIPO_META[docTipo];
  const acceso = await obtenerAccesoEmpresa(empresaId);
  if (!acceso) notFound();
  const estado = filtros.estado && ESTADOS.has(filtros.estado) ? filtros.estado : undefined;
  const consulta = {
    docTipo,
    estado,
    q: filtros.q?.trim().slice(0, 200) || undefined,
    desde: fechaValida(filtros.desde),
    hasta: fechaValida(filtros.hasta),
    terceroId: filtros.terceroId || undefined,
    pagina: Math.max(1, Number.parseInt(filtros.pagina ?? "1", 10) || 1),
    porPagina: 25,
  };
  const [resultado, terceros, tiposDoc, monedas] = await Promise.all([
    listarDocumentosCompraPaginados(empresaId, consulta),
    listarTerceros(empresaId),
    listarTiposDocumento(),
    listarMonedasDeEmpresa(empresaId),
  ]);
  const saldos = await saldosDocumentos(
    db,
    empresaId,
    "compra",
    resultado.documentos.filter((d) => d.estado === "contabilizado").map((d) => d.id),
  );
  const tipoNombre = new Map(tiposDoc.map((t) => [t.id, t.nombre]));
  const proveedorNombre = new Map(terceros.map((t) => [t.id, t.razonSocial]));
  const monedaCodigo = new Map(monedas.map((m) => [m.id, m.codigo]));
  const puedeEditar = puedeEditarFinanzas(acceso.session.user.esAdminFirma, acceso.rol);
  const codigosPermitidos = CODIGOS_SII_COMPRA_POR_TIPO[docTipo]
    ? new Set(CODIGOS_SII_COMPRA_POR_TIPO[docTipo])
    : null;

  return (
    <>
      <TypographyHeading
        title={meta.titulo}
        description={
          docTipo === "factura"
            ? "Las facturas se guardan y contabilizan en una sola operación. Si una queda pendiente, puedes completarla, reintentarla o descartarla."
            : meta.contabiliza
              ? "Al contabilizar se genera el asiento. Solo se edita mientras está pendiente."
              : "La orden de compra formaliza el pedido al proveedor (no es un documento tributario). Controla el saldo pendiente por línea y puede convertirse en recepción o factura."
        }
      />
      <DocumentosCompraLista
        key={[consulta.estado, consulta.q, consulta.desde, consulta.hasta, consulta.terceroId, resultado.pagina].join("|")}
        empresaId={empresaId}
        docTipo={docTipo}
        puedeEditar={puedeEditar}
        hoy={new Date().toISOString().slice(0, 10)}
        filtros={{
          estado: estado ?? "",
          q: consulta.q ?? "",
          desde: consulta.desde ?? "",
          hasta: consulta.hasta ?? "",
          terceroId: consulta.terceroId ?? "",
        }}
        pagina={resultado.pagina}
        paginas={resultado.paginas}
        total={resultado.total}
        documentos={resultado.documentos.map((d) => ({
          id: d.id,
          numeroInterno: d.numeroInterno,
          docTipo: d.docTipo,
          tipoDocumento: (d.tipoDocumentoId && tipoNombre.get(d.tipoDocumentoId)) || "—",
          folio: d.folio,
          proveedor: proveedorNombre.get(d.terceroId) ?? "—",
          terceroId: d.terceroId,
          fechaEmision: d.fechaEmision,
          fechaVencimiento: d.fechaVencimiento,
          montoTotal: d.montoTotal,
          saldo: saldos.get(d.id)?.saldo ?? Number(d.montoTotal),
          moneda: monedaCodigo.get(d.monedaId) ?? "—",
          estado: d.estado,
          puedeReintentar:
            meta.contabiliza &&
            d.estado === "borrador" &&
            Number(d.montoTotal) > 0 &&
            (!CODIGOS_SII_COMPRA_POR_TIPO[d.docTipo] || !!d.folio) &&
            (d.docTipo !== "nota_credito" && d.docTipo !== "nota_debito" || !!d.documentoBaseId),
        }))}
        tiposDocumento={tiposDoc
          .filter((t) =>
            codigosPermitidos
              ? codigosPermitidos.has(t.codigoSii)
              : t.tipoOperacion === "Compra" || t.tipoOperacion === "Ambos",
          )
          .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}` }))}
        proveedoresFiltro={terceros
          .filter((t) => t.tipoTercero === "Proveedor")
          .map((t) => ({ id: t.id, label: `${t.razonSocial} (${t.rut})` }))}
        proveedores={terceros
          .filter((t) => t.tipoTercero === "Proveedor" && t.activo && !t.bloqueado)
          .map((t) => ({ id: t.id, label: `${t.razonSocial} (${t.rut})` }))}
      />
    </>
  );
}
