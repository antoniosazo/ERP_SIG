import Link from "next/link";
import { listarEntradasPendientesFacturar, listarTerceros } from "@erp/db";
import { TypographyHeading } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ConciliacionGrIrPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [entradas, terceros] = await Promise.all([
    listarEntradasPendientesFacturar(empresaId),
    listarTerceros(empresaId),
  ]);
  const provNombre = new Map(terceros.map((t) => [t.id, t.razonSocial]));
  const total = entradas.reduce((a, e) => a + e.valorPendiente, 0);

  return (
    <>
      <TypographyHeading
        title="Conciliación GR-IR"
        description="Entradas de mercadería contabilizadas y aún no facturadas. El total es el saldo vivo de la cuenta puente GR-IR y debe cuadrar contra el mayor."
      />
      {entradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay recepciones pendientes de facturar.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">N° interno</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Valor pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entradas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono font-medium">
                    <Link
                      href={`/panel/${empresaId}/compras/documentos/${e.id}`}
                      className="hover:underline"
                    >
                      {e.numeroInterno ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{provNombre.get(e.terceroId) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {e.fechaEmision}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.valorPendiente.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell colSpan={3} className="text-right">
                  Saldo GR-IR
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {total.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
