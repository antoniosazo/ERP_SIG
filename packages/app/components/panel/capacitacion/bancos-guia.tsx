"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, CheckCircle2Icon, LandmarkIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const pasos = [
  {
    titulo: "Prepara tu cuenta",
    resumen: "Comprueba dónde vas a cargar los movimientos.",
    instrucciones: [
      "Verifica que estás trabajando en la empresa correcta.",
      "En Cuentas bancarias, revisa el banco, el número de cuenta y que la cuenta esté activa y vinculada a su cuenta contable.",
      "Revisa el saldo inicial conciliado y su fecha con la persona responsable de contabilidad. Es el punto de partida de la cuenta; los saldos de cada cartola se ingresan al importar.",
    ],
    consejo: "Si tu cuenta no aparece al importar, revisa primero que esté activa.",
    enlace: "/configuracion/cuentas-bancarias",
    accion: "Ver cuentas bancarias",
  },
  {
    titulo: "Revisa la plantilla",
    resumen: "La plantilla indica cómo leer el archivo de tu banco.",
    instrucciones: [
      "Busca una plantilla para el banco y el formato de archivo que descargaste. Puedes usar Excel (.xlsx o .xls), CSV o TXT.",
      "Si hay que crear una, identifica las columnas de fecha, descripción, cargos y abonos. Revisa también los formatos de fecha y de número y las filas de encabezado o totales que se deben omitir.",
      "Si el archivo trae un único monto con signo, la plantilla debe usar esa opción: positivo para abonos y negativo para cargos.",
    ],
    consejo: "La plantilla se puede reutilizar mientras el banco mantenga el mismo formato. Si tienes dudas al configurarla, pide ayuda al responsable de tu empresa.",
    enlace: "/configuracion/cartolas-formatos",
    accion: "Ver formatos de cartola",
  },
  {
    titulo: "Carga el archivo",
    resumen: "Ten a mano los saldos que aparecen en la cartola del banco.",
    instrucciones: [
      "Abre Importar cartola y selecciona la cuenta bancaria. Verás las plantillas del banco de esa cuenta.",
      "Selecciona la plantilla y el archivo descargado del banco.",
      "Ingresa el saldo inicial declarado y el saldo final declarado de esa cartola. Luego pulsa Previsualizar.",
    ],
    consejo: "En la vista previa aún no has guardado los movimientos. Puedes revisar el resultado antes de confirmar.",
    enlace: "/tesoreria/cartolas/importar",
    accion: "Ir a importar cartola",
  },
  {
    titulo: "Revisa el resultado",
    resumen: "Comprueba los montos y el estado de cada movimiento.",
    instrucciones: [
      "Revisa que las fechas, descripciones y montos coincidan con el archivo del banco.",
      "Nuevo significa que el movimiento se agregará. Ya importado significa que el sistema lo reconoce y lo omitirá.",
      "Comprueba la cuadratura: saldo inicial + abonos − cargos = saldo final. Si hay errores, corrige su causa y vuelve a previsualizar.",
    ],
    consejo: "Un aviso de saldo distinto al de la cartola anterior puede indicar que falta un período. Revísalo, aunque el aviso permita continuar.",
    enlace: "/tesoreria/cartolas/importar",
    accion: "Abrir importación",
  },
  {
    titulo: "Confirma y consulta",
    resumen: "Guarda los movimientos nuevos cuando hayas terminado la revisión.",
    instrucciones: [
      "Cuando el estado sea Lista para confirmar, pulsa Confirmar importación.",
      "El sistema informa cuántos movimientos nuevos guardó y abre el detalle de la cartola.",
      "Puedes volver a Tesorería → Cartolas para consultar las cartolas cargadas. Si todos los movimientos ya estaban importados, no se crea una nueva importación.",
    ],
    consejo: "Importar una cartola registra lo que informa el banco. No genera asientos ni marca facturas como pagadas; los pagos se registran en Tesorería.",
    enlace: "/tesoreria/cartolas",
    accion: "Consultar cartolas",
  },
] as const;

const preparacion = [
  "Estoy en la empresa y cuenta bancaria correctas.",
  "Tengo el archivo del banco y una plantilla para leerlo.",
  "Tengo los saldos inicial y final de la cartola.",
];

const preguntas = [
  ["La cartola no cuadra. ¿Qué reviso?", "Compara los saldos ingresados con los del banco. Después revisa que la plantilla lea todos los movimientos, omita las filas de totales e interprete bien los cargos y abonos. No cambies un saldo solo para hacer coincidir el resultado; corrige el dato o la plantilla y vuelve a previsualizar."],
  ["Aparece «Ya importado». ¿Tengo que borrar esa fila?", "No hace falta. El sistema omite los movimientos que reconoce como repetidos y guarda los nuevos. Compara cuenta, fecha, monto, número de documento y descripción; si cambias esos datos, podría dejar de reconocer un movimiento repetido. Si todos están repetidos, la importación se rechaza."],
  ["El período está bloqueado o no existe. ¿Cómo sigo?", "Verifica primero la fecha del movimiento. Si es correcta, pide al responsable contable que revise el ejercicio y el estado del período. Una fecha sin período generado o con el período totalmente bloqueado impide importar. No cambies la fecha del banco para sortear el mensaje."],
  ["El saldo inicial no coincide con la cartola anterior.", "Revisa si falta una cartola intermedia o si seleccionaste otra cuenta. Este aviso permite continuar, pero conviene aclarar la diferencia con el responsable antes de confirmar."],
  ["No encuentro una plantilla para mi banco.", "Abre Formatos de cartola y configura una para el archivo que descargaste, o pide ayuda al responsable. En archivos por columnas, la primera columna se indica con 0, la segunda con 1, y así sucesivamente. En TXT de ancho fijo se indica la posición y el largo de cada campo."],
  ["¿Cómo agrego un movimiento sin archivo?", "En Tesorería → Cartolas, pulsa Movimiento manual. Selecciona la cuenta, completa fecha, descripción y monto; el número de documento es opcional. Usa un monto negativo para un cargo (por ejemplo, −5.000 por una comisión) y positivo para un abono. Pulsa Agregar. Esto registra el movimiento bancario, sin generar un asiento."],
  ["¿Importar una cartola paga mis facturas o concilia el banco?", "No. La cartola guarda los movimientos informados por el banco. Los pagos recibidos y efectuados se registran por separado en Tesorería. La conciliación bancaria aún no está disponible en este módulo."],
  ["¿Qué significan cargo, abono y cuadratura?", "Un cargo es dinero que sale de la cuenta; un abono es dinero que entra. La cuadratura comprueba que el saldo inicial, más lo que entró y menos lo que salió, coincide con el saldo final del banco."],
] as const;

const pesos = (valor: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(valor);

export function BancosGuia({ empresaId }: { empresaId: string }) {
  const [paso, setPaso] = useState(0);
  const [preparados, setPreparados] = useState<number[]>([]);
  const [saldo, setSaldo] = useState("");
  const [respuesta, setRespuesta] = useState<"correcta" | "revisar" | null>(null);
  const actual = pasos[paso]!;
  const base = `/panel/${empresaId}`;

  return (
    <div className="max-w-5xl space-y-6">
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-7" aria-labelledby="bancos-bienvenida">
        <div className="flex items-start gap-4">
          <div className="hidden rounded-xl bg-primary/10 p-3 text-primary sm:block"><LandmarkIcon className="size-6" aria-hidden="true" /></div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Guía práctica · Cartolas bancarias</p>
            <h2 id="bancos-bienvenida" className="text-xl font-semibold tracking-tight sm:text-2xl">Tu primera cartola, paso a paso</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Aprende a cargar los movimientos de tu banco y a comprobar que todo coincide. Sigue la guía a tu ritmo o ve directamente a la duda que necesitas resolver.</p>
            <p className="text-sm">Una cartola es el resumen de entradas y salidas de dinero de tu cuenta bancaria.</p>
          </div>
        </div>
      </section>

      <Tabs defaultValue="guia">
        <TabsList className="flex-wrap gap-x-5 gap-y-0" aria-label="Contenido de la guía de bancos">
          <TabsTrigger value="guia" className="focus-visible:ring-2 focus-visible:ring-ring">Paso a paso</TabsTrigger>
          <TabsTrigger value="practica" className="focus-visible:ring-2 focus-visible:ring-ring">Practicar cuadratura</TabsTrigger>
          <TabsTrigger value="ayuda" className="focus-visible:ring-2 focus-visible:ring-ring">Resolver dudas</TabsTrigger>
        </TabsList>

        <TabsContent value="guia" className="space-y-5">
          <section className="rounded-xl border bg-card p-5" aria-labelledby="bancos-preparacion">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="bancos-preparacion" className="font-semibold">Antes de empezar</h2>
              <span className="text-xs text-muted-foreground" role="status">{preparados.length} de {preparacion.length} listos</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Marca lo que ya tienes preparado. Estas marcas se reinician al salir de la página.</p>
            <div className="mt-4 space-y-3">
              {preparacion.map((texto, indice) => (
                <label key={texto} className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring" checked={preparados.includes(indice)} onChange={(e) => {
                    const marcado = e.target.checked;
                    setPreparados((prev) => marcado ? [...prev, indice] : prev.filter((i) => i !== indice));
                  }} />
                  {texto}
                </label>
              ))}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
            <nav aria-label="Pasos para importar una cartola" className="space-y-2">
              {pasos.map((item, indice) => (
                <button key={item.titulo} type="button" aria-current={paso === indice ? "step" : undefined} aria-controls="bancos-paso" onClick={() => setPaso(indice)} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", paso === indice ? "border-primary/30 bg-primary/10 font-medium text-primary" : "border-transparent hover:bg-muted")}>
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", paso === indice ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{indice + 1}</span>
                  {item.titulo}
                </button>
              ))}
            </nav>

            <section id="bancos-paso" className="flex flex-col rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="bancos-paso-titulo">
              <div aria-live="polite" aria-atomic="true">
                <p className="text-xs font-medium text-primary">Paso {paso + 1} de {pasos.length}</p>
                <h2 id="bancos-paso-titulo" className="mt-2 text-lg font-semibold">{actual.titulo}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{actual.resumen}</p>
                <ol className="my-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed marker:text-muted-foreground">
                  {actual.instrucciones.map((texto) => <li key={texto} className="pl-1">{texto}</li>)}
                </ol>
                <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-4 text-sm leading-relaxed">
                  <BookOpenIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <p>{actual.consejo}</p>
                </div>
              </div>
              <div className="mt-5">
                <Button variant="outline" asChild><Link href={`${base}${actual.enlace}`} target="_blank" rel="noopener noreferrer">{actual.accion}<ArrowRightIcon aria-hidden="true" /><span className="sr-only"> (abre otra pestaña)</span></Link></Button>
                <p className="mt-2 text-xs text-muted-foreground">Se abre en otra pestaña para que puedas seguir esta guía.</p>
              </div>
              <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
                <Button variant="ghost" disabled={paso === 0} onClick={() => setPaso((prev) => prev - 1)}><ArrowLeftIcon aria-hidden="true" />Anterior</Button>
                {paso < pasos.length - 1 ? <Button onClick={() => setPaso((prev) => prev + 1)}>Siguiente<ArrowRightIcon aria-hidden="true" /></Button> : <Button variant="ghost" onClick={() => setPaso(0)}><RotateCcwIcon aria-hidden="true" />Volver al inicio</Button>}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="practica">
          <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="bancos-practica">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Ejercicio de práctica</p>
            <h2 id="bancos-practica" className="mt-2 text-lg font-semibold">¿Con qué saldo termina esta cartola?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Son datos de ejemplo en pesos chilenos. Puedes probar las veces que quieras; no se guardan movimientos.</p>
            <div className="my-6 grid gap-3 sm:grid-cols-3">
              {([["Saldo inicial", 1000000], ["Abonos · dinero que entra", 350000], ["Cargos · dinero que sale", 120000]] as const).map(([etiqueta, valor]) => (
                <div key={etiqueta} className="rounded-lg bg-muted/60 p-4"><p className="text-xs text-muted-foreground">{etiqueta}</p><p className="mt-2 text-xl font-semibold tabular-nums">{pesos(valor)}</p></div>
              ))}
            </div>
            <p className="rounded-lg border border-dashed p-4 text-center text-sm font-medium">Saldo inicial + abonos − cargos = saldo final</p>
            <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); setRespuesta(Number(saldo) === 1230000 ? "correcta" : "revisar"); }}>
              <div className="max-w-sm space-y-2">
                <Label htmlFor="bancos-saldo-ejercicio">Tu saldo final (CLP)</Label>
                <Input id="bancos-saldo-ejercicio" type="number" step="1" required value={saldo} placeholder="Escribe el resultado" aria-describedby="bancos-saldo-ayuda" onChange={(e) => { setSaldo(e.target.value); setRespuesta(null); }} />
                <p id="bancos-saldo-ayuda" className="text-xs text-muted-foreground">Ingresa pesos enteros, sin puntos ni comas.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Comprobar respuesta</Button>
                <Button type="button" variant="ghost" onClick={() => { setSaldo(""); setRespuesta(null); }}><RotateCcwIcon aria-hidden="true" />Reiniciar</Button>
              </div>
              <div role="status" aria-live="polite">
                {respuesta && (
                  <div className={cn("rounded-lg border p-4 text-sm leading-relaxed", respuesta === "correcta" ? "border-primary/30 bg-primary/5" : "border-border bg-muted/60")}>
                    <p className="flex items-center gap-2 font-semibold">{respuesta === "correcta" && <CheckCircle2Icon className="size-4 text-primary" aria-hidden="true" />}{respuesta === "correcta" ? "¡Correcto! La cartola cuadra." : "Todavía hay una diferencia."}</p>
                    <p className="mt-1">{respuesta === "correcta" ? "El saldo final es $1.230.000. Al importar una cartola real, revisa también los estados de las filas antes de confirmar." : `Suma $350.000 al saldo inicial de $1.000.000 y después resta $120.000. Tu respuesta difiere en ${pesos(Math.abs(Number(saldo) - 1230000))}. Inténtalo otra vez.`}</p>
                  </div>
                )}
              </div>
            </form>
          </section>
        </TabsContent>

        <TabsContent value="ayuda" className="space-y-4">
          <div><h2 className="text-lg font-semibold">Encuentra el siguiente paso</h2><p className="mt-1 text-sm text-muted-foreground">Abre una pregunta para ver qué significa el mensaje y cómo resolverlo.</p></div>
          <div className="space-y-3">
            {preguntas.map(([pregunta, respuesta]) => (
              <details key={pregunta} className="rounded-xl border bg-card open:border-primary/30">
                <summary className="cursor-pointer rounded-xl p-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{pregunta}</summary>
                <p className="px-4 pb-5 text-sm leading-relaxed text-muted-foreground">{respuesta}</p>
              </details>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link href={`${base}/tesoreria/cartolas`}>Consultar cartolas<ArrowRightIcon aria-hidden="true" /></Link></Button>
            <Button variant="outline" asChild><Link href={`${base}/configuracion/cartolas-formatos`}>Ver formatos de cartola<ArrowRightIcon aria-hidden="true" /></Link></Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
