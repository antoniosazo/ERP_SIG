"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, CheckCircle2Icon, PackageIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const pasos = [
  {
    titulo: "Prepara la clase",
    resumen: "Agrupa los bienes y revisa sus cuentas contables.",
    instrucciones: [
      "Comprueba que estás en la empresa correcta y reúne los datos del bien: descripción, fecha de adquisición, costo y ubicación.",
      "En Clases de activo, busca la clase que corresponde, por ejemplo Equipos o Vehículos. Si falta, pide al responsable contable que la configure con sus cuentas por libro.",
      "Acuerda el libro, la vida útil, el valor residual y la fecha de inicio de depreciación con el responsable contable antes de crear el activo.",
    ],
    consejo: "La clase agrupa activos similares. La ficha identifica un bien concreto, como un computador con su propio número de serie.",
    enlace: "/activos-fijos/clases",
    accion: "Ver clases de activo",
  },
  {
    titulo: "Crea o completa la ficha",
    resumen: "Registra el bien y cómo se calculará su depreciación.",
    instrucciones: [
      "En Activos, pulsa Nuevo activo. Completa descripción, clase, centro de costo y los datos que permitan identificar el bien.",
      "En Valoración y depreciación, revisa el libro, la vida útil en meses, el valor residual y la fecha y regla de inicio. Guarda la ficha.",
      "Si el activo se creó desde una factura de compra, abre su ficha y usa Completar datos para asignar clase y valoración antes de capitalizar. Revisa primero si ya existe para evitar crear otra ficha del mismo bien.",
    ],
    consejo: "Guardar la ficha deja el activo en estado Nuevo. La capitalización es una acción posterior.",
    enlace: "/activos-fijos/activos",
    accion: "Abrir listado de activos",
  },
  {
    titulo: "Capitaliza el activo",
    resumen: "Registra el costo del bien en el módulo.",
    instrucciones: [
      "Abre la ficha y comprueba que tenga clase y valoración. En un activo Nuevo con estos datos completos aparece Capitalizar.",
      "Pulsa Capitalizar y revisa la fecha y el importe de cada libro. Puedes agregar una glosa para identificar la operación.",
      "Confirma cuando los datos estén revisados. La capitalización genera el documento y el asiento correspondiente; consulta el resultado en la ficha.",
    ],
    consejo: "Para un bien que todavía está En curso, revisa la ayuda de obras en curso en Otras operaciones antes de iniciar su depreciación.",
    enlace: "/activos-fijos/activos",
    accion: "Buscar la ficha del activo",
  },
  {
    titulo: "Deprecia cada mes",
    resumen: "Simula, revisa las cuotas y luego contabiliza.",
    instrucciones: [
      "En Ejecutar depreciación, selecciona el libro que corresponde a la valoración y el período que vas a procesar.",
      "Pulsa Simular. Revisa el costo depreciable, la depreciación acumulada, la cuota de cada activo y el total del período.",
      "Si todo está correcto, pulsa Confirmar y contabilizar. Procesa los meses en orden; si cambias el libro o el período, vuelve a simular antes de confirmar.",
    ],
    consejo: "Simular permite revisar los importes. Confirmar y contabilizar registra la depreciación real. Si no hay cuotas, consulta las posibles causas en Resolver dudas.",
    enlace: "/activos-fijos/depreciacion",
    accion: "Ir a depreciación",
  },
  {
    titulo: "Revisa los informes",
    resumen: "Comprueba cómo cambió el valor de los bienes.",
    instrucciones: [
      "Abre el informe de activos fijos y selecciona el año y libro que quieres revisar.",
      "Consulta el cuadro de evolución: costo inicial, altas, bajas, costo final, depreciación acumulada y valor libro.",
      "Si la empresa mantiene libros separados, consulta la conciliación Tributario/IFRS. Para estimar cuotas futuras de un bien, abre su ficha y selecciona Más acciones → Pronóstico.",
    ],
    consejo: "El valor libro es el costo vigente menos la depreciación acumulada. El pronóstico es una estimación; no contabiliza cuotas futuras.",
    enlace: "/informes/activos-fijos",
    accion: "Ver informe de activos fijos",
  },
  {
    titulo: "Prepara el cierre anual",
    resumen: "Completa los movimientos antes de cerrar el ejercicio.",
    instrucciones: [
      "Revisa los movimientos del año, la depreciación hasta diciembre y la corrección monetaria cuando corresponda. Completa estas tareas antes de bloquear los períodos.",
      "Coordina con el responsable contable el bloqueo de los doce meses. En Cierre de ejercicio, selecciona el año y libro y revisa los requisitos pendientes, incluido el cierre anterior si corresponde.",
      "Cuando se cumplan los requisitos, revisa y confirma Cerrar ejercicio. El cierre conserva el costo y la depreciación acumulada de cada activo al terminar el año.",
    ],
    consejo: "Este es el cierre del módulo de activo fijo por libro. No reemplaza el cierre contable general de la empresa ni genera un asiento propio.",
    enlace: "/activos-fijos/cierre",
    accion: "Ver cierre de activo fijo",
  },
] as const;

const preparacion = [
  "Identifiqué el bien y reuní sus datos de adquisición.",
  "Revisé la clase y las cuentas con el responsable contable.",
  "Confirmé el libro, la vida útil, el residual y la fecha de inicio.",
];

const operaciones = [
  {
    titulo: "Registrar una mejora",
    cuando: "Se incorpora un costo adicional a un activo Activo o En curso.",
    pasos: "Abre la ficha → Más acciones → Registrar mejora. Completa fecha, glosa e importe por libro y confirma después de revisarlos. La mejora aumenta el costo; las cuotas posteriores se calculan con los valores vigentes.",
    detalle: "El responsable contable debe determinar si el desembolso corresponde a una mejora del activo.",
    enlace: "/activos-fijos/activos",
  },
  {
    titulo: "Activar una obra en curso",
    cuando: "El bien figura En curso y ya está listo para comenzar su depreciación.",
    pasos: "En la ficha, pulsa Activar obra en curso. Revisa el libro, la regla y fecha de inicio, la vida útil y el valor residual. Confirma la activación una vez revisados los datos.",
    detalle: "Un activo En curso puede acumular costos mediante mejoras. La activación utiliza el costo ya registrado y no genera un asiento propio.",
    enlace: "/activos-fijos/activos",
  },
  {
    titulo: "Cambiar centro de costo o clase",
    cuando: "El activo pasa a otra área o necesita una clasificación diferente.",
    pasos: "En Más acciones, selecciona Transferir centro de costo o Transferir clase. Indica la fecha, el destino y una glosa que explique el cambio.",
    detalle: "Cambiar la clase puede generar una reclasificación contable si cambia la cuenta del activo. Revisa la clase de destino antes de confirmar.",
    enlace: "/activos-fijos/activos",
  },
  {
    titulo: "Dar de baja por venta o castigo",
    cuando: "El bien sale del registro, en su totalidad o parcialmente.",
    pasos: "En Más acciones → Dar de baja, elige el tipo y la fecha. Indica el porcentaje: 100% para todo el activo o el porcentaje que corresponda. En una venta, completa el valor de venta y la cuenta de contrapartida.",
    detalle: "El sistema retira la proporción de costo y depreciación acumulada y calcula el resultado. Una baja parcial conserva el resto del activo. La baja desde una factura de venta no es automática.",
    enlace: "/activos-fijos/activos",
  },
  {
    titulo: "Registrar depreciación manual",
    cuando: "El responsable contable necesita un ajuste puntual de depreciación.",
    pasos: "En la ficha → Más acciones → Depreciación manual, selecciona libro y período. Ingresa el monto y una glosa que permita entender el ajuste antes de confirmar.",
    detalle: "Revisa las cuotas ya registradas para no duplicar la depreciación. Esta operación registra un movimiento real sobre el activo.",
    enlace: "/activos-fijos/activos",
  },
  {
    titulo: "Aplicar corrección monetaria",
    cuando: "Preparas los ajustes anuales del libro Tributario.",
    pasos: "En Corrección monetaria, revisa los factores del año con el responsable contable. Selecciona el año, pulsa Simular y revisa los ajustes de costo y depreciación acumulada antes de confirmar.",
    detalle: "La aplicación se realiza por año sobre el libro Tributario. Si cambias los factores o el año, vuelve a simular para revisar el nuevo resultado.",
    enlace: "/activos-fijos/correccion-monetaria",
  },
  {
    titulo: "Consultar DDAN y comparar libros",
    cuando: "Quieres revisar las diferencias entre valoraciones del activo.",
    pasos: "En un activo con valoración acelerada, abre Más acciones → Registro DDAN y selecciona el año. Para comparar valores Tributario e IFRS, abre el informe de conciliación de activos fijos.",
    detalle: "DDAN muestra la diferencia entre la depreciación acelerada y la normal calculada para ese activo. Esta consulta no crea asientos ni sustituye los registros generales de la empresa.",
    enlace: "/informes/activos-fijos-conciliacion",
  },
] as const;

const preguntas = [
  ["¿Qué significan clase, valoración, vida útil y residual?", "La clase agrupa bienes similares y define sus cuentas. La valoración reúne los datos de depreciación por libro. La vida útil se ingresa en meses; el residual es el valor que se espera conservar al final y que no se deprecia."],
  ["¿Qué libro selecciono: Tributario, IFRS o Ambos?", "Usa el libro definido en la valoración del activo y acordado con el responsable contable. Tributario e IFRS pueden tener parámetros distintos. Ambos identifica una valoración común; no lo uses como sustituto de ejecutar cada libro cuando hay valoraciones separadas."],
  ["¿Cómo elijo el régimen de depreciación?", "El formulario del libro Tributario permite configurar Normal, Acelerada o Instantánea. Usa la opción y la vida útil indicadas por el responsable contable. El sistema no determina automáticamente qué régimen corresponde a la empresa."],
  ["El activo viene de una compra. ¿Ya está capitalizado?", "No. Cuando una línea de la factura usa una cuenta de tipo Activo Fijo, se crea una ficha Nueva vinculada a la compra. Usa Completar datos para revisar clase y valoración; después realiza la capitalización desde la ficha."],
  ["No aparece Capitalizar. ¿Qué falta?", "Comprueba que el activo esté Nuevo, tenga clase y al menos una valoración. Si nació de una compra, completa primero esos datos. Si ya está Activo, revisa si corresponde Registrar mejora para el costo adicional."],
  ["La simulación muestra «Sin cuotas para este período».", "Revisa el libro elegido, el estado del activo, su fecha y regla de inicio, la vida útil y el valor residual. Un activo Nuevo o En curso no se deprecia. También puede no haber cuota porque ya se registró la depreciación o porque se agotó el importe depreciable."],
  ["¿Cuándo empieza a depreciarse?", "Con Desde el mes de la fecha de inicio, el mes indicado puede tener cuota. Con Mes siguiente a la fecha de inicio, la primera cuota corresponde al mes posterior. Por ejemplo, para una fecha de marzo, esta última regla comienza en abril."],
  ["El sistema pide ejecutar un mes anterior.", "Las depreciaciones se procesan en orden. Revisa el libro y completa el mes pendiente antes de avanzar. No cambies la fecha de inicio solo para evitar el mensaje."],
  ["Me equivoqué en un documento. ¿Cómo lo corrijo?", "Revisa el documento en la ficha y utiliza Anular con un motivo cuando corresponda. La anulación revierte la operación y conserva su historial. Si hay movimientos posteriores, puede ser necesario anularlos primero; en depreciación se comienza por el período más reciente. Coordina la corrección con el responsable contable."],
  ["El período está bloqueado o el ejercicio está cerrado.", "Revisa la fecha y el libro de la operación. Si necesitas corregir datos de un período cerrado, pide al responsable contable que revise la reapertura y su motivo. Los cierres se reabren desde el año más reciente; no cambies la fecha de la operación para evitar el bloqueo."],
  ["¿Qué reviso si no puedo cerrar el año?", "Lee los requisitos pendientes de la pantalla de cierre: deben existir los doce períodos y estar bloqueados, estar resuelta la depreciación de diciembre cuando el sistema la solicite y estar cerrado el año anterior si corresponde. Completa los movimientos antes del bloqueo de los meses."],
] as const;

const ejercicios = [
  {
    titulo: "Cuota mensual",
    pregunta: "¿Cuánto se deprecia en el primer mes?",
    contexto: "Activo listo para depreciar, método lineal, sin movimientos adicionales. El mes elegido ya cumple la regla de inicio.",
    datos: [["Costo", "$1.200.000"], ["Valor residual", "$0"], ["Vida útil", "12 meses"]],
    formula: "(Costo − valor residual) ÷ meses de vida útil",
    resultado: 100000,
    explicacion: "$1.200.000 ÷ 12 = $100.000 por mes en este ejemplo sin cambios de costo.",
    etiqueta: "Tu cuota mensual (CLP)",
  },
  {
    titulo: "Valor libro",
    pregunta: "¿Cuál es el valor libro del activo?",
    contexto: "Consulta el costo vigente y la depreciación acumulada de un mismo libro y fecha.",
    datos: [["Costo vigente", "$1.000.000"], ["Depreciación acumulada", "$300.000"]],
    formula: "Costo vigente − depreciación acumulada",
    resultado: 700000,
    explicacion: "$1.000.000 − $300.000 = $700.000 de valor libro. No es necesariamente su precio de venta.",
    etiqueta: "Tu valor libro (CLP)",
  },
] as const;

function EjercicioActivoFijo({ ejercicio }: { ejercicio: (typeof ejercicios)[number] }) {
  const [valor, setValor] = useState("");
  const [respuesta, setRespuesta] = useState<"correcta" | "revisar" | null>(null);

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="af-ejercicio-titulo">
      <h3 id="af-ejercicio-titulo" className="text-lg font-semibold">{ejercicio.pregunta}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{ejercicio.contexto}</p>
      <div className="my-6 grid gap-3 sm:grid-cols-3">
        {ejercicio.datos.map(([etiqueta, monto]) => (
          <div key={etiqueta} className="rounded-lg bg-muted/60 p-4">
            <p className="text-xs text-muted-foreground">{etiqueta}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">{monto}</p>
          </div>
        ))}
      </div>
      <p className="rounded-lg border border-dashed p-4 text-center text-sm font-medium">{ejercicio.formula}</p>
      <form className="mt-6 space-y-4" onSubmit={(event) => {
        event.preventDefault();
        setRespuesta(Number(valor) === ejercicio.resultado ? "correcta" : "revisar");
      }}>
        <div className="max-w-sm space-y-2">
          <Label htmlFor="af-respuesta">{ejercicio.etiqueta}</Label>
          <Input id="af-respuesta" type="number" step="1" required value={valor} placeholder="Escribe el resultado" aria-describedby="af-respuesta-ayuda" onChange={(event) => {
            setValor(event.target.value);
            setRespuesta(null);
          }} />
          <p id="af-respuesta-ayuda" className="text-xs text-muted-foreground">Ingresa pesos enteros, sin puntos ni comas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Comprobar respuesta</Button>
          <Button type="button" variant="ghost" onClick={() => { setValor(""); setRespuesta(null); }}>
            <RotateCcwIcon aria-hidden="true" />Reiniciar
          </Button>
        </div>
        <div role="status" aria-live="polite">
          {respuesta && (
            <div className={cn("rounded-lg border p-4 text-sm leading-relaxed", respuesta === "correcta" ? "border-primary/30 bg-primary/5" : "bg-muted/60")}>
              <p className="flex items-center gap-2 font-semibold">
                {respuesta === "correcta" && <CheckCircle2Icon className="size-4 text-primary" aria-hidden="true" />}
                {respuesta === "correcta" ? "¡Correcto!" : "Revisa el cálculo e inténtalo otra vez."}
              </p>
              <p className="mt-1">{respuesta === "correcta" ? ejercicio.explicacion : `Usa esta fórmula con los datos del ejemplo: ${ejercicio.formula.toLowerCase()}.`}</p>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}

export function ActivoFijoGuia({ empresaId }: { empresaId: string }) {
  const [paso, setPaso] = useState(0);
  const [preparados, setPreparados] = useState<number[]>([]);
  const [ejercicio, setEjercicio] = useState(0);
  const actual = pasos[paso]!;
  const base = `/panel/${empresaId}`;

  return (
    <div className="max-w-5xl space-y-6">
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-7" aria-labelledby="af-bienvenida">
        <div className="flex items-start gap-4">
          <div className="hidden rounded-xl bg-primary/10 p-3 text-primary sm:block"><PackageIcon className="size-6" aria-hidden="true" /></div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Guía práctica · Activo fijo</p>
            <h2 id="af-bienvenida" className="text-xl font-semibold tracking-tight sm:text-2xl">Acompaña cada activo desde su alta hasta su baja</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Aprende a registrar un bien, depreciarlo cada mes y consultar su valor. Sigue los pasos o busca la operación que necesitas realizar.</p>
            <p className="text-sm">Un activo fijo es un bien que la empresa utiliza durante un tiempo prolongado, como un equipo, una máquina o un vehículo.</p>
          </div>
        </div>
      </section>

      <Tabs defaultValue="guia">
        <TabsList className="flex-wrap gap-x-5 gap-y-0" aria-label="Contenido de la guía de activo fijo">
          <TabsTrigger value="guia" className="focus-visible:ring-2 focus-visible:ring-ring">Paso a paso</TabsTrigger>
          <TabsTrigger value="operaciones" className="focus-visible:ring-2 focus-visible:ring-ring">Otras operaciones</TabsTrigger>
          <TabsTrigger value="practica" className="focus-visible:ring-2 focus-visible:ring-ring">Practicar</TabsTrigger>
          <TabsTrigger value="ayuda" className="focus-visible:ring-2 focus-visible:ring-ring">Resolver dudas</TabsTrigger>
        </TabsList>

        <TabsContent value="guia" className="space-y-5">
          <section className="rounded-xl border bg-card p-5" aria-labelledby="af-preparacion">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="af-preparacion" className="font-semibold">Antes de empezar</h2>
              <span className="text-xs text-muted-foreground" role="status">{preparados.length} de {preparacion.length} listos</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Marca lo que ya tienes preparado. Las marcas se reinician al salir de esta página.</p>
            <div className="mt-4 space-y-3">
              {preparacion.map((texto, indice) => (
                <label key={texto} className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring" checked={preparados.includes(indice)} onChange={(event) => {
                    const marcado = event.target.checked;
                    setPreparados((prev) => marcado ? [...prev, indice] : prev.filter((i) => i !== indice));
                  }} />
                  {texto}
                </label>
              ))}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
            <nav aria-label="Pasos para gestionar activos fijos" className="space-y-2">
              {pasos.map((item, indice) => (
                <button key={item.titulo} type="button" aria-current={paso === indice ? "step" : undefined} aria-controls="af-paso" onClick={() => setPaso(indice)} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", paso === indice ? "border-primary/30 bg-primary/10 font-medium text-primary" : "border-transparent hover:bg-muted")}>
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", paso === indice ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{indice + 1}</span>
                  {item.titulo}
                </button>
              ))}
            </nav>
            <section id="af-paso" className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="af-paso-titulo">
              <div aria-live="polite" aria-atomic="true">
                <p className="text-xs font-medium text-primary">Paso {paso + 1} de {pasos.length}</p>
                <h2 id="af-paso-titulo" className="mt-2 text-lg font-semibold">{actual.titulo}</h2>
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
                  <Link href={`${base}${actual.enlace}`} target="_blank" rel="noopener noreferrer">{actual.accion}<ArrowRightIcon aria-hidden="true" /><span className="sr-only"> (abre otra pestaña)</span></Link>
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">Se abre en otra pestaña para que puedas seguir esta guía.</p>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Button variant="ghost" disabled={paso === 0} onClick={() => setPaso((prev) => prev - 1)}><ArrowLeftIcon aria-hidden="true" />Anterior</Button>
                {paso < pasos.length - 1 ? <Button onClick={() => setPaso((prev) => prev + 1)}>Siguiente<ArrowRightIcon aria-hidden="true" /></Button> : <Button variant="ghost" onClick={() => setPaso(0)}><RotateCcwIcon aria-hidden="true" />Volver al inicio</Button>}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="operaciones" className="space-y-4">
          <div><h2 className="text-lg font-semibold">¿Qué necesitas hacer con el activo?</h2><p className="mt-1 text-sm text-muted-foreground">Abre una tarea para conocer los pasos. Las acciones disponibles dependen del estado del activo.</p></div>
          {operaciones.map((operacion) => (
            <details key={operacion.titulo} className="rounded-xl border bg-card open:border-primary/30">
              <summary className="cursor-pointer rounded-xl p-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{operacion.titulo}</summary>
              <div className="space-y-3 px-4 pb-5 text-sm leading-relaxed">
                <p className="font-medium">{operacion.cuando}</p>
                <p>{operacion.pasos}</p>
                <p className="rounded-lg bg-muted/60 p-3 text-muted-foreground">{operacion.detalle}</p>
                <Link className="inline-flex items-center gap-2 rounded text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" href={`${base}${operacion.enlace}`} target="_blank" rel="noopener noreferrer">Abrir pantalla en otra pestaña<ArrowRightIcon className="size-4" aria-hidden="true" /></Link>
              </div>
            </details>
          ))}
        </TabsContent>

        <TabsContent value="practica" className="space-y-4">
          <div><h2 className="text-lg font-semibold">Aprende con un ejemplo</h2><p className="mt-1 text-sm text-muted-foreground">Datos de práctica en pesos chilenos. Tus respuestas no crean activos ni movimientos.</p></div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Elige un ejercicio">
            {ejercicios.map((item, indice) => <Button key={item.titulo} variant={ejercicio === indice ? "default" : "outline"} aria-pressed={ejercicio === indice} onClick={() => setEjercicio(indice)}>{item.titulo}</Button>)}
          </div>
          <EjercicioActivoFijo key={ejercicio} ejercicio={ejercicios[ejercicio]!} />
        </TabsContent>

        <TabsContent value="ayuda" className="space-y-4">
          <div><h2 className="text-lg font-semibold">Encuentra el siguiente paso</h2><p className="mt-1 text-sm text-muted-foreground">Consulta los conceptos y mensajes más habituales del módulo.</p></div>
          {preguntas.map(([pregunta, respuesta]) => (
            <details key={pregunta} className="rounded-xl border bg-card open:border-primary/30">
              <summary className="cursor-pointer rounded-xl p-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{pregunta}</summary>
              <p className="px-4 pb-5 text-sm leading-relaxed text-muted-foreground">{respuesta}</p>
            </details>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
