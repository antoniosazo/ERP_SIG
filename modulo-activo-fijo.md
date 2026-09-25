# Módulo de Activo Fijo — Cómo funciona (Fase 1 + Fase 2)
**Estado:** Fase 1 (Núcleo) y Fase 2 (Ciclo de vida completo) implementadas y en producción.
**Basado en:** especificación funcional y técnica "Módulo de Activo Fijo" (estilo SAP Business One, normativa Chile).
**Propósito:** explicar en lenguaje llano qué hace hoy el módulo, cómo se usa día a día, y qué queda pendiente para fases futuras — sin tener que leer la especificación completa de 22 páginas.

---

## Qué hace hoy

El módulo lleva el control contable completo de los activos fijos de una empresa (maquinaria, equipos, vehículos, etc.), desde que se compran hasta que se dan de baja:

- Un **maestro de activos** con código automático, clase, centro de costo y datos físicos.
- **Capitalización** y **mejoras** (capitalizaciones adicionales sobre un activo ya en servicio), incluyendo **obras en curso** que acumulan costo sin depreciar hasta que se activan.
- **Depreciación mensual automática** (lineal) con simulación previa, y **depreciación manual** para correcciones puntuales de un mes específico.
- **Transferencias** de centro de costo o de clase (con reclasificación contable automática si cambia la cuenta de Activo Fijo).
- **Bajas** por venta o castigo, totales o parciales, con el resultado (utilidad o pérdida) calculado automáticamente.
- **Anulación** de documentos contabilizados, con reversa contable — igual que el resto del sistema.
- **Pronóstico** de depreciación futura de un activo.
- **Cierre de ejercicio propio del módulo**, que congela el costo y la depreciación acumulada de cada activo al cierre del año.
- **Alta automática desde una factura de compra**, y un **informe de cuadro de evolución**.

Esto cierra las Fases 1 y 2 de un plan de 4 — la última sección de este documento detalla qué queda para más adelante (régimen tributario chileno e IFRS).

---

## Conceptos clave

| Concepto | Qué es |
| --- | --- |
| **Clase de activo** | Agrupa activos similares y define sus 7 cuentas contables por defecto: activo, depreciación acumulada, gasto por depreciación, compensación de capitalización, y las 3 de baja (valor libro puente, utilidad, pérdida). |
| **Activo** | Un bien físico concreto, con su código, clase, centro de costo y estado: Nuevo → (En curso) → Activo → Dado de baja. |
| **Valoración** | Los parámetros de depreciación de un activo: método, fecha de inicio, vida útil en meses y valor residual. |
| **Libro contable** | Tributario, IFRS o Ambos — la mayoría de las empresas usa "Ambos", un solo libro. |
| **Documento de Activo Fijo** | El registro de cada movimiento: CAP (capitalización), MEJ (mejora), DEP/DEP_MAN (depreciación automática/manual), TRF/TRF_CLASE (transferencias), BAJA_VTA/BAJA_CAST (bajas) — cada uno con su asiento contable cuando corresponde. |
| **Cuadro de evolución** | El informe que muestra, por activo y por año: costo inicial, altas, bajas, costo final, depreciación acumulada inicial, del ejercicio, por bajas, final, y valor libro. |

Las cuentas contables se resuelven en dos niveles: primero la cuenta propia de la clase del activo; si no está configurada, el fallback GENERAL de "Determinación de cuentas".

---

## Flujo de uso paso a paso

1. **Configurar las clases de activo** (Activo Fijo → Clases de activo): código, nombre, y las 7 cuentas por libro (con fallback GENERAL si se omite alguna).
2. **Crear el activo** (Activo Fijo → Activos → Nuevo activo): descripción, clase, centro de costo y valoración. Nace en estado **Nuevo**.
3. **Capitalizar** (desde la ficha): fecha y costo por libro → asiento Debe Activo / Haber Compensación, y pasa a **Activo**.
4. **Ejecutar la depreciación mensual** (Activo Fijo → Ejecutar depreciación): simular y luego confirmar, mes a mes, sin saltarse ninguno.
5. **Durante la vida del activo** (desde "Más acciones" en la ficha): registrar una **mejora** (sube el costo), **transferir** centro de costo o clase, corregir con **depreciación manual**, o **dar de baja** (venta o castigo, total o parcial).
6. **Anular** un documento contabilizado (botón junto a cada fila en la tabla de documentos de la ficha) si algo quedó mal — genera una reversa, nunca edita el original.
7. **Cerrar el ejercicio del módulo** (Activo Fijo → Cierre de ejercicio) una vez bloqueados los 12 meses del año y ejecutada la depreciación de diciembre.
8. **Consultar el cuadro de evolución** (Informes → Cuadro de evolución) y el **pronóstico** de un activo (desde su ficha).

---

## Integración con Compras

Cuando se contabiliza una factura de compra, si la cuenta de imputación de una línea está marcada como tipo **Activo Fijo**, se crea automáticamente un activo nuevo enlazado a esa factura, en estado **Nuevo** y sin clase. El contador completa clase y valoración desde la ficha antes de capitalizar — nunca se capitaliza solo. Una factura sin líneas de Activo Fijo se contabiliza exactamente igual que antes.

---

## Motor de depreciación

Un solo método: **lineal sobre valor libro remanente** — se recalcula cada mes a partir del costo y la depreciación acumulada vigentes, así que absorbe sin problemas mejoras y bajas posteriores sin recalcular el pasado.

```
D_mes = (VL − VR) / r
```

`VL` = costo vigente (CAP + MEJ, menos el costo retirado por bajas) menos depreciación acumulada vigente; `VR` = valor residual; `r` = meses de vida útil que quedan.

**Ejemplo real, probado contra la base de datos**: activo capitalizado en $1.200.000 a 12 meses deprecia $100.000 exactos por mes. Al registrarle una mejora de $600.000 en el mes 3 (costo sube a $1.800.000, dep. acumulada $200.000, quedan 9 meses de los 12), la cuota del mes 3 sube automáticamente a $160.000 — sin tocar los asientos de los meses 1 y 2.

El sistema exige ejecutar los meses en orden (no se puede depreciar marzo sin haber depreciado febrero), y lo mismo en reversa al anular: solo se anula el período más reciente ya ejecutado.

---

## Bajas: cómo se calcula el resultado

Cada baja (venta o castigo) retira una porción del costo y de la depreciación acumulada — el 100% si es total, un porcentaje si es parcial (el activo sigue en servicio con el resto). El asiento usa una **cuenta puente de valor libro** (igual en espíritu al puente GR-IR de compras):

1. Debe Depreciación acumulada (la porción retirada) + Debe cuenta puente (el valor libro retirado) = Haber Activo (el costo retirado).
2. Debe/Haber la cuenta de contrapartida (si es venta, por lo efectivamente recibido) contra la cuenta puente.
3. La diferencia entre lo recibido y el valor libro va a Utilidad en baja (si es ganancia) o Pérdida en baja (si es pérdida). Un castigo total sin contrapartida manda todo el valor libro a Pérdida.

**Probado contra la base de datos**: un activo con costo $1.000.000 y depreciación acumulada $300.000 (valor libro $700.000), al darlo de baja al 50% por venta en $450.000, retira exactamente $500.000 de costo y $150.000 de depreciación (valor libro retirado $350.000) → utilidad de $100.000, y el activo sigue "Activo" con el 50% restante.

---

## Qué queda fuera de esta fase

- **Fase 3 — Tributario Chile**: los regímenes de depreciación acelerada del art. 31 N° 5 y N° 5 bis de la LIR (1/3, 1/10, instantánea Pro Pyme), la tabla de vidas útiles del SII, la corrección monetaria (art. 41 N° 2), el registro DDAN y la conciliación entre el libro financiero y el tributario.
- **Fase 4 — Complementos**: revalorización y deterioro bajo IFRS, métodos adicionales de depreciación (saldo decreciente, dígitos, unidades de producción), inventario físico con QR, aprobaciones por monto, e integración con el módulo de ventas (baja por venta desde una factura).

El modelo de datos ya está preparado para la Fase 3 (por ejemplo, el enum de métodos de depreciación ya incluye todos los métodos futuros), para que agregarla más adelante no requiera rehacer lo ya construido.

---

## Dónde está en el código

- **Esquema**: `packages/db/src/schema/activos-fijos*.ts` (9 tablas, incluye `activos_fijos_cierres`).
- **Motor de cálculo**: `packages/db/src/queries/activos-fijos-motor.ts`.
- **Queries**: `packages/db/src/queries/activos-fijos.ts`, `activos-fijos-clases.ts` y `activos-fijos-cierre.ts`.
- **Integración con compras**: hook en `contabilizarDocumentoCompra`, `packages/db/src/queries/documentos-compra.ts`.
- **Server Actions**: `packages/app/lib/actions/activos-fijos.ts`, `activos-fijos-config.ts` y `activos-fijos-cierre.ts`.
- **UI**: `packages/app/components/panel/activo-fijo-*.tsx`, `activos-fijos-*.tsx`, `cierre-activo-fijo-botones.tsx`; páginas en `packages/app/app/panel/[empresaId]/activos-fijos/` y `informes/activos-fijos/`.
