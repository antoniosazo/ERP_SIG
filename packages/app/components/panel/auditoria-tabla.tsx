"use client";

import { Fragment, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AUDITORIA_ACCION } from "@erp/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type Fila = {
  id: string;
  creadoEn: string;
  usuarioNombre: string;
  usuarioId: string | null;
  tablaAfectada: string;
  etiqueta: string;
  accion: string;
  motivo: string | null;
  valoresAnteriores: Record<string, unknown> | null;
  valoresNuevos: Record<string, unknown> | null;
};

const MODULOS: Record<string, string> = {
  monedas: "Monedas",
  plan_cuentas: "Plan de cuentas",
  reglas_determinacion_cuenta: "Determinación de cuentas",
  centros_costo: "Centros de costo",
  categorias_contables: "Categorías contables",
  terceros: "Socios de negocio",
  terceros_grupos: "Grupos de socios",
  terceros_contactos: "Contactos de socio",
  terceros_direcciones: "Direcciones de socio",
  terceros_cuentas_bancarias: "Cuentas bancarias de socio",
  impuestos: "Impuestos",
  productos: "Productos",
  productos_grupos: "Grupos de artículos",
  documentos_venta: "Documentos de venta",
  documentos_compra: "Documentos de compra",
  stock_movimientos: "Movimientos de stock",
  sii_credenciales: "Conexión SII",
  sii_importaciones: "Importaciones SII",
  periodos_contables: "Períodos contables",
  empresas: "Empresa",
};

const ACCION_LABEL: Record<string, string> = {
  crear: "Creación",
  editar: "Edición",
  eliminar: "Eliminación",
  cambio_estado: "Cambio de estado",
};

const TODOS = "__all__";
const OCULTAR = new Set(["id", "creadoEn", "createdAt", "updatedAt", "created_at", "updated_at"]);

function mostrarValor(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function diffCampos(fila: Fila): Array<{ campo: string; antes: string; despues: string }> {
  const antes = fila.valoresAnteriores ?? {};
  const despues = fila.valoresNuevos ?? {};
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].filter(
    (k) => !OCULTAR.has(k),
  );
  const salida: Array<{ campo: string; antes: string; despues: string }> = [];
  for (const k of claves.sort()) {
    const a = mostrarValor(antes[k as keyof typeof antes]);
    const d = mostrarValor(despues[k as keyof typeof despues]);
    if (fila.accion === "editar" && a === d) continue;
    salida.push({ campo: k, antes: a, despues: d });
  }
  return salida;
}

export function AuditoriaTabla({
  filas,
  total,
  pagina,
  porPagina,
  filtros,
  usuarios,
}: {
  filas: Fila[];
  total: number;
  pagina: number;
  porPagina: number;
  filtros: { tabla: string; accion: string; usuarioId: string };
  usuarios: Array<{ id: string; nombre: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [expandida, setExpandida] = useState<string | null>(null);

  function navegar(patch: Partial<{ tabla: string; accion: string; usuarioId: string; pagina: number }>) {
    const q = new URLSearchParams();
    const next = { ...filtros, pagina: 1, ...patch };
    if (next.tabla) q.set("tabla", next.tabla);
    if (next.accion) q.set("accion", next.accion);
    if (next.usuarioId) q.set("usuarioId", next.usuarioId);
    if (next.pagina && next.pagina > 1) q.set("pagina", String(next.pagina));
    router.push(q.toString() ? `${pathname}?${q}` : pathname);
  }

  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const hayMas = hasta < total;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select
          value={filtros.tabla || TODOS}
          onValueChange={(v) => navegar({ tabla: v === TODOS ? "" : v })}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los módulos</SelectItem>
            {Object.entries(MODULOS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.accion || TODOS}
          onValueChange={(v) => navegar({ accion: v === TODOS ? "" : v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las acciones</SelectItem>
            {AUDITORIA_ACCION.map((a) => (
              <SelectItem key={a} value={a}>
                {ACCION_LABEL[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {usuarios.length > 0 && (
          <Select
            value={filtros.usuarioId || TODOS}
            onValueChange={(v) => navegar({ usuarioId: v === TODOS ? "" : v })}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Usuario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los usuarios</SelectItem>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay movimientos registrados.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead className="text-right">Cambios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => {
                const abierta = expandida === f.id;
                const cambios = diffCampos(f);
                return (
                  <Fragment key={f.id}>
                    <TableRow>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {new Date(f.creadoEn).toLocaleString("es-CL")}
                      </TableCell>
                      <TableCell>{f.usuarioNombre}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {MODULOS[f.tablaAfectada] ?? f.tablaAfectada}
                      </TableCell>
                      <TableCell>{f.etiqueta}</TableCell>
                      <TableCell>
                        <Badge variant={f.accion === "eliminar" ? "destructive" : "secondary"}>
                          {ACCION_LABEL[f.accion] ?? f.accion}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandida(abierta ? null : f.id)}
                        >
                          {abierta ? "Ocultar" : "Ver cambios"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {abierta && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30">
                          {f.motivo && (
                            <p className="mb-2 text-sm">
                              <span className="text-muted-foreground">Motivo:</span> {f.motivo}
                            </p>
                          )}
                          {cambios.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin campos con cambios.</p>
                          ) : (
                            <ul className="space-y-1 text-sm">
                              {cambios.map((c) => (
                                <li key={c.campo} className="flex flex-wrap gap-x-2">
                                  <span className="font-mono text-muted-foreground">{c.campo}:</span>
                                  {f.accion !== "crear" && (
                                    <span className="text-destructive/80 line-through">{c.antes}</span>
                                  )}
                                  {f.accion !== "eliminar" && (
                                    <>
                                      <span className="text-muted-foreground">→</span>
                                      <span>{c.despues}</span>
                                    </>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {desde}–{hasta} de {total}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina <= 1}
            onClick={() => navegar({ pagina: pagina - 1 })}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hayMas}
            onClick={() => navegar({ pagina: pagina + 1 })}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
