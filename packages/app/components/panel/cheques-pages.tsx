import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listarCheques,
  listarCuentasBancariasEmpresa,
  listarDepositos,
  listarPlanCuentasDeEmpresa,
  obtenerDepositoConDetalle,
} from "@erp/db";
import { historialDepositoAction } from "@/lib/actions/cheques";
import { AsientoTabla } from "@/components/panel/asiento-tabla";
import { HistorialDocumentoDialog } from "@/components/panel/historial-documento-dialog";
import { ChequesLista } from "@/components/panel/cheques-lista";
import { DepositoAnularBoton } from "@/components/panel/deposito-anular-boton";
import { TerceroEnlace } from "@/components/panel/tercero-enlace";
import { VolverBoton } from "@/components/panel/volver-boton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TypographyHeading } from "@/components/ui/typography";

const fmt = (n: number) => n.toLocaleString("es-CL");

export async function ChequesPage({ empresaId, estado }: { empresaId: string; estado?: string }) {
  const filtro = ["en_cartera", "depositado", "protestado", "emitidos", "todos"].includes(estado ?? "")
    ? (estado as string)
    : "en_cartera";
  const [cheques, cuentas, plan] = await Promise.all([
    listarCheques(
      empresaId,
      filtro === "emitidos"
        ? { tipo: "Emitido" }
        : filtro === "todos"
          ? {}
          : { tipo: "Recibido", estado: filtro },
    ),
    listarCuentasBancariasEmpresa(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
  ]);
  return (
    <>
      <TypographyHeading
        title="Cheques"
        description="Los cheques nacen de los pagos: los recibidos quedan en cartera hasta depositarlos; si el banco los devuelve, se protestan y la deuda del cliente se reabre."
      />
      <ChequesLista
        empresaId={empresaId}
        filtro={filtro}
        filas={cheques.map((c) => ({
          id: c.id,
          tipo: c.tipo,
          numero: c.numero,
          tercero: c.tercero,
          terceroId: c.terceroId,
          banco: c.banco,
          monto: Number(c.monto),
          fechaEmision: c.fechaEmision,
          fechaCobro: c.fechaCobro,
          estado: c.estado,
          pagoId: c.pagoId,
          pagoNumero: c.pagoNumero,
          depositoId: c.depositoId,
          motivoProtesto: c.motivoProtesto,
        }))}
        cuentasBancarias={cuentas
          .filter((c) => c.activa)
          .map((c) => ({ id: c.id, label: `${c.bancoNombre} ${c.alias ?? c.numeroCuenta}` }))}
        cuentasGasto={plan
          .filter((c) => c.nivelImputable && c.activa && c.clase === "Costos y Gastos")
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
      />
    </>
  );
}

export async function DepositosPage({ empresaId }: { empresaId: string }) {
  const depositos = await listarDepositos(empresaId);
  const base = `/panel/${empresaId}/tesoreria/depositos`;
  return (
    <>
      <TypographyHeading
        title="Depósitos"
        description="Traspaso de cheques en cartera a una cuenta bancaria: banco al debe, cheques en cartera al haber."
      />
      {depositos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay depósitos. Se crean desde Cheques, seleccionando los que están en cartera.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">N°</TableHead>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Glosa</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {depositos.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono font-medium">
                    <Link href={`${base}/${d.id}`} className="hover:underline">
                      {d.numeroInterno}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{d.fecha}</TableCell>
                  <TableCell>
                    {d.banco} {d.cuentaAlias ?? d.cuentaNumero}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.glosa ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(Number(d.montoTotal))}</TableCell>
                  <TableCell>
                    <Badge variant={d.estado === "contabilizado" ? "default" : "secondary"}>
                      {d.estado === "contabilizado" ? "Contabilizado" : "Anulado"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

export async function DepositoDetallePage({ empresaId, depositoId }: { empresaId: string; depositoId: string }) {
  const d = await obtenerDepositoConDetalle(depositoId, empresaId);
  if (!d) notFound();
  const { deposito, cuenta, cheques, asiento, reversa } = d;
  const anulado = deposito.estado === "anulado";
  return (
    <>
      <VolverBoton fallbackHref={`/panel/${empresaId}/tesoreria/depositos`} />
      <TypographyHeading
        title={`Depósito ${deposito.numeroInterno}`}
        description={`${cuenta?.banco ?? ""} ${cuenta?.alias ?? cuenta?.numeroCuenta ?? ""}`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={anulado ? "secondary" : "default"}>{anulado ? "Anulado" : "Contabilizado"}</Badge>
        {!anulado && <DepositoAnularBoton empresaId={empresaId} depositoId={deposito.id} />}
        <HistorialDocumentoDialog empresaId={empresaId} docId={deposito.id} historial={historialDepositoAction} />
        {anulado && deposito.motivoAnulacion && (
          <span className="text-sm text-muted-foreground">Motivo: {deposito.motivoAnulacion}</span>
        )}
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Fecha</div>
            <div className="text-sm">{deposito.fecha}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total depositado</div>
            <div className="text-sm">{fmt(Number(deposito.montoTotal))}</div>
          </div>
          {deposito.glosa && (
            <div>
              <div className="text-xs text-muted-foreground">Glosa</div>
              <div className="text-sm">{deposito.glosa}</div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cheques del depósito</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">N° cheque</th>
                <th>Cliente</th>
                <th>Banco</th>
                <th>Estado actual</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-1.5 font-mono">{c.numero}</td>
                  <td>
                    <TerceroEnlace empresaId={empresaId} terceroId={c.terceroId}>
                      {c.tercero}
                    </TerceroEnlace>
                  </td>
                  <td className="text-muted-foreground">{c.banco ?? "—"}</td>
                  <td>{c.estado}</td>
                  <td className="text-right tabular-nums">{fmt(Number(c.monto))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {asiento && <AsientoTabla a={asiento} titulo="Asiento" />}
      {reversa && <AsientoTabla a={reversa} titulo="Asiento de reversa" />}
    </>
  );
}
