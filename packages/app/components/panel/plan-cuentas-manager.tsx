"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { MAX_PROFUNDIDAD_CUENTA } from "@erp/shared";
import { filtrarPlanCuentas } from "@/lib/plan-cuentas-vista";
import { Badge } from "@/components/ui/badge";
import { FlechaDetalle } from "@/components/panel/flecha-detalle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  saldos,
  hasta,
  puedeEditar,
}: {
  empresaId: string;
  cuentas: CuentaLite[];
  monedas: Opcion[];
  saldos: Record<string, number>;
  hasta: string;
  puedeEditar: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todas");
  const [tipo, setTipo] = useState("todas");
  const filtrando = !!busqueda.trim() || estado !== "todas" || tipo !== "todas";
  const { coincidencias, visibles } = useMemo(() => filtrarPlanCuentas(cuentas, busqueda, estado, tipo), [cuentas, busqueda, estado, tipo]);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<CuentaLite | null>(null);
  const [padreParaNueva, setPadreParaNueva] = useState<CuentaLite | null>(null);

  const porPadre = useMemo(() => indexarHijos(cuentas), [cuentas]);
  const idsConHijos = useMemo(
    () => cuentas.filter((c) => (porPadre.get(c.id)?.length ?? 0) > 0).map((c) => c.id),
    [cuentas, porPadre],
  );

  // Por defecto todo colapsado — se expande cuenta por cuenta al hacer clic.
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());

  const filas = useMemo(
    () => filasVisibles(cuentas, porPadre, filtrando ? new Set(idsConHijos) : expandidos).filter((f) => visibles.has(f.cuenta.id)),
    [cuentas, porPadre, expandidos, filtrando, idsConHijos, visibles],
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

  // Deep-link "ir a configurar la cuenta" (ej. desde Grupos de artículos): ?cuenta=<id>
  // abre directo el diálogo de edición de esa cuenta.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cuentaEnlace = puedeEditar ? cuentas.find((c) => c.id === params.get("cuenta")) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="mr-auto flex items-center gap-2 text-sm">
          <label htmlFor="hasta" className="text-muted-foreground">
            Saldos al
          </label>
          <Input
            id="hasta"
            type="date"
            value={hasta}
            className="h-8 w-40"
            onChange={(e) => {
              if (e.target.value) router.push(`${pathname}?hasta=${e.target.value}`);
            }}
          />
        </div>
        <Button variant="outline" size="sm" disabled={filtrando} onClick={expandirTodo}>
          Expandir todo
        </Button>
        <Button variant="outline" size="sm" disabled={filtrando} onClick={colapsarTodo}>
          Colapsar todo
        </Button>
        {puedeEditar && <Button onClick={abrirNueva}>Nueva cuenta</Button>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1">
          <label htmlFor="buscar-cuenta" className="text-xs text-muted-foreground">Buscar por código o nombre</label>
          <Input id="buscar-cuenta" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej. 1.1 o Banco" />
        </div>
        <div className="space-y-1">
          <label htmlFor="estado-cuenta" className="block text-xs text-muted-foreground">Estado</label>
          <select id="estado-cuenta" value={estado} onChange={(e) => setEstado(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="todas">Todas</option><option value="activas">Activas</option><option value="inactivas">Inactivas</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="tipo-cuenta-filtro" className="block text-xs text-muted-foreground">Imputación</label>
          <select id="tipo-cuenta-filtro" value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="todas">Todas</option><option value="imputables">Imputables</option><option value="titulos">Títulos</option>
          </select>
        </div>
        {filtrando && <Button variant="ghost" onClick={() => { setBusqueda(""); setEstado("todas"); setTipo("todas"); }}>Limpiar filtros</Button>}
      </div>
      {filtrando && <p role="status" className="text-xs text-muted-foreground">{coincidencias.size} coincidencia(s). Se incluyen sus cuentas padre como contexto.</p>}
      {!puedeEditar && <p className="text-xs text-muted-foreground">Acceso de consulta al plan de cuentas.</p>}

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{cuentas.length ? "No hay cuentas que coincidan con los filtros." : "Esta empresa no tiene plan de cuentas."}</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Clase</TableHead>
                <TableHead>Naturaleza</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                {puedeEditar && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map(({ cuenta, nivel, tieneHijos }) => {
                const abierto = filtrando || expandidos.has(cuenta.id);
                const puedeTenerHijas = nivel + 1 < MAX_PROFUNDIDAD_CUENTA;
                return (
                  <TableRow
                    key={cuenta.id}
                    className={cuenta.activa ? undefined : "opacity-50"}
                    title={puedeEditar ? "Doble clic para editar" : undefined}
                    onDoubleClick={(e) => {
                      // Los botones y enlaces de la fila conservan su propia acción.
                      if (!puedeEditar) return;
                      if ((e.target as HTMLElement).closest("a, button, input")) return;
                      abrirEdicion(cuenta);
                    }}
                  >
                    <TableCell className="font-mono text-muted-foreground">
                      <div
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${nivel * 1.25}rem` }}
                      >
                        {tieneHijos ? (
                          <button
                            type="button"
                            disabled={filtrando}
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
                        {filtrando && !coincidencias.has(cuenta.id) && <Badge variant="outline">Contexto</Badge>}
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
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <FlechaDetalle
                          href={`/panel/${empresaId}/configuracion/plan-cuentas/${cuenta.id}?hasta=${hasta}`}
                          title={`Ver detalle de movimientos de ${cuenta.codigoCuenta}`}
                        />
                        <span className={(saldos[cuenta.id] ?? 0) < 0 ? "text-destructive" : undefined}>
                          {(saldos[cuenta.id] ?? 0) === 0 ? "—" : (saldos[cuenta.id] ?? 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                    </TableCell>
                    {puedeEditar && <TableCell className="text-right whitespace-nowrap">
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
                    </TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {cuentaEnlace && <CuentaDesdeEnlace
        key={cuentaEnlace.id}
        empresaId={empresaId}
        cuentas={cuentas}
        cuenta={cuentaEnlace}
        monedas={monedas}
        alCerrar={() => {
          const query = new URLSearchParams(params.toString());
          query.delete("cuenta");
          router.replace(`${pathname}${query.size ? `?${query}` : ""}`, { scroll: false });
        }}
      />}
      {puedeEditar && <CuentaFormDialog
        empresaId={empresaId}
        cuentas={cuentas}
        cuenta={enEdicion}
        padreInicial={padreParaNueva}
        monedas={monedas}
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
      />}
    </div>
  );
}

/** El diálogo del enlace inicia abierto; al cerrar se consume el parámetro de la URL. */
function CuentaDesdeEnlace({ alCerrar, ...props }: {
  empresaId: string;
  cuentas: CuentaLite[];
  cuenta: CuentaLite;
  monedas: Opcion[];
  alCerrar: () => void;
}) {
  const [abierto, setAbierto] = useState(true);
  return <CuentaFormDialog {...props} open={abierto} onOpenChange={(open) => {
    setAbierto(open);
    if (!open) alCerrar();
  }} />;
}
