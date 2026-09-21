"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { depositarChequesAction, historialChequeAction, protestarChequeAction } from "@/lib/actions/cheques";
import { HistorialDocumentoDialog } from "@/components/panel/historial-documento-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ChequeFila = {
  id: string;
  tipo: string;
  numero: string;
  tercero: string;
  banco: string | null;
  monto: number;
  fechaEmision: string;
  fechaCobro: string | null;
  estado: string;
  pagoId: string;
  pagoNumero: string;
  depositoId: string | null;
  motivoProtesto: string | null;
};
type Opcion = { id: string; label: string };

const fmt = (n: number) => n.toLocaleString("es-CL");
const hoy = () => new Date().toISOString().slice(0, 10);
const ETIQUETA: Record<string, string> = {
  en_cartera: "En cartera",
  depositado: "Depositado",
  protestado: "Protestado",
  emitido: "Emitido",
  cobrado: "Cobrado",
  anulado: "Anulado",
};
const FILTROS: { valor: string; etiqueta: string }[] = [
  { valor: "en_cartera", etiqueta: "En cartera" },
  { valor: "depositado", etiqueta: "Depositados" },
  { valor: "protestado", etiqueta: "Protestados" },
  { valor: "emitidos", etiqueta: "Emitidos" },
  { valor: "todos", etiqueta: "Todos" },
];

export function ChequesLista({
  empresaId,
  filtro,
  filas,
  cuentasBancarias,
  cuentasGasto,
}: {
  empresaId: string;
  filtro: string;
  filas: ChequeFila[];
  cuentasBancarias: Opcion[];
  cuentasGasto: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [depOpen, setDepOpen] = useState(false);
  const [cuentaId, setCuentaId] = useState("");
  const [fechaDep, setFechaDep] = useState(hoy());
  const [glosaDep, setGlosaDep] = useState("");
  const [protesto, setProtesto] = useState<ChequeFila | null>(null);
  const [fechaProt, setFechaProt] = useState(hoy());
  const [motivo, setMotivo] = useState("");
  const [gastos, setGastos] = useState("");
  const [cuentaGasto, setCuentaGasto] = useState("");
  const base = `/panel/${empresaId}/tesoreria`;

  const enCartera = filas.filter((f) => f.estado === "en_cartera" && f.tipo === "Recibido");
  const seleccionados = enCartera.filter((f) => sel.has(f.id));
  const totalSel = seleccionados.reduce((a, f) => a + f.monto, 0);

  function alternar(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function depositar() {
    startTransition(async () => {
      const r = await depositarChequesAction(empresaId, {
        cuentaBancariaId: cuentaId,
        fecha: fechaDep,
        fechaContabilizacion: fechaDep,
        glosa: glosaDep || null,
        chequeIds: seleccionados.map((f) => f.id),
      });
      if (r.ok) {
        toast.success("Depósito registrado y contabilizado.");
        setDepOpen(false);
        setSel(new Set());
        router.push(`${base}/depositos/${r.depositoId}`);
      } else toast.error(r.error);
    });
  }

  function protestar() {
    if (!protesto) return;
    startTransition(async () => {
      const r = await protestarChequeAction(empresaId, protesto.id, {
        fecha: fechaProt,
        motivo,
        gastosProtesto: Number(gastos) || 0,
        cuentaGastoId: cuentaGasto || null,
      });
      if (r.ok) {
        toast.success("Cheque protestado: la deuda del cliente quedó reabierta.");
        setProtesto(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTROS.map((f) => (
            <Button key={f.valor} asChild size="sm" variant={filtro === f.valor ? "default" : "outline"}>
              <Link href={`${base}/cheques?estado=${f.valor}`}>{f.etiqueta}</Link>
            </Button>
          ))}
        </div>
        {filtro === "en_cartera" && (
          <Button size="sm" disabled={seleccionados.length === 0} onClick={() => setDepOpen(true)}>
            Depositar seleccionados ({seleccionados.length}) — {fmt(totalSel)}
          </Button>
        )}
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay cheques en este estado.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                {filtro === "en_cartera" && <TableHead className="w-8" />}
                <TableHead>N° cheque</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente / Proveedor</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Cobro</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((c) => {
                const aFecha = c.fechaCobro && c.fechaCobro > hoy();
                return (
                  <TableRow key={c.id}>
                    {filtro === "en_cartera" && (
                      <TableCell>
                        {c.estado === "en_cartera" && c.tipo === "Recibido" && (
                          <input
                            type="checkbox"
                            checked={sel.has(c.id)}
                            onChange={() => alternar(c.id)}
                            aria-label={`Seleccionar cheque ${c.numero}`}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-mono font-medium">{c.numero}</TableCell>
                    <TableCell className="text-muted-foreground">{c.tipo}</TableCell>
                    <TableCell>{c.tercero}</TableCell>
                    <TableCell className="text-muted-foreground">{c.banco ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(c.monto)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{c.fechaEmision}</TableCell>
                    <TableCell className="tabular-nums">
                      {c.fechaCobro ? (
                        <span className={aFecha ? "text-amber-600" : ""}>
                          {c.fechaCobro}
                          {aFecha ? " (a fecha)" : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">a la vista</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`${base}/${c.tipo === "Recibido" ? "pagos-recibidos" : "pagos-efectuados"}/${c.pagoId}`}
                        className="font-mono hover:underline"
                      >
                        {c.pagoNumero}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.estado === "protestado" ? "destructive" : c.estado === "anulado" ? "secondary" : "default"}>
                        {ETIQUETA[c.estado] ?? c.estado}
                      </Badge>
                      {c.motivoProtesto && <div className="text-xs text-muted-foreground">{c.motivoProtesto}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <span className="mr-1 inline-block align-middle">
                        <HistorialDocumentoDialog empresaId={empresaId} docId={c.id} historial={historialChequeAction} />
                      </span>
                      {c.estado === "depositado" && c.tipo === "Recibido" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setProtesto(c);
                            setMotivo("");
                            setGastos("");
                            setCuentaGasto("");
                          }}
                        >
                          Protestar
                        </Button>
                      )}
                      {c.depositoId && c.estado === "depositado" && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`${base}/depositos/${c.depositoId}`}>Depósito</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={depOpen} onOpenChange={setDepOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Depositar {seleccionados.length} cheque(s) por {fmt(totalSel)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cuenta bancaria de destino</Label>
              <Select value={cuentaId || undefined} onValueChange={setCuentaId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {cuentasBancarias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cuentasBancarias.length === 0 && (
                <p className="text-xs text-destructive">No hay cuentas bancarias activas: créalas en Administración → Bancos y pagos.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaDep">Fecha del depósito</Label>
              <Input id="fechaDep" type="date" value={fechaDep} onChange={(e) => setFechaDep(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="glosaDep">Glosa (opcional)</Label>
              <Input id="glosaDep" value={glosaDep} onChange={(e) => setGlosaDep(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={isPending || !cuentaId} onClick={depositar}>
              {isPending ? "Depositando…" : "Registrar depósito"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={protesto !== null} onOpenChange={(o) => !o && setProtesto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Protestar cheque N° {protesto?.numero} por {protesto ? fmt(protesto.monto) : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            El banco devuelve el cheque: se carga el banco, se reabre la deuda del cliente y las facturas que pagó
            recuperan su saldo.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fechaProt">Fecha del protesto</Label>
              <Input id="fechaProt" type="date" value={fechaProt} onChange={(e) => setFechaProt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo</Label>
              <Input id="motivo" placeholder="Ej. Sin fondos" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gastos">Gastos de protesto (opcional)</Label>
                <Input id="gastos" type="number" min={0} value={gastos} onChange={(e) => setGastos(e.target.value)} />
              </div>
              {Number(gastos) > 0 && (
                <div className="space-y-2">
                  <Label>Cuenta de gasto</Label>
                  <Select value={cuentaGasto || undefined} onValueChange={setCuentaGasto}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentasGasto.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProtesto(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending || !motivo.trim()} onClick={protestar}>
              {isPending ? "Registrando…" : "Registrar protesto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
