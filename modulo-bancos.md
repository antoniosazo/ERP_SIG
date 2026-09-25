# Módulo de Bancos — Cómo funciona (Fase 1: Cartolas)
**Estado:** Fase 1 (Cartolas) implementada y en producción.
**Basado en:** especificación funcional "Módulo de Bancos (Pagos, Cartolas, Conciliación y Nómina de Pagos)", estilo SAP Business One.
**Propósito:** explicar en lenguaje llano qué hace hoy el módulo, cómo se usa, y qué queda para fases futuras.

---

## Qué ya existía antes de este módulo

El módulo de Bancos se construye sobre Tesorería, que ya estaba en producción:

- **Pagos recibidos y efectuados**, contabilizados al registrarse y anulables con asiento de reversa.
- **Cartera de cheques y depósitos**: los cheques recibidos quedan en una cuenta transitoria ("cheques en cartera") hasta que se depositan; se pueden protestar.
- **Cuentas bancarias de la empresa** (cada una ligada a su cuenta contable de tipo Banco) y **cuentas bancarias de clientes y proveedores**.

---

## Qué hace hoy (Fase 1)

- **Plantillas de cartola por banco**: le dicen al sistema cómo leer el archivo de un banco — qué columna (o qué posición, en archivos de ancho fijo) es la fecha, la glosa, el cargo, el abono, etc. Agregar un banco nuevo es configurar una plantilla, no programar.
- **Importación de cartolas** en Excel (.xlsx/.xls), CSV/TXT delimitado y TXT de ancho fijo, con vista previa antes de confirmar.
- **Validaciones** de la especificación (sección 5.4): cuadratura, continuidad con la cartola anterior, períodos bloqueados y movimientos repetidos.
- **Carga manual** de movimientos, para bancos sin archivo o para corregir.
- **Saldo inicial conciliado** por cuenta bancaria: el punto de partida de la conciliación.

Importar una cartola **no genera asientos**: solo registra lo que dice el banco. Calzarla contra la contabilidad es la Fase 2 (Conciliación).

---

## Conceptos clave

| Concepto | Qué es |
| --- | --- |
| **Cartola** | El extracto de movimientos de una cuenta bancaria para un período, con su saldo inicial y final. |
| **Plantilla de cartola** | La configuración que traduce el archivo de un banco a movimientos: tipo de archivo, codificación, filas a saltar, formato de fecha y de número, y el mapeo de cada campo. Una empresa puede tener varias por banco (el formato a veces cambia por producto). |
| **Regla de signo** | Si el banco trae cargo y abono en **columnas separadas**, o **una sola columna con signo** (positivo = abono, negativo = cargo). |
| **Huella** | Una firma de cada movimiento (cuenta + fecha + monto + N° documento + glosa). Si ya existe, el movimiento no se vuelve a importar. |
| **Cuadratura** | Saldo inicial + abonos − cargos = saldo final. Si no cierra, la cartola se rechaza. |

---

## Flujo de uso paso a paso

1. **Completar la cuenta bancaria** (Administración → Bancos y pagos → Cuentas bancarias): agregar el saldo inicial conciliado y su fecha.
2. **Crear la plantilla del banco** (Administración → Bancos y pagos → Formatos de cartola): elegir banco, tipo de archivo, formatos de fecha y número (por ejemplo `1.234,56` para el formato chileno), la regla de signo, y mapear cada campo a su columna (la primera columna es la 0) o a su posición y largo en archivos de ancho fijo.
3. **Importar** (Tesorería → Cartolas → Importar cartola): elegir la cuenta, la plantilla, el archivo, e ingresar el saldo inicial y final que informa el banco.
4. **Revisar la vista previa**: cada fila aparece como *Nuevo*, *Ya importado* o con su error. Arriba se ven los totales y si la cartola cuadra.
5. **Confirmar**: solo entran los movimientos nuevos.
6. Para un movimiento suelto, usar **Movimiento manual** en la lista de cartolas (monto negativo = cargo).

---

## Validaciones al importar

| Validación | Qué pasa si falla |
| --- | --- |
| Saldo inicial + abonos − cargos = saldo final | **Bloquea** la importación, con la diferencia exacta. |
| Fecha en un período contable "Bloqueado" o sin período generado | **Bloquea** esa fila (y por lo tanto la importación). |
| Movimiento ya importado (misma huella) | Se marca *Ya importado* y se omite; el resto entra. Si todos están repetidos, se rechaza. |
| Saldo inicial distinto del saldo final de la cartola anterior | **Advertencia**: probablemente falta un período, pero se puede confirmar. |
| Monto cero | La fila se ignora (filas en blanco comunes al final de un Excel). |

Esto permite subir cartolas con días traslapados sin duplicar nada.

**Probado contra la base de datos**: un Excel de 5 movimientos en formato chileno (con fila de encabezado y fila de totales que la plantilla salta) se importó completo; reimportarlo fue rechazado; una cartola traslapada con 1 movimiento viejo y 1 nuevo insertó solo el nuevo y advirtió el salto de saldo; una cartola que no cuadraba fue rechazada; un TXT de ancho fijo en Latin-1 leyó bien tildes y ñ.

---

## Qué queda para fases siguientes

- **Fase 2 — Conciliación bancaria**: reglas automáticas (referencia exacta, RUT + monto, monto + fecha, palabras clave como "COMISION"), pantalla manual de dos paneles, partidas pendientes con antigüedad, cierre mensual y asientos de comisiones y diferencias. Incluye el catálogo de códigos de transacción de cada banco.
- **Fase 3 — Nómina de pagos**: propuesta, aprobación por un segundo usuario, archivo para el banco y confirmación por cartola.
- **MT940 y CAMT.053**: formatos estructurados que se agregarán cuando haya archivos de muestra reales de un banco.
- **Pendientes del módulo de Pagos** (no de Bancos): pago a cuenta contable sin documento, retención de boletas de honorarios, pagos en moneda extranjera y aplicación posterior de anticipos.

---

## Dónde está en el código

- **Esquema**: `packages/db/src/schema/cartolas*.ts` (4 tablas) y dos columnas nuevas en `cuentas-bancarias.ts`.
- **Queries**: `packages/db/src/queries/cartolas.ts` y `cartolas-formatos.ts`.
- **Lectura de archivos**: `packages/app/lib/cartolas-parser.ts` (Excel vía `xlsx`, CSV y ancho fijo a mano) y `cartolas-mapeo.ts` (fechas, números y signo).
- **Server Actions**: `packages/app/lib/actions/cartolas.ts` y `cartolas-formatos.ts`.
- **UI**: `cartola-importar-form.tsx`, `cartolas-lista.tsx`, `cartola-movimiento-manual.tsx`, `cartolas-formatos-manager.tsx`; páginas en `tesoreria/cartolas/` y `configuracion/cartolas-formatos/`.
