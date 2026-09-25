"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LibroContable } from "@erp/shared";
import { LIBRO_CONTABLE } from "@erp/shared";
import {
  activarObraEnCursoAction,
  anularDocumentoActivoFijoAction,
  bajarActivoAction,
  capitalizarActivoAction,
  pronosticoDepreciacionAction,
  registrarDepreciacionManualAction,
  registrarMejoraAction,
  transferirCentroCostoAction,
  transferirClaseAction,
} from "@/lib/actions/activos-fijos";
import { ActivoFijoForm, type ActivoFijoExistente } from "@/components/panel/activo-fijo-form";
import { calcularDdanAction } from "@/lib/actions/activos-fijos-tributario";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Opcion = { id: string; label: string };
type PeriodoOpcion = { id: string; anio: number; mes: number; estado: string };
const SIN_CENTRO = "__none__";

const TIPOS_ANULABLES = new Set(["CAP", "MEJ", "DEP", "DEP_MAN", "BAJA_VTA", "BAJA_CAST"]);

export type ActivoFijoDetalle = {
  activo: {
    id: string;
    codigo: string;
    descripcion: string;
    estado: string;
    claseId: string | null;
    centroCostoId: string | null;
    ubicacion: string | null;
    numeroSerie: string | null;
    marca: string | null;
    modelo: string | null;
    fechaAdquisicion: string | null;
  };
  valoraciones: {
    libro: string;
    metodoDep: string;
    reglaInicio: string;
    fechaInicioDep: string | null;
    vidaUtilMeses: number;
    valorResidual: string;
    regimenDepreciacion: string;
    vidaUtilNormalMeses: number | null;
  }[];
  documentos: {
    id: string;
    numero: number;
    anio: number;
    tipoDoc: string;
    estado: string;
    fecha: string;
    libro: string;
    importe: string;
    glosa: string | null;
  }[];
};

const fmt = (n: number) => n.toLocaleString("es-CL");

export function ActivoFijoFicha({
  empresaId,
  detalle,
  clases,
  centros,
  cuentas,
  periodos,
  vidasUtilesSii,
}: {
  empresaId: string;
  detalle: ActivoFijoDetalle;
  clases: Opcion[];
  centros: Opcion[];
  cuentas: Opcion[];
  periodos: PeriodoOpcion[];
  vidasUtilesSii?: { id: string; categoria: string; vidaUtilNormalMeses: number }[];
}) {
  const { activo, valoraciones, documentos } = detalle;
  const [completar, setCompletar] = useState(false);
  const [capitalizar, setCapitalizar] = useState(false);
  const [mejora, setMejora] = useState(false);
  const [obraEnCurso, setObraEnCurso] = useState(false);
  const [transferirCentro, setTransferirCentro] = useState(false);
  const [transferirClase, setTransferirClase] = useState(false);
  const [depreciacionManual, setDepreciacionManual] = useState(false);
  const [baja, setBaja] = useState(false);
  const [pronostico, setPronostico] = useState(false);
  const [ddan, setDdan] = useState(false);
  const [anular, setAnular] = useState<{ id: string; etiqueta: string } | null>(null);

  const libros = valoraciones.map((v) => v.libro as LibroContable);
  const valoracionAcelerada = valoraciones.find((v) => v.libro === "Tributario" && v.regimenDepreciacion === "Acelerada");
  const puedeCompletar = activo.estado === "Nuevo";
  const puedeCapitalizar = activo.estado === "Nuevo" && !!activo.claseId && valoraciones.length > 0;
  const puedeMejorar = (activo.estado === "Activo" || activo.estado === "En curso") && valoraciones.length > 0;
  const puedeActivarObra = activo.estado === "En curso";
  const puedeTransferir = !!activo.claseId && activo.estado !== "Dado de baja";
  const puedeDepreciarManual = activo.estado === "Activo" && valoraciones.length > 0;
  const puedeDarDeBaja = activo.estado === "Activo";
  const puedeVerPronostico = activo.estado === "Activo" && valoraciones.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Código</div>
            <div className="font-mono font-medium">{activo.codigo}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground">Descripción</div>
            <div className="font-medium">{activo.descripcion}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Estado</div>
            <StatusBadge estado={activo.estado} />
          </div>
        </CardContent>
      </Card>

      {!activo.claseId && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="text-sm text-muted-foreground">
              Este activo nació desde una factura de compra y todavía no tiene clase ni valoración. Complétalo antes
              de capitalizarlo.
            </p>
            <Button size="sm" onClick={() => setCompletar(true)}>
              Completar datos
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {puedeCompletar && activo.claseId && (
          <Button variant="outline" size="sm" onClick={() => setCompletar(true)}>
            Editar
          </Button>
        )}
        {puedeCapitalizar && <Button size="sm" onClick={() => setCapitalizar(true)}>Capitalizar</Button>}
        {puedeActivarObra && <Button size="sm" onClick={() => setObraEnCurso(true)}>Activar obra en curso</Button>}

        {(puedeMejorar || puedeTransferir || puedeDepreciarManual || puedeDarDeBaja || puedeVerPronostico || valoracionAcelerada) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Más acciones
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {puedeMejorar && <DropdownMenuItem onSelect={() => setMejora(true)}>Registrar mejora</DropdownMenuItem>}
              {puedeTransferir && (
                <DropdownMenuItem onSelect={() => setTransferirCentro(true)}>Transferir centro de costo</DropdownMenuItem>
              )}
              {puedeTransferir && (
                <DropdownMenuItem onSelect={() => setTransferirClase(true)}>Transferir clase</DropdownMenuItem>
              )}
              {puedeDepreciarManual && (
                <DropdownMenuItem onSelect={() => setDepreciacionManual(true)}>Depreciación manual</DropdownMenuItem>
              )}
              {puedeVerPronostico && <DropdownMenuItem onSelect={() => setPronostico(true)}>Pronóstico</DropdownMenuItem>}
              {valoracionAcelerada && <DropdownMenuItem onSelect={() => setDdan(true)}>Registro DDAN</DropdownMenuItem>}
              {puedeDarDeBaja && (
                <DropdownMenuItem variant="destructive" onSelect={() => setBaja(true)}>
                  Dar de baja
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Valoración y depreciación</h3>
        {valoraciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin valoraciones configuradas.</p>
        ) : (
          <div className="rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Libro</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Inicio depreciación</TableHead>
                  <TableHead className="text-right">Vida útil (meses)</TableHead>
                  <TableHead className="text-right">Valor residual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valoraciones.map((v) => (
                  <TableRow key={v.libro}>
                    <TableCell>{v.libro}</TableCell>
                    <TableCell>{v.metodoDep}</TableCell>
                    <TableCell>{v.fechaInicioDep ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.vidaUtilMeses}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Number(v.valorResidual))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Documentos</h3>
        {documentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>
        ) : (
          <div className="rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>N°</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Libro</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentos.map((d) => (
                  <TableRow key={`${d.id}-${d.libro}`}>
                    <TableCell>{d.tipoDoc}</TableCell>
                    <TableCell>{d.numero}</TableCell>
                    <TableCell>{d.fecha}</TableCell>
                    <TableCell>{d.libro}</TableCell>
                    <TableCell>
                      <StatusBadge estado={d.estado} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Number(d.importe))}</TableCell>
                    <TableCell>
                      {d.estado === "contabilizado" && TIPOS_ANULABLES.has(d.tipoDoc) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAnular({ id: d.id, etiqueta: `${d.tipoDoc} N° ${d.numero}` })}
                        >
                          Anular
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={completar} onOpenChange={setCompletar}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Completar activo</DialogTitle>
          </DialogHeader>
          <ActivoFijoForm
            empresaId={empresaId}
            clases={clases}
            centros={centros}
            vidasUtilesSii={vidasUtilesSii}
            activo={activoExistenteDe(activo, valoraciones[0])}
            onSaved={() => setCompletar(false)}
          />
        </DialogContent>
      </Dialog>

      {capitalizar && (
        <ImporteXLibroDialog
          titulo="Capitalizar activo"
          etiquetaImporte="Costo de capitalización"
          libros={libros}
          onClose={() => setCapitalizar(false)}
          onConfirm={(input) => capitalizarActivoAction(empresaId, activo.id, input)}
          mensajeExito="Activo capitalizado"
        />
      )}

      {mejora && (
        <ImporteXLibroDialog
          titulo="Registrar mejora"
          etiquetaImporte="Costo de la mejora"
          libros={libros}
          onClose={() => setMejora(false)}
          onConfirm={(input) => registrarMejoraAction(empresaId, activo.id, input)}
          mensajeExito="Mejora registrada"
        />
      )}

      {obraEnCurso && (
        <ObraEnCursoDialog empresaId={empresaId} activoId={activo.id} onClose={() => setObraEnCurso(false)} />
      )}

      {transferirCentro && (
        <TransferirCentroDialog
          empresaId={empresaId}
          activoId={activo.id}
          centros={centros}
          onClose={() => setTransferirCentro(false)}
        />
      )}

      {transferirClase && (
        <TransferirClaseDialog
          empresaId={empresaId}
          activoId={activo.id}
          clases={clases}
          onClose={() => setTransferirClase(false)}
        />
      )}

      {depreciacionManual && (
        <DepreciacionManualDialog
          empresaId={empresaId}
          activoId={activo.id}
          libros={libros}
          periodos={periodos}
          onClose={() => setDepreciacionManual(false)}
        />
      )}

      {baja && (
        <BajaDialog empresaId={empresaId} activoId={activo.id} cuentas={cuentas} onClose={() => setBaja(false)} />
      )}

      {pronostico && (
        <PronosticoDialog empresaId={empresaId} activoId={activo.id} libros={libros} onClose={() => setPronostico(false)} />
      )}

      {anular && (
        <AnularDocumentoDialog
          empresaId={empresaId}
          documentoId={anular.id}
          etiqueta={anular.etiqueta}
          onClose={() => setAnular(null)}
        />
      )}

      {ddan && <DdanDialog empresaId={empresaId} activoId={activo.id} onClose={() => setDdan(false)} />}
    </div>
  );
}

function activoExistenteDe(
  activo: ActivoFijoDetalle["activo"],
  valoracion: ActivoFijoDetalle["valoraciones"][number] | undefined,
): ActivoFijoExistente {
  return {
    id: activo.id,
    descripcion: activo.descripcion,
    claseId: activo.claseId,
    centroCostoId: activo.centroCostoId,
    ubicacion: activo.ubicacion,
    numeroSerie: activo.numeroSerie,
    marca: activo.marca,
    modelo: activo.modelo,
    fechaAdquisicion: activo.fechaAdquisicion,
    valoracion,
  };
}

type AccionResultado = { ok: true; id: string } | { ok: false; error: string };

/** Diálogo compartido por Capitalizar y Registrar mejora: fecha + glosa + importe por libro. */
function ImporteXLibroDialog({
  titulo,
  etiquetaImporte,
  libros,
  onClose,
  onConfirm,
  mensajeExito,
}: {
  titulo: string;
  etiquetaImporte: string;
  libros: LibroContable[];
  onClose: () => void;
  onConfirm: (input: { fecha: string; glosa: string | null; lineas: { libro: LibroContable; importe: number }[] }) => Promise<AccionResultado>;
  mensajeExito: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [glosa, setGlosa] = useState("");
  const [importes, setImportes] = useState<Record<string, number | null>>(
    Object.fromEntries(libros.map((l) => [l, null])),
  );

  function guardar() {
    const lineas = libros.map((libro) => ({ libro, importe: importes[libro] ?? 0 }));
    if (lineas.some((l) => !l.importe || l.importe <= 0)) {
      toast.error(`Indica el ${etiquetaImporte.toLowerCase()} para cada libro`);
      return;
    }
    startTransition(async () => {
      const result = await onConfirm({ fecha, glosa: glosa || null, lineas });
      if (result.ok) {
        toast.success(mensajeExito);
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <DatePicker id="fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="glosa">Glosa (opcional)</Label>
              <Input id="glosa" value={glosa} onChange={(e) => setGlosa(e.target.value)} />
            </div>
          </div>
          {libros.map((libro) => (
            <div key={libro} className="space-y-2">
              <Label htmlFor={`importe-${libro}`}>
                {etiquetaImporte} — {libro}
              </Label>
              <MoneyInput
                id={`importe-${libro}`}
                value={importes[libro] ?? null}
                onValueChange={(v) => setImportes((prev) => ({ ...prev, [libro]: v }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObraEnCursoDialog({
  empresaId,
  activoId,
  onClose,
}: {
  empresaId: string;
  activoId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [libro, setLibro] = useState<LibroContable>("Ambos");
  const [reglaInicio, setReglaInicio] = useState<"Mes siguiente" | "Inicio de mes">("Mes siguiente");
  const [fechaInicioDep, setFechaInicioDep] = useState(new Date().toISOString().slice(0, 10));
  const [vidaUtilMeses, setVidaUtilMeses] = useState(12);
  const [valorResidual, setValorResidual] = useState<number | null>(0);

  function guardar() {
    if (!vidaUtilMeses || vidaUtilMeses < 1) {
      toast.error("Indica la vida útil en meses");
      return;
    }
    startTransition(async () => {
      const result = await activarObraEnCursoAction(empresaId, activoId, {
        valoraciones: [
          {
            libro,
            metodoDep: "Lineal",
            reglaInicio,
            reglaBaja: "Hasta mes anterior",
            fechaInicioDep,
            vidaUtilMeses,
            valorResidual: valorResidual ?? 0,
            regimenDepreciacion: "Normal",
          },
        ],
      });
      if (result.ok) {
        toast.success("Obra en curso activada");
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activar obra en curso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Libro contable</Label>
              <Select value={libro} onValueChange={(v) => setLibro(v as LibroContable)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIBRO_CONTABLE.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Regla de inicio</Label>
              <Select value={reglaInicio} onValueChange={(v) => setReglaInicio(v as typeof reglaInicio)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mes siguiente">Mes siguiente a la fecha de inicio</SelectItem>
                  <SelectItem value="Inicio de mes">Desde el mes de la fecha de inicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="fechaInicioDep">Fecha de inicio de depreciación</Label>
              <DatePicker id="fechaInicioDep" value={fechaInicioDep} onChange={(e) => setFechaInicioDep(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vidaUtilMeses">Vida útil (meses)</Label>
              <Input
                id="vidaUtilMeses"
                type="number"
                min={1}
                value={vidaUtilMeses}
                onChange={(e) => setVidaUtilMeses(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valorResidual">Valor residual</Label>
              <MoneyInput id="valorResidual" value={valorResidual} onValueChange={setValorResidual} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={isPending}>
            {isPending ? "Activando..." : "Activar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferirCentroDialog({
  empresaId,
  activoId,
  centros,
  onClose,
}: {
  empresaId: string;
  activoId: string;
  centros: Opcion[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [centroCostoId, setCentroCostoId] = useState(centros[0]?.id ?? "");
  const [glosa, setGlosa] = useState("");

  function guardar() {
    if (!centroCostoId) {
      toast.error("Selecciona el centro de costo destino");
      return;
    }
    startTransition(async () => {
      const result = await transferirCentroCostoAction(empresaId, activoId, { fecha, centroCostoId, glosa: glosa || null });
      if (result.ok) {
        toast.success("Centro de costo transferido");
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir centro de costo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <DatePicker id="fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Centro de costo destino</Label>
            <Select value={centroCostoId} onValueChange={setCentroCostoId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="glosa">Glosa (opcional)</Label>
            <Input id="glosa" value={glosa} onChange={(e) => setGlosa(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={isPending}>
            {isPending ? "Transfiriendo..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferirClaseDialog({
  empresaId,
  activoId,
  clases,
  onClose,
}: {
  empresaId: string;
  activoId: string;
  clases: Opcion[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [claseId, setClaseId] = useState(clases[0]?.id ?? "");
  const [glosa, setGlosa] = useState("");

  function guardar() {
    if (!claseId) {
      toast.error("Selecciona la clase destino");
      return;
    }
    startTransition(async () => {
      const result = await transferirClaseAction(empresaId, activoId, { fecha, claseId, glosa: glosa || null });
      if (result.ok) {
        toast.success("Clase transferida");
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir clase</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <DatePicker id="fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Clase destino</Label>
            <Select value={claseId} onValueChange={setClaseId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Si la cuenta de Activo Fijo de la clase destino difiere de la actual, se genera además un asiento de
            reclasificación por el costo vigente.
          </p>
          <div className="space-y-2">
            <Label htmlFor="glosa">Glosa (opcional)</Label>
            <Input id="glosa" value={glosa} onChange={(e) => setGlosa(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={isPending}>
            {isPending ? "Transfiriendo..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepreciacionManualDialog({
  empresaId,
  activoId,
  libros,
  periodos,
  onClose,
}: {
  empresaId: string;
  activoId: string;
  libros: LibroContable[];
  periodos: PeriodoOpcion[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [libro, setLibro] = useState<LibroContable>(libros[0] ?? "Ambos");
  const [periodoId, setPeriodoId] = useState(periodos[0]?.id ?? "");
  const [monto, setMonto] = useState<number | null>(null);
  const [glosa, setGlosa] = useState("");

  function guardar() {
    if (!periodoId) {
      toast.error("Selecciona el período");
      return;
    }
    if (!monto || monto <= 0) {
      toast.error("Indica el monto de la depreciación");
      return;
    }
    startTransition(async () => {
      const result = await registrarDepreciacionManualAction(empresaId, activoId, {
        libro,
        periodoId,
        monto,
        glosa: glosa || null,
      });
      if (result.ok) {
        toast.success("Depreciación manual registrada");
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Depreciación manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Libro</Label>
              <Select value={libro} onValueChange={(v) => setLibro(v as LibroContable)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {libros.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={periodoId} onValueChange={setPeriodoId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.anio}-{String(p.mes).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="monto">Monto</Label>
            <MoneyInput id="monto" value={monto} onValueChange={setMonto} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="glosa">Glosa (opcional)</Label>
            <Input id="glosa" value={glosa} onChange={(e) => setGlosa(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BajaDialog({
  empresaId,
  activoId,
  cuentas,
  onClose,
}: {
  empresaId: string;
  activoId: string;
  cuentas: Opcion[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState<"Venta" | "Castigo">("Venta");
  const [porcentaje, setPorcentaje] = useState(100);
  const [valorVenta, setValorVenta] = useState<number | null>(null);
  const [cuentaContrapartidaId, setCuentaContrapartidaId] = useState("");
  const [glosa, setGlosa] = useState("");

  function guardar() {
    if (porcentaje < 1 || porcentaje > 100) {
      toast.error("El porcentaje debe estar entre 1 y 100");
      return;
    }
    if (tipo === "Venta" && (!valorVenta || !cuentaContrapartidaId)) {
      toast.error("Indica el valor de venta y la cuenta de contrapartida");
      return;
    }
    startTransition(async () => {
      const result = await bajarActivoAction(empresaId, activoId, {
        fecha,
        tipo,
        porcentaje,
        valorVenta: tipo === "Venta" ? valorVenta : null,
        cuentaContrapartidaId: tipo === "Venta" ? cuentaContrapartidaId : null,
        glosa: glosa || null,
      });
      if (result.ok) {
        toast.success("Activo dado de baja");
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar de baja</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <DatePicker id="fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "Venta" | "Castigo")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venta">Venta</SelectItem>
                  <SelectItem value="Castigo">Castigo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="porcentaje">% a dar de baja</Label>
              <Input
                id="porcentaje"
                type="number"
                min={1}
                max={100}
                value={porcentaje}
                onChange={(e) => setPorcentaje(Number(e.target.value))}
              />
            </div>
          </div>
          {tipo === "Venta" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="valorVenta">Valor de venta</Label>
                <MoneyInput id="valorVenta" value={valorVenta} onValueChange={setValorVenta} />
              </div>
              <div className="space-y-2">
                <Label>Cuenta de contrapartida</Label>
                <Select value={cuentaContrapartidaId} onValueChange={setCuentaContrapartidaId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuentas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="glosa">Glosa (opcional)</Label>
            <Input id="glosa" value={glosa} onChange={(e) => setGlosa(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={guardar} disabled={isPending}>
            {isPending ? "Procesando..." : "Dar de baja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PronosticoDialog({
  empresaId,
  activoId,
  libros,
  onClose,
}: {
  empresaId: string;
  activoId: string;
  libros: LibroContable[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [libro, setLibro] = useState<LibroContable>(libros[0] ?? "Ambos");
  const [meses, setMeses] = useState(12);
  const [filas, setFilas] = useState<
    { anio: number; mes: number; cuota: number; depAcumuladaProyectada: number; valorLibroProyectado: number }[] | null
  >(null);

  function calcular() {
    startTransition(async () => {
      const result = await pronosticoDepreciacionAction(empresaId, activoId, { libro, meses });
      if (result.ok) setFilas(result.filas);
      else toast.error(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pronóstico de depreciación</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Libro</Label>
              <Select value={libro} onValueChange={(v) => setLibro(v as LibroContable)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {libros.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meses">Meses</Label>
              <Input id="meses" type="number" min={1} max={60} className="w-24" value={meses} onChange={(e) => setMeses(Number(e.target.value))} />
            </div>
            <Button type="button" size="sm" onClick={calcular} disabled={isPending}>
              {isPending ? "Calculando..." : "Calcular"}
            </Button>
          </div>

          {filas && (
            <div className="max-h-96 overflow-y-auto rounded-xl ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Cuota</TableHead>
                    <TableHead className="text-right">Dep. acumulada</TableHead>
                    <TableHead className="text-right">Valor libro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f) => (
                    <TableRow key={`${f.anio}-${f.mes}`}>
                      <TableCell>
                        {f.anio}-{String(f.mes).padStart(2, "0")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(f.cuota)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(f.depAcumuladaProyectada)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(f.valorLibroProyectado)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnularDocumentoDialog({
  empresaId,
  documentoId,
  etiqueta,
  onClose,
}: {
  empresaId: string;
  documentoId: string;
  etiqueta: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState("");

  function confirmar() {
    if (!motivo.trim()) {
      toast.error("Indica el motivo de la anulación");
      return;
    }
    startTransition(async () => {
      const result = await anularDocumentoActivoFijoAction(empresaId, documentoId, { motivo });
      if (result.ok) {
        toast.success("Documento anulado");
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Anular {etiqueta}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="motivo">Motivo</Label>
          <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={confirmar} disabled={isPending}>
            {isPending ? "Anulando..." : "Anular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DdanDialog({ empresaId, activoId, onClose }: { empresaId: string; activoId: string; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [resultado, setResultado] = useState<{
    depAcumuladaAcelerada: number;
    depAcumuladaNormal: number;
    ddanAcumulado: number;
    depEjercicioAcelerada: number;
    depEjercicioNormal: number;
    ddanEjercicio: number;
  } | null>(null);

  function calcular() {
    startTransition(async () => {
      const result = await calcularDdanAction(empresaId, activoId, anio);
      if (result.ok) setResultado(result.resultado);
      else toast.error(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registro DDAN</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Diferencia entre Depreciación Acelerada y Normal — la depreciación normal es una simulación de
            referencia, nunca se contabiliza.
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="anioDdan">Año</Label>
              <Input id="anioDdan" type="number" className="w-28" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
            </div>
            <Button type="button" size="sm" onClick={calcular} disabled={isPending}>
              {isPending ? "Calculando..." : "Calcular"}
            </Button>
          </div>
          {resultado && (
            <div className="space-y-1 rounded-lg border border-input p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dep. acumulada acelerada</span>
                <span className="tabular-nums">{fmt(resultado.depAcumuladaAcelerada)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dep. acumulada normal (referencia)</span>
                <span className="tabular-nums">{fmt(resultado.depAcumuladaNormal)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>DDAN acumulado</span>
                <span className="tabular-nums">{fmt(resultado.ddanAcumulado)}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">DDAN del ejercicio {anio}</span>
                <span className="tabular-nums">{fmt(resultado.ddanEjercicio)}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
