"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, Settings2Icon } from "lucide-react";
import { toast } from "sonner";
import type { ConfigFormularioDoc } from "@erp/shared";
import { guardarConfigFormularioDocVentaAction } from "@/lib/actions/preferencias";
import {
  aplicarConfig,
  CAMPOS_CABECERA,
  CAMPOS_LINEA,
  CONFIG_VACIA,
  type CampoResuelto,
} from "@/lib/documento-venta-campos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Setter = (f: (prev: CampoResuelto[]) => CampoResuelto[]) => void;

function Seccion({
  titulo,
  items,
  setItems,
}: {
  titulo: string;
  items: CampoResuelto[];
  setItems: Setter;
}) {
  function mover(i: number, delta: number) {
    setItems((prev) => {
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }
  function toggle(id: string) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{titulo}</p>
      <ul className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
        {items.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <input
              type="checkbox"
              className="size-4 shrink-0"
              checked={c.visible}
              disabled={c.estructural}
              onChange={() => toggle(c.id)}
            />
            <span className={c.visible ? "" : "text-muted-foreground line-through"}>{c.label}</span>
            <div className="ml-auto flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => mover(i, -1)}
                disabled={i === 0}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => mover(i, 1)}
                disabled={i === items.length - 1}
              >
                <ArrowDownIcon />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Diálogo de "Configuración de formulario": orden y visibilidad de campos, por usuario. */
export function ConfigFormularioDialog({ config }: { config: ConfigFormularioDoc }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [cabecera, setCabecera] = useState<CampoResuelto[]>([]);
  const [linea, setLinea] = useState<CampoResuelto[]>([]);

  function abrir() {
    setCabecera(aplicarConfig(CAMPOS_CABECERA, config.cabecera));
    setLinea(aplicarConfig(CAMPOS_LINEA, config.linea));
    setAbierto(true);
  }

  function guardar(nueva: ConfigFormularioDoc) {
    startTransition(async () => {
      const r = await guardarConfigFormularioDocVentaAction(nueva);
      if (r.ok) {
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function onGuardar() {
    const aConfig = (items: CampoResuelto[]) => ({
      orden: items.map((c) => c.id),
      ocultos: items.filter((c) => !c.visible && !c.estructural).map((c) => c.id),
    });
    guardar({ cabecera: aConfig(cabecera), linea: aConfig(linea) });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={abrir}
        title="Configurar campos"
        aria-label="Configurar campos"
      >
        <Settings2Icon />
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuración de formulario</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Seccion titulo="Cabecera" items={cabecera} setItems={setCabecera} />
            <Seccion titulo="Líneas" items={linea} setItems={setLinea} />
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => guardar(CONFIG_VACIA)}
              disabled={isPending}
            >
              Restablecer
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={onGuardar} disabled={isPending}>
                {isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
