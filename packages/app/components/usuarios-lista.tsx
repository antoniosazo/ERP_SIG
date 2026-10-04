"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanIcon, RotateCcwIcon, SendIcon, KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import {
  cambiarEstadoUsuarioAction,
  historialUsuarioAction,
  reenviarInvitacionAction,
  resetearPasswordAction,
} from "@/lib/actions/usuarios";
import { EditarUsuarioDialog, type UsuarioEditable } from "@/components/editar-usuario-dialog";
import { HistorialDocumentoDialog } from "@/components/panel/historial-documento-dialog";
import { LinkGenerado } from "@/components/link-generado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filtrarUsuarios, type EstadoUsuario } from "@/lib/usuarios-filtro";

export type UsuarioFila = Omit<UsuarioEditable, "asignaciones"> & {
  asignaciones: { empresaId: string; empresaNombre: string; rol: string }[];
  /** Invitación pendiente cuyo link ya venció (o no hay link vigente): hay que reenviarla. */
  invitacionVencida: boolean;
};

const TODOS = "__todos__";
const ETIQUETA_ESTADO: Record<string, string> = { Activo: "Activo", Invitado: "Invitación pendiente", Suspendido: "Suspendido" };

function SuspenderDialog({ usuario, abierto, onAbierto }: { usuario: UsuarioFila; abierto: boolean; onAbierto: (v: boolean) => void }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [isPending, startTransition] = useTransition();
  return (
    <Dialog open={abierto} onOpenChange={onAbierto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspender a {usuario.nombre} en esta firma</DialogTitle>
          <DialogDescription>
            No podrá entrar a esta firma y sus sesiones abiertas se cierran en pocos minutos (su acceso a otras firmas no cambia). Podrás reactivarlo cuando quieras; sus datos y registros se conservan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`motivo-${usuario.id}`}>Motivo (opcional, queda en el historial)</Label>
          <Input id={`motivo-${usuario.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: se retiró de la firma" maxLength={500} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onAbierto(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const r = await cambiarEstadoUsuarioAction(usuario.id, "suspender", motivo);
                if (r.ok) {
                  toast.success(`${usuario.nombre} fue suspendido`);
                  onAbierto(false);
                  router.refresh();
                } else toast.error(r.error);
              })
            }
          >
            {isPending ? "Suspendiendo…" : "Suspender"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilaUsuario({
  usuario,
  empresas,
  esUnoMismo,
  actorEsSuperAdmin,
}: {
  usuario: UsuarioFila;
  empresas: { id: string; label: string }[];
  esUnoMismo: boolean;
  actorEsSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [suspendiendo, setSuspendiendo] = useState(false);
  // Solo un superadmin gestiona la cuenta de otro superadmin: desde la firma podría tomarla.
  const protegida = usuario.esSuperAdmin && !actorEsSuperAdmin;

  const generar = (accion: typeof reenviarInvitacionAction | typeof resetearPasswordAction) =>
    startTransition(async () => {
      const r = await accion(usuario.id);
      if (r.ok) {
        setLink(r.token);
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            {usuario.nombre}
            {esUnoMismo && <span className="text-xs font-normal text-muted-foreground">(tú)</span>}
            {usuario.esSuperAdmin && <Badge variant="outline">Superadmin</Badge>}
            {usuario.esAdminFirma && <Badge>Admin firma</Badge>}
            {usuario.otrasFirmas > 0 && (
              <Badge variant="secondary" title="La misma cuenta trabaja en otras firmas">
                También en {usuario.otrasFirmas} {usuario.otrasFirmas === 1 ? "firma" : "firmas"}
              </Badge>
            )}
          </p>
          <p className="text-sm text-muted-foreground">{usuario.email}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {usuario.estado === "Invitado" && usuario.invitacionVencida && <Badge variant="destructive">Invitación vencida</Badge>}
          <Badge variant={usuario.estado === "Activo" ? "default" : usuario.estado === "Suspendido" ? "destructive" : "secondary"}>
            {ETIQUETA_ESTADO[usuario.estado] ?? usuario.estado}
          </Badge>
        </div>
      </div>

      {usuario.asignaciones.length > 0 && (
        <ul className="text-sm text-muted-foreground">
          {usuario.asignaciones.map((a) => (
            <li key={a.empresaId}>
              {a.empresaNombre} — {a.rol}
            </li>
          ))}
        </ul>
      )}

      {protegida ? (
        <p className="text-xs text-muted-foreground">Cuenta de superadmin: solo la gestiona un superadmin.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <EditarUsuarioDialog usuario={usuario} empresas={empresas} esUnoMismo={esUnoMismo} />
          {usuario.estado === "Invitado" && (
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => generar(reenviarInvitacionAction)}>
              <SendIcon className="mr-1 size-3.5" aria-hidden /> {isPending ? "Generando…" : "Reenviar invitación"}
            </Button>
          )}
          {usuario.estado === "Activo" && (usuario.otrasFirmas === 0 || actorEsSuperAdmin) && (
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => generar(resetearPasswordAction)}>
              <KeyRoundIcon className="mr-1 size-3.5" aria-hidden /> {isPending ? "Generando…" : "Resetear contraseña"}
            </Button>
          )}
          {usuario.estado === "Suspendido" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const r = await cambiarEstadoUsuarioAction(usuario.id, "reactivar");
                  if (r.ok) {
                    toast.success(usuario.asignaciones.length || usuario.esAdminFirma ? `${usuario.nombre} fue reactivado` : "Reactivado");
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              <RotateCcwIcon className="mr-1 size-3.5" aria-hidden /> Reactivar
            </Button>
          ) : (
            !esUnoMismo && (
              <Button type="button" variant="outline" size="sm" onClick={() => setSuspendiendo(true)}>
                <BanIcon className="mr-1 size-3.5" aria-hidden /> Suspender
              </Button>
            )
          )}
          <HistorialDocumentoDialog empresaId="" docId={usuario.id} historial={historialUsuarioAction} />
        </div>
      )}

      {usuario.estado === "Activo" && usuario.otrasFirmas > 0 && !actorEsSuperAdmin && !protegida && (
        <p className="text-xs text-muted-foreground">
          Trabaja en otras firmas: su contraseña la cambia ella misma o un superadmin. Suspender y editar empresas y roles solo afecta a esta firma.
        </p>
      )}
      {link && <LinkGenerado token={link} />}
      <SuspenderDialog usuario={usuario} abierto={suspendiendo} onAbierto={setSuspendiendo} />
    </div>
  );
}

/** Usuarios de la firma con búsqueda, filtro por estado y las acciones de gestión de cada uno. */
export function UsuariosLista({
  usuarios,
  empresas,
  yoId,
  actorEsSuperAdmin,
}: {
  usuarios: UsuarioFila[];
  empresas: { id: string; label: string }[];
  yoId: string;
  actorEsSuperAdmin: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<EstadoUsuario | typeof TODOS>(TODOS);
  const visibles = useMemo(() => filtrarUsuarios(usuarios, { texto, estado: estado === TODOS ? "todos" : estado }), [usuarios, texto, estado]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1">
          <Label htmlFor="buscar-usuario" className="text-xs text-muted-foreground">
            Buscar por nombre, email o empresa
          </Label>
          <Input id="buscar-usuario" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar…" />
        </div>
        <div className="w-52 space-y-1">
          <Label className="text-xs text-muted-foreground">Estado</Label>
          <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
            <SelectTrigger className="w-full" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              <SelectItem value="Activo">Activos</SelectItem>
              <SelectItem value="Invitado">Invitación pendiente</SelectItem>
              <SelectItem value="Suspendido">Suspendidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          {visibles.length} de {usuarios.length}
        </p>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{usuarios.length === 0 ? "Aún no hay usuarios invitados." : "Ningún usuario coincide con la búsqueda."}</p>
      ) : (
        <div className="space-y-6">
          {visibles.map((u) => (
            <FilaUsuario key={u.id} usuario={u} empresas={empresas} esUnoMismo={u.id === yoId} actorEsSuperAdmin={actorEsSuperAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
