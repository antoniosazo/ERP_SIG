"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PagoTipo } from "@erp/shared";
import { documentosAbiertosAction, registrarPagoAction } from "@/lib/actions/pagos";
import { PAGO_META } from "@/lib/pagos";
import { VolverBoton } from "@/components/panel/volver-boton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Opcion = { id: string; label: string };
export type MetodoOpcion = { id: string; nombre: string; tipo: string };
type DocAbierto = {
  id: string;
  numeroInterno: string | null;
  folio: string | null;
  tipo: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  total: number;
  saldo: number;
};
type MedioForm = {
  clave: number;
  metodoPagoId: string;
  monto: string;
  referencia: string;
  chequeNumero: string;
  chequeBancoId: string;
  fechaCobro: string;
};

const fmt = (n: number) => n.toLocaleString("es-CL");
const hoy = () => new Date().toISOString().slice(0, 10);
const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function PagoForm({
  empresaId,
  tipo,
  terceros,
  metodos,
  bancos,
}: {
  empresaId: string;
  tipo: PagoTipo;
  terceros: Opcion[];
  metodos: MetodoOpcion[];
  bancos: Opcion[];
}) {
  const meta = PAGO_META[tipo];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [terceroId, setTerceroId] = useState("");
  const [fechaPago, setFechaPago] = useState(hoy());
  const [fechaContab, setFechaContab] = useState(hoy());
  const [glosa, setGlosa] = useState("");
  const [referencia, setReferencia] = useState("");
  const [docs, setDocs] = useState<DocAbierto[]>([]);
  const [cargandoDocs, setCargandoDocs] = useState(false);
  const [seleccion, setSeleccion] = useState<Record<string, string>>({}); // documentoId → monto
  const [medios, setMedios] = useState<MedioForm[]>([nuevoMedio(1)]);
  const [medioManual, setMedioManual] = useState(false);

  function nuevoMedio(clave: number): MedioForm {
    return { clave, metodoPagoId: "", monto: "", referencia: "", chequeNumero: "", chequeBancoId: "", fechaCobro: "" };
  }

  function elegirTercero(id: string) {
    setTerceroId(id);
    setDocs([]);
    setSeleccion({});
    setCargandoDocs(true);
    documentosAbiertosAction(empresaId, tipo, id).then((r) => {
      setCargandoDocs(false);
      if (r.ok) setDocs(r.documentos);
      else toast.error(r.error);
    });
  }

  const totalAplicado = useMemo(
    () => Object.values(seleccion).reduce((a, m) => a + num(m), 0),
    [seleccion],
  );
  // Con un solo medio y sin edición manual, su monto es lo aplicado a documentos.
  const montoAutomatico = medios.length === 1 && !medioManual;
  const montoDe = (m: MedioForm) =>
    montoAutomatico ? (totalAplicado ? String(totalAplicado) : "") : m.monto;
  const totalMedios = medios.reduce((a, m) => a + num(montoDe(m)), 0);

  const anticipo = Math.max(totalMedios - totalAplicado, 0);
  const faltante = totalAplicado - totalMedios;

  function alternarDoc(d: DocAbierto) {
    setSeleccion((prev) => {
      const n = { ...prev };
      if (d.id in n) delete n[d.id];
      else n[d.id] = String(d.saldo);
      return n;
    });
  }

  function actualizarMedio(clave: number, cambio: Partial<MedioForm>) {
    setMedios((prev) => prev.map((m) => (m.clave === clave ? { ...m, ...cambio } : m)));
  }

  function registrar() {
    if (!terceroId) return toast.error(`Selecciona un ${meta.tercero.toLowerCase()}.`);
    startTransition(async () => {
      const r = await registrarPagoAction(empresaId, {
        tipo,
        terceroId,
        fechaPago,
        fechaContabilizacion: fechaContab,
        glosa: glosa || null,
        referencia: referencia || null,
        medios: medios.map((m) => ({
          metodoPagoId: m.metodoPagoId,
          monto: num(montoDe(m)),
          referencia: m.referencia || null,
          chequeNumero: m.chequeNumero || null,
          chequeBancoId: m.chequeBancoId || null,
          fechaCobro: m.fechaCobro || null,
        })),
        aplicaciones: Object.entries(seleccion).map(([documentoId, monto]) => ({ documentoId, monto: num(monto) })),
      });
      if (r.ok) {
        toast.success(`${meta.singular[0]!.toUpperCase()}${meta.singular.slice(1)} registrado y contabilizado.`);
        router.push(`/panel/${empresaId}/tesoreria/${meta.slug}/${r.pagoId}`);
      } else toast.error(r.error);
    });
  }

  const tipoMetodo = new Map(metodos.map((m) => [m.id, m.tipo]));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del {meta.singular}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>{meta.tercero}</Label>
            <Select value={terceroId || undefined} onValueChange={elegirTercero}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Selecciona un ${meta.tercero.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {terceros.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaPago">Fecha del {meta.accion}</Label>
            <Input
              id="fechaPago"
              type="date"
              value={fechaPago}
              onChange={(e) => {
                if (fechaContab === fechaPago) setFechaContab(e.target.value);
                setFechaPago(e.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaContab">Fecha de contabilización</Label>
            <Input id="fechaContab" type="date" value={fechaContab} onChange={(e) => setFechaContab(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="glosa">Glosa (opcional)</Label>
            <Input id="glosa" value={glosa} onChange={(e) => setGlosa(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ref">Referencia (opcional)</Label>
            <Input id="ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {tipo === "Recibido" ? "Facturas pendientes de cobro" : "Facturas pendientes de pago"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!terceroId ? (
            <p className="text-sm text-muted-foreground">Selecciona un {meta.tercero.toLowerCase()} para ver sus documentos abiertos.</p>
          ) : cargandoDocs ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tiene documentos con saldo. Si registras el {meta.accion} igual, quedará como anticipo.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2">Documento</th>
                    <th className="px-3 py-2">Folio</th>
                    <th className="px-3 py-2">Emisión</th>
                    <th className="px-3 py-2">Vencimiento</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                    <th className="w-40 px-3 py-2 text-right">A {meta.accion === "cobro" ? "cobrar" : "pagar"}</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => {
                    const marcado = d.id in seleccion;
                    const vencido = d.fechaVencimiento && d.fechaVencimiento < hoy();
                    return (
                      <tr key={d.id} className="border-t">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={marcado} onChange={() => alternarDoc(d)} aria-label={`Seleccionar ${d.numeroInterno ?? d.folio}`} />
                        </td>
                        <td className="px-3 py-2">
                          {d.tipo} <span className="font-mono text-muted-foreground">{d.numeroInterno}</span>
                        </td>
                        <td className="px-3 py-2 font-mono">{d.folio ?? "—"}</td>
                        <td className="px-3 py-2">{d.fechaEmision}</td>
                        <td className={`px-3 py-2 ${vencido ? "text-destructive" : ""}`}>{d.fechaVencimiento ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(d.total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(d.saldo)}</td>
                        <td className="px-3 py-2 text-right">
                          {marcado && (
                            <Input
                              type="number"
                              className="ml-auto h-8 w-32 text-right"
                              value={seleccion[d.id]}
                              min={0}
                              max={d.saldo}
                              onChange={(e) => setSeleccion((prev) => ({ ...prev, [d.id]: e.target.value }))}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medios de {meta.accion === "cobro" ? "cobro" : "pago"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metodos.length === 0 && (
            <p className="text-sm text-destructive">
              No hay métodos de pago activos para este sentido. Créalos en Configuración → Métodos de pago.
            </p>
          )}
          {medios.map((m) => {
            const t = tipoMetodo.get(m.metodoPagoId);
            return (
              <div key={m.clave} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Método</Label>
                  <Select value={m.metodoPagoId || undefined} onValueChange={(v) => actualizarMedio(m.clave, { metodoPagoId: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {metodos.map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    className="text-right"
                    value={montoDe(m)}
                    onChange={(e) => {
                      setMedioManual(true);
                      actualizarMedio(m.clave, { monto: e.target.value });
                    }}
                  />
                </div>
                {t === "Cheque" ? (
                  <>
                    <div className="space-y-2">
                      <Label>N° de cheque</Label>
                      <Input value={m.chequeNumero} onChange={(e) => actualizarMedio(m.clave, { chequeNumero: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha de cobro</Label>
                      <Input type="date" value={m.fechaCobro} onChange={(e) => actualizarMedio(m.clave, { fechaCobro: e.target.value })} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Banco del cheque</Label>
                      <Select value={m.chequeBancoId || undefined} onValueChange={(v) => actualizarMedio(m.clave, { chequeBancoId: v })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Opcional" />
                        </SelectTrigger>
                        <SelectContent>
                          {bancos.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>{t === "Transferencia" ? "N° de transferencia / comprobante" : "Referencia (opcional)"}</Label>
                    <Input value={m.referencia} onChange={(e) => actualizarMedio(m.clave, { referencia: e.target.value })} />
                  </div>
                )}
                {medios.length > 1 && (
                  <div className="flex items-end sm:col-span-2 lg:col-span-4">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setMedios((prev) => prev.filter((x) => x.clave !== m.clave))}>
                      Quitar medio
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              // Al pasar a modo manual el primer medio conserva el monto automático que tenía.
              setMedios((prev) => [
                ...prev.map((x) => ({ ...x, monto: montoDe(x) })),
                nuevoMedio(Math.max(...prev.map((x) => x.clave)) + 1),
              ]);
              setMedioManual(true);
            }}
          >
            + Agregar otro medio
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-8">
            <span className="text-muted-foreground">Aplicado a documentos</span>
            <span className="tabular-nums">{fmt(totalAplicado)}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-muted-foreground">Total medios de {meta.accion === "cobro" ? "cobro" : "pago"}</span>
            <span className="tabular-nums">{fmt(totalMedios)}</span>
          </div>
          {anticipo > 0 && (
            <div className="flex justify-between gap-8 text-amber-600">
              <span>Anticipo (sin documento)</span>
              <span className="tabular-nums">{fmt(anticipo)}</span>
            </div>
          )}
          {faltante > 0.005 && (
            <div className="flex justify-between gap-8 text-destructive">
              <span>Faltan medios por</span>
              <span className="tabular-nums">{fmt(faltante)}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <VolverBoton fallbackHref={`/panel/${empresaId}/tesoreria/${meta.slug}`} />
          <Button onClick={registrar} disabled={isPending || totalMedios <= 0 || faltante > 0.005}>
            {isPending ? "Registrando…" : `Registrar y contabilizar`}
          </Button>
        </div>
      </div>
    </div>
  );
}
