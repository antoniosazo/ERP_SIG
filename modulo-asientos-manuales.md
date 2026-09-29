# Asientos manuales — Cómo funcionan
**Estado:** implementado; migración `0050` aplicada en la base configurada el 28 de septiembre de 2026.
**Basado en:** la ventana "Asiento" de SAP Business One (Finanzas → Asiento, Comprobante preliminar, Revertir transacciones) y en las reglas 2.3 y 4.1 del diseño técnico.
**Propósito:** explicar qué hace la pantalla de asientos, en qué se parece a SAP y en qué difiere.

---

## Dónde está

Menú **Finanzas → Asientos**. La lista es el **libro diario**: muestra los asientos manuales y también los generados por los módulos (compras, ventas, pagos, activo fijo, cierre). Se filtra por fechas, origen (manual o automático), estado y texto (N°, glosa o referencia).

---

## Cómo se crea un asiento

**Cabecera**
- **Fecha de contabilización**: define el período. Tiene que estar *Desbloqueado* o en *Período de cierre*.
- **Tipo**: Traspaso (por defecto), Ingreso, Egreso o **Ajuste de cierre**. Los de ajuste van en su propia columna del balance de 8 columnas.
- **Referencia** (como la Ref. 1 de SAP) y **glosa**. La glosa se copia a las líneas que no tengan la suya.
- **Libro** (Tributario / IFRS / Ambos): solo aparece si la empresa lleva doble libro.
- **Programar reversión** + fecha: para provisiones que se reversan al mes siguiente.

**Líneas**: cada una lleva una **cuenta de mayor**, un **socio de negocio**, o ambos, más su centro de costo, glosa y un monto en el debe **o** en el haber.
- Si se indica solo el socio, se usa su **cuenta asociada** (la del socio, si no la de su grupo, si no la regla general). Es lo mismo que el "Código SN" de SAP.
- Al agregar una línea, el sistema propone el monto que falta para cuadrar.

**Guardar borrador o Contabilizar**
- **Borrador** (el comprobante preliminar de SAP): se puede guardar descuadrado. No afecta saldos ni consume número. Se puede editar o eliminar.
- **Contabilizar**: exige que debe = haber, asigna el correlativo del año y el asiento queda **definitivo**.

---

## Validaciones

| Regla | Por qué |
| --- | --- |
| Debe = haber para contabilizar (con tolerancia de medio centavo) | Partida doble. |
| Solo cuentas imputables y activas de la empresa | Las cuentas de título no reciben movimientos. |
| Las cuentas de tipo Cliente/Proveedor exigen socio | Su saldo es la cuenta corriente de los socios. Sin socio, la cuenta corriente dejaría de cuadrar con el mayor. |
| "Requiere centro de costo" y "Requiere análisis por tercero" del plan de cuentas | Se respetan igual que en los documentos. |
| Socios y centros de costo activos | Nuevos movimientos solo sobre maestros vigentes. |
| El período no puede estar Bloqueado ni "Bloqueado excepto ventas" | Mismo criterio de períodos que el resto del sistema. |
| Cuentas en moneda extranjera fija quedan fuera por ahora | En esta fase los asientos manuales son solo en moneda funcional, igual que los pagos. |

---

## Corregir un asiento

Como en SAP, **un asiento contabilizado no se edita ni se borra**. Se **anula** (Datos → Cancelar en SAP), y el sistema:

1. pide el motivo y la fecha de la reversa (por defecto, la fecha del original);
2. crea un asiento nuevo con el debe y el haber invertidos, enlazado al original;
3. deja el original como "Revertido". Los dos se ven en el libro diario y se neutralizan en los saldos.

Si solo había un error de digitación, **Duplicar** abre un asiento nuevo con las mismas líneas, listo para corregir.

Los asientos **automáticos** siguen siendo de solo lectura (regla 2.3). Su ficha enlaza al documento que los generó, y se corrigen desde ahí.

**Reversiones programadas**: cuando llega la fecha de reversión de un asiento marcado "Programar reversión", la lista de asientos muestra un aviso con el botón **Ejecutar reversiones** (la ventana "Revertir transacciones" de SAP). Si alguna cae en un período bloqueado, se informa y queda pendiente.

---

## Detalles técnicos

- Tablas: `asientos_contables` / `asientos_lineas`. Un asiento es manual cuando `documento_origen_tabla` es nulo.
- `correlativo` es nulo **solo** en borradores. Lo garantiza el check `asientos_contables_correlativo_si_no_borrador`.
- La reversa de un asiento manual se guarda con `documento_origen_tabla = 'asientos_contables'` y `documento_origen_id` apuntando al original, y queda de solo lectura.
- Columnas nuevas: `referencia`, `fecha_reversa`, `usuario_id`.
- Informes, mayores y cuentas corrientes ya filtran `estado = 'contabilizado'`, así que los borradores no alteran saldos.
- Todo queda en la bitácora de auditoría (crear, editar, contabilizar, eliminar borrador, anular).
- Reglas puras y tests: `packages/db/src/queries/asientos-manuales-reglas.ts` (+ `.test.ts`).

## Pendiente para fases futuras

- **Plantillas de asiento** (por porcentaje) y **asientos periódicos/recurrentes** (Contabilizaciones periódicas de SAP).
- **Moneda extranjera** en líneas (monto en moneda origen + tipo de cambio).
- **Importar asientos** desde Excel.
- **Adjuntos** (respaldo del asiento).
- Guía interactiva en Capacitación.


## Validación técnica — 28 de septiembre de 2026

Se revisaron listado, nuevo asiento, borradores, detalle, permisos, anulación,
reversiones programadas y enlaces al documento origen. Se corrigieron:

- Acceso a la empresa comprobado en cada página antes de consultar datos; usuarios
  de consulta ven los borradores sin controles de edición. Solo Administrador,
  Contador y administrador de firma pueden crear, contabilizar, eliminar o revertir.
- Las etiquetas de tipos se comparten desde un módulo neutro: el servidor ya no
  intenta leer un objeto exportado desde un componente cliente.
- Fechas reales (también en anulación), rangos ordenados y rechazo de parámetros
  repetidos en filtros. La búsqueda de números fuera del rango de PostgreSQL se
  trata como texto.
- Los manuales admiten dos decimales y rechazan montos y totales que excedan la
  precisión permitida. No se aceptan líneas que se vuelvan cero al redondear.
  Los totales conservan los cuatro decimales de automáticos antes de redondear.
- El período se comprueba y mantiene bloqueado para lectura dentro de la misma
  transacción de contabilización o reversión. Los correlativos se asignan con
  bloqueo por empresa y año para evitar colisiones concurrentes entre módulos.
- Las reversiones programadas se cuentan como exitosas después del commit.
  Activar la programación sin indicar fecha produce un mensaje de validación.
- El detalle de un asiento originado en un pago enlaza a ese pago; el listado avisa
  cuando muestra solo los primeros 300 resultados.

**Estado de la base en la revisión inicial:** una consulta de solo lectura a `information_schema.columns`
confirmó que la base configurada aún no tiene `referencia`, `fecha_reversa` ni
`usuario_id` y conserva `correlativo NOT NULL`. La migración `0050` está pendiente.
No se modificaron datos contables ni se aplicaron migraciones durante la revisión.
La prueba funcional en navegador y el ciclo completo de guardado, contabilización
y reversión contra la base quedan pendientes de esa migración.

**Comprobaciones completadas:** 73 pruebas automatizadas aprobadas (19 de Finanzas),
TypeScript del monorepo, ESLint de componentes/acciones/rutas de Finanzas y build de
producción de Next.js. Estas comprobaciones no sustituyen la prueba funcional con
sesión y base migrada; no se probaron operaciones contables sobre datos reales.


## Corrección de la caída al abrir Asientos — 28 de septiembre de 2026

El registro del servidor confirmó errores en las consultas del diario y las
reversiones pendientes por las columnas ausentes de la migración `0050`.
Se contrastó el historial de migraciones: `0050_greedy_silver_sable` era la única
pendiente. Se aplicó correctamente mediante `pnpm --filter @erp/db db:migrate`.

El aviso de hidratación registrado señalaba exclusivamente el atributo
`cz-shortcut-listen="true"` añadido al `body` por la extensión ColorZilla.
Para evitar ese aviso, desactivar la extensión en el sitio o abrirlo en una sesión
sin extensiones. No se suprimen los avisos de hidratación de la aplicación.

Verificación posterior: las dos consultas que fallaban se ejecutaron correctamente
para la empresa afectada y el rango reportado: 74 asientos y 0 reversiones pendientes.
La comprobación fue contra la base, en modo lectura; no se crearon asientos de prueba.


## Navegación del detalle y trazabilidad

- El listado abre el detalle con los filtros de fechas, origen, estado y búsqueda.
  «Volver al listado» los conserva incluso al abrir el asiento en otra pestaña;
  los enlaces entre el asiento original y su reversa conservan ese mismo contexto.
- La cabecera identifica el documento origen por tipo y folio/número, con acceso
  directo. También presenta la moneda funcional, fecha, libro, referencia y usuario.
- Cada línea enlaza al mayor de su cuenta (desde el inicio del mes hasta la fecha
  del asiento), a la ficha del socio, su cuenta corriente y la ficha del centro de costo.
- Las referencias de línea se resuelven por identificador dentro de la misma empresa.
  Si una referencia no existe o es ambigua, se informa sin generar un enlace incorrecto.
- Los asientos en otras monedas muestran moneda, tipo de cambio y debe/haber de
  origen, separados de las columnas y totales en moneda funcional.
- Se agregaron fichas de consulta para documentos de activo fijo, centros de costo
  y cheques. El documento de activo fijo enlaza a los activos afectados y a su asiento
  o reversa; el cheque enlaza al pago, depósito y asiento de protesto cuando existen.
- Compras y ventas tienen enlace directo al asiento completo y desde el visor del
  asiento real. Pagos, depósitos y cierres incorporan el mismo enlace en sus tablas
  de asientos. La ficha del activo enlaza a cada documento y a su asiento.

Estas pantallas agregan consultas y navegación; los asientos contabilizados mantienen
las restricciones de edición y reversión existentes. No requieren una nueva migración.

**Validación de navegación:** 6 pruebas automatizadas aprobadas; compilación de
producción de Next.js y comprobación de TypeScript correctas; ESLint de los archivos
afectados sin errores (dos advertencias preexistentes). Las consultas de solo lectura
resolvieron 3 documentos origen y 8 líneas de asientos reales; la comprobación con
otra empresa no devolvió referencias. No se modificaron datos contables.
Queda pendiente la revisión visual de estas pantallas en una sesión autenticada.

## Auditoría de generación de asientos — 29 de septiembre de 2026

- Toda creación automática o reversa guarda el usuario responsable en la cabecera del
  asiento y crea una entrada propia en `bitacora_auditoria`, dentro de la misma
  transacción que el asiento y sus líneas.
- La entrada registra correlativo, fecha, glosa, tipo, libro, estado, origen, documento
  asociado, cantidad de líneas y totales de debe/haber en moneda funcional.
- Se conserva en paralelo la auditoría del documento origen. Las operaciones capaces de
  generar asientos requieren contexto de usuario también cuando se ejecutan desde SII.
- El historial del detalle consulta la auditoría directa. Para asientos anteriores a este
  cambio, si no existe una entrada directa, muestra como respaldo la del documento origen
  sin inventar usuarios ni fechas históricas.
- La pantalla general identifica Asientos contables, Documentos de activo fijo y Cierres
  de ejercicio con nombres legibles. El cambio no requiere una migración.

**Validación:** 67 pruebas del paquete de base de datos aprobadas, incluida la prueba
unitaria del resumen de auditoría; TypeScript del monorepo, ESLint de la interfaz,
compilación de producción de Next.js y `git diff --check` correctos. No se generaron
asientos ni se modificaron datos contables durante esta comprobación.
