"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, SearchIcon } from "lucide-react";
import { formatearRut, normalizarRut } from "@erp/shared";
import { colorPorNombre } from "@/lib/avatar-color";
import { formatearFechaRelativa } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type EmpresaFila = {
  id: string;
  rut: string;
  razonSocial: string;
  giro: string | null;
  estado: string;
  aplicaIfrs: boolean;
  ultimoAcceso: string | null;
};

export function EmpresasGrid({
  empresas,
  puedeCrear,
}: {
  empresas: EmpresaFila[];
  puedeCrear: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qRut = normalizarRut(query.trim());
    const resultado = !q
      ? empresas
      : empresas.filter(
          (e) =>
            e.razonSocial.toLowerCase().includes(q) ||
            (qRut && normalizarRut(e.rut).includes(qRut)),
        );
    // Activas primero; dentro de cada grupo, orden alfabético (ya viene ordenado así de la query).
    return [...resultado].sort((a, b) => {
      const aActiva = a.estado === "Activa" ? 0 : 1;
      const bActiva = b.estado === "Activa" ? 0 : 1;
      return aActiva - bActiva;
    });
  }, [empresas, query]);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Empresas cliente</h1>
          <p className="text-sm text-muted-foreground">
            Elige una empresa para entrar a su panel de trabajo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o RUT…"
              className="h-10 w-80 pl-8"
            />
          </div>
          {puedeCrear && (
            <Button asChild className="h-10">
              <Link href="/admin/empresas/nueva">+ Nueva empresa</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8">
      {empresas.length === 0 ? (
        <EstadoVacio
          titulo="Aún no hay empresas cliente creadas."
          descripcion={
            puedeCrear
              ? "Crea la primera empresa para empezar a trabajar."
              : "Pídele a tu Administrador que te asigne una."
          }
          puedeCrear={puedeCrear}
        />
      ) : filtradas.length === 0 ? (
        <EstadoVacio
          titulo={`Sin resultados para "${query}"`}
          descripcion="Probá con otro nombre o RUT."
          puedeCrear={false}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtradas.map((empresa) => {
            const color = colorPorNombre(empresa.razonSocial);
            const activa = empresa.estado === "Activa";
            return (
              <Link
                key={empresa.id}
                href={`/panel/${empresa.id}`}
                className={activa ? "group block" : "group block opacity-60"}
              >
                <Card
                  className="h-full border border-transparent transition hover:-translate-y-0.5 hover:border-teal-500 hover:shadow-md"
                  style={{ "--card-spacing": "1.25rem" } as React.CSSProperties}
                >
                  <CardContent className="flex items-start gap-3">
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${color.bg} ${color.text}`}
                    >
                      {empresa.razonSocial.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="truncate font-medium leading-snug group-hover:text-primary">
                        {empresa.razonSocial}
                      </p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {formatearRut(empresa.rut)}
                      </p>
                      {empresa.giro && (
                        <p className="truncate text-xs text-muted-foreground">{empresa.giro}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className={`size-1.5 rounded-full ${activa ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
                          />
                          {empresa.estado}
                        </span>
                        {empresa.aplicaIfrs && (
                          <Badge variant="outline" className="border-gray-200 text-gray-600">
                            IFRS
                          </Badge>
                        )}
                      </div>
                      {empresa.ultimoAcceso && (
                        <p className="text-xs text-muted-foreground/70">
                          Último acceso: {formatearFechaRelativa(empresa.ultimoAcceso)}
                        </p>
                      )}
                    </div>
                    <ChevronRightIcon className="mt-1 size-4 shrink-0 self-center text-gray-300 transition-colors group-hover:text-teal-500" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

function EstadoVacio({
  titulo,
  descripcion,
  puedeCrear,
}: {
  titulo: string;
  descripcion: string;
  puedeCrear: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
        {puedeCrear && (
          <Button asChild className="mt-1">
            <Link href="/admin/empresas/nueva">+ Nueva empresa</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
