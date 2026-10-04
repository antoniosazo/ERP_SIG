"use client";

import { ROL } from "@erp/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Rol = (typeof ROL)[number];
export type Asignacion = { empresaId: string; rol: Rol };
type Opcion = { id: string; label: string };

const QUE_PUEDE: Record<Rol, string> = {
  Administrador: "registra y contabiliza, anula documentos y edita los datos de la empresa",
  Contador: "registra y contabiliza documentos",
  Asistente: "solo consulta",
};

/** Empresas asignadas a un usuario y su rol en cada una; lo comparten la invitación y la edición. */
export function AsignacionesEmpresas({
  empresas,
  value,
  onChange,
  esAdminFirma,
  error,
}: {
  empresas: Opcion[];
  value: Asignacion[];
  onChange: (v: Asignacion[]) => void;
  esAdminFirma: boolean;
  error?: string;
}) {
  const libres = empresas.filter((e) => !value.some((a) => a.empresaId === e.id));
  const cambiar = (i: number, parcial: Partial<Asignacion>) => onChange(value.map((a, j) => (j === i ? { ...a, ...parcial } : a)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Empresas asignadas y rol en cada una</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { empresaId: libres[0]!.id, rol: "Contador" }])}
          disabled={libres.length === 0}
        >
          Agregar empresa
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {esAdminFirma
            ? "Sin empresas asignadas (opcional para un Administrador de firma, que ve todas)."
            : empresas.length === 0
              ? "Esta firma todavía no tiene empresas: crea una antes de invitar a un contador."
              : "Agrega al menos una empresa."}
        </p>
      )}

      {value.map((a, i) => (
        <div key={a.empresaId} className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Empresa</Label>
            <Select value={a.empresaId} onValueChange={(v) => cambiar(i, { empresaId: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {empresas
                  .filter((e) => e.id === a.empresaId || !value.some((x) => x.empresaId === e.id))
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40 space-y-1">
            <Label className="text-xs text-muted-foreground">Rol</Label>
            <Select value={a.rol} onValueChange={(v) => cambiar(i, { rol: v as Rol })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROL.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            Quitar
          </Button>
        </div>
      ))}

      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {ROL.map((r) => (
          <li key={r}>
            <span className="font-medium text-foreground">{r}:</span> {QUE_PUEDE[r]}.
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
