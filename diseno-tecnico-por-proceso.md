# Diseño Técnico por Proceso — ERP Contable Multiempresa
**Versión:** 1.1 (agrega ejemplo numérico al mecanismo de auto-asignación)
**Complementa a:** "Diseño Técnico ERP Contable v0.10" (organizado por módulo) y "Diagrama Entidad-Relación v0.7"
**Propósito:** mientras el documento de diseño por módulo explica **qué hace cada módulo**, este documento explica **cómo fluye el trabajo real de punta a punta**, cruzando varios módulos en cada proceso. Útil para entender el orden de las cosas, para armar wireframes/prototipo, y para explicarle el sistema a alguien sin que tenga que leer las 9 secciones del documento principal.

---

## Proceso 0 — Alta de una empresa cliente nueva

Ocurre una sola vez por cada empresa que la firma incorpora a su cartera.

1. Un usuario con rol adecuado crea la empresa cliente dentro de la firma contable (`empresas`, ver 3.1 del diseño por módulo), ingresando RUT, razón social, giro y régimen tributario.
2. Se completa el **asistente de inicialización** (módulo 4.9-A): moneda funcional, moneda de reporte (si aplica), si admite multi-moneda, y si la empresa requiere **NIIF** (`aplica_ifrs`).
3. Se elige la **plantilla de plan de cuentas** a clonar; el sistema genera automáticamente el árbol completo de `plan_cuentas` para esta empresa a partir de la plantilla.
4. Se define la **fecha del primer periodo contable**, generando el primer registro en `periodos_contables` con `estado = Abierto`.
5. Se asigna el **contador responsable** (`empresas.contador_asignado_id`) y se da acceso a los usuarios que van a trabajar con esta empresa (`usuario_empresa`), cada uno con su rol.
6. (Opcional, se puede completar después) Se cargan los centros de costo iniciales y las categorías contables más usadas para esta empresa.

**Resultado**: la empresa queda lista para recibir documentos y registrar asientos. Ningún otro proceso puede empezar antes de que este termine.

---

## Proceso 1 — Ciclo mensual de trabajo (la vista de conjunto)

Este es el proceso que un contador de la firma repite cada mes, para cada empresa de su cartera. Los procesos 2 a 8 de este documento son el detalle de cada paso.

1. **Importar documentos del mes**: RCV de compras y ventas, boletas de honorarios, cartola bancaria (procesos 2, 3, 4 y 6).
2. **Revisar documentos pendientes**: los que quedaron sin asignación automática (tercero nuevo, sin categoría contable) y los marcados como duplicados o notas de crédito sin vincular.
3. **Conciliar bancos** (proceso 6).
4. **Revisar informe de documentos extemporáneos**: documentos con fecha de un periodo ya cerrado que el sistema reencauzó al periodo abierto actual (ver Proceso 7).
5. **Generar asientos de ajuste de cierre**: depreciación del mes (proceso 8), provisiones, diferencias de cambio si la empresa opera en moneda extranjera, y ajustes NIIF si `aplica_ifrs = true` (proceso 9).
6. **Cerrar el periodo** (proceso 7).
7. **Generar y revisar informes**: balance 8 columnas, estado de resultados, informes NIIF si corresponde (proceso 10).
8. **Entregar informes al cliente** (fuera del alcance técnico de este documento, pero es el punto en que el ciclo mensual "termina" para el cliente).

---

## Proceso 2 — Compra: de la factura del proveedor al asiento contable

1. El sistema **importa el Registro de Compras** desde el archivo descargado del SII (o, en una fase futura, vía webservice).
2. Por cada línea del archivo, valida la **llave única** `(empresa_id, tercero_id, tipo_documento_id, folio)`; si ya existe, la marca como **duplicado** y no la reprocesa.
3. Busca el RUT del emisor en `terceros`. Si no existe, lo **crea automáticamente** con `pendiente_completar = true` y los datos mínimos del archivo.
4. Si el documento es una **nota de crédito/débito**, busca la factura relacionada por folio + RUT; si la encuentra, propone la anulación total/parcial; si no, queda pendiente de vinculación manual.
5. Busca la **categoría contable por defecto** del tercero (`terceros.categoria_contable_default_id`). Si existe, **propone automáticamente** la cuenta, el centro de costo y la clasificación (gasto/costo/activo/pasivo) en `documento_detalle_cuenta`.
6. El contador **confirma o corrige** la propuesta (o clasifica manualmente si el tercero no tenía categoría — y de paso puede asignarle una para el futuro).
7. Se define la **recuperabilidad del IVA** de la línea (total/parcial/no recuperable), calculando el prorrateo si corresponde.
8. El sistema **genera el asiento contable** automáticamente: IVA crédito fiscal + cuenta de gasto/costo/activo + cuenta por pagar al proveedor (cuenta puente, no una cuenta por RUT — ver 3.11 del diseño por módulo). El asiento queda con `libro = Ambos` salvo que el tratamiento tributario e IFRS difieran (ver Proceso 9).
9. El asiento generado queda **de solo lectura**: si algo estaba mal, se corrige el documento (paso 6) y el sistema regenera el asiento, nunca se edita el asiento directamente.

---

## Proceso 3 — Venta: de la factura emitida al asiento contable

Simétrico al Proceso 2, con estas diferencias:
1. Se importa el **Registro de Ventas** del SII en vez del de Compras.
2. El asiento generado es: cuenta por cobrar al cliente (cuenta puente) + IVA débito fiscal + cuenta de ingreso.
3. Las notas de crédito de venta funcionan igual que en compras (paso 4 del Proceso 2), pero reversando el ingreso en vez del gasto.

---

## Proceso 4 — Honorarios: de la boleta a la retención registrada

1. Se cargan las boletas del mes, **manualmente** o por **importación masiva** desde el SII.
2. Se determina el **rol** de la boleta: recibida (la empresa paga honorarios a un tercero) o emitida (poco común, la propia empresa emite la boleta).
3. El sistema busca la **tasa de retención vigente** en `tasas_retencion_honorarios` según la fecha de la boleta (nunca hardcodeada).
4. Si el prestador tiene **categoría contable** asignada, se propone automáticamente la cuenta de gasto a usar (ej. distinguir "Honorarios Legales" de "Honorarios Contables").
5. El sistema **calcula automáticamente** el monto retenido y el monto líquido a pagar.
6. Se **genera el asiento**: gasto por honorarios + retención por pagar + cuenta por pagar al prestador (o cuenta corriente si se paga al contado).
7. Al cierre del mes, el módulo alimenta el **reporte de retenciones para el F29** y, una vez al año, el **certificado F1879**.

---

## Proceso 5 — Auto-asignación por categoría contable (proceso transversal a 2, 3 y 4)

Este proceso no es un módulo en sí, sino el mecanismo que reduce el trabajo manual en Compras, Ventas y Honorarios simultáneamente. Cada documento necesita **dos cuentas contables**, resueltas por caminos distintos: la cuenta "puente" del tercero (siempre la misma para todos los proveedores/clientes de ese tipo) y la cuenta del otro lado del asiento (gasto, costo, activo o ingreso), que es la que resuelve este mecanismo.

1. La primera vez que aparece un tercero nuevo, **no hay categoría** — el contador clasifica el documento a mano.
2. En ese momento (o después, desde el mantenedor de terceros), el contador le asigna una **categoría contable** al tercero (ej. "Servicios Básicos", "Arriendo", "Honorarios Legales").
3. **Desde la siguiente importación**, cualquier documento de ese mismo tercero llega con la cuenta, el centro de costo y la clasificación ya propuestos — el contador solo confirma.
4. Si una categoría cambia de cuenta contable en el futuro, el sistema permite **reclasificación masiva** de los documentos históricos que usaron esa categoría (trazado vía `documento_detalle_cuenta.categoria_contable_id`).

**Ejemplo concreto**: llega una factura de electricidad por $150.000 + IVA ($28.500), de un proveedor ya clasificado con la categoría "Servicios Básicos":

| Línea del asiento | Monto | De dónde sale la cuenta |
|---|---|---|
| Proveedores Nacionales (Haber) | $178.500 | Cuenta puente asociada al proveedor |
| Gastos Básicos - Electricidad (Debe) | $150.000 | Cuenta de gasto de la categoría "Servicios Básicos" |
| IVA Crédito Fiscal (Debe) | $28.500 | Calculado directamente del documento |
| Centro de costo | — | Centro de costo por defecto de la categoría |

Todo el asiento se propone automáticamente; el contador solo confirma.

---

## Proceso 6 — Conciliación bancaria

1. Se **importa la cartola** mensual de una cuenta bancaria (`cuentas_bancarias`), en el formato parametrizado para ese banco.
2. El sistema intenta **conciliar automáticamente** cada movimiento de la cartola contra los movimientos ya contabilizados, cruzando monto + fecha + referencia.
3. Cuando hay **ambigüedad** (varios movimientos con igual monto y fecha), el sistema no adivina: los agrupa en una vista de **conciliación asistida** para que el contador resuelva manualmente, usando glosas y saldos acumulados como pista.
4. Las **partidas conciliatorias** que no tienen contrapartida contable (comisiones bancarias no registradas, cheques en tránsito) generan su propio **asiento automático** al confirmarse.
5. Al finalizar, queda disponible el **informe de conciliación bancaria** por cuenta y periodo — insumo directo para el cierre del mes (Proceso 1, paso 5).

---

## Proceso 7 — Cierre y reapertura de periodo

1. Antes de cerrar, el sistema verifica que el **periodo anterior** de la misma empresa ya esté cerrado (los cierres son secuenciales, no se puede saltar meses).
2. Se generan y revisan los **asientos de ajuste** pendientes del mes (depreciación, provisiones, diferencias de cambio, ajustes NIIF).
3. El usuario con permiso cierra el periodo: `periodos_contables.estado` pasa a `Cerrado`, quedando bloqueada la creación o edición de asientos con fecha dentro de ese rango.
4. **Documentos extemporáneos**: si más adelante llega un documento con fecha de este periodo ya cerrado, el sistema lo contabiliza en el **primer periodo abierto** (no lo rechaza), dejando registro de su fecha real de origen para revisión.
5. **Reapertura** (excepcional): solo el rol Administrador puede reabrir un periodo cerrado, debe indicar un motivo, y la acción queda en `bitacora_auditoria`. El periodo vuelve a `estado = Reabierto` y acepta asientos hasta que se cierre de nuevo.

---

## Proceso 8 — Activo Fijo: de la compra de un bien a su depreciación mensual

1. Un activo se da de alta **manualmente** o directamente desde un documento de Compras ya clasificado como "Activo" (Proceso 2, paso 6).
2. Se define el **método de depreciación** y la **vida útil**. Si la empresa aplica NIIF y el criterio difiere del tributario, se registran ambos (ver Proceso 9).
3. Cada mes, el sistema **calcula automáticamente la depreciación** y genera el asiento correspondiente — sin intervención manual, salvo revisión.
4. Si corresponde, se registra un **revalúo técnico** (`revaluos_activo_fijo`) o, para empresas con NIIF, una evaluación de **deterioro** (`deterioros_activo_fijo`), este último siempre en `libro = IFRS`.
5. Ante la **venta o baja** de un activo, el sistema calcula automáticamente la utilidad o pérdida resultante.

---

## Proceso 9 — Doble libro NIIF (solo empresas con `aplica_ifrs = true`)

Este proceso corre "en paralelo" a los procesos 2, 3, 4 y 8, sin que el contador de una empresa sin NIIF lo note.

1. Al generar cualquier asiento automático, el sistema evalúa si el tratamiento **tributario e IFRS coinciden** para ese tipo de operación.
2. Si coinciden (la mayoría de los casos: una factura de compra normal, una boleta de honorarios), se genera **un solo asiento** con `libro = Ambos`.
3. Si **difieren** (ej. un contrato de leasing, que bajo IFRS 16 se activa como derecho de uso y bajo la norma tributaria chilena puede seguir como gasto de arriendo), se generan **dos asientos separados**: uno `libro = Tributario` y otro `libro = IFRS`.
4. Al cierre de mes, el contador puede revisar el **Informe de Conciliación Tributario–IFRS**, que muestra las diferencias entre ambos libros cuenta por cuenta.
5. Los reportes filtran automáticamente por `libro` según lo que se esté generando: un F29 o balance tributario usa `libro IN (Tributario, Ambos)`; un Estado de Situación Financiera NIIF usa `libro IN (IFRS, Ambos)`.

---

## Proceso 10 — Generación de informes de cierre

1. Con el periodo cerrado (Proceso 7) y todos los asientos de ajuste contabilizados, el contador genera el **balance de 8 columnas** y el **estado de resultados**, filtrando siempre por `libro = Tributario/Ambos` salvo que pida la versión NIIF.
2. Puede generar informes **segmentados** por centro de costo, o el **auxiliar por tercero** (cuentas por cobrar/pagar con antigüedad de saldos).
3. Si la empresa tiene presupuesto cargado, se genera el **informe de presupuesto vs. ejecución** y el de **flujo de caja** (real y proyectado).
4. Si `aplica_ifrs = true`, se generan además los **4 estados financieros formales NIIF** (Situación Financiera clasificada, Resultado Integral, Cambios en el Patrimonio, Flujo de Efectivo) y el **Informe de Conciliación Tributario–IFRS**.
5. Todos los informes se pueden exportar a PDF o Excel para entregar al cliente.

---

## Cómo se relaciona este documento con los otros dos

- Si necesitas saber **qué campos tiene una tabla**, revisa el documento de diseño por módulo (secciones 3 y 4).
- Si necesitas ver las **relaciones entre tablas**, revisa el diagrama entidad-relación.
- Si necesitas entender **en qué orden ocurren las cosas** o armar un wireframe/prototipo que siga un flujo de uso real, usa este documento.
