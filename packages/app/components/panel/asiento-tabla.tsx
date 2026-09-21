import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AsientoVista = {
  correlativo: number;
  fecha: string;
  lineas: { cuenta: string; glosa: string | null; debe: number; haber: number }[];
  totalDebe: number;
  totalHaber: number;
};

const fmt = (n: number) => n.toLocaleString("es-CL");

/** Asiento contabilizado en solo lectura (usado por pagos y depósitos). */
export function AsientoTabla({ a, titulo }: { a: AsientoVista; titulo: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {titulo} N° {a.correlativo} · {a.fecha}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1">Cuenta</th>
              <th>Glosa</th>
              <th className="text-right">Debe</th>
              <th className="text-right">Haber</th>
            </tr>
          </thead>
          <tbody>
            {a.lineas.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="py-1.5">{l.cuenta}</td>
                <td className="text-muted-foreground">{l.glosa}</td>
                <td className="text-right tabular-nums">{l.debe ? fmt(l.debe) : ""}</td>
                <td className="text-right tabular-nums">{l.haber ? fmt(l.haber) : ""}</td>
              </tr>
            ))}
            <tr className="border-t font-medium">
              <td className="py-1.5" colSpan={2}>
                Total
              </td>
              <td className="text-right tabular-nums">{fmt(a.totalDebe)}</td>
              <td className="text-right tabular-nums">{fmt(a.totalHaber)}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
