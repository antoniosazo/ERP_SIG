import {
  db,
  listarMonedasDeEmpresa,
  listarDocumentosVentaPaginados,
  listarTerceros,
  listarTiposDocumento,
  saldosDocumentos,
} from "@erp/db";
import {
  CODIGOS_SII_VENTA_POR_CLASE,
  puedeEditarFinanzas,
  type DocumentoVentaClase,
} from "@erp/shared";
import { notFound } from "next/navigation";
import { DocumentosVentaLista } from "@/components/panel/documentos-venta-lista";
import { VENTA_CLASE_META } from "@/lib/ventas";
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

const ESTADOS = new Set(["borrador", "contabilizado", "anulado"]);
const fechaValida = (v?: string) => {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const fecha = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === v ? v : undefined;
};

/** Lista operativa de documentos de venta con filtros, saldos y permisos efectivos. */
export async function VentasListaPage({
  empresaId,
  clase,
  filtros = {},
}: {
  empresaId: string;
  clase: DocumentoVentaClase;
  filtros?: Filtros;
}) {
  const meta = VENTA_CLASE_META[clase];
  const acceso = await obtenerAccesoEmpresa(empresaId);
  if (!acceso) notFound();

  const estado = filtros.estado && ESTADOS.has(filtros.estado) ? filtros.estado : undefined;
  const pagina = Math.max(1, Number.parseInt(filtros.pagina ?? "1", 10) || 1);
  const consulta = {
    clase,
    estado,
    q: filtros.q?.trim().slice(0, 200) || undefined,
    desde: fechaValida(filtros.desde),
    hasta: fechaValida(filtros.hasta),
    terceroId: filtros.terceroId || undefined,
    pagina,
    porPagina: 25,
  };
  const [resultado, terceros, tiposDoc, monedas] = await Promise.all([
    listarDocumentosVentaPaginados(empresaId, consulta),
    listarTerceros(empresaId),
    listarTiposDocumento(),
    listarMonedasDeEmpresa(empresaId),
  ]);
  const saldos = await saldosDocumentos(
    db,
    empresaId,
    "venta",
    resultado.documentos.filter((d) => d.estado === "contabilizado").map((d) => d.id),
  );

  const tipoNombre = new Map(tiposDoc.map((t) => [t.id, t.nombre]));
  const clienteNombre = new Map(terceros.map((t) => [t.id, t.razonSocial]));
  const monedaCodigo = new Map(monedas.map((m) => [m.id, m.codigo]));
  const puedeEditar = puedeEditarFinanzas(acceso.session.user.esAdminFirma, acceso.rol);
  const codigosPermitidos = new Set(CODIGOS_SII_VENTA_POR_CLASE[clase]);

  return (
    <>
      <TypographyHeading
        title={meta.titulo}
        description={
          clase === "Factura"
            ? "Las facturas se guardan y contabilizan en una sola operación. Si una queda pendiente, puedes completarla, reintentarla o descartarla."
            : "Al contabilizar se genera el asiento. Solo se edita mientras está pendiente."
        }
      />
      <DocumentosVentaLista
        key={[consulta.estado, consulta.q, consulta.desde, consulta.hasta, consulta.terceroId, resultado.pagina].join("|")}
        empresaId={empresaId}
        clase={clase}
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
          clase: d.clase,
          tipoDocumento: tipoNombre.get(d.tipoDocumentoId) ?? "—",
          folio: d.folio,
          cliente: clienteNombre.get(d.terceroId) ?? "—",
          terceroId: d.terceroId,
          fechaEmision: d.fechaEmision,
          fechaVencimiento: d.fechaVencimiento,
          montoTotal: d.montoTotal,
          saldo: saldos.get(d.id)?.saldo ?? Number(d.montoTotal),
          moneda: monedaCodigo.get(d.monedaId) ?? "—",
          estado: d.estado,
          puedeReintentar: d.estado === "borrador" && Number(d.montoTotal) > 0,
        }))}
        tiposDocumento={tiposDoc
          .filter((t) => codigosPermitidos.has(t.codigoSii))
          .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}` }))}
        clientesFiltro={terceros
          .filter((t) => t.tipoTercero === "Cliente")
          .map((t) => ({ id: t.id, label: `${t.razonSocial} (${t.rut})` }))}
        clientes={terceros
          .filter((t) => t.tipoTercero === "Cliente" && t.activo && !t.bloqueado)
          .map((t) => ({ id: t.id, label: `${t.razonSocial} (${t.rut})` }))}
      />
    </>
  );
}
