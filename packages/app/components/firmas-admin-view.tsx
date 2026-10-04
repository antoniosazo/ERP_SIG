"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Building2Icon,
  CheckCircle2Icon,
  DatabaseIcon,
  PlusIcon,
  SearchIcon,
  ShieldOffIcon,
} from "lucide-react";
import { formatearRut, normalizarRut, type FirmaEstado, type PlanContratado } from "@erp/shared";
import { colorPorNombre } from "@/lib/avatar-color";
import { CrearFirmaForm } from "@/components/crear-firma-form";
import { EditarFirmaDialog } from "@/components/editar-firma-dialog";
import { EntrarFirmaButton } from "@/components/entrar-firma-button";
import { ReintentarBaseFirma } from "@/components/reintentar-base-firma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";

export type FirmaAdminFila = {
  id: string;
  rut: string;
  razonSocial: string;
  planContratado: PlanContratado;
  estado: FirmaEstado;
  proveedor: "neon" | "servidor";
  neonProyectoId: string | null;
  region: string | null;
  estadoBase: "pendiente" | "lista" | "error";
  versionEsquema: string | null;
  errorMigracion: string | null;
};

type Filtro = "todas" | "activas" | "suspendidas" | "atencion";

function Indicador({
  titulo,
  valor,
  icono,
  filtro,
  activo,
  onClick,
}: {
  titulo: string;
  valor: number;
  icono: ReactNode;
  filtro: Filtro;
  activo: boolean;
  onClick: (filtro: Filtro) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={() => onClick(filtro)}
      className="block w-full rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <Card className={`h-full gap-3 border transition-colors hover:border-primary/50 ${activo ? "border-primary/50 bg-primary/5" : "border-border"}`} size="sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
          <span className="text-primary" aria-hidden="true">{icono}</span>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">{valor}</p>
        </CardContent>
      </Card>
    </button>
  );
}

function FirmaCard({ firma }: { firma: FirmaAdminFila }) {
  const color = colorPorNombre(firma.razonSocial);
  const baseLista = firma.estadoBase === "lista";

  return (
    <Card className="gap-0 border-border/80 transition-shadow hover:shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${color.bg} ${color.text}`} aria-hidden="true">
            {firma.razonSocial.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{firma.razonSocial}</CardTitle>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{formatearRut(firma.rut)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <EditarFirmaDialog
            firmaId={firma.id}
            razonSocial={firma.razonSocial}
            valoresIniciales={{
              razonSocial: firma.razonSocial,
              planContratado: firma.planContratado,
              estado: firma.estado,
            }}
          />
          <EntrarFirmaButton firmaId={firma.id} nombre={firma.razonSocial} disponible={firma.estado === "Activa" && baseLista} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
          <StatusBadge estado={firma.estado} tono={firma.estado === "Activa" ? "success" : "warning"} />
          <Badge variant="outline">Plan {firma.planContratado}</Badge>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DatabaseIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">Base de datos</span>
            </div>
            <Badge variant={baseLista ? "secondary" : firma.estadoBase === "error" ? "destructive" : "outline"}>
              {baseLista ? "Lista" : firma.estadoBase === "error" ? "Requiere atención" : "Pendiente"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {firma.proveedor === "neon" ? `Neon${firma.region ? ` · ${firma.region}` : ""}` : "Servidor propio"}
            {firma.versionEsquema ? ` · Esquema ${firma.versionEsquema.slice(0, 4)}` : ""}
          </p>
          {firma.neonProyectoId && (
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={firma.neonProyectoId}>
              Proyecto {firma.neonProyectoId}
            </p>
          )}
          {firma.errorMigracion && (
            <details className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              <summary className="cursor-pointer font-medium">Ver detalle del error</summary>
              <p className="mt-2 break-words">{firma.errorMigracion}</p>
            </details>
          )}
          {!baseLista && <div className="mt-3"><ReintentarBaseFirma firmaId={firma.id} /></div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function FirmasAdminView({ firmas }: { firmas: FirmaAdminFila[] }) {
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [crearAbierto, setCrearAbierto] = useState(false);

  const resumen = {
    todas: firmas.length,
    activas: firmas.filter((f) => f.estado === "Activa").length,
    suspendidas: firmas.filter((f) => f.estado === "Suspendida").length,
    atencion: firmas.filter((f) => f.estadoBase !== "lista").length,
  };
  const filtradas = useMemo(() => {
    const nombre = query.trim().toLowerCase();
    const rut = normalizarRut(query.trim());
    return firmas
      .filter((f) => {
        if (filtro === "activas" && f.estado !== "Activa") return false;
        if (filtro === "suspendidas" && f.estado !== "Suspendida") return false;
        if (filtro === "atencion" && f.estadoBase === "lista") return false;
        return !nombre || f.razonSocial.toLowerCase().includes(nombre) || normalizarRut(f.rut).includes(rut);
      })
      .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "Activa" ? -1 : 1));
  }, [firmas, query, filtro]);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Administración de plataforma</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Firmas contables</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Gestiona el acceso, el plan y la base de datos de cada firma. Al entrar, la firma activa cambia en todas tus pestañas.
          </p>
        </div>
        <Button type="button" size="md" onClick={() => setCrearAbierto(true)}>
          <PlusIcon className="size-4" aria-hidden="true" /> Nueva firma
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <Indicador titulo="Todas" valor={resumen.todas} icono={<Building2Icon className="size-5" />} filtro="todas" activo={filtro === "todas"} onClick={setFiltro} />
        <Indicador titulo="Activas" valor={resumen.activas} icono={<CheckCircle2Icon className="size-5" />} filtro="activas" activo={filtro === "activas"} onClick={setFiltro} />
        <Indicador titulo="Suspendidas" valor={resumen.suspendidas} icono={<ShieldOffIcon className="size-5" />} filtro="suspendidas" activo={filtro === "suspendidas"} onClick={setFiltro} />
        <Indicador titulo="Bases por revisar" valor={resumen.atencion} icono={<DatabaseIcon className="size-5" />} filtro="atencion" activo={filtro === "atencion"} onClick={setFiltro} />
      </div>

      <section className="space-y-4" aria-labelledby="directorio-firmas">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="directorio-firmas" className="text-lg font-semibold tracking-tight">Directorio de firmas</h2>
            <p className="text-sm text-muted-foreground">{filtradas.length} de {firmas.length} firmas</p>
          </div>
          <div className="relative w-full sm:w-80">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar firmas por nombre o RUT"
              placeholder="Buscar por nombre o RUT…"
              className="pl-9"
            />
          </div>
        </div>

        {filtradas.length > 0 ? (
          <div className="grid gap-4 @2xl:grid-cols-2">
            {filtradas.map((firma) => <FirmaCard key={firma.id} firma={firma} />)}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Building2Icon className="mb-2 size-8 text-muted-foreground/50" aria-hidden="true" />
              <p className="font-medium">{firmas.length === 0 ? "Aún no hay firmas contables" : "No hay firmas con estos filtros"}</p>
              <p className="text-sm text-muted-foreground">
                {firmas.length === 0 ? "Crea la primera firma para comenzar." : "Prueba con otro nombre, RUT o indicador."}
              </p>
              {firmas.length === 0 && <Button type="button" className="mt-3" onClick={() => setCrearAbierto(true)}>Crear firma</Button>}
            </CardContent>
          </Card>
        )}
      </section>

      <Dialog open={crearAbierto} onOpenChange={setCrearAbierto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva firma contable</DialogTitle>
            <DialogDescription>
              Registra la firma y su primer administrador. La base de datos se prepara al crearla.
            </DialogDescription>
          </DialogHeader>
          {crearAbierto && <CrearFirmaForm onCreated={() => { setFiltro("todas"); setQuery(""); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
