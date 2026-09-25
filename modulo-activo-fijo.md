# Módulo de Activo Fijo — Cómo funciona (Fase 1 + Fase 2 + Fase 3)
**Estado:** Fase 1 (Núcleo), Fase 2 (Ciclo de vida completo) y Fase 3 (Tributario Chile) implementadas y en producción.
**Basado en:** especificación funcional y técnica "Módulo de Activo Fijo" (estilo SAP Business One, normativa Chile).
**Propósito:** explicar en lenguaje llano qué hace hoy el módulo, cómo se usa día a día, y qué queda pendiente para fases futuras — sin tener que leer la especificación completa de 22 páginas.

---

## Qué hace hoy

El módulo lleva el control contable **y tributario** completo de los activos fijos de una empresa (maquinaria, equipos, vehículos, etc.), desde que se compran hasta que se dan de baja:

- Un **maestro de activos** con código automático, clase, centro de costo y datos físicos.
- **Capitalización** y **mejoras** (capitalizaciones adicionales sobre un activo ya en servicio), incluyendo **obras en curso** que acumulan costo sin depreciar hasta que se activan.
- **Depreciación mensual automática** (lineal) con simulación previa, y **depreciación manual** para correcciones puntuales de un mes específico.
- **Regímenes tributarios de depreciación** (art. 31 LIR): Normal, Acelerada (vida útil ÷3) e Instantánea (100% Pro Pyme), con su propio libro Tributario independiente del libro financiero (IFRS).
- **Corrección monetaria** (art. 41 N°2 LIR) del libro Tributario, con los factores mensuales que carga la firma.
- **Registro DDAN** (Diferencia entre Depreciación Acelerada y Normal) por activo, listo para llevar al registro general de la empresa.
- **Transferencias** de centro de costo o de clase (con reclasificación contable automática si cambia la cuenta de Activo Fijo).
- **Bajas** por venta o castigo, totales o parciales, con el resultado (utilidad o pérdida) calculado automáticamente.
- **Anulación** de documentos contabilizados, con reversa contable — igual que el resto del sistema.
- **Pronóstico** de depreciación futura de un activo, y **conciliación Tributario/IFRS** lado a lado.
- **Cierre de ejercicio propio del módulo**, que congela el costo y la depreciación acumulada de cada activo al cierre del año.
- **Alta automática desde una factura de compra**, y un **informe de cuadro de evolución**.

Esto cierra las Fases 1, 2 y 3 de un plan de 4 — la última sección de este documento detalla qué queda para más adelante (IFRS: revalorización y deterioro).

---

## Conceptos clave

| Concepto | Qué es |
| --- | --- |
| **Clase de activo** | Agrupa activos similares y define sus 8 cuentas contables por defecto: activo, depreciación acumulada, gasto por depreciación, compensación de capitalización, las 3 de baja (valor libro puente, utilidad, pérdida), y corrección monetaria. |
| **Activo** | Un bien físico concreto, con su código, clase, centro de costo y estado: Nuevo → (En curso) → Activo → Dado de baja. |
| **Valoración** | Los parámetros de depreciación de un activo por libro: método, fecha de inicio, vida útil en meses, valor residual y (en Tributario) el régimen de depreciación. |
| **Libro contable** | Tributario, IFRS o Ambos — un activo puede llevar valoraciones distintas en cada libro (ej. Acelerada en Tributario, Normal en IFRS) o una sola si la empresa no separa ambos. |
| **Documento de Activo Fijo** | El registro de cada movimiento: CAP (capitalización), MEJ (mejora), DEP/DEP_MAN (depreciación automática/manual), TRF/TRF_CLASE (transferencias), BAJA_VTA/BAJA_CAST (bajas), CM (corrección monetaria) — cada uno con su asiento contable cuando corresponde. |
| **Cuadro de evolución** | El informe que muestra, por activo y por año: costo inicial, altas, bajas, costo final, depreciación acumulada inicial, del ejercicio, por bajas, final, y valor libro. |

Las cuentas contables se resuelven en dos niveles: primero la cuenta propia de la clase del activo; si no está configurada, el fallback GENERAL de "Determinación de cuentas".

---

## Flujo de uso paso a paso

1. **Configurar las clases de activo** (Activo Fijo → Clases de activo): código, nombre, y las 8 cuentas por libro (con fallback GENERAL si se omite alguna).
2. **Crear el activo** (Activo Fijo → Activos → Nuevo activo): descripción, clase, centro de costo y valoración. En el libro Tributario se puede elegir régimen Normal, Acelerada (con vida útil normal SII, buscable en el catálogo) o Instantánea. Nace en estado **Nuevo**.
3. **Capitalizar** (desde la ficha): fecha y costo por libro → asiento Debe Activo / Haber Compensación, y pasa a **Activo**.
4. **Ejecutar la depreciación mensual** (Activo Fijo → Ejecutar depreciación), por libro: simular y luego confirmar, mes a mes, sin saltarse ninguno.
5. **Durante la vida del activo** (desde "Más acciones" en la ficha): registrar una **mejora** (sube el costo), **transferir** centro de costo o clase, corregir con **depreciación manual**, consultar el **Registro DDAN** (si el activo es Acelerado), o **dar de baja** (venta o castigo, total o parcial).
6. **Anular** un documento contabilizado (botón junto a cada fila en la tabla de documentos de la ficha) si algo quedó mal — genera una reversa, nunca edita el original.
7. **Cargar los factores de corrección monetaria** del mes (Activo Fijo → Corrección monetaria) y **aplicarla** al cierre del año sobre el libro Tributario.
8. **Cerrar el ejercicio del módulo** (Activo Fijo → Cierre de ejercicio, por libro) una vez bloqueados los 12 meses del año y ejecutada la depreciación de diciembre.
9. **Consultar** el cuadro de evolución, la conciliación Tributario/IFRS y el pronóstico de un activo (Informes y ficha del activo).

---

## Integración con Compras

Cuando se contabiliza una factura de compra, si la cuenta de imputación de una línea está marcada como tipo **Activo Fijo**, se crea automáticamente un activo nuevo enlazado a esa factura, en estado **Nuevo** y sin clase. El contador completa clase y valoración desde la ficha antes de capitalizar — nunca se capitaliza solo. Una factura sin líneas de Activo Fijo se contabiliza exactamente igual que antes.

---

## Motor de depreciación

Dos métodos:

- **Lineal sobre valor libro remanente** (`D_mes = (VL − VR) / r`) — se recalcula cada mes a partir del costo y la depreciación acumulada vigentes, así que absorbe sin problemas mejoras, bajas y corrección monetaria posteriores sin recalcular el pasado. Cubre tanto el régimen tributario **Normal** como **Acelerado**: acelerar es, matemáticamente, lo mismo que depreciar lineal con una vida útil más corta (la vida útil SII dividida por 3).
- **Inmediata** (depreciación instantánea, régimen Pro Pyme) — el 100% del valor libro remanente en el primer período elegible, 0 en los siguientes.

`VL` = costo vigente (CAP + MEJ + CM, menos el costo retirado por bajas) menos depreciación acumulada vigente; `VR` = valor residual; `r` = meses de vida útil que quedan.

**Ejemplo real, probado contra la base de datos**: activo capitalizado en $1.200.000 a 12 meses deprecia $100.000 exactos por mes. Al registrarle una mejora de $600.000 en el mes 3 (costo sube a $1.800.000, dep. acumulada $200.000, quedan 9 meses de los 12), la cuota del mes 3 sube automáticamente a $160.000 — sin tocar los asientos de los meses 1 y 2. Con régimen Acelerada (vida normal 36 meses → vida efectiva 12) y otra valoración IFRS Normal a 60 meses sobre el mismo activo, cada libro deprecia con su propia cuota ($100.000 Tributario vs. $20.000 IFRS mensuales) sin interferir entre sí.

El sistema exige ejecutar los meses en orden (no se puede depreciar marzo sin haber depreciado febrero), y lo mismo en reversa al anular: solo se anula el período más reciente ya ejecutado.

---

## Bajas: cómo se calcula el resultado

Cada baja (venta o castigo) retira una porción del costo y de la depreciación acumulada — el 100% si es total, un porcentaje si es parcial (el activo sigue en servicio con el resto). El asiento usa una **cuenta puente de valor libro** (igual en espíritu al puente GR-IR de compras):

1. Debe Depreciación acumulada (la porción retirada) + Debe cuenta puente (el valor libro retirado) = Haber Activo (el costo retirado).
2. Debe/Haber la cuenta de contrapartida (si es venta, por lo efectivamente recibido) contra la cuenta puente.
3. La diferencia entre lo recibido y el valor libro va a Utilidad en baja (si es ganancia) o Pérdida en baja (si es pérdida). Un castigo total sin contrapartida manda todo el valor libro a Pérdida.

**Probado contra la base de datos**: un activo con costo $1.000.000 y depreciación acumulada $300.000 (valor libro $700.000), al darlo de baja al 50% por venta en $450.000, retira exactamente $500.000 de costo y $150.000 de depreciación (valor libro retirado $350.000) → utilidad de $100.000, y el activo sigue "Activo" con el 50% restante.

---

## Corrección monetaria y DDAN

**Corrección monetaria** (art. 41 N°2 LIR): reajusta el costo y la depreciación acumulada del libro Tributario según la variación de IPC que publica el SII cada mes. Al saldo que venía de años anteriores se le aplica el factor de diciembre; a cada alta (capitalización o mejora) del año se le aplica el factor de su propio mes de adquisición — mismo criterio que usa el SII. El ajuste nunca reduce el activo (un factor negativo se trata como 0). Genera un asiento: Debe Activo Fijo / Haber Corrección Monetaria por el ajuste de costo, y Debe Corrección Monetaria / Haber Depreciación Acumulada por el ajuste de la depreciación — se aplica en lote, por año, no activo por activo.

**Registro DDAN**: para un activo en régimen Acelerada, el sistema calcula en paralelo (sin contabilizarla nunca) la depreciación que habría correspondido con la vida útil normal completa, y la compara con la depreciación acelerada real: `DDAN = Depreciación Acelerada − Depreciación Normal`. Es la fórmula oficial del registro que exige la ley — el contador la lleva al registro general de rentas empresariales de la compañía.

**Probado contra la base de datos**: un activo Acelerado (vida normal 36 meses → efectiva 12) con 9 meses de depreciación real acumulada $900.000, frente a una depreciación normal hipotética de esos mismos 9 meses ($300.000 con la vida de 36 meses) → DDAN acumulado $600.000, exacto.

---

## Qué queda fuera de esta fase

- **Fase 4 — Complementos IFRS**: revalorización y deterioro bajo IFRS, métodos adicionales de depreciación financiera (saldo decreciente, dígitos, unidades de producción), inventario físico con QR, aprobaciones por monto, e integración con el módulo de ventas (baja por venta desde una factura).
- **Tabla completa de vidas útiles del SII**: solo se sembró un subconjunto representativo (~14 categorías comunes, Resolución Ex. N°43/2002); la firma agrega las categorías propias de sus clientes que falten.
- **Registros de Rentas Empresariales a nivel de empresa** (RAI/DDAN corporativo/REX/SAC): el sistema calcula el DDAN **por activo** — construir el registro completo de la compañía (que cruza con utilidades, retiros y dividendos de todos los orígenes, no solo activo fijo) es un módulo aparte.
- **Detección automática de elegibilidad de régimen tributario**: el sistema no decide si una empresa califica para Pro Pyme o acelerada — el contador lo indica explícitamente al configurar la valoración, bajo su propio criterio profesional.

El modelo de datos ya quedó preparado para varias de estas piezas desde Fase 1 (por ejemplo, el enum de tipos de documento ya reservaba "CM" desde el principio), para que agregar lo que falta no requiera rehacer lo ya construido.

---

## Dónde está en el código

- **Esquema**: `packages/db/src/schema/activos-fijos*.ts` (11 tablas, incluye `activos_fijos_cierres`, `activos_fijos_vidas_utiles_sii` y `factores_correccion_monetaria`).
- **Motor de cálculo**: `packages/db/src/queries/activos-fijos-motor.ts`.
- **Queries**: `packages/db/src/queries/activos-fijos.ts`, `activos-fijos-clases.ts`, `activos-fijos-cierre.ts`, `activos-fijos-tributario.ts` y `activos-fijos-vidas-utiles-sii.ts`.
- **Integración con compras**: hook en `contabilizarDocumentoCompra`, `packages/db/src/queries/documentos-compra.ts`.
- **Server Actions**: `packages/app/lib/actions/activos-fijos.ts`, `activos-fijos-config.ts`, `activos-fijos-cierre.ts` y `activos-fijos-tributario.ts`.
- **UI**: `packages/app/components/panel/activo-fijo-*.tsx`, `activos-fijos-*.tsx`, `cierre-activo-fijo-botones.tsx`, `correccion-monetaria-manager.tsx`, `vidas-utiles-sii-manager.tsx`; páginas en `packages/app/app/panel/[empresaId]/activos-fijos/` y `informes/activos-fijos*/`.
