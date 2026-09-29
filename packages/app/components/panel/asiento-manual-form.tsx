"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ASIENTO_MANUAL_TIPO, LIBRO_CONTABLE, TIPO_ASIENTO_LABEL, totalesAsiento, type AsientoManualTipo, type LibroContable } from "@erp/shared";
import { eliminarBorradorAsientoAction, guardarAsientoManualAction } from "@/lib/actions/asientos";
import { MontoInput } from "@/components/panel/monto-input";
import { SelectorBuscable, type OpcionBuscable } from "@/components/panel/selector-buscable";
import { VolverBoton } from "@/components/panel/volver-boton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CuentaOpcion = OpcionBuscable & { control: boolean; requiereCentroCosto: boolean; requiereTercero: boolean };

export type AsientoInicial = {
  fecha: string;
  glosa: string;
  tipo: AsientoManualTipo;
  libro: LibroContable;
  referencia: string;
  fechaReversa: string;
  lineas: { cuentaId: string | null; terceroId: string | null; centroCostoId: string | null; glosa: string; debe: number; haber: number }[];
};

type LineaForm = AsientoInicial["lineas"][number] & { clave: number };

const fmt = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
const lineaVacia = (clave: number, debe = 0, haber = 0): LineaForm => ({
  clave,
  cuentaId: null,
  terceroId: null,
  centroCostoId: null,
  glosa: "",
  debe,
  haber,
});

/**
 * Asiento manual al estilo de SAP B1 (Finanzas → Asiento): cabecera con fecha, glosa y
 * referencia; líneas con cuenta de mayor o socio de negocio, debe/haber y centro de costo.
 * Al agregar una línea se propone la diferencia que falta para cuadrar.
 */
export function AsientoManualForm({
  empresaId,
  asientoId,
  inicial,
  cuentas,
  terceros,
  centrosCosto,
  aplicaIfrs,
}: {
  empresaId: string;
  /** Presente al editar un borrador. */
  asientoId: string | null;
  inicial: AsientoInicial;
  cuentas: CuentaOpcion[];
  terceros: OpcionBuscable[];
  centrosCosto: OpcionBuscable[];
  aplicaIfrs: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fecha, setFecha] = useState(inicial.fecha);
  const [glosa, setGlosa] = useState(inicial.glosa);
  const [tipo, setTipo] = useState<AsientoManualTipo>(inicial.tipo);
  const [libro, setLibro] = useState<LibroContable>(inicial.libro);
  const [referencia, setReferencia] = useState(inicial.referencia);
  const [revertir, setRevertir] = useState(!!inicial.fechaReversa);
  const [fechaReversa, setFechaReversa] = useState(inicial.fechaReversa);
  const [lineas, setLineas] = useState<LineaForm[]>(
    inicial.lineas.length ? inicial.lineas.map((l, i) => ({ ...l, clave: i + 1 })) : [lineaVacia(1), lineaVacia(2)],
  );
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
  const t = totalesAsiento(lineas);
  const base = `/panel/${empresaId}/contabilidad/asientos`;

  function actualizar(clave: number, cambio: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)));
  }

  function agregarLinea() {
    const sig = Math.max(0, ...lineas.map((l) => l.clave)) + 1;
    // Como el "Balance" de SAP: la nueva línea trae lo que falta para cuadrar.
    const dif = t.diferencia;
    setLineas((prev) => [...prev, lineaVacia(sig, dif < 0 ? -dif : 0, dif > 0 ? dif : 0)]);
  }

  function guardar(contabilizar: boolean) {
    if (revertir && !fechaReversa) {
      toast.error("Indica la fecha de reversión programada");
      return;
    }
    startTransition(async () => {
      const r = await guardarAsientoManualAction(empresaId, asientoId, {
        fecha,
        glosa,
        tipo,
        libro,
        referencia: referencia || null,
        fechaReversa: revertir && fechaReversa ? fechaReversa : null,
        contabilizar,
        lineas: lineas
          .filter((l) => l.cuentaId || l.terceroId || l.debe || l.haber)
          .map((l) => ({
            cuentaId: l.cuentaId,
            terceroId: l.terceroId,
            centroCostoId: l.centroCostoId,
            glosa: l.glosa || null,
            debe: l.debe || 0,
            haber: l.haber || 0,
          })),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(contabilizar ? `Asiento N° ${r.correlativo} contabilizado.` : "Borrador guardado.");
      router.push(`${base}/${r.asientoId}`);
    });
  }

  function eliminar() {
    if (!asientoId) return;
    return new Promise<void>((resolve) =>
      startTransition(async () => {
        const r = await eliminarBorradorAsientoAction(empresaId, asientoId);
        resolve();
        if (!r.ok) return void toast.error(r.error);
        toast.success("Borrador eliminado.");
        router.push(base);
      }),
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cabecera</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de contabilización</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as AsientoManualTipo)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASIENTO_MANUAL_TIPO.map((x) => (
                  <SelectItem key={x} value={x}>
                    {TIPO_ASIENTO_LABEL[x]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="referencia">Referencia (opcional)</Label>
            <Input id="referencia" value={referencia} maxLength={80} onChange={(e) => setReferencia(e.target.value)} />
          </div>
          {aplicaIfrs ? (
            <div className="space-y-2">
              <Label>Libro</Label>
              <Select value={libro} onValueChange={(v) => setLibro(v as LibroContable)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIBRO_CONTABLE.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div />
          )}
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="glosa">Glosa</Label>
            <Input
              id="glosa"
              value={glosa}
              maxLength={500}
              placeholder="Ej.: Provisión de vacaciones septiembre"
              onChange={(e) => setGlosa(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={revertir} onChange={(e) => setRevertir(e.target.checked)} />
              Programar reversión
            </label>
            {revertir && (
              <Input
                type="date"
                aria-label="Fecha de reversión"
                value={fechaReversa}
                min={fecha}
                onChange={(e) => setFechaReversa(e.target.value)}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Líneas</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={agregarLinea}>
            + Agregar línea
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-8 py-1">#</th>
                <th className="w-64">Cuenta de mayor</th>
                <th className="w-56">Socio de negocio</th>
                <th className="w-40">Centro de costo</th>
                <th>Glosa de la línea</th>
                <th className="w-36 text-right">Debe</th>
                <th className="w-36 text-right">Haber</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => {
                const c = l.cuentaId ? cuentaPorId.get(l.cuentaId) : undefined;
                const avisos = [
                  !l.cuentaId && l.terceroId && "Se usará la cuenta asociada del socio",
                  c && (c.control || c.requiereTercero) && !l.terceroId && "Esta cuenta exige socio",
                  c?.requiereCentroCosto && !l.centroCostoId && "Esta cuenta exige centro de costo",
                ].filter(Boolean) as string[];
                return (
                  <tr key={l.clave} className="border-t align-top">
                    <td className="py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="py-1.5 pr-2">
                      <SelectorBuscable
                        ariaLabel={`Cuenta línea ${i + 1}`}
                        opciones={cuentas}
                        valor={l.cuentaId}
                        onCambio={(v) => actualizar(l.clave, { cuentaId: v })}
                        placeholder="Código o nombre"
                      />
                      {avisos.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-xs text-amber-600">
                          {avisos.map((a) => (
                            <div key={a}>{a}</div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <SelectorBuscable
                        ariaLabel={`Socio línea ${i + 1}`}
                        opciones={terceros}
                        valor={l.terceroId}
                        onCambio={(v) => actualizar(l.clave, { terceroId: v })}
                        placeholder="RUT o razón social"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <SelectorBuscable
                        ariaLabel={`Centro de costo línea ${i + 1}`}
                        opciones={centrosCosto}
                        valor={l.centroCostoId}
                        onCambio={(v) => actualizar(l.clave, { centroCostoId: v })}
                        placeholder="—"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        className="h-8"
                        value={l.glosa}
                        maxLength={250}
                        placeholder={glosa || "Glosa de la cabecera"}
                        onChange={(e) => actualizar(l.clave, { glosa: e.target.value })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <MontoInput
                        className="h-8 text-right"
                        valor={l.debe}
                        onValorChange={(v) => actualizar(l.clave, { debe: v, ...(v ? { haber: 0 } : {}) })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <MontoInput
                        className="h-8 text-right"
                        valor={l.haber}
                        onValorChange={(v) => actualizar(l.clave, { haber: v, ...(v ? { debe: 0 } : {}) })}
                      />
                    </td>
                    <td className="py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar línea ${i + 1}`}
                        disabled={lineas.length <= 2}
                        onClick={() => setLineas((prev) => prev.filter((x) => x.clave !== l.clave))}
                      >
                        <Trash2Icon />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t font-medium">
                <td colSpan={5} className="py-2 text-right">
                  Totales
                </td>
                <td className="pr-4 text-right tabular-nums">{fmt(t.debe)}</td>
                <td className="pr-4 text-right tabular-nums">{fmt(t.haber)}</td>
                <td />
              </tr>
              {!t.cuadra && (
                <tr>
                  <td colSpan={5} className="py-1 text-right text-destructive">
                    Diferencia
                  </td>
                  <td className="pr-4 text-right tabular-nums text-destructive">{t.diferencia < 0 ? fmt(-t.diferencia) : ""}</td>
                  <td className="pr-4 text-right tabular-nums text-destructive">{t.diferencia > 0 ? fmt(t.diferencia) : ""}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          El borrador no afecta saldos ni consume número. Al contabilizar, el asiento queda definitivo: para corregirlo se anula con una reversa.
        </p>
        <div className="flex flex-wrap gap-2">
          <VolverBoton fallbackHref={base} />
          {asientoId && (
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => setConfirmarEliminar(true)}>
              Eliminar borrador
            </Button>
          )}
          <Button type="button" variant="outline" disabled={isPending || !glosa.trim()} onClick={() => guardar(false)}>
            Guardar borrador
          </Button>
          <Button type="button" disabled={isPending || !glosa.trim() || !t.cuadra || t.debe <= 0} onClick={() => guardar(true)}>
            {isPending ? "Guardando…" : "Contabilizar"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmarEliminar}
        onOpenChange={setConfirmarEliminar}
        title="Eliminar borrador"
        description="El borrador se elimina definitivamente. No afecta saldos."
        confirmLabel="Eliminar"
        onConfirm={eliminar}
      />
    </div>
  );
}
