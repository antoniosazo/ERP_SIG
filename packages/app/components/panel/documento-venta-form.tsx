"use client";

import { useMemo, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  guardarDocumentoVentaSchema,
  type ConfigFormularioDoc,
  type DocumentoVentaClase,
} from "@erp/shared";
import {
  anularDocumentoVentaAction,
  contabilizarDocumentoVentaAction,
  actualizarFechasDocumentoVentaAction,
  guardarDocumentoVentaAction,
} from "@/lib/actions/ventas";
import { aplicarConfig, CAMPOS_CABECERA, CAMPOS_LINEA } from "@/lib/documento-venta-campos";
import { VENTA_CLASE_META } from "@/lib/ventas";
import { VolverBoton } from "@/components/panel/volver-boton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type Opcion = { id: string; label: string };
export type ClienteOpcion = Opcion & { condicionPagoDias?: number };
export type ProductoOpcion = Opcion & {
  cuentaIngresoId: string | null;
  impuestoId: string | null;
  centroCostoId: string | null;
  categoriaContableId: string | null;
  precioUnitario: number;
  glosaSugerida: string | null;
};
type FormValues = z.input<typeof guardarDocumentoVentaSchema>;
const NINGUNA = "__none__";

const fmt = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 4 });

/** Suma `dias` a una fecha `YYYY-MM-DD` en UTC y devuelve el mismo formato. */
function sumarDiasISO(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function DocumentoVentaForm({
  empresaId,
  docId,
  estado,
  numeroInterno,
  clase,
  asientoCorrelativo,
  config,
  valoresIniciales,
  clientes,
  tiposDocumento,
  cuentas,
  categorias,
  centrosCosto,
  impuestos,
  monedas,
  docsReferencia,
  contactos,
  vendedores,
  productos,
  saldosReferencia,
}: {
  empresaId: string;
  docId: string;
  estado: string;
  numeroInterno: string | null;
  clase: DocumentoVentaClase;
  asientoCorrelativo: number | null;
  config: ConfigFormularioDoc;
  valoresIniciales: FormValues;
  clientes: ClienteOpcion[];
  tiposDocumento: Opcion[];
  cuentas: Opcion[];
  categorias: Opcion[];
  centrosCosto: Opcion[];
  impuestos: (Opcion & { tasa: number })[];
  monedas: Opcion[];
  docsReferencia: Opcion[];
  contactos: Opcion[];
  vendedores: Opcion[];
  productos: ProductoOpcion[];
  saldosReferencia?: Record<string, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const readOnly = estado !== "borrador";
  // Las facturas no pasan por borrador: se contabilizan al guardarse, y ya contabilizadas solo
  // se editan el vencimiento y la fecha de contabilización.
  const esFactura = clase === "Factura";
  const fechasEditables = esFactura && estado === "contabilizado";
  const tasaImpuesto = useMemo(() => new Map(impuestos.map((i) => [i.id, i.tasa])), [impuestos]);
  const cuentaLabel = useMemo(() => new Map(cuentas.map((c) => [c.id, c.label])), [cuentas]);
  const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const camposCabecera = useMemo(
    () => aplicarConfig(CAMPOS_CABECERA, config.cabecera).filter((c) => c.visible),
    [config],
  );
  const colsLinea = useMemo(
    () => aplicarConfig(CAMPOS_LINEA, config.linea).filter((c) => c.visible),
    [config],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(guardarDocumentoVentaSchema),
    defaultValues: valoresIniciales,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lineas" });
  const lineas = watch("lineas");
  const esServicio = (watch("modalidad") ?? "Artículo") === "Servicio";
  // Como un documento de tipo Servicio de SAP B1: sin artículo del maestro; la descripción
  // va primero y es obligatoria, junto a la cuenta, el impuesto y el importe.
  const columnasLinea = useMemo(() => {
    if (!esServicio) return colsLinea;
    const glosa = colsLinea.find((c) => c.id === "glosa") ?? {
      id: "glosa",
      label: "Glosa",
      visible: true,
      estructural: false,
    };
    return [
      { ...glosa, label: "Descripción" },
      ...colsLinea.filter((c) => c.id !== "productoId" && c.id !== "glosa"),
    ];
  }, [colsLinea, esServicio]);
  const descGlobal = watch("descuentoGlobalPct");

  const gFactor = 1 - (Number(descGlobal) || 0) / 100;
  const netoDe = (l: FormValues["lineas"][number] | undefined) =>
    (Number(l?.cantidad) || 0) *
    (Number(l?.precioUnitario) || 0) *
    (1 - (Number(l?.descuentoLineaPct) || 0) / 100) *
    gFactor;
  const ivaDe = (l: FormValues["lineas"][number] | undefined) =>
    l && !l.esExento && l.impuestoId ? (netoDe(l) * (tasaImpuesto.get(l.impuestoId) ?? 0)) / 100 : 0;

  const totales = useMemo(() => {
    let neto = 0;
    let exento = 0;
    let iva = 0;
    for (const l of lineas ?? []) {
      const n = netoDe(l);
      if (l.esExento) exento += n;
      else {
        neto += n;
        iva += ivaDe(l);
      }
    }
    const R = Math.round;
    return { neto, exento, iva: R(iva), total: R(neto) + R(exento) + R(iva) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineas, tasaImpuesto, descGlobal]);

  const refId = watch("documentoReferenciaId") as string | undefined;
  const saldoRef =
    clase === "Nota de Crédito" && refId ? (saldosReferencia?.[refId] ?? null) : null;
  const excedeSaldo = saldoRef != null && totales.total > saldoRef + 0.01;

  function recomputarVencimiento(dias?: number) {
    if (readOnly) return;
    const f = watch("fechaEmision");
    if (!f) return;
    const d = dias ?? (Number(watch("condicionPagoDias")) || 0);
    setValue("fechaVencimiento", sumarDiasISO(f, d), { shouldValidate: true });
  }

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = await guardarDocumentoVentaAction(empresaId, docId, data);
      if (r.ok) {
        toast.success(r.contabilizado ? "Factura guardada y contabilizada" : "Documento guardado");
        router.refresh();
      } else toast.error(r.error);
    });
  });

  function guardarFechas() {
    startTransition(async () => {
      const r = await actualizarFechasDocumentoVentaAction(empresaId, docId, {
        fechaVencimiento: watch("fechaVencimiento") as string,
        fechaContabilizacion: watch("fechaContabilizacion") as string,
      });
      if (r.ok) {
        toast.success("Fechas actualizadas");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function contabilizar() {
    startTransition(async () => {
      const r = await contabilizarDocumentoVentaAction(empresaId, docId);
      if (r.ok) {
        toast.success("Documento contabilizado");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function anular() {
    const motivo = prompt("Motivo de la anulación:");
    if (!motivo?.trim()) return;
    startTransition(async () => {
      const r = await anularDocumentoVentaAction(empresaId, docId, { motivo });
      if (r.ok) {
        toast.success("Documento anulado");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const selOpt = (name: keyof FormValues, opciones: Opcion[], placeholder: string) => (
    <Select
      value={(watch(name) as string | undefined) ?? NINGUNA}
      onValueChange={(v) => setValue(name, (v === NINGUNA ? undefined : v) as never)}
      disabled={readOnly}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NINGUNA}>{placeholder}</SelectItem>
        {opciones.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const campo = (label: string, field: ReactNode, extra?: string, error?: string) => (
    <div className={`space-y-2 ${extra ?? ""}`}>
      <Label>{label}</Label>
      {field}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );

  function renderCabecera(id: string): ReactNode {
    switch (id) {
      case "terceroId":
        return campo(
          "Cliente",
          <Select
            value={(watch("terceroId") as string | undefined) ?? NINGUNA}
            onValueChange={(v) => {
              const cid = v === NINGUNA ? undefined : v;
              setValue("terceroId", cid as never);
              const cli = clientes.find((c) => c.id === cid);
              setValue("nombreCliente", cli?.label ?? "");
              setValue("condicionPagoDias", cli?.condicionPagoDias ?? 0);
              recomputarVencimiento(cli?.condicionPagoDias ?? 0);
            }}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNA}>Cliente</SelectItem>
              {clientes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>,
        );
      case "modalidad":
        return campo(
          "Tipo (Artículo / Servicio)",
          <Select
            value={(watch("modalidad") as string | undefined) ?? "Artículo"}
            onValueChange={(v) => {
              setValue("modalidad", v as "Artículo" | "Servicio");
              if (v === "Servicio") {
                (watch("lineas") ?? []).forEach((_, i) => setValue(`lineas.${i}.productoId`, undefined));
              }
            }}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Artículo">Artículo</SelectItem>
              <SelectItem value="Servicio">Servicio</SelectItem>
            </SelectContent>
          </Select>,
        );
      case "tipoDocumentoId":
        return campo("Tipo de documento", selOpt("tipoDocumentoId", tiposDocumento, "Tipo"));
      case "fechaEmision":
        return campo(
          "Fecha del documento",
          <Input
            type="date"
            {...register("fechaEmision", { onChange: () => recomputarVencimiento() })}
            disabled={readOnly}
          />,
          undefined,
          errors.fechaEmision?.message,
        );
      case "fechaVencimiento":
        return campo(
          "Fecha de vencimiento",
          <Input type="date" {...register("fechaVencimiento")} disabled={readOnly && !fechasEditables} />,
          undefined,
          errors.fechaVencimiento?.message,
        );
      case "fechaContabilizacion":
        return campo(
          "Fecha de contabilización",
          <Input type="date" {...register("fechaContabilizacion")} disabled={readOnly && !fechasEditables} />,
          undefined,
          errors.fechaContabilizacion?.message,
        );
      case "monedaId":
        return campo(
          "Moneda",
          <Select
            value={watch("monedaId")}
            onValueChange={(v) => setValue("monedaId", v)}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monedas.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>,
        );
      case "folio":
        return campo("Folio SII", <Input {...register("folio")} disabled={readOnly} />);
      case "numAtCard":
        return campo("N° ref. del cliente", <Input {...register("numAtCard")} disabled={readOnly} />);
      case "tipoCambio":
        return campo(
          "Tipo de cambio",
          <Input
            type="number"
            step="0.000001"
            {...register("tipoCambio", { valueAsNumber: true })}
            disabled={readOnly}
          />,
        );
      case "descuentoGlobalPct":
        return campo(
          "Descuento global %",
          <Input
            type="number"
            step="0.01"
            {...register("descuentoGlobalPct", {
              setValueAs: (v) => (v === "" || v == null ? 0 : Number(v)),
            })}
            disabled={readOnly}
          />,
        );
      case "documentoReferenciaId":
        if (clase === "Factura") return null;
        return (
          <div className="space-y-2" key="documentoReferenciaId">
            <Label>Documento que corrige</Label>
            {selOpt("documentoReferenciaId", docsReferencia, "Sin referencia")}
            {saldoRef != null && (
              <p
                className={
                  excedeSaldo ? "text-sm text-destructive" : "text-sm text-muted-foreground"
                }
              >
                Saldo disponible de la factura: {fmt(saldoRef)}
                {excedeSaldo && " — el total la excede"}
              </p>
            )}
          </div>
        );
      case "nombreCliente":
        return campo(
          "Nombre del cliente",
          <Input {...register("nombreCliente")} disabled={readOnly} />,
        );
      case "condicionPagoDias":
        return campo(
          "Condición de pago (días)",
          <Input
            type="number"
            step="1"
            {...register("condicionPagoDias", {
              setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
              onChange: () => recomputarVencimiento(),
            })}
            disabled={readOnly}
          />,
        );
      case "vendedorId":
        return campo("Vendedor", selOpt("vendedorId", vendedores, "Sin vendedor"));
      case "contactoId":
        return campo("Persona de contacto", selOpt("contactoId", contactos, "Sin contacto"));
      case "direccionFacturacion":
        return campo(
          "Dirección de facturación",
          <Input {...register("direccionFacturacion")} disabled={readOnly} />,
        );
      case "direccionDespacho":
        return campo(
          "Dirección de despacho",
          <Input {...register("direccionDespacho")} disabled={readOnly} />,
        );
      case "glosa":
        return campo(
          "Glosa",
          <Input {...register("glosa")} disabled={readOnly} />,
          "@xl:col-span-3",
        );
      default:
        return null;
    }
  }

  function elegirProducto(i: number, productoId: string | undefined) {
    setValue(`lineas.${i}.productoId`, productoId);
    const p = productoId ? productoPorId.get(productoId) : undefined;
    if (!p) return;
    if (p.cuentaIngresoId) setValue(`lineas.${i}.cuentaIngresoId`, p.cuentaIngresoId);
    setValue(`lineas.${i}.impuestoId`, p.impuestoId ?? undefined);
    if (p.centroCostoId) setValue(`lineas.${i}.centroCostoId`, p.centroCostoId);
    if (p.categoriaContableId) setValue(`lineas.${i}.categoriaContableId`, p.categoriaContableId);
    setValue(`lineas.${i}.precioUnitario`, p.precioUnitario);
    if (!watch(`lineas.${i}.glosa`) && p.glosaSugerida) {
      setValue(`lineas.${i}.glosa`, p.glosaSugerida);
    }
  }

  function renderCeldaLinea(id: string, i: number): ReactNode {
    switch (id) {
      case "productoId":
        return (
          <Select
            value={watch(`lineas.${i}.productoId`) ?? NINGUNA}
            onValueChange={(v) => elegirProducto(i, v === NINGUNA ? undefined : v)}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full min-w-44">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNA}>—</SelectItem>
              {productos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "cuentaIngresoId":
        return (
          <Select
            value={watch(`lineas.${i}.cuentaIngresoId`)}
            onValueChange={(v) => setValue(`lineas.${i}.cuentaIngresoId`, v)}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full min-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cuentas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "cantidad":
        return (
          <Input
            type="number"
            step="0.000001"
            className="w-24 text-right"
            {...register(`lineas.${i}.cantidad`, { valueAsNumber: true })}
            disabled={readOnly}
          />
        );
      case "precioUnitario":
        return (
          <Input
            type="number"
            step="0.01"
            className="w-32 text-right"
            {...register(`lineas.${i}.precioUnitario`, { valueAsNumber: true })}
            disabled={readOnly}
          />
        );
      case "descuentoLineaPct":
        return (
          <Input
            type="number"
            step="0.01"
            className="w-20 text-right"
            {...register(`lineas.${i}.descuentoLineaPct`, {
              setValueAs: (v) => (v === "" || v == null ? 0 : Number(v)),
            })}
            disabled={readOnly}
          />
        );
      case "impuestoId":
        return (
          <Select
            value={watch(`lineas.${i}.impuestoId`) ?? NINGUNA}
            onValueChange={(v) =>
              setValue(`lineas.${i}.impuestoId`, v === NINGUNA ? undefined : v)
            }
            disabled={readOnly || watch(`lineas.${i}.esExento`)}
          >
            <SelectTrigger className="w-full min-w-36">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNA}>—</SelectItem>
              {impuestos.map((im) => (
                <SelectItem key={im.id} value={im.id}>
                  {im.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "esExento":
        return (
          <input
            type="checkbox"
            className="size-4"
            {...register(`lineas.${i}.esExento`)}
            disabled={readOnly}
          />
        );
      case "glosa":
        return <Input {...register(`lineas.${i}.glosa`)} disabled={readOnly} />;
      case "categoriaContableId":
        return (
          <Select
            value={watch(`lineas.${i}.categoriaContableId`) ?? NINGUNA}
            onValueChange={(v) =>
              setValue(`lineas.${i}.categoriaContableId`, v === NINGUNA ? undefined : v)
            }
            disabled={readOnly}
          >
            <SelectTrigger className="w-full min-w-40">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNA}>—</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "centroCostoId":
        return (
          <Select
            value={watch(`lineas.${i}.centroCostoId`) ?? NINGUNA}
            onValueChange={(v) =>
              setValue(`lineas.${i}.centroCostoId`, v === NINGUNA ? undefined : v)
            }
            disabled={readOnly}
          >
            <SelectTrigger className="w-full min-w-40">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNA}>—</SelectItem>
              {centrosCosto.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "fechaDiferimiento":
        return (
          <Input
            type="date"
            className="w-40"
            {...register(`lineas.${i}.fechaDiferimiento`)}
            disabled={readOnly}
          />
        );
      case "nombreCuenta":
        return (
          <span className="text-xs text-muted-foreground">
            {cuentaLabel.get(watch(`lineas.${i}.cuentaIngresoId`)) ?? "—"}
          </span>
        );
      case "totalConIva": {
        const l = lineas?.[i];
        return (
          <span className="tabular-nums">{fmt(netoDe(l) + ivaDe(l))}</span>
        );
      }
      default:
        return null;
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            {numeroInterno} · {clase}
          </CardTitle>
          <Badge
            variant={
              estado === "contabilizado"
                ? "secondary"
                : estado === "anulado"
                  ? "destructive"
                  : "default"
            }
          >
            {estado}
          </Badge>
        </CardHeader>
        <CardContent className="doc-hdr grid gap-4 @xl:grid-cols-3">
          {camposCabecera.map((c) => {
            const node = renderCabecera(c.id);
            return node == null ? null : (
              <div key={c.id} className="contents">
                {node}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Líneas</CardTitle>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              onClick={() =>
                append({
                  glosa: "",
                  productoId: undefined,
                  cuentaIngresoId: cuentas[0]?.id ?? "",
                  categoriaContableId: undefined,
                  centroCostoId: undefined,
                  impuestoId: impuestos[0]?.id ?? undefined,
                  cantidad: 1,
                  precioUnitario: 0,
                  descuentoLineaPct: 0,
                  esExento: false,
                  fechaDiferimiento: undefined,
                })
              }
            >
              Agregar línea
            </Button>
          )}
        </CardHeader>
        <div className="erp-grid overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columnasLinea.map((c) => (
                  <TableHead key={c.id}>{c.label}</TableHead>
                ))}
                <TableHead className="text-right">Neto</TableHead>
                {!readOnly && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, i) => (
                <TableRow key={f.id}>
                  {columnasLinea.map((c) => (
                    <TableCell key={c.id}>{renderCeldaLinea(c.id, i)}</TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">
                    {fmt(netoDe(lineas?.[i]))}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => remove(i)}
                      >
                        Quitar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {errors.lineas && (
          <p className="px-6 pb-2 text-sm text-destructive">
            {errors.lineas.message ?? "Revisa las líneas"}
          </p>
        )}
        <CardContent className="ml-auto grid w-full max-w-xs gap-1 rounded-md border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Neto</span>
            <span className="tabular-nums">{fmt(totales.neto)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exento</span>
            <span className="tabular-nums">{fmt(totales.exento)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA</span>
            <span className="tabular-nums">{fmt(totales.iva)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{fmt(totales.total)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {!readOnly && (
          <>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : esFactura ? "Guardar y contabilizar" : "Guardar"}
            </Button>
            {!esFactura && (
              <Button type="button" variant="secondary" disabled={isPending} onClick={contabilizar}>
                Contabilizar
              </Button>
            )}
          </>
        )}
        {fechasEditables && (
          <Button type="button" disabled={isPending} onClick={guardarFechas}>
            {isPending ? "Guardando..." : "Guardar fechas"}
          </Button>
        )}
        {estado !== "anulado" && (
          <Button type="button" variant="destructive" disabled={isPending} onClick={anular}>
            Anular
          </Button>
        )}
        {estado === "contabilizado" && asientoCorrelativo != null && (
          <span className="text-sm text-muted-foreground">
            Asiento generado: <span className="font-mono">N° {asientoCorrelativo}</span>
          </span>
        )}
        <VolverBoton
          className="ml-auto"
          fallbackHref={`/panel/${empresaId}/ventas/${VENTA_CLASE_META[clase].slug}`}
        />
      </div>
    </form>
  );
}
