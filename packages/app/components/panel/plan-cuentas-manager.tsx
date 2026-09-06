"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { MAX_PROFUNDIDAD_CUENTA } from "@erp/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CuentaFormDialog, type CuentaLite, type Opcion } from "./cuenta-form-dialog";

type Fila = { cuenta: CuentaLite; nivel: number; tieneHijos: boolean };

/** Índice hijos-por-padre, cada lista ordenada por código. */
function indexarHijos(cuentas: CuentaLite[]): Map<string | null, CuentaLite[]> {
  const porPadre = new Map<string | null, CuentaLite[]>();
  for (const c of cuentas) {
    const arr = porPadre.get(c.cuentaPadreId) ?? [];
    arr.push(c);
    porPadre.set(c.cuentaPadreId, arr);
  }
  for (const arr of porPadre.values()) {
    arr.sort((a, b) => a.codigoCuenta.localeCompare(b.codigoCuenta, "es", { numeric: true }));
  }
  return porPadre;
}

/** Filas a mostrar: recorre el árbol y solo baja por los nodos expandidos. */
function filasVisibles(
  cuentas: CuentaLite[],
  porPadre: Map<string | null, CuentaLite[]>,
  expandidos: Set<string>,
): Fila[] {
  const ids = new Set(cuentas.map((c) => c.id));
  const salida: Fila[] = [];
  const emitir = (cuenta: CuentaLite, nivel: number) => {
    const hijos = porPadre.get(cuenta.id) ?? [];
    salida.push({ cuenta, nivel, tieneHijos: hijos.length > 0 });
    if (hijos.length > 0 && expandidos.has(cuenta.id)) {
      for (const h of hijos) emitir(h, nivel + 1);
    }
  };
  // Raíces: sin padre, o con un padre que no está en el set (huérfanas).
  const raices = cuentas
    .filter((c) => c.cuentaPadreId === null || !ids.has(c.cuentaPadreId))
    .sort((a, b) => a.codigoCuenta.localeCompare(b.codigoCuenta, "es", { numeric: true }));
  for (const r of raices) emitir(r, 0);
  return salida;
}

export function PlanCuentasManager({
  empresaId,
  cuentas,
  monedas,
}: {
  empresaId: string;
  cuentas: CuentaLite[];
  monedas: Opcion[];
}) {
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<CuentaLite | null>(null);
  const [padreParaNueva, setPadreParaNueva] = useState<CuentaLite | null>(null);

  const porPadre = useMemo(() => indexarHijos(cuentas), [cuentas]);
  const idsConHijos = useMemo(
    () => cuentas.filter((c) => (porPadre.get(c.id)?.length ?? 0) > 0).map((c) => c.id),
    [cuentas, porPadre],
  );

  // Por defecto todo expandido (mismo comportamiento que la lista plana anterior).
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(idsConHijos));

  const filas = useMemo(
    () => filasVisibles(cuentas, porPadre, expandidos),
    [cuentas, porPadre, expandidos],
  );

  function alternar(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const expandirTodo = () => setExpandidos(new Set(idsConHijos));
  const colapsarTodo = () => setExpandidos(new Set());

  function abrirNueva() {
    setEnEdicion(null);
    setPadreParaNueva(null);
    setDialogAbierto(true);
  }
  function abrirNuevaHija(padre: CuentaLite) {
    setEnEdicion(null);
    setPadreParaNueva(padre);
    setDialogAbierto(true);
  }
  function abrirEdicion(cuenta: CuentaLite) {
    setEnEdicion(cuenta);
    setPadreParaNueva(null);
    setDialogAbierto(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={expandirTodo}>
          Expandir todo
        </Button>
        <Button variant="outline" size="sm" onClick={colapsarTodo}>
          Colapsar todo
        </Button>
        <Button onClick={abrirNueva}>Nueva cuenta</Button>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta empresa no tiene plan de cuentas.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Clase</TableHead>
                <TableHead>Naturaleza</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map(({ cuenta, nivel, tieneHijos }) => {
                const abierto = expandidos.has(cuenta.id);
                const puedeTenerHijas = nivel + 1 < MAX_PROFUNDIDAD_CUENTA;
                return (
                  <TableRow
                    key={cuenta.id}
                    className={cuenta.activa ? undefined : "opacity-50"}
                  >
                    <TableCell className="font-mono text-muted-foreground">
                      <div
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${nivel * 1.25}rem` }}
                      >
                        {tieneHijos ? (
                          <button
                            type="button"
                            onClick={() => alternar(cuenta.id)}
                            aria-label={abierto ? "Colapsar" : "Expandir"}
                            aria-expanded={abierto}
                            className="grid size-4 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            {abierto ? (
                              <ChevronDownIcon className="size-3.5" />
                            ) : (
                              <ChevronRightIcon className="size-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="inline-block size-4 shrink-0" />
                        )}
                        {cuenta.codigoCuenta}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={nivel === 0 ? "font-semibold" : undefined}>
                        {cuenta.nombreCuenta}
                      </span>
                      <span className="ml-2 inline-flex gap-1 align-middle">
                        {!cuenta.nivelImputable && <Badge variant="outline">Título</Badge>}
                        {cuenta.requiereCentroCosto && <Badge variant="ghost">CC</Badge>}
                        {cuenta.requiereAnalisisTerceros && <Badge variant="ghost">Control</Badge>}
                        {cuenta.tipoCuenta !== "Otra" && (
                          <Badge variant="ghost">{cuenta.tipoCuenta}</Badge>
                        )}
                        {cuenta.modoMoneda !== "Funcional" && (
                          <Badge variant="ghost">{cuenta.modoMoneda}</Badge>
                        )}
                        {cuenta.relevanteFlujoCaja && <Badge variant="ghost">Flujo</Badge>}
                        {cuenta.tieneMovimientos && <Badge variant="ghost">Con movim.</Badge>}
                        {!cuenta.activa && <Badge variant="secondary">Inactiva</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{cuenta.clase}</TableCell>
                    <TableCell className="text-muted-foreground">{cuenta.naturaleza}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {puedeTenerHijas && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirNuevaHija(cuenta)}
                        >
                          + hija
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicion(cuenta)}>
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CuentaFormDialog
        empresaId={empresaId}
        cuentas={cuentas}
        cuenta={enEdicion}
        padreInicial={padreParaNueva}
        monedas={monedas}
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
      />
    </div>
  );
}
