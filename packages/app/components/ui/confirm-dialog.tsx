"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Modal de confirmación para acciones destructivas. Controlado por el padre
 * (`open`/`onOpenChange`); `onConfirm` puede ser async — mientras corre, el
 * botón de confirmar queda en estado `loading` y no se puede cerrar el modal.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = true,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}) {
  const [enCurso, setEnCurso] = React.useState(false)

  async function confirmar() {
    setEnCurso(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setEnCurso(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !enCurso && onOpenChange(v)}>
      <DialogContent className="max-w-sm" showCloseButton={!enCurso}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" size="md" disabled={enCurso} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={danger ? "danger" : "default"} size="md" loading={enCurso} onClick={confirmar}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
