"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FilaCartolaMapeada } from "@erp/shared";
import { confirmarImportacionCartolaAction, previsualizarCartolaAction } from "@/lib/actions/cartolas";
import type { PreviaCartola } from "@erp/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MontoInput } from "@/components/panel/monto-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type CuentaOpcion = { id: string; label: string; bancoId: string };
type FormatoOpcion = { id: string; label: string; bancoId: string };

const fmt = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function archivoABase64(archivo: File): Promise<string> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export function CartolaImportarForm({
  empresaId,
  cuentas,
  formatos,
}: {
  empresaId: string;
  cuentas: CuentaOpcion[];
  formatos: FormatoOpcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cuentaBancariaId, setCuentaBancariaId] = useState(cuentas[0]?.id ?? "");
  const [formatoId, setFormatoId] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [saldoFinal, setSaldoFinal] = useState(0);
  const [resultado, setResultado] = useState<{ previa: PreviaCartola; archivoHash: string; fechaDesde: string; fechaHasta: string } | null>(
    null,
  );

  const cuentaSeleccionada = cuentas.find((c) => c.id === cuentaBancariaId);
  const formatosDeCuenta = useMemo(
    () => formatos.filter((f) => f.bancoId === cuentaSeleccionada?.bancoId),
    [formatos, cuentaSeleccionada],
  );

  function previsualizar() {
    if (!archivo || !formatoId) return;
    startTransition(async () => {
      const archivoBase64 = await archivoABase64(archivo);
      const r = await previsualizarCartolaAction(empresaId, {
        cuentaBancariaId,
        formatoId,
        archivoNombre: archivo.name,
        archivoBase64,
        saldoInicial,
        saldoFinal,
      });
      if (r.ok) {
        setResultado(r);
        if (r.previa.bloqueada) toast.warning("La cartola tiene errores o no cuadra — revisa antes de confirmar.");
      } else {
        toast.error(r.error);
      }
    });
  }

  function confirmar() {
    if (!resultado) return;
    startTransition(async () => {
      const filas: FilaCartolaMapeada[] = resultado.previa.filas.map((f) => ({
        fecha: f.fecha,
        descripcion: f.descripcion,
        nroDocumento: f.nroDocumento,
        rutContraparte: f.rutContraparte,
        monto: f.monto,
        codigoTransaccion: f.codigoTransaccion,
      }));
      const r = await confirmarImportacionCartolaAction(empresaId, cuentaBancariaId, {
        archivoNombre: archivo?.name ?? null,
        archivoHash: resultado.archivoHash,
        fechaDesde: resultado.fechaDesde,
        fechaHasta: resultado.fechaHasta,
        saldoInicial,
        saldoFinal,
        filas,
      });
      if (r.ok) {
        toast.success(`Cartola importada: ${r.insertadas} movimiento(s) nuevo(s).`);
        router.push(`/panel/${empresaId}/tesoreria/cartolas/${r.cartolaId}`);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 rounded-xl border p-4">
        <div className="space-y-2">
          <Label htmlFor="cuentaBancariaId">Cuenta bancaria</Label>
          <Select value={cuentaBancariaId} onValueChange={(v) => { setCuentaBancariaId(v); setFormatoId(""); setResultado(null); }}>
            <SelectTrigger id="cuentaBancariaId" className="w-full">
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
        <div className="space-y-2">
          <Label htmlFor="formatoId">Plantilla de cartola</Label>
          <Select value={formatoId} onValueChange={setFormatoId} disabled={formatosDeCuenta.length === 0}>
            <SelectTrigger id="formatoId" className="w-full">
              <SelectValue placeholder={formatosDeCuenta.length === 0 ? "Configura una plantilla para este banco" : "Selecciona una plantilla"} />
            </SelectTrigger>
            <SelectContent>
              {formatosDeCuenta.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="archivo">Archivo</Label>
          <Input
            id="archivo"
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setResultado(null); }}
          />
        </div>
        <div />
        <div className="space-y-2">
          <Label htmlFor="saldoInicial">Saldo inicial declarado</Label>
          <MontoInput valor={saldoInicial} onValorChange={setSaldoInicial} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="saldoFinal">Saldo final declarado</Label>
          <MontoInput valor={saldoFinal} onValorChange={setSaldoFinal} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={previsualizar} disabled={!archivo || !formatoId || isPending}>
          {isPending ? "Procesando..." : "Previsualizar"}
        </Button>
      </div>

      {resultado && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4 rounded-xl border p-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Total abonos</div>
              <div className="tabular-nums">{fmt(resultado.previa.totalAbonos)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total cargos</div>
              <div className="tabular-nums">{fmt(resultado.previa.totalCargos)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Diferencia de cuadratura</div>
              <div className={`tabular-nums ${resultado.previa.cuadra ? "" : "text-destructive font-medium"}`}>
                {fmt(resultado.previa.diferenciaCuadratura)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Estado</div>
              <Badge variant={resultado.previa.bloqueada ? "destructive" : "default"}>
                {resultado.previa.bloqueada ? "Con errores" : "Lista para confirmar"}
              </Badge>
            </div>
          </div>
          {resultado.previa.advertenciaSaldoAnterior && (
            <p className="text-sm text-amber-600">{resultado.previa.advertenciaSaldoAnterior}</p>
          )}

          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>N° documento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.previa.filas.map((f, i) => (
                  <TableRow key={i} className={f.error ? "bg-destructive/5" : f.duplicada ? "bg-muted/50" : ""}>
                    <TableCell className="whitespace-nowrap">{f.fecha}</TableCell>
                    <TableCell>{f.descripcion}</TableCell>
                    <TableCell className="text-muted-foreground">{f.nroDocumento ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(f.monto)}</TableCell>
                    <TableCell>
                      {f.error ? (
                        <span className="text-xs text-destructive">{f.error}</span>
                      ) : f.duplicada ? (
                        <span className="text-xs text-muted-foreground">Ya importado</span>
                      ) : (
                        <span className="text-xs text-emerald-600">Nuevo</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button onClick={confirmar} disabled={resultado.previa.bloqueada || isPending}>
              {isPending ? "Importando..." : "Confirmar importación"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
