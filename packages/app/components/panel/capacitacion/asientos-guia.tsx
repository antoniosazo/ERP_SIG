"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  RotateCcwIcon,
  ScaleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const pasos = [
  {
    titulo: "Consulta el libro diario",
    resumen: "Busca asientos manuales y automáticos desde un mismo lugar.",
    instrucciones: [
      "Abre Finanzas → Asientos y confirma que estás trabajando en la empresa correcta.",
      "Usa las fechas, el origen, el estado o la búsqueda para encontrar un asiento. Puedes buscar por número, glosa o referencia.",
      "Abre el número del asiento para revisar su cabecera y sus líneas. Desde el detalle puedes ir a la cuenta, socio, centro de costo o documento relacionado.",
    ],
    consejo: "Si llegaste al detalle desde un listado filtrado, Volver al listado conserva esos filtros.",
    enlace: "/contabilidad/asientos",
    accion: "Abrir libro diario",
  },
  {
    titulo: "Prepara la cabecera",
    resumen: "Define cuándo y por qué se registrará el movimiento.",
    instrucciones: [
      "Pulsa Nuevo asiento y selecciona la fecha de contabilización. Esa fecha determina el período contable.",
      "Elige el tipo de asiento y completa una glosa clara. La referencia es opcional y sirve para identificar un respaldo o número interno.",
      "Si la empresa utiliza más de un libro, selecciona Tributario, IFRS o Ambos según la instrucción del responsable contable.",
    ],
    consejo: "No cambies la fecha para evitar un período bloqueado. Pide al responsable contable que revise el período.",
    enlace: "/contabilidad/asientos/nuevo",
    accion: "Crear un asiento",
  },
  {
    titulo: "Completa las líneas",
    resumen: "Registra las cuentas y montos que forman la partida doble.",
    instrucciones: [
      "Agrega una línea por cada cuenta afectada. En cada línea escribe un monto en Debe o en Haber, nunca en ambos.",
      "Selecciona un socio cuando la cuenta controla clientes o proveedores. Si eliges solo el socio, el sistema utiliza su cuenta asociada.",
      "Completa centro de costo o análisis por tercero cuando la cuenta lo solicite. El sistema propone en la nueva línea el monto que falta para cuadrar.",
    ],
    consejo: "Antes de contabilizar, confirma que el total Debe sea igual al total Haber y que cada glosa permita entender el movimiento.",
    enlace: "/contabilidad/asientos/nuevo",
    accion: "Practicar en un asiento nuevo",
  },
  {
    titulo: "Guarda o contabiliza",
    resumen: "Decide si el asiento está listo para afectar la contabilidad.",
    instrucciones: [
      "Usa Guardar borrador si todavía falta revisar información. El borrador no afecta saldos ni utiliza un número definitivo.",
      "Abre nuevamente el borrador para editar sus datos o eliminarlo. Puede quedar temporalmente descuadrado.",
      "Usa Contabilizar solo después de revisar fecha, cuentas, socios, centros de costo, glosas y cuadratura. El sistema asigna el número definitivo.",
    ],
    consejo: "Un asiento contabilizado ya no se edita ni se elimina; las correcciones se hacen mediante una reversa.",
    enlace: "/contabilidad/asientos",
    accion: "Revisar borradores",
  },
  {
    titulo: "Corrige sin perder el historial",
    resumen: "Revierte el efecto del asiento y conserva la trazabilidad.",
    instrucciones: [
      "Abre el asiento contabilizado y pulsa Anular. Indica la fecha y explica el motivo de la corrección.",
      "El sistema crea una reversa con Debe y Haber invertidos. El asiento original y la reversa quedan vinculados y se neutralizan en los saldos.",
      "Si necesitas volver a registrar la operación, usa Duplicar, corrige el nuevo asiento y revísalo antes de contabilizar.",
    ],
    consejo: "Los asientos automáticos se corrigen desde la factura, pago, cheque, activo fijo u otro documento que los originó.",
    enlace: "/contabilidad/asientos",
    accion: "Consultar asientos",
  },
  {
    titulo: "Programa y revisa reversiones",
    resumen: "Útil para provisiones que deben neutralizarse en una fecha posterior.",
    instrucciones: [
      "Al crear el asiento, activa Programar reversión e indica una fecha posterior a la fecha de contabilización.",
      "Cuando llegue esa fecha, el libro diario mostrará las reversiones pendientes. Revisa la lista antes de ejecutarlas.",
      "Pulsa Ejecutar reversiones. Si un período está bloqueado, esa reversa se informa y permanece pendiente hasta resolverlo.",
    ],
    consejo: "La ejecución conserva quién realizó la operación, el asiento original y la reversa creada.",
    enlace: "/contabilidad/asientos",
    accion: "Revisar reversiones",
  },
] as const;

const preparacion = [
  "Confirmé la empresa y la fecha de contabilización.",
  "Tengo el respaldo y una glosa que explica el movimiento.",
  "Conozco las cuentas, socios y centros de costo que debo utilizar.",
];

const opcionesPractica = [
  "Debe: Gastos de electricidad $120.000 · Haber: Gastos por pagar $120.000",
  "Debe: Gastos por pagar $120.000 · Haber: Gastos de electricidad $120.000",
  "Debe y Haber en la cuenta Gastos de electricidad por $120.000 cada uno",
] as const;

const preguntas = [
  ["¿Cuándo debo usar un asiento manual?", "Úsalo para ajustes, provisiones, reclasificaciones u operaciones indicadas por el responsable contable que no provengan de otro módulo. Si una factura, pago, cheque o activo fijo ya genera su asiento, registra o corrige la operación desde ese documento para no duplicarla."],
  ["¿Por qué no puedo contabilizar?", "Comprueba que Debe y Haber sean iguales, que todas las líneas tengan cuenta o socio válido y que los campos exigidos estén completos. Revisa también que el período exista y permita contabilizar."],
  ["¿Por qué no aparece una cuenta?", "La selección muestra cuentas activas e imputables. Una cuenta de título, inactiva o configurada en una moneda no admitida para asientos manuales no estará disponible."],
  ["El sistema me pide un socio. ¿Qué significa?", "La cuenta controla saldos de clientes o proveedores. Selecciona el socio correspondiente para que su cuenta corriente cuadre con el mayor contable."],
  ["¿Cuándo debo indicar un centro de costo?", "Cuando la cuenta lo exige o cuando la política de la empresa necesita distribuir el movimiento por área, proyecto o unidad. Si el campo es obligatorio, el sistema no permitirá contabilizar sin completarlo."],
  ["¿Un borrador cambia los saldos o informes?", "No. El borrador permite preparar y revisar el asiento, pero no afecta saldos, mayores ni informes y todavía no tiene número definitivo."],
  ["¿Puedo editar un asiento contabilizado?", "No. Para conservar el historial, debes anularlo y crear una reversa. Después puedes duplicar el original, corregir el nuevo asiento y contabilizarlo."],
  ["¿Qué hago con un asiento automático incorrecto?", "Abre el documento origen desde el detalle del asiento y realiza allí la corrección o anulación. El asiento automático es de solo lectura."],
  ["¿Dónde veo quién creó o revirtió un asiento?", "Abre el detalle y consulta Historial. La auditoría registra el usuario, la fecha, el origen, el documento asociado, la cantidad de líneas y los totales del asiento."],
] as const;

export function AsientosGuia({ empresaId }: { empresaId: string }) {
  const [paso, setPaso] = useState(0);
  const [preparados, setPreparados] = useState<number[]>([]);
  const [respuesta, setRespuesta] = useState<number | null>(null);
  const actual = pasos[paso]!;
  const base = `/panel/${empresaId}`;
  const respuestaCorrecta = 0;

  return (
    <div className="max-w-5xl space-y-6">
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-7" aria-labelledby="asientos-bienvenida">
        <div className="flex items-start gap-4">
          <div className="hidden rounded-xl bg-primary/10 p-3 text-primary sm:block">
            <ScaleIcon className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Guía práctica · Libro diario</p>
            <h2 id="asientos-bienvenida" className="text-xl font-semibold tracking-tight sm:text-2xl">Tu primer asiento manual, paso a paso</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Aprende a preparar, revisar y contabilizar un asiento, y a corregirlo sin perder su historial.
            </p>
            <p className="text-sm">La regla principal es simple: el total del Debe siempre debe ser igual al total del Haber.</p>
          </div>
        </div>
      </section>

      <Tabs defaultValue="guia">
        <TabsList className="flex-wrap gap-x-5 gap-y-0" aria-label="Contenido de la guía de asientos">
          <TabsTrigger value="guia" className="focus-visible:ring-2 focus-visible:ring-ring">Paso a paso</TabsTrigger>
          <TabsTrigger value="practica" className="focus-visible:ring-2 focus-visible:ring-ring">Practicar partida doble</TabsTrigger>
          <TabsTrigger value="ayuda" className="focus-visible:ring-2 focus-visible:ring-ring">Resolver dudas</TabsTrigger>
        </TabsList>

        <TabsContent value="guia" className="space-y-5">
          <section className="rounded-xl border bg-card p-5" aria-labelledby="asientos-preparacion">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="asientos-preparacion" className="font-semibold">Antes de empezar</h2>
              <span className="text-xs text-muted-foreground" role="status">{preparados.length} de {preparacion.length} listos</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Estas marcas son solo para ayudarte y se reinician al salir de la página.</p>
            <div className="mt-4 space-y-3">
              {preparacion.map((texto, indice) => (
                <label key={texto} className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                    checked={preparados.includes(indice)}
                    onChange={(event) => {
                      const marcado = event.target.checked;
                      setPreparados((prev) => marcado ? [...prev, indice] : prev.filter((i) => i !== indice));
                    }}
                  />
                  {texto}
                </label>
              ))}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
            <nav aria-label="Pasos para registrar un asiento" className="space-y-2">
              {pasos.map((item, indice) => (
                <button
                  key={item.titulo}
                  type="button"
                  aria-current={paso === indice ? "step" : undefined}
                  aria-controls="asientos-paso"
                  onClick={() => setPaso(indice)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    paso === indice
                      ? "border-primary/30 bg-primary/10 font-medium text-primary"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  <span className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    paso === indice ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}>
                    {indice + 1}
                  </span>
                  {item.titulo}
                </button>
              ))}
            </nav>

            <section id="asientos-paso" className="flex flex-col rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="asientos-paso-titulo">
              <div aria-live="polite" aria-atomic="true">
                <p className="text-xs font-medium text-primary">Paso {paso + 1} de {pasos.length}</p>
                <h2 id="asientos-paso-titulo" className="mt-2 text-lg font-semibold">{actual.titulo}</h2>
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
                <Button variant="outline" asChild>
                  <Link href={`${base}${actual.enlace}`} target="_blank" rel="noopener noreferrer">
                    {actual.accion}<ArrowRightIcon aria-hidden="true" />
                    <span className="sr-only"> (abre otra pestaña)</span>
                  </Link>
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">Se abre en otra pestaña para que puedas seguir esta guía.</p>
              </div>
              <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
                <Button variant="ghost" disabled={paso === 0} onClick={() => setPaso((prev) => prev - 1)}>
                  <ArrowLeftIcon aria-hidden="true" />Anterior
                </Button>
                {paso < pasos.length - 1 ? (
                  <Button onClick={() => setPaso((prev) => prev + 1)}>Siguiente<ArrowRightIcon aria-hidden="true" /></Button>
                ) : (
                  <Button variant="ghost" onClick={() => setPaso(0)}><RotateCcwIcon aria-hidden="true" />Volver al inicio</Button>
                )}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="practica">
          <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="asientos-practica">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">Ejercicio de práctica</p>
              <h2 id="asientos-practica" className="mt-2 text-lg font-semibold">Registra una provisión de electricidad</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Al cierre del mes debes reconocer $120.000 de electricidad consumida, todavía no pagada. ¿Qué líneas mantienen la partida doble?
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/60 p-4">
                <p className="text-xs text-muted-foreground">Gasto reconocido</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">$120.000</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-4">
                <p className="text-xs text-muted-foreground">Pago realizado</p>
                <p className="mt-2 text-xl font-semibold">Todavía no</p>
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Selecciona el asiento correcto</legend>
              {opcionesPractica.map((opcion, indice) => (
                <label
                  key={opcion}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm leading-relaxed",
                    respuesta === indice && (indice === respuestaCorrecta ? "border-primary/40 bg-primary/5" : "bg-muted/60"),
                  )}
                >
                  <input
                    type="radio"
                    name="asientos-practica"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    checked={respuesta === indice}
                    onChange={() => setRespuesta(indice)}
                  />
                  {opcion}
                </label>
              ))}
            </fieldset>

            <div role="status" aria-live="polite">
              {respuesta !== null && (
                <div className={cn(
                  "rounded-lg border p-4 text-sm leading-relaxed",
                  respuesta === respuestaCorrecta ? "border-primary/30 bg-primary/5" : "bg-muted/60",
                )}>
                  <p className="flex items-start gap-2 font-semibold">
                    {respuesta === respuestaCorrecta && <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
                    {respuesta === respuestaCorrecta ? "Correcto." : "Revisa el sentido del movimiento."}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    El gasto aumenta en el Debe y la obligación pendiente aumenta en el Haber. Debe y Haber suman $120.000. Cuando se pague, el documento o pago correspondiente registrará la salida de dinero.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClipboardCheckIcon className="size-4" aria-hidden="true" />Esta práctica no guarda información.
              </p>
              <Button type="button" variant="ghost" onClick={() => setRespuesta(null)}>
                <RotateCcwIcon aria-hidden="true" />Reiniciar
              </Button>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="ayuda" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Encuentra el siguiente paso</h2>
            <p className="mt-1 text-sm text-muted-foreground">Abre una pregunta para entender el mensaje y saber cómo continuar.</p>
          </div>
          <div className="space-y-3">
            {preguntas.map(([pregunta, respuestaAyuda]) => (
              <details key={pregunta} className="rounded-xl border bg-card open:border-primary/30">
                <summary className="cursor-pointer rounded-xl p-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
                  {pregunta}
                </summary>
                <p className="px-4 pb-5 text-sm leading-relaxed text-muted-foreground">{respuestaAyuda}</p>
              </details>
            ))}
          </div>
          <Button variant="outline" asChild>
            <Link href={`${base}/contabilidad/asientos`}>Abrir libro diario<ArrowRightIcon aria-hidden="true" /></Link>
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
