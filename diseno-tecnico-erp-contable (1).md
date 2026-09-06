# Diseño Técnico — ERP Contable Multiempresa
**Versión:** 0.10 (aclara el mecanismo de asignación de cuentas con ejemplo)
**Fecha:** Agosto 2026
**Alcance:** Bajada de diseño funcional y de datos previa a la etapa de programación.

> **Cambios respecto a v0.9**: se agrega en 3.11 una explicación detallada de **por qué cada documento necesita dos cuentas contables** (la cuenta puente del tercero + la cuenta de la categoría contable), con un ejemplo numérico concreto, para que el mecanismo de auto-asignación quede completamente claro antes de implementarlo.

> **Cambios respecto a v0.8**: se agrega soporte para **IFRS mediante un modelo de doble libro**, activable por empresa (`empresas.aplica_ifrs`). Se agrega el campo `libro` (Tributario/IFRS/Ambos) a `asientos_contables`, `activos_fijos`, `depreciaciones` y `pasivos`, permitiendo que un mismo núcleo contable sirva tanto a clientes con contabilidad simple (un solo libro) como a clientes que requieren IFRS completo (libros paralelos con ajustes de conciliación). Se agrega `plan_cuentas.clasificacion_corriente` para el balance clasificado, `deterioros_activo_fijo` (IAS 36), el tratamiento de leasing bajo IFRS 16 (distinto del criterio tributario chileno), y en el módulo de Informes se agregan los 4 estados financieros formales IFRS más un Informe de Conciliación Tributario–IFRS. Varios criterios normativos quedan marcados **[Definir con equipo contable]** por ser decisiones que exceden el diseño técnico (umbral de "bajo valor" en leasing, método de flujo de efectivo, si se modela impuesto diferido).

> **Cambios respecto a v0.7**: se agrega la tabla **`periodos_contables`** (3.12), formalizando el cierre/apertura de periodo que hasta ahora era solo un concepto mencionado dentro del módulo de Contabilidad. Se reestructura el módulo 4.9 en un **Módulo de Configuración y Administración** completo, con 5 sub-módulos: (A) Inicialización de empresa, (B) Monedas y Tipos de Cambio, (C) Periodos Contables, (D) Mantenedores generales (plan de cuentas, centros de costo, tipos de documento, categorías contables, bancos, tasas de retención), y (E) Usuarios y Roles — agrupando bajo un mismo menú todo lo que antes estaba disperso entre distintas secciones del documento.
>
> **Cambios respecto a v0.6**: se agrega el **módulo de Configuración de Empresa y Tipos de Cambio**, inspirado en la ficha "Detalles Sociedad" de SAP Business One: un asistente de inicialización para dar de alta una empresa cliente (moneda funcional, moneda de reporte, plantilla de plan de cuentas a clonar, fecha de primer periodo) y un mantenedor de tipos de cambio con carga manual, importación masiva y sincronización opcional. La tabla `indicadores_economicos` de v0.2 se reemplaza por un modelo más flexible: `monedas` + `tipos_cambio`, que admite cualquier moneda o unidad de reajuste sin cambiar el esquema.
>
> **Cambios respecto a v0.5**: se agrega la tabla maestra **`categorias_contables`**, inspirada en el concepto de "Grupos de Artículos" de SAP Business One (donde cada artículo hereda cuentas contables predefinidas de su grupo), pero adaptada a un sistema sin inventario: aquí la categoría se asocia al **tercero** (proveedor, cliente o prestador de honorarios) en vez de a un producto. Esto formaliza y reemplaza lo que en v0.2 quedaba descrito solo como "reglas de auto-asignación por proveedor/giro", dándole una tabla y un flujo concretos en los módulos de Compras/Ventas y Honorarios.
>
> **Cambios respecto a v0.4**: se agrega la sección 8 con el stack de desarrollo completo (Next.js 16, Drizzle, Auth.js, colas para procesos pesados, testing, deployment), cerrando el pendiente de la sección 6.1. Se reordenaron los "próximos pasos" para reflejar el orden de construcción recomendado (maestros → núcleo contable → Honorarios → Compras/Ventas → Bancos → Informes).
>
> **Cambios respecto a v0.3**: se agrega una **clase fija de nivel 1** al plan de cuentas (Activo, Pasivo, Patrimonio, Ingresos, Costos y Gastos, Cuentas de Orden), inspirada en el modelo de "cajones" de SAP Business One pero adaptada y simplificada a norma contable chilena. Toda cuenta hereda la clase de su raíz, lo que hace que el balance 8 columnas y el EERR se puedan generar de forma confiable sin depender de que cada firma haya clasificado bien cada cuenta manualmente. Se confirma además, alineado con el mismo referente, que las cuentas de clientes/proveedores no se crean una por RUT sino que usan cuentas puente agregadas.
>
> **Cambios respecto a v0.2**: se agrega la entidad **Firma Contable** como nivel superior del sistema (el software es usado por una empresa de contabilidad que atiende una cartera de empresas cliente, no por cada empresa cliente de forma independiente). Esto afecta a usuarios, permisos, y agrega una dimensión nueva de reportería a nivel de la firma. Se asume, salvo que se indique lo contrario, que **el acceso al sistema es solo para el staff de la firma contable en la v1**; el acceso de clientes finales (portal de solo lectura) queda marcado como **[Definir con equipo contable]** para una fase posterior.
>
> **Cambios respecto a v0.1**: se resuelven explícitamente multi-moneda/UF, la relación entre asiento automático y documento origen, notas de crédito/débito, el cruce activo fijo–leasing, repactaciones de préstamos, informes auxiliares por tercero, y se detalla la auditoría y el manejo de errores en importaciones masivas. Los puntos marcados **[Definir con equipo contable]** son decisiones normativas/de negocio que este documento deja abiertas a propósito para validar contigo antes de modelar la base de datos.

---

## 1. Introducción y alcance

Este documento traduce los requerimientos funcionales en un modelo de diseño técnico: arquitectura general, modelo de datos (tablas maestras y transaccionales) y especificación de cada módulo. Es la base para el esquema de base de datos, los servicios/API y la interfaz de usuario en la siguiente etapa.

El sistema tiene **tres niveles de organización**:
1. **Firma contable**: el cliente real del software — una empresa de contabilidad que presta servicios a terceros.
2. **Empresas cliente**: cada empresa a la que la firma le lleva la contabilidad (lo que hasta la v0.2 llamábamos simplemente "empresa"). Cada una opera de forma independiente en plan de cuentas, periodos, documentos y saldos.
3. **Usuarios**: pertenecen a la firma contable (son su staff — socios, contadores, asistentes) y se les asigna acceso a un subconjunto de empresas cliente, con un rol específico en cada una.

Las tablas maestras transversales (bancos, tipos de documento, UF/UTM, tasas de retención) siguen siendo compartidas globalmente, ya que no dependen ni de la firma ni de la empresa cliente.

---

## 2. Arquitectura general

### 2.1 Enfoque multiempresa (multi-tenant) y cartera de clientes [actualizado]
Se recomienda **tenant por columna** (`empresa_id` en cada tabla transaccional) en lugar de base de datos por empresa: facilita informes consolidados, simplifica migraciones/respaldos, y es suficiente para el volumen esperado. `empresa_id` queda como llave de partición natural si más adelante se requiere aislamiento físico.

Se agrega un nivel superior de tenancy: `firma_contable_id`. En la práctica, cada `empresa` (cliente) pertenece a exactamente una `firma_contable`, así que basta con que `empresas.firma_contable_id` exista como FK — no es necesario propagar `firma_contable_id` a cada tabla transaccional, ya que siempre se puede llegar a ella navegando por `empresa_id`. Esto mantiene el modelo simple y evita duplicar la columna de tenancy en decenas de tablas.

Si en el futuro el software se vende también en modalidad "instalación dedicada" a una sola firma (una base de datos por firma), `firma_contable_id` es la llave de partición natural para ese escenario, igual que `empresa_id` lo es para el escenario "empresa cliente única".

### 2.2 Capas del sistema
1. **Capa de datos**: base de datos relacional (PostgreSQL recomendado por particionamiento, JSON e integridad referencial).
2. **Capa de servicios/API**: lógica de negocio (partida doble, cálculo de impuestos, conciliaciones, generación de asientos automáticos).
3. **Capa de integración**: conectores SII (RCV, Boletas de Honorarios) y bancos (cartolas).
4. **Capa de presentación**: aplicación web con selector de empresa activa y roles por usuario.
5. **Motor de reportes**: balance 8 columnas, EERR, informes por centro de costo, por tercero, presupuesto y flujo de caja, sobre vistas materializadas de saldos.

### 2.3 Principios de diseño contable
- Todo movimiento nace de un **asiento contable** con líneas balanceadas (debe = haber).
- Los módulos especializados **generan asientos automáticamente** hacia el núcleo; no existen saldos paralelos.
- **Regla de edición de asientos automáticos [nueva]**: un asiento cuyo origen es un documento (compra, venta, honorario, cartola, depreciación, cuota de préstamo) es de **solo lectura** en el módulo de contabilidad. Para corregirlo, el usuario corrige o anula el documento origen en su módulo, y el sistema regenera el asiento (anulando el anterior y creando uno nuevo, nunca sobrescribiendo). Solo los asientos de tipo "manual" son editables directamente en el módulo de contabilidad. Esto evita que el libro contable se desincronice de los módulos operativos.
- Cada línea de asiento puede llevar **centro de costo**, **tercero** y **documento de referencia** (trazabilidad).
- Los periodos contables se cierran mes a mes y año a año, con reapertura restringida a rol Administrador (ver 4.1).
- **Multi-moneda y UF [nuevo]**: toda línea de asiento registra `monto_moneda_origen`, `moneda_origen`, `tipo_cambio_aplicado` y `monto_moneda_funcional`. Existe una tabla `tipos_cambio` (ver 3.9) con el valor histórico de cada moneda/unidad de reajuste por fecha, usada por presupuesto, pasivos indexados y activos. **[Definir con equipo contable]**: si la v1 soporta multi-moneda real o solo CLP + UF, dejando USD para una segunda etapa.

---

## 3. Modelo de datos — Tablas maestras

### 3.0 Firma contable (`firmas_contables`) [nuevo]
| Campo | Tipo | Descripción |
|---|---|---|
| id | PK | |
| rut | string | RUT de la firma de contabilidad (el cliente real del software) |
| razon_social | string | |
| plan_contratado | enum | Define límites de uso (n° de empresas cliente, n° de usuarios) si el software se comercializa por suscripción |
| estado | enum | Activa / Suspendida |

Todos los `usuarios` pertenecen a una `firma_contable`. Todas las `empresas` (cliente) pertenecen a una `firma_contable` vía `firma_contable_id`.

### 3.1 Empresas cliente (`empresas`) [actualizado]
Igual que v0.1/v0.2 (rut, razón social, giro, dirección, representante legal, régimen tributario, fecha inicio actividades, moneda funcional, estado), agregando:
| Campo nuevo | Tipo | Descripción |
|---|---|---|
| firma_contable_id | FK | A qué firma contable pertenece esta empresa cliente |
| contador_asignado_id | FK a usuarios | Responsable principal de la cartera de esta empresa (además de los accesos generales vía `usuario_empresa`) |
| moneda_reporte_id | FK a monedas [nuevo] | Moneda secundaria opcional para reportar/consolidar (ej. una filial que lleva su contabilidad en CLP pero reporta a una casa matriz en USD). Si es null, se reporta solo en la moneda funcional. |
| permite_multimoneda | boolean [nuevo] | Si la empresa admite que sus cuentas y documentos registren montos en monedas distintas a la funcional (ver `admite_moneda_extranjera` en 3.2) |
| plan_cuentas_plantilla_id | FK [nuevo] | Plantilla de plan de cuentas desde la cual se clonó el árbol de esta empresa al inicializarla |
| fecha_primer_periodo_contable | date [nuevo] | Desde cuándo la empresa empieza a operar en el sistema (define el primer periodo abierto) |
| aplica_ifrs | boolean [nuevo] | Si esta empresa cliente requiere llevar contabilidad IFRS además de la tributaria (ver 4.1 y 4.8). La mayoría de las pymes de la cartera lo tendrán en `false` (un solo libro); se activa para clientes más grandes que necesitan reportar bajo IFRS. |

### 3.2 Plan de cuentas (`plan_cuentas`) [actualizado]
Igual que v0.1/v0.2 (código jerárquico, naturaleza, tipo, nivel imputable, requiere centro de costo, requiere análisis de terceros, cuenta SII relacionada), agregando:
| Campo nuevo | Tipo | Descripción |
|---|---|---|
| clase | enum | **Clase fija de nivel 1** (ver abajo). Solo se puede asignar en cuentas de nivel 1 (raíz del árbol); las cuentas hijas heredan la clase de su padre. |
| admite_moneda_extranjera | boolean | Si la cuenta puede llevar saldos en moneda distinta a la funcional |
| es_cuenta_ajuste | boolean | Marca cuentas usadas típicamente en asientos de cierre/ajuste, para el balance 8 columnas |
| clasificacion_corriente | enum [nuevo] | Corriente / No Corriente / No Aplica — solo relevante para cuentas de clase Activo o Pasivo. Requerido para armar el Estado de Situación Financiera clasificado que exige IFRS (ver 4.8); en empresas con `aplica_ifrs = false` puede dejarse en "No Aplica" sin afectar el resto del sistema. |

**Clase fija de nivel 1 [nuevo — inspirado en el modelo de "cajones" de SAP Business One, adaptado a norma contable chilena]**: a diferencia de v0.2, donde el árbol de `plan_cuentas` era completamente libre, se agrega una validación de que **toda cuenta de nivel 1 (raíz) debe pertenecer a una de estas 6 clases fijas**, y todas sus cuentas hijas heredan esa clase automáticamente:

| Clase | Tipo de saldo | Se cierra al fin de ejercicio |
|---|---|---|
| Activo | Balance | No |
| Pasivo | Balance | No |
| Patrimonio | Balance | No |
| Ingresos | Resultado (Ganancia) | Sí |
| Costos y Gastos | Resultado (Pérdida) | Sí |
| Cuentas de Orden | Memorándum | No |

Esto es más simple que el modelo de SAP Business One (que usa 8 cajones, separando Costo de Ventas, Gastos, Financiamiento y Otros Ingresos/Gastos en categorías distintas de nivel 1): en nuestro caso, esa subclasificación se resuelve **dentro** del árbol de "Ingresos" y "Costos y Gastos" usando los niveles inferiores (ej. `4.1 Ingresos Operacionales`, `5.2 Gastos Financieros`), lo que da el mismo resultado en los informes con menos rigidez para el usuario al armar su plan de cuentas.

**Por qué se agrega esto (a diferencia de v0.2, donde `tipo` era un campo libre por cuenta)**: el motor de balance 8 columnas y EERR necesita poder generar los informes de forma confiable sin depender de que cada firma haya clasificado correctamente cada cuenta individual. Al forzar la clase en el nivel 1 y heredarla hacia abajo, el árbol completo queda auto-consistente por construcción.

**Lo que deliberadamente no se replica del modelo SAP**: el límite de 10 niveles fijos (se mantiene la jerarquía libre vía `cuenta_padre_id` recursivo sin límite) y el bloqueo automático de cuentas intermedias (se mantiene el campo `nivel_imputable`, más flexible que forzar que solo el último nivel sea imputable).

**Cuentas de clientes/proveedores [confirmado, sin cambios respecto a v0.2]**: siguiendo el mismo enfoque que SAP Business One, el sistema **no crea una cuenta contable por cada RUT**. Cada tercero se asocia a una cuenta "puente" agregada de balance (ej. "Clientes Nacionales", "Proveedores Nacionales") vía `terceros.cuenta_contable_asociada`, y el detalle por tercero se consulta en el **informe de auxiliares por tercero** (ver 4.8), no en el plan de cuentas.

Se mantiene el **plan de cuentas tipo** (plantilla clonable al crear una empresa), que ahora viene pre-armado respetando las 6 clases de nivel 1.

### 3.3 Centros de costo (`centros_costo`)
Sin cambios respecto a v0.1.

### 3.4 Documentos mercantiles/tributarios (`tipos_documento`)
Sin cambios respecto a v0.1, agregando:
| Campo nuevo | Descripción |
|---|---|
| documento_relacionable | boolean | Si el tipo de documento puede referenciar a otro (ej. Nota de Crédito referencia una Factura) — ver 4.2 |

### 3.5 Usuarios y categorías [actualizado]
`usuarios` ahora lleva `firma_contable_id` (pertenecen al staff de la firma, no "sueltos" en el sistema). `roles` y `usuario_empresa` se mantienen igual: `usuario_empresa` sigue siendo la relación N:N que define a qué empresas cliente accede cada usuario y con qué rol, solo que ahora todas esas empresas caen dentro del universo de la misma `firma_contable` del usuario.

**Acceso de clientes finales [nuevo — Definir con equipo contable]**: por defecto, la v1 asume que **solo el staff de la firma contable** usa el sistema (los dueños de las empresas cliente no entran). El rol "Cliente" mencionado en v0.1 queda reservado para una fase futura, en la que se habilitaría un portal de solo lectura para que el dueño de una empresa cliente vea sus propios informes. Si esto se necesita desde la v1, hay que definir con precisión qué puede ver ese rol (probablemente: informes, no documentos en proceso de asignación ni asientos internos) antes de modelar los permisos en detalle.

La bitácora de auditoría se especifica en 3.8.

### 3.6 Maestro de RUT / terceros (`terceros`)
Igual que v0.1, agregando manejo explícito de doble rol:
| Campo nuevo | Descripción |
|---|---|
| es_emisor_boleta_honorarios | boolean | Si el tercero puede emitir boletas hacia la empresa |
| es_receptor_boleta_honorarios | boolean | Si la propia empresa emite boletas a este tercero (poco común pero posible en estructuras relacionadas) |
| categoria_contable_default_id | FK a categorias_contables [nuevo] | Categoría que se propone automáticamente al importar un documento de este tercero (ver 3.11) |

**Regla de creación automática [nuevo]**: si una importación (RCV, honorarios, cartola) trae un RUT no existente en `terceros`, el sistema crea un registro mínimo automáticamente (RUT + nombre desde el archivo origen) marcado `pendiente_completar = true`, y lo deja visible en un panel de "terceros por completar". No se bloquea la importación por esta causa. Al completar el tercero, se recomienda asignarle una `categoria_contable_default_id` en el mismo paso, para que las futuras importaciones vengan con la cuenta contable ya propuesta.

### 3.7 Bancos e instituciones financieras (`bancos`, `cuentas_bancarias`)
Igual que v0.1, agregando `moneda` explícita en `cuentas_bancarias` (para cuentas en USD).

### 3.8 Auditoría (`bitacora_auditoria`) [detallado]
| Campo | Descripción |
|---|---|
| id | PK |
| usuario_id | Quién |
| empresa_id | En qué empresa |
| tabla_afectada | Nombre de la entidad |
| registro_id | Id del registro modificado |
| accion | Crear / Editar / Anular / Aprobar |
| valores_anteriores | JSON con el estado previo |
| valores_nuevos | JSON con el estado posterior |
| timestamp | Fecha y hora |
| ip_origen | Opcional |

Se recomienda implementarlo a nivel de aplicación (no triggers de base de datos) para poder registrar el "por qué" además del "qué" cuando aplique, y para no depender del motor de base de datos.

### 3.9 Monedas y tipos de cambio (`monedas`, `tipos_cambio`) [actualizado — reemplaza `indicadores_economicos` de v0.2, inspirado en el detalle de "Detalles Sociedad" de SAP Business One]

En SAP Business One, la ficha de la sociedad define la moneda local, la moneda del sistema y si las cuentas admiten todas las monedas o solo algunas — nuestro sistema necesita el mismo concepto pero aplicado a una firma que administra **muchas empresas**, cada una con su propia configuración de monedas.

**`monedas`** (tabla global, compartida por todas las empresas/firmas):
| Campo | Tipo | Descripción |
|---|---|---|
| id | PK | |
| codigo | string | Código ISO o interno: CLP, USD, EUR, UF, UTM |
| nombre | string | Peso Chileno, Dólar Americano, Unidad de Fomento, etc. |
| tipo | enum | Moneda / Unidad de Reajuste (para distinguir CLP/USD/EUR de UF/UTM, que no son divisas pero se usan igual como base de conversión) |
| simbolo | string | $, US$, UF |
| decimales | integer | Cantidad de decimales a usar al mostrar montos en esta moneda/unidad |

**`tipos_cambio`** (histórico de valores, uno por moneda y fecha):
| Campo | Tipo | Descripción |
|---|---|---|
| fecha | date | PK compuesta junto con moneda_id |
| moneda_id | FK a monedas | PK compuesta |
| valor_en_clp | decimal | Valor de esa moneda/unidad en pesos chilenos para esa fecha |
| origen | enum | Manual / Importado archivo / Sincronizado API |

Esto reemplaza a `indicadores_economicos` de v0.2 con un modelo más flexible: en vez de un enum fijo de 3 indicadores (UF, UTM, Dólar Observado), cualquier moneda puede agregarse sin cambiar el esquema — útil si en el futuro una empresa cliente opera en EUR, UF y USD a la vez.

### 3.10 Tasas de retención de honorarios (`tasas_retencion_honorarios`) [nuevo]
| Campo | Descripción |
|---|---|
| vigente_desde / vigente_hasta | Rango de vigencia |
| porcentaje | Tasa aplicable (la tasa progresiva cambia por ley año a año) |

### 3.12 Periodos contables (`periodos_contables`) [nuevo — formaliza el concepto de cierre mencionado desde v0.1]

Hasta v0.7, el "cierre de periodo" se mencionaba como una característica del módulo de Contabilidad (4.1) pero sin una tabla propia — cada cierre/apertura vivía implícito en el estado de los asientos. Se formaliza como tabla explícita porque la apertura/cierre de periodos es, en la práctica, una **pantalla de configuración** que el contador usa activamente mes a mes, no solo una regla de fondo.

| Campo | Tipo | Descripción |
|---|---|---|
| id | PK | |
| empresa_id | FK | Cada empresa cliente cierra sus periodos de forma independiente |
| anio | integer | |
| mes | integer | |
| fecha_inicio / fecha_fin | date | Rango de fechas que cubre el periodo |
| estado | enum | Abierto / Cerrado / Reabierto |
| fecha_cierre | timestamp | Cuándo se cerró efectivamente |
| usuario_cierre_id | FK a usuarios | Quién ejecutó el cierre |
| motivo_reapertura | string | Obligatorio si `estado = Reabierto`, queda además registrado en `bitacora_auditoria` |

**Funciones de la pantalla de Periodos Contables:**
- Vista de calendario/lista por empresa mostrando el estado de cada mes (abierto, cerrado, reabierto).
- **Cerrar un periodo**: bloquea la creación o edición de asientos con fecha dentro de ese rango, salvo asientos de tipo **ajuste** generados explícitamente durante el proceso de cierre (ver 4.1).
- **Reabrir un periodo**: acción restringida al rol Administrador, exige un motivo, y desde ese momento el periodo vuelve a aceptar asientos hasta que se cierre de nuevo.
- Se relaciona directamente con la regla de "periodos abiertos hacia atrás" (4.1): cuando un documento extemporáneo llega con fecha de un periodo ya cerrado, el sistema lo redirige al primer periodo con `estado = Abierto` en esta tabla, en vez de rechazarlo.
- No se puede cerrar un periodo si el periodo anterior de la misma empresa sigue abierto (los cierres son secuenciales, no se pueden saltar meses).

### 3.11 Categorías contables (`categorias_contables`) [nuevo — inspirado en "Grupos de Artículos" de SAP Business One]

En SAP Business One, cada artículo pertenece a un **grupo de artículos**, y ese grupo trae preconfiguradas las cuentas contables (ingresos, costo, existencias, etc.) que se usan automáticamente al vender o comprar un artículo de ese grupo — el usuario nunca elige la cuenta manualmente documento por documento. Nuestro sistema no maneja inventario ni artículos (no es su alcance), pero el mismo principio de **determinación automática de cuenta por categoría** se adapta directamente a los documentos de Compras, Ventas y Honorarios, reemplazando y formalizando lo que en v0.2 quedó descrito solo como "reglas de auto-asignación por proveedor o giro".

| Campo | Tipo | Descripción |
|---|---|---|
| id | PK | |
| empresa_id | FK | Cada empresa cliente define sus propias categorías (o se clonan desde una plantilla, igual que el plan de cuentas tipo) |
| nombre | string | Ej. "Servicios Básicos", "Arriendo", "Materiales de Oficina", "Honorarios Profesionales", "Mercadería para Reventa" |
| aplica_a | enum | Compra / Venta / Honorario / Ambos |
| cuenta_gasto_id | FK a plan_cuentas | Cuenta a usar cuando el documento se clasifica como Gasto (Compras) |
| cuenta_ingreso_id | FK a plan_cuentas | Cuenta a usar en Ventas |
| cuenta_costo_id | FK a plan_cuentas | Cuenta a usar cuando se clasifica como Costo |
| cuenta_activo_id | FK a plan_cuentas | Cuenta a usar cuando se clasifica como Activo |
| centro_costo_default_id | FK a centros_costo | Opcional — centro de costo que se propone por defecto |
| iva_recuperable_default | enum | Opcional — valor por defecto de recuperabilidad de IVA (ver 4.2) para esta categoría |

**Cómo se usa (flujo de auto-asignación):**
1. Cada `tercero` (proveedor, cliente o prestador de honorarios) puede tener una `categoria_contable_default_id` asociada — ej. el proveedor de electricidad queda etiquetado como "Servicios Básicos".
2. Cuando se importa un documento (RCV u honorarios) de ese tercero, el sistema **propone automáticamente** la cuenta contable, el centro de costo y la clasificación (gasto/costo/activo) según la categoría del tercero — el contador solo confirma, en vez de elegir todo manualmente cada vez.
3. Si el tercero no tiene categoría asignada (por ejemplo, es nuevo y quedó `pendiente_completar`, ver 3.6), el documento simplemente queda sin auto-asignación y se clasifica a mano esa primera vez — el contador puede aprovechar ese momento para asignarle una categoría al tercero y que las próximas importaciones ya vengan resueltas.
4. La categoría usada en cada documento se guarda en `documento_detalle_cuenta.categoria_contable_id` (ver 4.2) para trazabilidad y para permitir reclasificación masiva si una categoría cambia de cuenta contable en el futuro.

**Diferencia clave con el modelo de SAP**: en SAP la categoría se asocia al **artículo** (producto); en nuestro caso, como no hay artículos, se asocia al **tercero** — el mismo patrón de "clasificar una vez, heredar automáticamente después", aplicado a quién emite el documento en vez de qué producto contiene.

**Por qué cada documento necesita dos cuentas, no una [aclaración importante]**: al contabilizar una factura de compra (o venta, u honorario), el asiento siempre involucra **dos cuentas distintas**, cada una resuelta por un mecanismo diferente:

1. **La cuenta "puente" del tercero** (`terceros.cuenta_contable_asociada`, ver 3.6) — la cuenta agregada de Proveedores o Clientes (ej. "Proveedores Nacionales"), la misma para todos los terceros de ese tipo. Como se explicó en 3.2, **no se crea una cuenta por cada RUT**.
2. **La cuenta del otro lado del asiento** (gasto, costo, activo o ingreso) — esta es la que resuelve `categorias_contables` según la categoría del tercero, y es la que varía documento a documento según **qué es** lo que se compró o vendió.

**Ejemplo concreto**: llega una factura de electricidad por $150.000 + IVA ($28.500), de un proveedor ya clasificado con la categoría "Servicios Básicos":

| Línea del asiento | Monto | De dónde sale la cuenta |
|---|---|---|
| Proveedores Nacionales (Haber) | $178.500 | `terceros.cuenta_contable_asociada` del proveedor |
| Gastos Básicos - Electricidad (Debe) | $150.000 | `categorias_contables.cuenta_gasto_id` de "Servicios Básicos" |
| IVA Crédito Fiscal (Debe) | $28.500 | Calculado directamente del documento |
| Centro de costo | — | `categorias_contables.centro_costo_default_id` de "Servicios Básicos" |

Todo el asiento se **propone automáticamente**; el contador solo confirma. Este mismo mecanismo aplica igual en Compras, Ventas y Honorarios (4.2, 4.3) — cambia únicamente qué campo de `categorias_contables` se usa (`cuenta_gasto_id`, `cuenta_ingreso_id`, `cuenta_costo_id` o `cuenta_activo_id`) según el tipo de operación y la clasificación elegida.

---

## 4. Módulos funcionales

### 4.1 Módulo de Contabilidad (núcleo)
Entidades: `asientos_contables` (fecha, glosa, **tipo**: manual / traspaso / ingreso / egreso / **ajuste** / automático-origen-documento, origen, estado: borrador/contabilizado/anulado, **correlativo por empresa y año**, **libro**: Tributario / IFRS / Ambos), `asientos_lineas` (cuenta, centro de costo, tercero, glosa, monto debe, monto haber en moneda origen y funcional, documento de referencia).

**Cambios respecto a v0.1**:
- Se agrega el tipo **ajuste**, usado en cierres (provisiones, reclasificaciones, diferencias de cambio), diferenciado de "manual" para que el balance 8 columnas pueda distinguir movimiento operativo de ajuste de cierre.
- **Asientos automáticos son de solo lectura** (ver principio 2.3); su corrección pasa por el documento origen.
- **Periodos "abiertos hacia atrás" [nuevo]**: cuando llega un documento con fecha de un periodo ya cerrado (ej. una boleta de honorarios de enero importada en marzo), el sistema no lo rechaza: lo contabiliza en el **primer periodo con `estado = Abierto` en `periodos_contables`** (ver 3.12), con una glosa que indica el periodo de origen real, y lo deja disponible en un informe de "documentos extemporáneos" para que el contador decida si amerita una reapertura formal. **[Definir con equipo contable]**: si se prefiere bloquear en vez de reencauzar automáticamente.
- **Cierre y reapertura de periodo [actualizado]**: se gestiona desde la tabla `periodos_contables` (3.12), no como un flag suelto — cada empresa cierra sus periodos de forma secuencial (no se puede cerrar un mes si el anterior sigue abierto), y la reapertura queda restringida a rol Administrador con motivo obligatorio.
- Libro diario y libro mayor por cuenta, y libro mayor **auxiliar por tercero** (ver 4.8).

**Doble libro — Tributario vs. IFRS [nuevo]**: para empresas con `aplica_ifrs = true` (ver 3.1), el sistema mantiene **dos libros contables paralelos sobre la misma base de datos**, distinguidos por el campo `asientos_contables.libro`:
- **`Ambos`** (el caso por defecto): el asiento aplica idéntico en ambos libros — es lo que generan automáticamente Compras/Ventas, Honorarios y Bancos en el día a día, ya que la gran mayoría de los movimientos no difieren entre norma tributaria e IFRS.
- **`Tributario`**: asiento que solo existe para efectos del SII (ej. depreciación acelerada permitida tributariamente, tratamiento de un leasing como gasto de arriendo bajo la norma tributaria chilena).
- **`IFRS`**: asiento de ajuste que solo existe para efectos financieros (ej. activación de un derecho de uso por leasing bajo IFRS 16, deterioro de activos según IAS 36, depreciación bajo el método/vida útil que exige IFRS cuando difiere de la tributaria).

Para empresas con `aplica_ifrs = false`, todos los asientos se generan con `libro = Ambos` y el concepto de doble libro es transparente — no se le pide al contador ninguna decisión extra. **Esto evita construir dos sistemas separados**: el mismo núcleo de asientos sirve para clientes simples y para clientes que requieren IFRS completo, activando o desactivando el doble libro por empresa.

Los informes (4.8) filtran por `libro`: un reporte tributario usa asientos con `libro IN (Tributario, Ambos)`; un estado financiero IFRS usa `libro IN (IFRS, Ambos)`.

### 4.2 Módulo de Compras y Ventas (RCV del SII)
Entidades: `documentos_compra`, `documentos_venta` (folio, tipo documento, fecha emisión, tercero, montos neto/exento/IVA/total, estado de asignación, **documento_relacionado_id**), `documento_detalle_cuenta` (imputación a cuenta, centro de costo, clasificación gasto/costo/activo/pasivo, **categoria_contable_id**).

**Cambios respecto a v0.1**:
- **Notas de crédito/débito [nuevo]**: se modelan como documentos propios que referencian a `documento_relacionado_id` (la factura original). Al importarse, el sistema busca automáticamente la factura por folio+RUT emisor; si la encuentra, ofrece anulación total o parcial (con selección de qué líneas/montos afecta); si no la encuentra, queda pendiente de vinculación manual. El asiento de la nota de crédito reversa proporcionalmente el asiento de la factura, no crea una reversa genérica.
- **Duplicados [nuevo]**: llave única `(rut_emisor, tipo_documento, folio, empresa_id)`. Un documento repetido en una nueva importación se marca como duplicado y no se reprocesa, mostrando un aviso.
- **IVA parcialmente irrecuperable / gasto rechazado (Art. 21) [nuevo]**: cada línea de imputación puede marcarse `iva_recuperable = total / parcial / no recuperable`, generando automáticamente el prorrateo del crédito fiscal y el registro del gasto rechazado en la cuenta correspondiente. **[Definir con equipo contable]**: el criterio de prorrateo a usar por defecto.
- **Auto-asignación por categoría contable [actualizado — reemplaza "reglas de auto-asignación por proveedor/giro" de v0.2]**: al importar un documento, el sistema busca la `categoria_contable_default_id` del tercero (ver 3.6 y 3.11) y **propone automáticamente** la cuenta, el centro de costo y la clasificación en `documento_detalle_cuenta`; el contador confirma o corrige. Si el tercero no tiene categoría asignada, el documento queda para clasificación manual y esa clasificación puede usarse para asignarle una categoría al tercero de ahí en adelante.

### 4.3 Módulo de Honorarios
Entidades: `boletas_honorarios` (folio, prestador, **rol: emitida por la empresa / recibida por la empresa**, fecha, monto bruto, % retención tomado de `tasas_retencion_honorarios` vigente a la fecha, monto retenido, monto líquido, estado de pago, **categoria_contable_id**).

**Cambios respecto a v0.1**:
- Se agrega el campo **rol** explícito para separar boletas que la empresa **recibe** (gasto + retención por pagar) de boletas que la empresa **emite** (ingreso, poco común pero posible), ya que generan asientos contables distintos.
- La tasa de retención ya no se hardcodea: se busca en `tasas_retencion_honorarios` según la fecha de la boleta, permitiendo que cambie año a año sin tocar código.
- **Auto-asignación por categoría contable [nuevo]**: igual que en Compras/Ventas, si el prestador tiene `categoria_contable_default_id` asignada (ej. "Honorarios Legales" vs. "Honorarios Contables", cada una con su propia cuenta de gasto), el sistema propone automáticamente la cuenta de gasto a usar. Útil cuando la firma quiere distinguir contablemente distintos tipos de honorarios en vez de usar una única cuenta genérica.
- Importación masiva y generación de asiento igual que v0.1.
- Reporte mensual para F29 y certificado anual F1879 se mantiene.

### 4.4 Módulo de Bancos (conciliación bancaria)
Entidades: `cartolas_bancarias`, `conciliaciones` (sin cambios estructurales).

**Cambios respecto a v0.1**:
- **Estrategia de desempate [nuevo]**: cuando existen múltiples movimientos candidatos con igual monto y fecha, el sistema no concilia automáticamente — los deja agrupados en una vista de "conciliación asistida" donde el usuario resuelve con un clic (mostrando glosas y saldos acumulados como pista), en vez de arriesgar una conciliación automática incorrecta.
- Cuentas bancarias en moneda extranjera: el registro de conciliación guarda el monto en la moneda de la cuenta y el equivalente en moneda funcional al tipo de cambio del día.

### 4.5 Módulo de Presupuesto y Flujo de Caja
Entidades: `presupuestos`, `presupuesto_detalle`, `flujo_caja_proyectado` (sin cambios estructurales).

**Cambios respecto a v0.1**:
- **Versionamiento real [nuevo]**: el campo `version` de `presupuestos` ahora se usa explícitamente — se distingue **Presupuesto Original** (versión 1, no editable una vez aprobado) de **Reformulaciones** (versión 2, 3…, cada una con fecha de aprobación). Los informes de presupuesto vs. ejecución permiten elegir contra qué versión comparar.
- El flujo de caja proyectado incorpora explícitamente **pagos/cobros parciales y en cuotas** de documentos de compra/venta y de pasivos (4.7), no solo el monto total pendiente.

### 4.6 Módulo de Activo Fijo y Control de Inversiones
Entidades: `activos_fijos` (agrega **libro**: Tributario / IFRS / Ambos), `depreciaciones` (agrega **libro**), `inversiones`, `deterioros_activo_fijo` [nuevo].

**Cambios respecto a v0.1**:
- **Revalúo técnico [nuevo]**: se agrega `revaluos_activo_fijo` (fecha, valor anterior, valor revaluado, cuenta de superávit de revalorización), para activos que lo requieran.
- **Cruce con leasing [actualizado — ver también 4.7 e IFRS 16 abajo]**: cuando un contrato de leasing se clasifica como **leasing financiero**, el bien se activa en `activos_fijos` con origen "leasing" y se deprecia normalmente, mientras que la deuda vive en `pasivos` (4.7). Cuando se clasifica como **leasing operativo** bajo el criterio tributario chileno, no se activa: solo se registra el gasto de arriendo mensual. **[Definir con equipo contable]**: el criterio de clasificación financiero/operativo a aplicar para efectos tributarios.
- **Leasing bajo IFRS 16 [nuevo]**: para empresas con `aplica_ifrs = true`, el estándar vigente (IFRS 16) exige activar **casi todos** los arriendos como "derecho de uso" en el libro IFRS, con excepciones para contratos de corto plazo (menor a 12 meses) o de bajo valor — a diferencia del criterio tributario chileno, que puede seguir tratando el mismo contrato como gasto de arriendo. En la práctica, un mismo leasing puede generar: un asiento `libro = Tributario` (gasto de arriendo mensual) y, en paralelo, un activo `activos_fijos` con `libro = IFRS` (derecho de uso) más su depreciación y el pasivo por arrendamiento correspondiente en `libro = IFRS`. **[Definir con equipo contable]**: umbral de "bajo valor" y tratamiento de contratos de corto plazo.
- **Depreciación con métodos distintos por libro [nuevo]**: cuando el método o la vida útil difiere entre la norma tributaria (ej. depreciación acelerada) y IFRS (vida útil económica real), `depreciaciones` genera dos registros por periodo — uno con `libro = Tributario` y otro con `libro = IFRS` — en vez de uno solo con `libro = Ambos`. Si ambos coinciden, se genera un único registro con `libro = Ambos`, sin duplicar trabajo.
- **Deterioro de activos — impairment (`deterioros_activo_fijo`) [nuevo — solo aplica a empresas con `aplica_ifrs = true`]**: registro periódico de la evaluación de deterioro exigida por IAS 36. Campos: activo_id, fecha, valor_libro_antes, valor_recuperable_estimado, monto_deterioro, cuenta_perdida_deterioro. El asiento generado siempre es `libro = IFRS`, ya que el deterioro normalmente no es deducible tributariamente en Chile. **[Definir con equipo contable]**: periodicidad de la evaluación (anual, ante indicios) y método de estimación del valor recuperable a usar por defecto.

### 4.7 Módulo de Control de Pasivos
Entidades: `pasivos` (tipo: préstamo, **leasing financiero**, proveedor, acreedor; tercero, monto original, moneda/indexación UF, tasa, plazo, **libro**: Tributario / IFRS / Ambos), `pasivo_cuotas` (capital, interés, saldo).

**Cambios respecto a v0.1**:
- **Repactaciones y prepagos [nuevo]**: se agrega `pasivo_movimientos_extraordinarios` (tipo: repactación / prepago, fecha, monto, saldo insoluto antes/después), que dispara el recálculo de la tabla de amortización desde ese punto en adelante, conservando el historial de cuotas ya pagadas sin alterarlas.
- Indexación en UF: `pasivo_cuotas` puede calcular capital e interés en UF y su equivalente en CLP usando `tipos_cambio`.
- **Pasivo por arrendamiento IFRS 16 [nuevo]**: cuando un leasing se activa como derecho de uso en el libro IFRS (ver 4.6), el pasivo correspondiente se registra aquí con `libro = IFRS`, generando su propia tabla de amortización financiera (separada de cualquier tratamiento tributario del mismo contrato).

### 4.8 Módulo de Informes
Sin cambios estructurales en balance 8 columnas, EERR, informes por centro de costo, presupuesto y flujo de caja. Se agrega:
- **Informe de auxiliares por tercero [nuevo]**: cuentas por cobrar y por pagar detalladas por cliente/proveedor, con antigüedad de saldos (30/60/90+ días), directamente solicitado como uno de los informes más usados en la operación diaria y que no estaba contemplado en v0.1.
- El balance 8 columnas ahora distingue explícitamente movimiento operativo (asientos tipo manual/traspaso/ingreso/egreso/automático) de **ajustes de cierre** (tipo ajuste, ver 4.1), como columna separada.
- **Informes a nivel de firma contable [nuevo]**: dado que el sistema ahora modela explícitamente la firma como entidad, se agrega una dimensión de reportería operativa para la firma misma (no para sus clientes): cantidad de empresas atendidas, documentos pendientes de asignación por empresa, carga de trabajo por contador asignado, estado de avance del cierre mensual por cartera. Esto es un tablero de control interno de la firma, distinto de los informes contables que se generan para cada empresa cliente.
- **Estados financieros IFRS [nuevo — solo visible para empresas con `aplica_ifrs = true`]**: usando únicamente asientos con `libro IN (IFRS, Ambos)`, se generan los 4 estados formales exigidos por IFRS, distintos del balance 8 columnas (que sigue siendo una herramienta de trabajo interna, no un estado financiero formal):
  - **Estado de Situación Financiera** (clasificado en corriente/no corriente, usando `plan_cuentas.clasificacion_corriente`).
  - **Estado de Resultado Integral** (incluye el Otro Resultado Integral — ej. superávit de revalorización, diferencias de conversión de moneda extranjera).
  - **Estado de Cambios en el Patrimonio Neto**.
  - **Estado de Flujo de Efectivo** (método directo o indirecto — **[Definir con equipo contable]**: cuál usar por defecto).
- **Informe de Conciliación Tributario–IFRS [nuevo]**: reporte que compara, cuenta por cuenta o partida por partida, el saldo bajo `libro = Tributario` vs. `libro = IFRS` para un periodo dado, mostrando la diferencia — equivalente a un papel de trabajo de conciliación entre resultado tributario y resultado financiero. Útil tanto para revisar consistencia como para la eventual declaración de impuesto diferido (IAS 12), que queda fuera del alcance de esta versión pero para la cual este informe es la base natural. **[Definir con equipo contable]**: si se requiere modelar impuesto diferido (IAS 12) en una fase posterior.

### 4.9 Módulo de Configuración y Administración [ampliado — agrupa todo lo conversado sobre inicialización, monedas, periodos y mantenedores]

Este módulo reúne, bajo un mismo menú de "Configuración", todas las pantallas que un contador usa para **parametrizar** el sistema antes y durante la operación — a diferencia de los módulos 4.1 a 4.8, que son de uso operativo diario. Se divide en cinco sub-módulos:

**A. Inicialización de empresa** (asistente de alta de empresa cliente)

Pantalla de configuración inicial que se completa una sola vez al dar de alta una empresa cliente en la cartera de la firma (equivalente a la ficha "Detalles Sociedad" de SAP Business One, adaptada al modelo multiempresa):
- Datos generales de la empresa (ya cubiertos en 3.1: rut, razón social, giro, régimen tributario).
- **Moneda funcional** (`empresas.moneda_funcional`): la moneda en la que se lleva la contabilidad principal — normalmente CLP.
- **Moneda de reporte** (`empresas.moneda_reporte_id`, opcional): si la empresa necesita reportar/consolidar en una moneda distinta a la funcional.
- **¿Admite multi-moneda?** (`empresas.permite_multimoneda`): si se activa, las cuentas y documentos de esta empresa pueden registrar montos en monedas distintas a la funcional.
- **Plantilla de plan de cuentas a clonar** (`empresas.plan_cuentas_plantilla_id`): selecciona el plan de cuentas tipo desde el cual se genera el árbol inicial de la empresa.
- **Fecha del primer periodo contable** (`empresas.fecha_primer_periodo_contable`): genera automáticamente el primer registro en `periodos_contables` (3.12) con `estado = Abierto`.
- Centros de costo iniciales (opcional, se puede completar después).

Al completar el asistente, el sistema clona el plan de cuentas de la plantilla elegida y deja la empresa lista para operar.

**B. Monedas y tipos de cambio**

Pantalla para administrar `monedas` y `tipos_cambio` (3.9), con tres formas de carga:
- **Ingreso manual**: cargar el valor de una moneda/unidad para una fecha específica.
- **Importación masiva**: subir un archivo (CSV/Excel) con el histórico de una moneda para un rango de fechas.
- **Sincronización automática [opcional — Definir con equipo contable]**: para UF, UTM y Dólar Observado existen fuentes públicas (Banco Central de Chile) que permiten traer el valor del día automáticamente; para otras monedas se mantiene la carga manual o por archivo.
- **Validación al contabilizar**: si un asiento requiere el tipo de cambio de una fecha sin valor cargado, el sistema advierte y bloquea la contabilización en vez de usar el último valor disponible sin confirmación explícita. **[Definir con equipo contable]**: si se prefiere permitir continuar con advertencia visible.
- Vista de historial editable por moneda, con indicador de fechas sin valor cargado (huecos).

**C. Periodos contables [nuevo]**

Pantalla de calendario/lista por empresa que administra `periodos_contables` (3.12):
- Ver el estado de cada mes (Abierto / Cerrado / Reabierto).
- Cerrar el periodo actual (bloquea nuevos asientos en ese rango de fechas, salvo asientos de ajuste de cierre).
- Reabrir un periodo cerrado (solo Administrador, con motivo obligatorio, registrado en bitácora).
- Alerta si se intenta cerrar un mes cuando el anterior todavía está abierto (los cierres son secuenciales).

**D. Mantenedores generales**

Agrupa, bajo el mismo menú de Configuración, la administración de las tablas maestras ya definidas en la sección 3, para que queden accesibles como pantallas CRUD estándar sin necesidad de detallarlas de nuevo aquí:
- Plan de Cuentas (3.2) y plantillas de plan de cuentas.
- Centros de Costo (3.3).
- Tipos de Documento (3.4) — normalmente de solo lectura para el usuario final, ya que son códigos oficiales del SII.
- Categorías Contables (3.11) — creación y edición de categorías con sus cuentas asociadas.
- Bancos e Instituciones Financieras (3.7).
- Tasas de Retención de Honorarios (3.10) — normalmente mantenida por el equipo de la firma cuando cambia la ley, no por cada contador.

**E. Usuarios y roles**

Administración de `usuarios`, `roles` y `usuario_empresa` (3.5): alta de nuevos contadores de la firma, asignación de qué empresas cliente puede ver cada uno y con qué rol, y gestión de permisos por rol. Incluye también la asignación del `contador_asignado_id` de cada empresa (3.1).

---

## 5. Integraciones externas (SII y bancos)

Sin cambios respecto a v0.1: importación de archivo (CSV/XLSX) como estrategia inicial para RCV y Boletas de Honorarios, con webservice + certificado digital como evolución futura. Cartolas bancarias por archivo, con parser configurable por banco.

**Reforzado**: toda importación pasa por una etapa de **validación de fila** (RUT válido, folio no duplicado, montos cuadrados) antes de crear registros; las filas que fallan validación se reportan en un log de importación visible al usuario, sin detener el resto del archivo.

---

## 6. Consideraciones técnicas pendientes de definir

1. **Stack tecnológico** (backend, frontend, base de datos).
2. **Alcance de multi-moneda en la v1**: ¿CLP + UF solamente, o también USD real? (afecta 2.3, 4.5, 4.7).
3. **Criterio de clasificación de leasing** (financiero vs. operativo) a aplicar por defecto.
4. **Política de periodos cerrados**: reencauzar automáticamente documentos extemporáneos vs. bloquear y exigir reapertura formal.
5. **Criterio de prorrateo de IVA parcialmente irrecuperable** (Art. 21).
6. **Priorización de módulos para el MVP**, considerando que ahora Compras/Ventas y Contabilidad tienen más superficie (notas de crédito, IVA parcial) de lo estimado en v0.1.
7. **Acceso de clientes finales**: confirmar si la v1 requiere un portal de solo lectura para los dueños de las empresas cliente, o si el sistema es exclusivamente para uso interno de la firma (supuesto actual del documento).
8. **Modelo comercial de la firma**: si el software se va a licenciar/vender con límites por plan (n° de empresas cliente, n° de usuarios), definir esas reglas para completar `firmas_contables.plan_contratado`.

---

## 8. Stack de desarrollo recomendado [nuevo]

Definición del stack técnico para la construcción del sistema (complementa la sección 6, que dejaba esto como pendiente).

### 8.1 Frontend / Framework
- **Next.js 16** (App Router, Turbopack por defecto) + **React 19.2**.
- **TypeScript** en modo estricto — no negociable en un sistema contable, donde un error de tipo en un monto puede tener consecuencias reales.
- **Tailwind CSS + shadcn/ui** para componentes de tabla, formulario y combobox (selector de cuentas, centros de costo, terceros).
- **TanStack Table** para las grillas de datos pesadas (libro diario, RCV, cartolas) — shadcn no trae tabla con paginación/filtrado/virtualización propia.
- **React Hook Form + Zod** para formularios (asientos, activos, pasivos), con el mismo schema de validación compartido entre cliente y servidor.

### 8.2 Backend / Lógica de negocio
- **Server Actions** de Next.js para mutaciones interactivas (crear asiento, asignar documento, conciliar).
- **Route Handlers** para webhooks/integraciones externas y endpoints que consume el worker de colas (ver 8.5).
- **Zod** también en el borde del servidor — nunca confiar solo en la validación del cliente.

### 8.3 Base de datos
- **PostgreSQL** (gestionado: Neon, Supabase o RDS).
- **Drizzle ORM** + **Drizzle Kit** para migraciones versionadas como SQL explícito, en vez de Prisma: da control más directo sobre tipos `numeric`/`decimal` de Postgres (crítico para montos contables — nunca usar `float`/`double`), y mejor manejo de consultas complejas de reportes (balance 8 columnas, EERR) y jerarquías recursivas (`plan_cuentas`, `centros_costo`).
- Particionamiento nativo de Postgres para las tablas de mayor crecimiento (`asientos_lineas`, `documentos_compra`, `documentos_venta`, `cartolas_bancarias`), como ya se indicó en el diagrama entidad-relación.

### 8.4 Autenticación y autorización
- **Auth.js (NextAuth v5)** con sesión custom que incluya `firma_contable_id` y el mapa de `empresa_id → rol` del usuario — se prefiere sobre un servicio de terceros tipo Clerk porque su modelo de "organizations" no calza con la jerarquía de 3 niveles (firma → cartera de empresas → roles por empresa) definida en este documento.
- Capa de autorización propia (middleware + validación en cada Server Action) que confirme el rol del usuario en la empresa activa antes de cualquier escritura — es lógica de negocio propia, no delegable a una librería.

### 8.5 Procesos pesados / colas
- **Inngest** o **Trigger.dev** para: importación de RCV/honorarios, procesamiento de cartolas, cálculo de depreciaciones/amortizaciones mensuales, cierre de periodo. Cualquier proceso que pueda exceder el tiempo de ejecución de una función serverless va aquí, nunca en una Server Action.

### 8.6 Storage de archivos
- **Amazon S3** o **Supabase Storage** (compatible S3) para conservar los archivos originales subidos (RCV, cartolas, honorarios) además de los datos ya parseados — permite reprocesar o auditar si algo falla en la importación.

### 8.7 Reportes / exportación
- **@react-pdf/renderer** o Puppeteer para PDF de reportes con estructura tabular fija (balance 8 columnas).
- **ExcelJS** para exportación a Excel con control de formato (más adecuado que SheetJS para reportes financieros con estilos).

### 8.8 Testing
- **Vitest** para pruebas unitarias, con foco especial en la lógica de cálculo (depreciación, amortización, retención de honorarios, cuadratura de asientos) — son las partes del sistema donde un error tiene costo económico real.
- **Playwright** para pruebas end-to-end de los flujos críticos (crear asiento, importar RCV, conciliar banco).

### 8.9 Observabilidad
- **Sentry** para errores en producción.
- Los dashboards propios de Inngest/Trigger.dev para depurar ejecuciones fallidas del worker de colas (importaciones, cierres).

### 8.10 Deployment
- **Vercel** para la aplicación Next.js.
- El worker de colas (Inngest/Trigger.dev) corre como servicio gestionado aparte, sin necesidad de infraestructura propia adicional.

### 8.11 Estructura de repositorio
Se recomienda **Turborepo** con paquetes separados:
- `app` — aplicación Next.js.
- `db` — schema de Drizzle y tipos compartidos.
- `shared` — schemas de Zod y utilidades de cálculo financiero (depreciación, amortización, retención).

Esto facilita reusar `db` y `shared` el día que se construya el portal de solo lectura para clientes finales (ver punto 7 de la sección 6, marcado como pendiente de definir), sin duplicar lógica de negocio entre dos aplicaciones.

---

## 9. Próximos pasos sugeridos

1. Resolver con el equipo contable los puntos marcados **[Definir con equipo contable]** en este documento — son decisiones normativas, no técnicas. Los de IFRS (leasing bajo IFRS 16, deterioro, flujo de efectivo, impuesto diferido) son especialmente importantes de cerrar antes de construir 4.6-4.8, ya que afectan directamente el modelo de datos.
2. Priorizar módulos para el MVP considerando la superficie real (ver punto 6.6). **El doble libro IFRS (campo `libro` y `aplica_ifrs`) se recomienda construir desde el inicio del núcleo contable aunque no se use de inmediato** — es mucho más barato incluirlo en el esquema desde el día 1 que agregarlo después sobre datos ya cargados. Orden de construcción recomendado: **Configuración y Administración (4.9): inicialización de empresa, monedas/tipos de cambio, periodos contables** → tablas maestras restantes → núcleo contable (con campo `libro` desde el inicio) → Honorarios → Compras/Ventas → Bancos → Informes básicos → Informes IFRS (cuando haya un cliente que los necesite).
3. Diseñar wireframes/prototipo clic-navegable de las pantallas clave: importación RCV con manejo de notas de crédito, asiento contable, conciliación bancaria asistida.
4. Definir contratos de API entre módulos, en particular el flujo "documento origen → asiento automático → regeneración ante corrección".
5. Iniciar el proyecto en el stack definido en la sección 8, comenzando por el esquema de base de datos (Drizzle) de las tablas maestras y el núcleo contable.
