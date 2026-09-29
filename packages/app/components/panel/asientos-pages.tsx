import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listarAsientos,
  listarCentrosCosto,
  listarPlanCuentasDeEmpresa,
  listarReversionesPendientes,
  listarTerceros,
  obtenerAsiento,
  obtenerEmpresa,
  type AsientoDetalle,
} from "@erp/db";
import { TIPO_ASIENTO_LABEL, puedeEditarFinanzas, validarFiltrosAsientos, type AsientoManualTipo } from "@erp/shared";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { historialAsientoAction } from "@/lib/actions/asientos";
import { ETIQUETA_ORIGEN } from "@/lib/origen-asiento";
import { AsientoAnularBoton, EjecutarReversionesBoton } from "@/components/panel/asiento-acciones";
import { AsientoManualForm, type AsientoInicial, type CuentaOpcion } from "@/components/panel/asiento-manual-form";
import { FilaEnlace } from "@/components/panel/fila-enlace";
import { HistorialDocumentoDialog } from "@/components/panel/historial-documento-dialog";
import { EnlaceDetalle } from "@/components/panel/enlace-detalle";
import { referenciaDeLinea, rutaReferenciaAsiento, rutaListaAsientos } from "@/lib/asientos-navegacion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TypographyHeading } from "@/components/ui/typography";

const fmt = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
const hoy = () => new Date().toISOString().slice(0, 10);
const TIPOS_MANUALES = new Set<string>(["traspaso", "ingreso", "egreso", "ajuste"]);

export type FiltrosAsientosParams = { desde?: string | string[]; hasta?: string | string[]; estado?: string | string[]; origen?: string | string[]; q?: string | string[] };

async function accesoFinanzas(empresaId: string) {
  const acceso = await obtenerAccesoEmpresa(empresaId);
  if (!acceso) notFound();
  return puedeEditarFinanzas(acceso.session.user.esAdminFirma, acceso.rol);
}

function EstadoBadge({ estado, revertido }: { estado: string; revertido?: boolean }) {
  if (estado === "borrador") return <Badge variant="outline">Borrador</Badge>;
  if (revertido) return <Badge variant="secondary">Revertido</Badge>;
  return <Badge variant={estado === "contabilizado" ? "default" : "secondary"}>{estado === "contabilizado" ? "Contabilizado" : "Anulado"}</Badge>;
}

// ── Lista (libro diario) ────────────────────────────────────────────────────

export async function AsientosListaPage({ empresaId, sp }: { empresaId: string; sp: FiltrosAsientosParams }) {
  const puedeEditar = await accesoFinanzas(empresaId);
  const base = `/panel/${empresaId}/contabilidad/asientos`;
  const resultado = validarFiltrosAsientos(sp, hoy());
  if (!resultado.success) return <>
    <TypographyHeading title="Asientos" description="Corrige los filtros para consultar el libro diario." />
    <p role="alert" className="text-sm text-destructive">{resultado.error.issues[0]?.message}</p>
    <Button asChild variant="outline"><Link href={base}>Restablecer filtros</Link></Button>
  </>;
  const { desde, hasta, q } = resultado.data;
  const estado = resultado.data.estado || undefined;
  const origen = resultado.data.origen || undefined;
  const [resultados, pendientes] = await Promise.all([
    listarAsientos(empresaId, { desde, hasta, estado, origen, texto: q, limite: 301 }),
    listarReversionesPendientes(empresaId, hoy()),
  ]);
  const filas = resultados.slice(0, 300);
  const filtros = new URLSearchParams();
  for (const [key, value] of Object.entries(resultado.data)) if (value) filtros.set(key, value);
  const consultaDetalle = new URLSearchParams({ lista: filtros.toString() }).toString();
  const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <>
      <TypographyHeading
        title="Asientos"
        description="Libro diario de la empresa: asientos manuales y los generados por los módulos. Los manuales se crean aquí; los automáticos se corrigen desde su documento origen."
      />

      {pendientes.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm">
            <span>
              Hay {pendientes.length} asiento(s) marcados para revertir con fecha vencida (
              {pendientes
                .slice(0, 5)
                .map((p) => `N° ${p.correlativo} al ${p.fechaReversa}`)
                .join(", ")}
              {pendientes.length > 5 ? "…" : ""}).
            </span>
            {puedeEditar && <EjecutarReversionesBoton empresaId={empresaId} cantidad={pendientes.length} />}
          </CardContent>
        </Card>
      )}

      <form className="flex flex-wrap items-end gap-3" action={base}>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Desde</span>
          <Input type="date" name="desde" defaultValue={desde} className="h-9 w-40" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Hasta</span>
          <Input type="date" name="hasta" defaultValue={hasta} className="h-9 w-40" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Origen</span>
          <select name="origen" defaultValue={origen ?? ""} className={`${selectCls} block`}>
            <option value="">Todos</option>
            <option value="manual">Manuales</option>
            <option value="automatico">Automáticos</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className={`${selectCls} block`}>
            <option value="">Todos</option>
            <option value="borrador">Borradores</option>
            <option value="contabilizado">Contabilizados</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Buscar</span>
          <Input name="q" defaultValue={q ?? ""} placeholder="N°, glosa o referencia" className="h-9 w-56" />
        </label>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
        {puedeEditar && <div className="ml-auto">
          <Button asChild>
            <Link href={`${base}/nuevo`}>Nuevo asiento</Link>
          </Button>
        </div>}
      </form>
      {resultados.length > 300 && <p role="status" className="text-sm text-muted-foreground">Se muestran los primeros 300 asientos. Reduce el rango de fechas o usa los filtros para consultar el resto.</p>}

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay asientos con estos filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">N°</TableHead>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead>Glosa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((a) => (
                <FilaEnlace key={a.id} href={`${base}/${a.id}?${consultaDetalle}`}>
                  <TableCell className="font-mono font-medium">
                    <EnlaceDetalle href={`${base}/${a.id}?${consultaDetalle}`} title="Ver detalle del asiento">
                      {a.correlativo ?? "Borrador"}
                    </EnlaceDetalle>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{a.fecha}</TableCell>
                  <TableCell>
                    <div className="max-w-md truncate">{a.glosa}</div>
                    {a.referencia && <div className="text-xs text-muted-foreground">Ref. {a.referencia}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{TIPO_ASIENTO_LABEL[a.tipo] ?? a.tipo}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.esManual ? "Manual" : (ETIQUETA_ORIGEN[a.origenTabla ?? ""] ?? a.origen ?? a.origenTabla)}
                    {a.esManual && a.fechaReversa && !a.reversaId && (
                      <div className="text-xs text-amber-600">Revierte el {a.fechaReversa}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(a.totalDebe)}</TableCell>
                  <TableCell>
                    <EstadoBadge estado={a.estado} revertido={!!a.reversaId} />
                  </TableCell>
                </FilaEnlace>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

// ── Nuevo / editar borrador ─────────────────────────────────────────────────

async function opcionesFormulario(empresaId: string) {
  const [empresa, cuentas, terceros, centros] = await Promise.all([
    obtenerEmpresa(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
    listarTerceros(empresaId),
    listarCentrosCosto(empresaId),
  ]);
  if (!empresa) notFound();
  const opcCuentas: CuentaOpcion[] = cuentas
    .filter((c) => c.activa && c.nivelImputable && c.modoMoneda !== "Extranjera fija")
    .map((c) => ({
      id: c.id,
      label: `${c.codigoCuenta} ${c.nombreCuenta}`,
      detalle: c.tipoCuenta !== "Otra" ? c.tipoCuenta : undefined,
      control: c.tipoCuenta === "Cliente" || c.tipoCuenta === "Proveedor",
      requiereCentroCosto: c.requiereCentroCosto,
      requiereTercero: c.requiereAnalisisTerceros,
    }));
  return {
    aplicaIfrs: empresa.aplicaIfrs,
    cuentas: opcCuentas,
    terceros: terceros
      .filter((t) => t.activo)
      .map((t) => ({ id: t.id, label: t.razonSocial, detalle: `${t.rut} · ${t.tipoTercero}` })),
    centrosCosto: centros
      .filter((c) => c.estado === "Activo")
      .map((c) => ({ id: c.id, label: `${c.codigo} ${c.nombre}` })),
  };
}

function inicialDesde(d: AsientoDetalle, comoCopia: boolean): AsientoInicial {
  const a = d.asiento;
  return {
    fecha: comoCopia ? hoy() : a.fecha,
    glosa: a.glosa,
    tipo: (TIPOS_MANUALES.has(a.tipo) ? a.tipo : "traspaso") as AsientoManualTipo,
    libro: a.libro,
    referencia: a.referencia ?? "",
    fechaReversa: comoCopia ? "" : (a.fechaReversa ?? ""),
    lineas: d.lineas.map((l) => ({
      cuentaId: l.cuentaId,
      terceroId: l.terceroId,
      centroCostoId: l.centroCostoId,
      glosa: l.glosa === a.glosa ? "" : (l.glosa ?? ""),
      debe: l.debe,
      haber: l.haber,
    })),
  };
}

export async function AsientoNuevoPage({ empresaId, desdeId }: { empresaId: string; desdeId?: string }) {
  if (!await accesoFinanzas(empresaId)) notFound();
  const [opc, origen] = await Promise.all([
    opcionesFormulario(empresaId),
    desdeId ? obtenerAsiento(empresaId, desdeId) : Promise.resolve(null),
  ]);
  if (desdeId && !origen) notFound();
  const inicial: AsientoInicial = origen
    ? inicialDesde(origen, true)
    : { fecha: hoy(), glosa: "", tipo: "traspaso", libro: "Ambos", referencia: "", fechaReversa: "", lineas: [] };
  return (
    <>
      <TypographyHeading
        title={origen ? `Nuevo asiento (copia del N° ${origen.asiento.correlativo ?? "borrador"})` : "Nuevo asiento"}
        description="Indica en cada línea una cuenta de mayor, un socio de negocio (usa su cuenta asociada) o ambos. El asiento debe cuadrar para contabilizarse."
      />
      <AsientoManualForm empresaId={empresaId} asientoId={null} inicial={inicial} {...opc} />
    </>
  );
}

// ── Detalle ─────────────────────────────────────────────────────────────────

export async function AsientoDetallePage({ empresaId, asientoId, lista }: { empresaId: string; asientoId: string; lista?: string | string[] }) {
  const puedeEditar = await accesoFinanzas(empresaId);
  const d = await obtenerAsiento(empresaId, asientoId);
  if (!d) notFound();
  const { asiento: a, lineas, totales, reversa, original } = d;
  const base = `/panel/${empresaId}/contabilidad/asientos`;
  const vuelta = rutaListaAsientos(empresaId, lista, hoy());
  const detalleHref = (id: string) => `${base}/${id}${vuelta.includes("?") ? `?${new URLSearchParams({ lista: vuelta.split("?")[1]! })}` : ""}`;
  const volver = <Button asChild variant="outline" size="sm"><Link href={vuelta}>Volver al listado</Link></Button>;
  const periodo = new URLSearchParams({ desde: `${a.fecha.slice(0, 7)}-01`, hasta: a.fecha });
  const origen = d.referencias.find((r) => r.id === a.documentoOrigenId && r.tabla === a.documentoOrigenTabla);
  const hayMonedaOrigen = lineas.some((l) => l.monedaId !== d.monedaFuncional?.id || Number(l.tipoCambio) !== 1);

  if (puedeEditar && a.estado === "borrador" && d.esManual) {
    const opc = await opcionesFormulario(empresaId);
    return (
      <>
        {volver}
        <TypographyHeading
          title="Borrador de asiento"
          description="Aún no afecta saldos ni tiene número. Complétalo y contabilízalo cuando cuadre."
        />
        <AsientoManualForm empresaId={empresaId} asientoId={a.id} inicial={inicialDesde(d, false)} {...opc} />
      </>
    );
  }

  const rutaDoc = origen ? rutaReferenciaAsiento(empresaId, origen) : null;
  const puedeAnular = puedeEditar && d.esManual && a.estado === "contabilizado" && !reversa;

  return (
    <>
      {volver}
      <TypographyHeading
        title={a.correlativo === null ? `Borrador de asiento · ${a.fecha}` : `Asiento N° ${a.correlativo} · ${a.fecha}`}
        description={a.glosa}
      />

      <div className="flex flex-wrap items-center gap-3">
        <EstadoBadge estado={a.estado} revertido={!!reversa} />
        {puedeAnular && <AsientoAnularBoton empresaId={empresaId} asientoId={a.id} fechaOriginal={a.fecha} />}
        {puedeEditar && d.esManual && (
          <Button asChild variant="outline">
            <Link href={`${base}/nuevo?desde=${a.id}`}>Duplicar</Link>
          </Button>
        )}
        {rutaDoc && a.documentoOrigenTabla !== "asientos_contables" && (
          <Button asChild variant="outline">
            <Link href={rutaDoc}>{origen?.etiqueta ?? "Ver documento origen"}</Link>
          </Button>
        )}
        <HistorialDocumentoDialog empresaId={empresaId} docId={a.id} historial={historialAsientoAction} />
      </div>

      {(reversa || original) && (
        <p className="text-sm">
          {reversa && (
            <>
              Revertido por el{" "}
              <Link href={detalleHref(reversa.id)} className="font-medium hover:underline">
                asiento N° {reversa.correlativo}
              </Link>{" "}
              del {reversa.fecha}.
            </>
          )}
          {original && (
            <>
              Reversa del{" "}
              <Link href={detalleHref(original.id)} className="font-medium hover:underline">
                asiento N° {original.correlativo}
              </Link>{" "}
              del {original.fecha}.
            </>
          )}
        </p>
      )}
      {!d.esManual && !original && (
        <p className="text-sm text-muted-foreground">
          Generado automáticamente ({a.origen ?? a.documentoOrigenTabla}). Es de solo lectura: se corrige desde su documento origen.
        </p>
      )}

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Fecha de contabilización">{a.fecha}</Dato>
          <Dato etiqueta="Origen">{origen && rutaDoc ? <EnlaceDetalle href={rutaDoc}>{origen.etiqueta}</EnlaceDetalle> : d.esManual ? "Manual" : "Documento no disponible"}</Dato>
          <Dato etiqueta="Moneda funcional">{d.monedaFuncional?.codigo ?? "—"}</Dato>
          <Dato etiqueta="Tipo">{TIPO_ASIENTO_LABEL[a.tipo] ?? a.tipo}</Dato>
          <Dato etiqueta="Libro">{a.libro}</Dato>
          <Dato etiqueta="Referencia">{a.referencia ?? "—"}</Dato>
          <Dato etiqueta="Creado por">{d.usuario ?? "—"}</Dato>
          {a.fechaReversa && <Dato etiqueta="Reversión programada">{a.fechaReversa}</Dato>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Líneas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-240 text-sm [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-3">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">Cuenta</th>
                <th>Socio de negocio</th>
                <th>C. costo</th>
                <th>Glosa</th>
                <th>Documento asociado</th>
                {hayMonedaOrigen && <th className="text-right">Moneda de origen / Tipo de cambio</th>}
                <th className="text-right">Debe ({d.monedaFuncional?.codigo})</th>
                <th className="text-right">Haber ({d.monedaFuncional?.codigo})</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const ref = l.documentoReferenciaId === a.id && origen ? origen : referenciaDeLinea(d.referencias, l.documentoReferenciaId);
                const href = ref ? rutaReferenciaAsiento(empresaId, ref) : null;
                return <tr key={l.id} className="border-t">
                  <td className="py-1.5">
                    <EnlaceDetalle href={`/panel/${empresaId}/configuracion/plan-cuentas/${l.cuentaId}?${periodo}`} title={`Ver mayor de ${l.cuentaCodigo}`}>
                      <span className="font-mono">{l.cuentaCodigo}</span> {l.cuentaNombre}
                    </EnlaceDetalle>
                  </td>
                  <td>
                    {l.tercero ? (
                      <div className="space-y-1">
                        <EnlaceDetalle href={`/panel/${empresaId}/maestros/terceros/${l.terceroId}`} title="Ver ficha del socio">{l.tercero}</EnlaceDetalle>
                        <Link className="block text-xs text-primary hover:underline" href={`/panel/${empresaId}/maestros/terceros/${l.terceroId}/cuenta`}>Cuenta corriente</Link>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="text-muted-foreground">{l.centroCostoId && l.centroCosto ? <EnlaceDetalle href={`/panel/${empresaId}/configuracion/centros-costo/${l.centroCostoId}`} title="Ver centro de costo">{l.centroCosto} · {l.centroCostoNombre}</EnlaceDetalle> : "—"}</td>
                  <td className="text-muted-foreground">{l.glosa}</td>
                  <td>{ref && href ? <EnlaceDetalle href={href}>{ref.etiqueta}</EnlaceDetalle> : l.documentoReferenciaId ? "Referencia no disponible" : "—"}</td>
                  {hayMonedaOrigen && <td className="text-right text-xs tabular-nums">
                    <div>{l.moneda ?? "—"} · TC {Number(l.tipoCambio).toLocaleString("es-CL", { maximumFractionDigits: 6 })}</div>
                    <div>Debe {Number(l.debeOrigen).toLocaleString("es-CL", { maximumFractionDigits: 4 })} / Haber {Number(l.haberOrigen).toLocaleString("es-CL", { maximumFractionDigits: 4 })}</div>
                  </td>}
                  <td className="text-right tabular-nums">{l.debe ? fmt(l.debe) : ""}</td>
                  <td className="text-right tabular-nums">{l.haber ? fmt(l.haber) : ""}</td>
                </tr>;
              })}
              <tr className="border-t font-medium">
                <td className="py-1.5" colSpan={hayMonedaOrigen ? 6 : 5}>
                  Total
                </td>
                <td className="text-right tabular-nums">{fmt(totales.debe)}</td>
                <td className="text-right tabular-nums">{fmt(totales.haber)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{etiqueta}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
