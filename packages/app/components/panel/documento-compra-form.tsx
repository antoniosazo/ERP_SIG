"use client";

import { useMemo, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  IVA_RECUPERABLE,
  guardarDocumentoCompraSchema,
  type ConfigFormularioDoc,
  type DocumentoCompraTipo,
} from "@erp/shared";
import {
  abrirPedidoCompraAction,
  anularDocumentoCompraAction,
  contabilizarDocumentoCompraAction,
  actualizarFechasDocumentoCompraAction,
  guardarDocumentoCompraAction,
} from "@/lib/actions/compras";
import { aplicarConfig, CAMPOS_CABECERA, CAMPOS_LINEA } from "@/lib/documento-compra-campos";
import { COMPRA_TIPO_META } from "@/lib/compras";
import { Badge } from "@/components/ui/badge";
import { VolverBoton } from "@/components/panel/volver-boton";
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
export type ProveedorOpcion = Opcion & { condicionPagoDias?: number };
export type ProductoCompraOpcion = Opcion & {
  cuentaImputacionId: string | null;
  impuestoId: string | null;
  centroCostoId: string | null;
  categoriaContableId: string | null;
  precioUnitario: number;
  glosaSugerida: string | null;
};
export type CategoriaOpcion = Opcion & { ivaRecuperableDefault: string | null };

type FormValues = z.input<typeof guardarDocumentoCompraSchema>;
const NINGUNA = "__none__";

const fmt = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 4 });

function sumarDiasISO(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function DocumentoCompraForm({
  empresaId,
  docId,
  docTipo,
  estado,
  numeroInterno,
  asientoCorrelativo,
  config,
  valoresIniciales,
  proveedores,
  tiposDocumento,
  cuentas,
  categorias,
  centrosCosto,
  impuestos,
  monedas,
  productos,
  lineasPendientes,
}: {
  empresaId: string;
  docId: string;
  docTipo: DocumentoCompraTipo;
  estado: string;
  numeroInterno: string | null;
  asientoCorrelativo: number | null;
  config: ConfigFormularioDoc;
  valoresIniciales: FormValues;
  proveedores: ProveedorOpcion[];
  tiposDocumento: Opcion[];
  cuentas: Opcion[];
  categorias: CategoriaOpcion[];
  centrosCosto: Opcion[];
  impuestos: (Opcion & { tasa: number })[];
  monedas: Opcion[];
  productos: ProductoCompraOpcion[];
  /** Saldo pendiente por línea (cuando este documento viene de un pedido). */
  lineasPendientes?: Record<number, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const readOnly = estado !== "borrador";
  // Las facturas no pasan por borrador: se contabilizan al guardarse, y ya contabilizadas solo
  // se editan el vencimiento y la fecha de contabilización.
  const esFactura = docTipo === "factura";
  const fechasEditables = esFactura && estado === "contabilizado";
  const contabiliza = COMPRA_TIPO_META[docTipo].contabiliza;
  const esPedido = docTipo === "pedido";

  const tasaImpuesto = useMemo(() => new Map(impuestos.map((i) => [i.id, i.tasa])), [impuestos]);
  const cuentaLabel = useMemo(() => new Map(cuentas.map((c) => [c.id, c.label])), [cuentas]);
  const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const categoriaPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

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
    resolver: zodResolver(guardarDocumentoCompraSchema),
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
  const ivaDe = (l: FormValues["lineas"][number] | undefined) => {
    if (!l || l.esExento || !l.impuestoId) return 0;
    if (l.ivaRecuperable === "No Recuperable") return 0;
    return (netoDe(l) * (tasaImpuesto.get(l.impuestoId) ?? 0)) / 100;
  };

  const totales = useMemo(() => {
    let neto = 0;
    let exento = 0;
    let iva = 0;
    for (const l of lineas ?? []) {
      let n = netoDe(l);
      if (l.impuestoId && !l.esExento && l.ivaRecuperable === "No Recuperable") {
        n += (n * (tasaImpuesto.get(l.impuestoId) ?? 0)) / 100;
      }
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

  function recomputarVencimiento(dias?: number) {
    if (readOnly) return;
    const f = watch("fechaEmision");
    if (!f) return;
    const d = dias ?? (Number(watch("condicionPagoDias")) || 0);
    setValue("fechaVencimiento", sumarDiasISO(f, d), { shouldValidate: true });
  }

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = await guardarDocumentoCompraAction(empresaId, docId, { ...data, docTipo });
      if (r.ok) {
        toast.success(r.contabilizado ? "Factura guardada y contabilizada" : "Documento guardado");
        router.refresh();
      } else toast.error(r.error);
    });
  });

  function guardarFechas() {
    startTransition(async () => {
      const r = await actualizarFechasDocumentoCompraAction(empresaId, docId, {
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
      const r = await contabilizarDocumentoCompraAction(empresaId, docId);
      if (r.ok) {
        toast.success("Documento contabilizado");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function abrirPedido() {
    startTransition(async () => {
      const r = await abrirPedidoCompraAction(empresaId, docId);
      if (r.ok) {
        toast.success("Pedido abierto");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function anular() {
    const motivo = prompt("Motivo de la anulación:");
    if (!motivo?.trim()) return;
    startTransition(async () => {
      const r = await anularDocumentoCompraAction(empresaId, docId, { motivo });
      if (r.ok) {
        toast.success("Documento anulado");
        router.refresh();
      } else toast.error(r.error);
    });
  }

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
          "Proveedor",
          <Select
            value={(watch("terceroId") as string | undefined) ?? NINGUNA}
            onValueChange={(v) => {
              const pid = v === NINGUNA ? undefined : v;
              setValue("terceroId", pid as never);
              const prov = proveedores.find((p) => p.id === pid);
              setValue("condicionPagoDias", prov?.condicionPagoDias ?? 0);
              recomputarVencimiento(prov?.condicionPagoDias ?? 0);
            }}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Proveedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNA}>Proveedor</SelectItem>
              {proveedores.map((o) => (
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
            disabled={readOnly || docTipo === "entrada_mercaderia"}
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
        return campo(
          "Tipo de documento",
          <Select
            value={(watch("tipoDocumentoId") as string | undefined) ?? NINGUNA}
            onValueChange={(v) => setValue("tipoDocumentoId", (v === NINGUNA ? undefined : v) as never)}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNA}>Tipo</SelectItem>
              {tiposDocumento.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>,
        );
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
        return campo(
          "N° del documento del proveedor",
          <Input {...register("numAtCard")} disabled={readOnly} />,
        );
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
      case "glosa":
        return campo("Glosa", <Input {...register("glosa")} disabled={readOnly} />, "@xl:col-span-3");
      default:
        return null;
    }
  }

  function elegirProducto(i: number, productoId: string | undefined) {
    setValue(`lineas.${i}.productoId`, productoId);
    const p = productoId ? productoPorId.get(productoId) : undefined;
    if (!p) return;
    if (p.cuentaImputacionId) setValue(`lineas.${i}.cuentaImputacionId`, p.cuentaImputacionId);
    setValue(`lineas.${i}.impuestoId`, p.impuestoId ?? undefined);
    if (p.centroCostoId) setValue(`lineas.${i}.centroCostoId`, p.centroCostoId);
    if (p.categoriaContableId) {
      setValue(`lineas.${i}.categoriaContableId`, p.categoriaContableId);
      const cat = categoriaPorId.get(p.categoriaContableId);
      if (cat?.ivaRecuperableDefault) {
        setValue(`lineas.${i}.ivaRecuperable`, cat.ivaRecuperableDefault as never);
      }
    }
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
      case "cuentaImputacionId":
        return (
          <Select
            value={watch(`lineas.${i}.cuentaImputacionId`)}
            onValueChange={(v) => setValue(`lineas.${i}.cuentaImputacionId`, v)}
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
            onValueChange={(v) => setValue(`lineas.${i}.impuestoId`, v === NINGUNA ? undefined : v)}
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
      case "ivaRecuperable":
        return (
          <Select
            value={watch(`lineas.${i}.ivaRecuperable`) ?? NINGUNA}
            onValueChange={(v) =>
              setValue(`lineas.${i}.ivaRecuperable`, (v === NINGUNA ? undefined : v) as never)
            }
            disabled={readOnly}
          >
            <SelectTrigger className="w-full min-w-36">
              <SelectValue placeholder="Total" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNA}>Total</SelectItem>
              {IVA_RECUPERABLE.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      case "cantidadPendiente":
        return (
          <span className="text-xs tabular-nums text-muted-foreground">
            {lineasPendientes?.[i] != null ? fmt(lineasPendientes[i]!) : "—"}
          </span>
        );
      case "nombreCuenta":
        return (
          <span className="text-xs text-muted-foreground">
            {cuentaLabel.get(watch(`lineas.${i}.cuentaImputacionId`)) ?? "—"}
          </span>
        );
      case "totalConIva": {
        const l = lineas?.[i];
        return <span className="tabular-nums">{fmt(netoDe(l) + ivaDe(l))}</span>;
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
            {numeroInterno} · {COMPRA_TIPO_META[docTipo].singular}
          </CardTitle>
          <Badge
            variant={
              estado === "contabilizado" || estado === "cerrado"
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
                  cuentaImputacionId: cuentas[0]?.id ?? "",
                  categoriaContableId: undefined,
                  centroCostoId: undefined,
                  impuestoId: impuestos[0]?.id ?? undefined,
                  cantidad: 1,
                  precioUnitario: 0,
                  descuentoLineaPct: 0,
                  esExento: false,
                  ivaRecuperable: undefined,
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
            {contabiliza && !esFactura ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={contabilizar}
              >
                Contabilizar
              </Button>
            ) : esPedido ? (
              <Button type="button" variant="secondary" disabled={isPending} onClick={abrirPedido}>
                Abrir pedido
              </Button>
            ) : null}
          </>
        )}
        {fechasEditables && (
          <Button type="button" disabled={isPending} onClick={guardarFechas}>
            {isPending ? "Guardando..." : "Guardar fechas"}
          </Button>
        )}
        {estado !== "anulado" && estado !== "cerrado" && (
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
          fallbackHref={`/panel/${empresaId}/compras/${COMPRA_TIPO_META[docTipo].slug}`}
        />
      </div>
    </form>
  );
}
