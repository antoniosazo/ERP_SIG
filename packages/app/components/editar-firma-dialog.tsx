"use client";

import { useState } from "react";
import type { ActualizarFirmaContableInput } from "@erp/shared";
import { EditarFirmaForm } from "@/components/editar-firma-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function EditarFirmaDialog({
  firmaId,
  razonSocial,
  valoresIniciales,
}: {
  firmaId: string;
  razonSocial: string;
  valoresIniciales: ActualizarFirmaContableInput;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setAbierto(true)}>
        Editar
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Administrar {razonSocial}</DialogTitle>
            <DialogDescription>Modifica la razón social, el plan o el acceso de la firma.</DialogDescription>
          </DialogHeader>
          {abierto && (
            <EditarFirmaForm
              firmaId={firmaId}
              valoresIniciales={valoresIniciales}
              onSaved={() => setAbierto(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
