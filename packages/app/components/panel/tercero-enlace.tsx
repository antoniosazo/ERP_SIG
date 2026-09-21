import type { ReactNode } from "react";
import { FlechaDetalle } from "@/components/panel/flecha-detalle";

/** Nombre del cliente/proveedor precedido de la flecha amarilla que abre su ficha (cuenta corriente incluida). */
export function TerceroEnlace({
  empresaId,
  terceroId,
  children,
}: {
  empresaId: string;
  terceroId: string | null | undefined;
  children: ReactNode;
}) {
  if (!terceroId) return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <FlechaDetalle href={`/panel/${empresaId}/maestros/terceros/${terceroId}`} title="Ver ficha y cuenta corriente" />
      <span>{children}</span>
    </span>
  );
}
