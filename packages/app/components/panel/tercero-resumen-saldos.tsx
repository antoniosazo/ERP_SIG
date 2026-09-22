import { saldosDeTerceros } from "@erp/db";
import { FlechaDetalle } from "@/components/panel/flecha-detalle";
import { Card, CardContent } from "@/components/ui/card";

const fmt = (n: number) => n.toLocaleString("es-CL");

/**
 * Nivel 1 (ficha del socio): solo el resumen de saldos. La flecha abre el nivel 2, el detalle de
 * la cuenta (facturas abiertas y movimientos).
 */
export async function TerceroResumenSaldos({
  empresaId,
  terceroId,
  tipoTercero,
  limiteCredito,
}: {
  empresaId: string;
  terceroId: string;
  tipoTercero: string;
  limiteCredito: number;
}) {
  const s = (await saldosDeTerceros(empresaId, new Date().toISOString().slice(0, 10), terceroId))[terceroId] ?? {
    porCobrar: 0,
    porPagar: 0,
  };
  const mostrarCobrar = tipoTercero === "Cliente" || s.porCobrar !== 0;
  const mostrarPagar = tipoTercero === "Proveedor" || s.porPagar !== 0;
  if (!mostrarCobrar && !mostrarPagar) return null;
  const href = `/panel/${empresaId}/maestros/terceros/${terceroId}/cuenta`;
  const disponible = limiteCredito > 0 ? limiteCredito - s.porCobrar : null;

  const tarjeta = (etiqueta: string, valor: number, nota?: string) => (
    <Card key={etiqueta}>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{etiqueta}</div>
        <div className={`flex items-center gap-1.5 text-lg font-semibold tabular-nums ${valor < 0 ? "text-destructive" : ""}`}>
          <FlechaDetalle href={href} title="Ver detalle de la cuenta" />
          {fmt(valor)}
        </div>
        {nota && <div className="text-xs text-muted-foreground">{nota}</div>}
      </CardContent>
    </Card>
  );

  // Un saldo "al revés" (anticipo) no es un problema: se relabela y se muestra en
  // positivo, en vez de un número negativo en rojo (mismo criterio que SAP B1).
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {mostrarCobrar &&
        tarjeta(s.porCobrar < 0 ? "A favor del cliente" : "Por cobrar (cliente)", Math.abs(s.porCobrar))}
      {mostrarPagar &&
        tarjeta(s.porPagar < 0 ? "A favor nuestro" : "Por pagar (proveedor)", Math.abs(s.porPagar))}
      {disponible !== null && mostrarCobrar && tarjeta("Crédito disponible", disponible, `Límite ${fmt(limiteCredito)}`)}
    </div>
  );
}
