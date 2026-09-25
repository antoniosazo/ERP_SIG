"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActivoFijoForm } from "@/components/panel/activo-fijo-form";
import { FlechaDetalle } from "@/components/panel/flecha-detalle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ActivoFijoLite = {
  id: string;
  codigo: string;
  descripcion: string;
  estado: string;
  claseNombre: string | null;
  fechaAdquisicion: string | null;
};

type Opcion = { id: string; label: string };

export function ActivosFijosManager({
  empresaId,
  activos,
  clases,
  centros,
  vidasUtilesSii,
}: {
  empresaId: string;
  activos: ActivoFijoLite[];
  clases: Opcion[];
  centros: Opcion[];
  vidasUtilesSii?: { id: string; categoria: string; vidaUtilNormalMeses: number }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAbierto(true)}>Nuevo activo</Button>
      </div>

      {activos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta empresa no tiene activos fijos registrados.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-40">Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Clase</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activos.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <FlechaDetalle href={`/panel/${empresaId}/activos-fijos/activos/${a.id}`} title="Ver ficha" />
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">{a.codigo}</TableCell>
                  <TableCell className="font-medium">{a.descripcion}</TableCell>
                  <TableCell>{a.claseNombre ?? "Sin clase"}</TableCell>
                  <TableCell>
                    <StatusBadge estado={a.estado} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo activo</DialogTitle>
          </DialogHeader>
          <ActivoFijoForm
            empresaId={empresaId}
            clases={clases}
            centros={centros}
            vidasUtilesSii={vidasUtilesSii}
            onSaved={(activoId) => {
              setAbierto(false);
              router.push(`/panel/${empresaId}/activos-fijos/activos/${activoId}`);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
