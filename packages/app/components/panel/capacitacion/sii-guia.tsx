"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, CheckCircle2Icon, KeyRoundIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const pasos = [
  {
    titulo: "Reúne los datos",
    resumen: "Ten a mano la información de la empresa y de quien entra al SII.",
    instrucciones: [
      "Verifica que estás trabajando en la empresa correcta. Solo los roles Administrador y Contador pueden ver y cambiar esta configuración.",
      "Anota el RUT de la empresa (el contribuyente) y averigua con qué emite y recibe sus documentos: el sistema gratuito del SII o un facturador comercial como Nubox, Bsale o Defontana.",
      "Consigue la Clave Tributaria o el certificado digital (.pfx o .p12) con su contraseña. Averigua también si pertenecen a la empresa o a una persona que la representa, por ejemplo el contador.",
    ],
    consejo: "Si la clave o el certificado son de una persona y no de la empresa, anota también el RUT de esa persona: lo necesitarás en el paso 3.",
  },
  {
    titulo: "Identifica la empresa",
    resumen: "Indica a qué contribuyente corresponde la conexión.",
    instrucciones: [
      "Abre Configuración → Conexión SII.",
      "En Tipo de facturación, elige cómo emite sus documentos la empresa. Si es un facturador comercial, escribe su nombre.",
      "En RUT del contribuyente, escribe el RUT de la empresa con guion y dígito verificador, por ejemplo 76192083-9.",
    ],
    consejo: "El tipo de facturación determina qué opciones de importación verás después. Por ejemplo, la descarga de XML solo está disponible para el sistema gratuito del SII.",
  },
  {
    titulo: "Elige cómo conectarte",
    resumen: "Define qué credencial usará el sistema para entrar al SII.",
    instrucciones: [
      "En Conectar con, elige Clave Tributaria o Certificado digital.",
      "Deja vacío RUT del titular / mandatario si la clave o el certificado son de la propia empresa.",
      "Si son de una persona que representa a la empresa, escribe el RUT de esa persona. El sistema entrará al SII con ese RUT y consultará los datos de la empresa.",
    ],
    consejo: "Puedes guardar la clave y el certificado. Después podrás cambiar de método sin volver a ingresar la otra credencial.",
  },
  {
    titulo: "Ingresa la credencial",
    resumen: "Escribe la clave o sube el certificado con su contraseña.",
    instrucciones: [
      "Con Clave Tributaria, escríbela en el campo correspondiente. Si indicaste un titular o mandatario, usa la clave de esa persona.",
      "Con Certificado digital, sube el archivo .pfx o .p12 y escribe su contraseña.",
      "En Ambiente, deja Producción (palena) para trabajar con datos reales. Certificación (maullín) solo sirve para hacer pruebas.",
    ],
    consejo: "Si ya hay una credencial guardada, deja el campo vacío para mantenerla. Si subes un certificado nuevo, escribe otra vez su contraseña; el sistema no reutiliza la anterior.",
  },
  {
    titulo: "Guarda y prueba",
    resumen: "Comprueba que el SII acepta los datos.",
    instrucciones: [
      "Pulsa Guardar. Las credenciales se guardan cifradas y nunca se vuelven a mostrar.",
      "Pulsa Probar conexión y lee el mensaje. Si falla, revisa la clave o la contraseña del certificado y el RUT del titular.",
      "Revisa el recuadro Estado: muestra qué credenciales están configuradas y, si usas certificado, su fecha de vencimiento.",
    ],
    consejo: "No pruebes la conexión muchas veces seguidas. El SII limita las sesiones abiertas y, si se supera el límite, bloquea el ingreso por varias horas.",
  },
] as const;

const preparacion = [
  "Tengo el RUT de la empresa y sé con qué emite sus documentos.",
  "Tengo la Clave Tributaria, o el certificado digital y su contraseña.",
  "Sé si la credencial es de la empresa o de una persona que la representa.",
];

const casos = [
  {
    situacion: "La contadora entra al SII con su propia Clave Tributaria y opera a nombre de la empresa 76.192.083-9.",
    opciones: ["Dejar vacío el RUT del titular", "Escribir el RUT de la contadora como titular / mandatario", "Escribir el RUT de la contadora como RUT del contribuyente"],
    correcta: 1,
    explicacion: "El RUT del contribuyente sigue siendo el de la empresa. El de la contadora va en titular / mandatario y la clave que se ingresa es la suya.",
  },
  {
    situacion: "La empresa tiene su propia Clave Tributaria y es la misma con la que se entra al SII.",
    opciones: ["Dejar vacío el RUT del titular", "Repetir el RUT de la empresa como titular", "Cambiar a Certificado digital"],
    correcta: 0,
    explicacion: "Si la credencial es de la propia empresa, el campo de titular queda vacío.",
  },
  {
    situacion: "Renovaste el certificado digital y subiste el archivo nuevo, pero dejaste vacía la contraseña.",
    opciones: ["Funciona: el sistema usa la contraseña guardada", "Debes escribir la contraseña del certificado nuevo", "Debes cambiar a Clave Tributaria"],
    correcta: 1,
    explicacion: "Al subir un certificado nuevo, la contraseña anterior no se reutiliza. Si no coinciden, la prueba falla y pide revisar la contraseña.",
  },
] as const;

const preguntas = [
  ["«Probar conexión» está deshabilitado.", "El botón se activa cuando ya hay guardada una credencial del método elegido. Si elegiste Certificado digital, sube el certificado y pulsa Guardar antes de probar."],
  ["La prueba dice que revise la contraseña.", "La contraseña no corresponde al certificado guardado. Vuelve a subir el archivo junto con su contraseña y pulsa Guardar. Si subiste un certificado nuevo, recuerda que la contraseña anterior no se reutiliza."],
  ["Aparece «superado el máximo de sesiones autenticadas».", "El SII limita las sesiones abiertas al mismo tiempo, y las sesiones pueden tardar horas en liberarse. Espera antes de volver a probar y evita pulsar Probar conexión varias veces seguidas."],
  ["¿Qué pongo si el contador usa su propia clave?", "En RUT del contribuyente, escribe el RUT de la empresa. En RUT del titular / mandatario, escribe el RUT del contador. En Clave Tributaria, escribe la clave del contador. Lo mismo aplica si usa su certificado digital."],
  ["¿Es seguro guardar la clave aquí?", "Las credenciales y el certificado se guardan cifrados (AES-256-GCM). Solo se descifran en el servidor cuando el sistema se conecta con el SII y nunca se muestran en pantalla."],
  ["¿Qué ambiente elijo?", "Producción (palena) para trabajar con los datos reales de la empresa. Certificación (maullín) es un ambiente de pruebas del SII y no tiene los documentos reales."],
  ["¿Para qué sirven «Probar XML compras» y «Probar XML ventas»?", "Solo aparecen si el tipo de facturación es «SII Gratuito». Descargan los documentos de los últimos días del sistema de facturación gratuita para confirmar que el acceso funciona. No crean ni cambian nada en el sistema."],
  ["Mi certificado va a vencer. ¿Qué hago?", "El recuadro Estado muestra la fecha de vencimiento. Antes de esa fecha, sube el certificado renovado con su contraseña, pulsa Guardar y después Probar conexión."],
] as const;

export function SiiGuia({ empresaId }: { empresaId: string }) {
  const [paso, setPaso] = useState(0);
  const [preparados, setPreparados] = useState<number[]>([]);
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const actual = pasos[paso]!;
  const base = `/panel/${empresaId}`;
  const aciertos = casos.filter((c, i) => respuestas[i] === c.correcta).length;

  return (
    <div className="max-w-5xl space-y-6">
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-7" aria-labelledby="sii-bienvenida">
        <div className="flex items-start gap-4">
          <div className="hidden rounded-xl bg-primary/10 p-3 text-primary sm:block"><KeyRoundIcon className="size-6" aria-hidden="true" /></div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Guía práctica · Conexión SII</p>
            <h2 id="sii-bienvenida" className="text-xl font-semibold tracking-tight sm:text-2xl">Conecta la empresa con el SII</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Configura las credenciales para que el sistema descargue el Registro de Compras y Ventas (RCV) y registre la aceptación o el reclamo de las facturas recibidas. Se configura una vez por empresa.</p>
          </div>
        </div>
      </section>

      <Tabs defaultValue="guia">
        <TabsList className="flex-wrap gap-x-5 gap-y-0" aria-label="Contenido de la guía de conexión SII">
          <TabsTrigger value="guia" className="focus-visible:ring-2 focus-visible:ring-ring">Paso a paso</TabsTrigger>
          <TabsTrigger value="practica" className="focus-visible:ring-2 focus-visible:ring-ring">Practicar casos</TabsTrigger>
          <TabsTrigger value="ayuda" className="focus-visible:ring-2 focus-visible:ring-ring">Resolver dudas</TabsTrigger>
        </TabsList>

        <TabsContent value="guia" className="space-y-5">
          <section className="rounded-xl border bg-card p-5" aria-labelledby="sii-preparacion">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="sii-preparacion" className="font-semibold">Antes de empezar</h2>
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
            <nav aria-label="Pasos para configurar la conexión SII" className="space-y-2">
              {pasos.map((item, indice) => (
                <button key={item.titulo} type="button" aria-current={paso === indice ? "step" : undefined} aria-controls="sii-paso" onClick={() => setPaso(indice)} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", paso === indice ? "border-primary/30 bg-primary/10 font-medium text-primary" : "border-transparent hover:bg-muted")}>
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", paso === indice ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{indice + 1}</span>
                  {item.titulo}
                </button>
              ))}
            </nav>

            <section id="sii-paso" className="flex flex-col rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="sii-paso-titulo">
              <div aria-live="polite" aria-atomic="true">
                <p className="text-xs font-medium text-primary">Paso {paso + 1} de {pasos.length}</p>
                <h2 id="sii-paso-titulo" className="mt-2 text-lg font-semibold">{actual.titulo}</h2>
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
                <Button variant="outline" asChild><Link href={`${base}/configuracion/sii`} target="_blank" rel="noopener noreferrer">Abrir Conexión SII<ArrowRightIcon aria-hidden="true" /><span className="sr-only"> (abre otra pestaña)</span></Link></Button>
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
          <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="sii-practica">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">Ejercicio de práctica</p>
              <h2 id="sii-practica" className="mt-2 text-lg font-semibold">¿Qué configurarías en cada caso?</h2>
              <p className="mt-2 text-sm text-muted-foreground">Elige una opción en cada caso. Son ejemplos: no se guarda nada.</p>
            </div>
            {casos.map((caso, i) => {
              const elegida = respuestas[i];
              return (
                <fieldset key={caso.situacion} className="space-y-3 rounded-lg border p-4">
                  <legend className="px-1 text-xs font-medium text-muted-foreground">Caso {i + 1}</legend>
                  <p className="text-sm font-medium">{caso.situacion}</p>
                  <div className="space-y-2">
                    {caso.opciones.map((opcion, j) => (
                      <label key={opcion} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm", elegida === j && (j === caso.correcta ? "border-primary/40 bg-primary/5" : "bg-muted/60"))}>
                        <input type="radio" name={`sii-caso-${i}`} className="mt-0.5 size-4 shrink-0 accent-primary" checked={elegida === j} onChange={() => setRespuestas((prev) => ({ ...prev, [i]: j }))} />
                        {opcion}
                      </label>
                    ))}
                  </div>
                  <div role="status" aria-live="polite">
                    {elegida !== undefined && (
                      <p className="flex items-start gap-2 text-sm leading-relaxed">
                        {elegida === caso.correcta && <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
                        <span><strong>{elegida === caso.correcta ? "Correcto." : "Revisa esta opción."}</strong> {caso.explicacion}</span>
                      </p>
                    )}
                  </div>
                </fieldset>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground" role="status">{aciertos} de {casos.length} correctas</p>
              <Button type="button" variant="ghost" onClick={() => setRespuestas({})}><RotateCcwIcon aria-hidden="true" />Reiniciar</Button>
            </div>
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
          <Button variant="outline" asChild><Link href={`${base}/configuracion/sii`}>Abrir Conexión SII<ArrowRightIcon aria-hidden="true" /></Link></Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
