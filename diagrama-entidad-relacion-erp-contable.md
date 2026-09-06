# Diagrama Entidad-Relación — ERP Contable Multiempresa
**Versión:** 0.7 — complementa el documento "Diseño Técnico ERP Contable v0.9"

> **Cambio respecto a v0.6**: se agrega soporte IFRS mediante el campo **`libro`** (Tributario/IFRS/Ambos) en `ASIENTOS_CONTABLES`, `ACTIVOS_FIJOS`, `DEPRECIACIONES` y `PASIVOS`, activable por empresa vía `EMPRESAS.aplica_ifrs`. Se agrega `PLAN_CUENTAS.clasificacion_corriente` (para el balance clasificado) y la entidad `DETERIOROS_ACTIVO_FIJO` (IAS 36).
**Formato:** Mermaid (`erDiagram`). Se puede visualizar pegando cada bloque en https://mermaid.live, en la extensión de Mermaid de VS Code, o directamente en GitHub/GitLab (que renderizan mermaid en markdown).

> **Cambio respecto a v0.1**: se agrega `FIRMAS_CONTABLES` como entidad de nivel superior. El software es usado por una firma de contabilidad (el cliente real) que atiende una cartera de `EMPRESAS` (clientes). Los `USUARIOS` pertenecen a la firma, no "sueltos" en el sistema.
>
> El modelo completo se dividió en 8 diagramas por dominio funcional para que sean legibles. Al final se incluye un diagrama de "mapa general" solo con las entidades y sus relaciones principales, sin atributos, para ver el conjunto completo de una vez.

---

## 1. Núcleo — firma contable, cartera de empresas y seguridad

```mermaid
erDiagram
    FIRMAS_CONTABLES ||--o{ USUARIOS : emplea
    FIRMAS_CONTABLES ||--o{ EMPRESAS : atiende
    EMPRESAS ||--o{ USUARIO_EMPRESA : "da acceso en"
    USUARIOS ||--o{ USUARIO_EMPRESA : "accede a"
    ROLES ||--o{ USUARIO_EMPRESA : "define permisos de"
    USUARIOS ||--o| EMPRESAS : "es contador asignado de"
    USUARIOS ||--o{ BITACORA_AUDITORIA : "genera"
    EMPRESAS ||--o{ BITACORA_AUDITORIA : "pertenece a"

    FIRMAS_CONTABLES {
        uuid id PK
        string rut
        string razon_social
        string plan_contratado
        string estado
    }
    EMPRESAS {
        uuid id PK
        uuid firma_contable_id FK
        uuid contador_asignado_id FK
        uuid moneda_reporte_id FK
        uuid plan_cuentas_plantilla_id FK
        string rut
        string razon_social
        string regimen_tributario
        string moneda_funcional
        boolean permite_multimoneda
        boolean aplica_ifrs
        date fecha_primer_periodo_contable
        string estado
    }
    USUARIOS {
        uuid id PK
        uuid firma_contable_id FK
        string nombre
        string email
        boolean mfa_habilitado
        string estado
    }
    ROLES {
        uuid id PK
        string nombre
        json permisos
    }
    USUARIO_EMPRESA {
        uuid id PK
        uuid usuario_id FK
        uuid empresa_id FK
        uuid rol_id FK
    }
    BITACORA_AUDITORIA {
        uuid id PK
        uuid usuario_id FK
        uuid empresa_id FK
        string tabla_afectada
        uuid registro_id
        string accion
        json valores_anteriores
        json valores_nuevos
        timestamp fecha
    }
```

---

## 2. Tablas maestras

```mermaid
erDiagram
    EMPRESAS ||--o{ PLAN_CUENTAS : tiene
    PLAN_CUENTAS ||--o{ PLAN_CUENTAS : "cuenta padre de"
    EMPRESAS ||--o{ CENTROS_COSTO : tiene
    CENTROS_COSTO ||--o{ CENTROS_COSTO : "centro padre de"
    EMPRESAS ||--o{ CUENTAS_BANCARIAS : posee
    BANCOS ||--o{ CUENTAS_BANCARIAS : emite
    PLAN_CUENTAS ||--o{ CUENTAS_BANCARIAS : "cuenta contable asociada"
    PLAN_CUENTAS ||--o{ TERCEROS : "cuenta auxiliar asociada"
    EMPRESAS ||--o{ CATEGORIAS_CONTABLES : define
    CATEGORIAS_CONTABLES ||--o{ TERCEROS : "categoría por defecto de"
    PLAN_CUENTAS ||--o{ CATEGORIAS_CONTABLES : "cuentas asociadas (gasto/ingreso/costo/activo)"
    CENTROS_COSTO ||--o{ CATEGORIAS_CONTABLES : "centro de costo por defecto"
    MONEDAS ||--o{ EMPRESAS : "moneda de reporte de"
    MONEDAS ||--o{ TIPOS_CAMBIO : "tiene histórico en"
    PLAN_CUENTAS ||--o| EMPRESAS : "plantilla clonada por"

    PLAN_CUENTAS {
        uuid id PK
        uuid empresa_id FK
        uuid cuenta_padre_id FK
        string codigo_cuenta
        string nombre_cuenta
        string clase
        string naturaleza
        string tipo
        string clasificacion_corriente
        boolean nivel_imputable
        boolean requiere_centro_costo
        boolean requiere_analisis_terceros
        boolean admite_moneda_extranjera
        boolean es_cuenta_ajuste
    }
    CENTROS_COSTO {
        uuid id PK
        uuid empresa_id FK
        uuid centro_padre_id FK
        string codigo
        string nombre
        string estado
    }
    TIPOS_DOCUMENTO {
        uuid id PK
        string codigo_sii
        string nombre
        string tipo_operacion
        boolean afecto_iva
        boolean documento_relacionable
    }
    CATEGORIAS_CONTABLES {
        uuid id PK
        uuid empresa_id FK
        string nombre
        string aplica_a
        uuid cuenta_gasto_id FK
        uuid cuenta_ingreso_id FK
        uuid cuenta_costo_id FK
        uuid cuenta_activo_id FK
        uuid centro_costo_default_id FK
        string iva_recuperable_default
    }
    TERCEROS {
        uuid id PK
        string rut
        string razon_social
        string tipo_tercero
        uuid cuenta_contable_asociada FK
        uuid categoria_contable_default_id FK
        decimal retencion_honorarios_pct
        boolean es_emisor_boleta_honorarios
        boolean pendiente_completar
    }
    BANCOS {
        uuid id PK
        string nombre
        string codigo_sbif
    }
    CUENTAS_BANCARIAS {
        uuid id PK
        uuid empresa_id FK
        uuid banco_id FK
        string numero_cuenta
        string moneda
        uuid cuenta_contable_asociada FK
        string formato_cartola_esperado
    }
    MONEDAS {
        uuid id PK
        string codigo
        string nombre
        string tipo
        string simbolo
        int decimales
    }
    TIPOS_CAMBIO {
        date fecha PK
        uuid moneda_id PK, FK
        decimal valor_en_clp
        string origen
    }
    TASAS_RETENCION_HONORARIOS {
        date vigente_desde PK
        date vigente_hasta
        decimal porcentaje
    }
```

---

## 3. Núcleo contable (asientos)

```mermaid
erDiagram
    EMPRESAS ||--o{ ASIENTOS_CONTABLES : registra
    EMPRESAS ||--o{ PERIODOS_CONTABLES : define
    PERIODOS_CONTABLES ||--o{ ASIENTOS_CONTABLES : "acota fecha de"
    USUARIOS ||--o{ PERIODOS_CONTABLES : "cierra/reabre"
    ASIENTOS_CONTABLES ||--|{ ASIENTOS_LINEAS : contiene
    PLAN_CUENTAS ||--o{ ASIENTOS_LINEAS : imputa
    CENTROS_COSTO ||--o{ ASIENTOS_LINEAS : clasifica
    TERCEROS ||--o{ ASIENTOS_LINEAS : "asocia a"

    PERIODOS_CONTABLES {
        uuid id PK
        uuid empresa_id FK
        int anio
        int mes
        date fecha_inicio
        date fecha_fin
        string estado
        timestamp fecha_cierre
        uuid usuario_cierre_id FK
        string motivo_reapertura
    }
    ASIENTOS_CONTABLES {
        uuid id PK
        uuid empresa_id FK
        int correlativo
        date fecha
        string glosa
        string tipo
        string origen
        string libro
        string estado
        uuid documento_origen_id
        string documento_origen_tabla
    }
    ASIENTOS_LINEAS {
        uuid id PK
        uuid asiento_id FK
        uuid cuenta_id FK
        uuid centro_costo_id FK
        uuid tercero_id FK
        string glosa
        decimal monto_debe_origen
        decimal monto_haber_origen
        string moneda_origen
        decimal tipo_cambio_aplicado
        decimal monto_debe_funcional
        decimal monto_haber_funcional
        uuid documento_referencia_id
    }
```
> `documento_origen_id` / `documento_origen_tabla` en `ASIENTOS_CONTABLES` es la referencia polimórfica hacia el documento que generó el asiento automático (factura, boleta de honorarios, movimiento de cartola, cuota de depreciación, cuota de préstamo). Se usa para bloquear la edición directa (regla de 2.3 del documento de diseño) y para poder regenerar el asiento si el documento origen se corrige.

---

## 4. Compras y ventas (RCV del SII)

```mermaid
erDiagram
    EMPRESAS ||--o{ DOCUMENTOS_COMPRA : registra
    EMPRESAS ||--o{ DOCUMENTOS_VENTA : registra
    TERCEROS ||--o{ DOCUMENTOS_COMPRA : "proveedor de"
    TERCEROS ||--o{ DOCUMENTOS_VENTA : "cliente de"
    TIPOS_DOCUMENTO ||--o{ DOCUMENTOS_COMPRA : clasifica
    TIPOS_DOCUMENTO ||--o{ DOCUMENTOS_VENTA : clasifica
    DOCUMENTOS_COMPRA ||--o{ DOCUMENTOS_COMPRA : "nota crédito/débito de"
    DOCUMENTOS_VENTA ||--o{ DOCUMENTOS_VENTA : "nota crédito/débito de"
    DOCUMENTOS_COMPRA ||--|{ DOCUMENTO_DETALLE_CUENTA : detalla
    DOCUMENTOS_VENTA ||--|{ DOCUMENTO_DETALLE_CUENTA : detalla
    PLAN_CUENTAS ||--o{ DOCUMENTO_DETALLE_CUENTA : imputa
    CENTROS_COSTO ||--o{ DOCUMENTO_DETALLE_CUENTA : clasifica
    CATEGORIAS_CONTABLES ||--o{ DOCUMENTO_DETALLE_CUENTA : "propone cuenta vía"
    DOCUMENTOS_COMPRA ||--o| ASIENTOS_CONTABLES : genera
    DOCUMENTOS_VENTA ||--o| ASIENTOS_CONTABLES : genera

    DOCUMENTOS_COMPRA {
        uuid id PK
        uuid empresa_id FK
        uuid tercero_id FK
        uuid tipo_documento_id FK
        uuid documento_relacionado_id FK
        string folio
        date fecha_emision
        decimal monto_neto
        decimal monto_exento
        decimal monto_iva
        decimal monto_total
        string estado_asignacion
    }
    DOCUMENTOS_VENTA {
        uuid id PK
        uuid empresa_id FK
        uuid tercero_id FK
        uuid tipo_documento_id FK
        uuid documento_relacionado_id FK
        string folio
        date fecha_emision
        decimal monto_neto
        decimal monto_exento
        decimal monto_iva
        decimal monto_total
        string estado_asignacion
    }
    DOCUMENTO_DETALLE_CUENTA {
        uuid id PK
        uuid documento_id FK
        string documento_tipo
        uuid cuenta_id FK
        uuid centro_costo_id FK
        uuid categoria_contable_id FK
        string clasificacion
        string iva_recuperable
        decimal monto
    }
```
> Llave única de negocio (no representable directamente en el ERD): `(empresa_id, tercero_id, tipo_documento_id, folio)` para detectar duplicados en la importación.

---

## 5. Honorarios

```mermaid
erDiagram
    EMPRESAS ||--o{ BOLETAS_HONORARIOS : registra
    TERCEROS ||--o{ BOLETAS_HONORARIOS : "prestador de"
    TASAS_RETENCION_HONORARIOS ||--o{ BOLETAS_HONORARIOS : "aplica tasa a"
    CATEGORIAS_CONTABLES ||--o{ BOLETAS_HONORARIOS : "propone cuenta vía"
    BOLETAS_HONORARIOS ||--o| ASIENTOS_CONTABLES : genera

    BOLETAS_HONORARIOS {
        uuid id PK
        uuid empresa_id FK
        uuid tercero_id FK
        uuid categoria_contable_id FK
        string folio
        string rol
        date fecha
        decimal monto_bruto
        decimal porcentaje_retencion
        decimal monto_retenido
        decimal monto_liquido
        string estado_pago
    }
```

---

## 6. Bancos y conciliación

```mermaid
erDiagram
    CUENTAS_BANCARIAS ||--o{ CARTOLAS_BANCARIAS : origina
    CARTOLAS_BANCARIAS ||--o| CONCILIACIONES : concilia
    ASIENTOS_CONTABLES ||--o| CONCILIACIONES : concilia
    CONCILIACIONES ||--o| ASIENTOS_CONTABLES : "genera ajuste"

    CARTOLAS_BANCARIAS {
        uuid id PK
        uuid cuenta_bancaria_id FK
        date fecha
        string glosa
        decimal monto_cargo
        decimal monto_abono
        decimal saldo
        string estado_conciliacion
    }
    CONCILIACIONES {
        uuid id PK
        uuid cartola_movimiento_id FK
        uuid asiento_linea_id FK
        string tipo_partida
        date fecha_conciliacion
    }
```

---

## 7. Presupuesto y flujo de caja

```mermaid
erDiagram
    EMPRESAS ||--o{ PRESUPUESTOS : define
    PRESUPUESTOS ||--|{ PRESUPUESTO_DETALLE : detalla
    PLAN_CUENTAS ||--o{ PRESUPUESTO_DETALLE : proyecta
    CENTROS_COSTO ||--o{ PRESUPUESTO_DETALLE : proyecta
    EMPRESAS ||--o{ FLUJO_CAJA_PROYECTADO : proyecta

    PRESUPUESTOS {
        uuid id PK
        uuid empresa_id FK
        int anio
        int version
        string tipo_version
        date fecha_aprobacion
    }
    PRESUPUESTO_DETALLE {
        uuid id PK
        uuid presupuesto_id FK
        uuid cuenta_id FK
        uuid centro_costo_id FK
        int mes
        decimal monto_presupuestado
    }
    FLUJO_CAJA_PROYECTADO {
        uuid id PK
        uuid empresa_id FK
        date fecha_proyectada
        string origen
        uuid documento_referencia_id
        decimal monto
        string estado
    }
```

---

## 8. Activo fijo, inversiones y pasivos

```mermaid
erDiagram
    EMPRESAS ||--o{ ACTIVOS_FIJOS : posee
    PLAN_CUENTAS ||--o{ ACTIVOS_FIJOS : "cuenta activo"
    CENTROS_COSTO ||--o{ ACTIVOS_FIJOS : asigna
    ACTIVOS_FIJOS ||--|{ DEPRECIACIONES : genera
    ACTIVOS_FIJOS ||--o{ REVALUOS_ACTIVO_FIJO : registra
    ACTIVOS_FIJOS ||--o{ DETERIOROS_ACTIVO_FIJO : registra
    DEPRECIACIONES ||--o| ASIENTOS_CONTABLES : genera
    DETERIOROS_ACTIVO_FIJO ||--o| ASIENTOS_CONTABLES : "genera (libro IFRS)"
    EMPRESAS ||--o{ INVERSIONES : posee

    EMPRESAS ||--o{ PASIVOS : mantiene
    TERCEROS ||--o{ PASIVOS : "acreedor de"
    PASIVOS ||--|{ PASIVO_CUOTAS : genera
    PASIVOS ||--o{ PASIVO_MOVIMIENTOS_EXTRAORDINARIOS : registra
    PASIVO_CUOTAS ||--o| ASIENTOS_CONTABLES : genera
    ACTIVOS_FIJOS ||--o| PASIVOS : "vinculado a (leasing financiero / IFRS 16)"

    ACTIVOS_FIJOS {
        uuid id PK
        uuid empresa_id FK
        uuid cuenta_activo_id FK
        uuid centro_costo_id FK
        uuid pasivo_relacionado_id FK
        string codigo
        string descripcion
        date fecha_adquisicion
        decimal valor_adquisicion
        int vida_util_meses
        string metodo_depreciacion
        string origen
        string libro
    }
    DEPRECIACIONES {
        uuid id PK
        uuid activo_id FK
        date periodo
        decimal monto
        string libro
    }
    REVALUOS_ACTIVO_FIJO {
        uuid id PK
        uuid activo_id FK
        date fecha
        decimal valor_anterior
        decimal valor_revaluado
    }
    DETERIOROS_ACTIVO_FIJO {
        uuid id PK
        uuid activo_id FK
        date fecha
        decimal valor_libro_antes
        decimal valor_recuperable_estimado
        decimal monto_deterioro
        uuid cuenta_perdida_deterioro_id FK
    }
    INVERSIONES {
        uuid id PK
        uuid empresa_id FK
        string instrumento
        decimal monto
        date fecha
        decimal rentabilidad
    }
    PASIVOS {
        uuid id PK
        uuid empresa_id FK
        uuid tercero_id FK
        string tipo
        decimal monto_original
        string moneda_indexacion
        decimal tasa
        int plazo_meses
        string libro
    }
    PASIVO_CUOTAS {
        uuid id PK
        uuid pasivo_id FK
        int numero_cuota
        decimal capital
        decimal interes
        decimal saldo
        date fecha_vencimiento
        string estado
    }
    PASIVO_MOVIMIENTOS_EXTRAORDINARIOS {
        uuid id PK
        uuid pasivo_id FK
        string tipo
        date fecha
        decimal monto
        decimal saldo_insoluto_antes
        decimal saldo_insoluto_despues
    }
```

---

## 9. Mapa general (solo entidades y relaciones principales)

```mermaid
erDiagram
    FIRMAS_CONTABLES ||--o{ USUARIOS : emplea
    FIRMAS_CONTABLES ||--o{ EMPRESAS : atiende
    EMPRESAS ||--o{ USUARIO_EMPRESA : "da acceso en"
    USUARIOS ||--o{ USUARIO_EMPRESA : "accede a"

    EMPRESAS ||--o{ PLAN_CUENTAS : tiene
    EMPRESAS ||--o{ CENTROS_COSTO : tiene
    EMPRESAS ||--o{ TERCEROS : "opera con"
    EMPRESAS ||--o{ CATEGORIAS_CONTABLES : define
    CATEGORIAS_CONTABLES ||--o{ TERCEROS : "categoría por defecto de"
    EMPRESAS ||--o{ CUENTAS_BANCARIAS : posee
    EMPRESAS ||--o{ PERIODOS_CONTABLES : define
    PERIODOS_CONTABLES ||--o{ ASIENTOS_CONTABLES : "acota fecha de"
    EMPRESAS ||--o{ ASIENTOS_CONTABLES : registra
    EMPRESAS ||--o{ DOCUMENTOS_COMPRA : registra
    EMPRESAS ||--o{ DOCUMENTOS_VENTA : registra
    EMPRESAS ||--o{ BOLETAS_HONORARIOS : registra
    EMPRESAS ||--o{ PRESUPUESTOS : define
    EMPRESAS ||--o{ ACTIVOS_FIJOS : posee
    EMPRESAS ||--o{ PASIVOS : mantiene

    ASIENTOS_CONTABLES ||--|{ ASIENTOS_LINEAS : contiene
    ASIENTOS_LINEAS }o--|| PLAN_CUENTAS : imputa
    ASIENTOS_LINEAS }o--o| CENTROS_COSTO : clasifica
    ASIENTOS_LINEAS }o--o| TERCEROS : asocia

    DOCUMENTOS_COMPRA ||--o| ASIENTOS_CONTABLES : genera
    DOCUMENTOS_VENTA ||--o| ASIENTOS_CONTABLES : genera
    BOLETAS_HONORARIOS ||--o| ASIENTOS_CONTABLES : genera
    DEPRECIACIONES ||--o| ASIENTOS_CONTABLES : genera
    PASIVO_CUOTAS ||--o| ASIENTOS_CONTABLES : genera
    CONCILIACIONES ||--o| ASIENTOS_CONTABLES : genera

    CUENTAS_BANCARIAS ||--o{ CARTOLAS_BANCARIAS : origina
    CARTOLAS_BANCARIAS ||--o| CONCILIACIONES : concilia

    ACTIVOS_FIJOS ||--|{ DEPRECIACIONES : genera
    ACTIVOS_FIJOS ||--o| PASIVOS : "leasing financiero"
    PASIVOS ||--|{ PASIVO_CUOTAS : genera
```

---

## Notas de implementación

- **Referencias polimórficas**: `ASIENTOS_CONTABLES.documento_origen_id` + `documento_origen_tabla` no se pueden expresar como FK real en la mayoría de motores relacionales sin una tabla intermedia. Alternativa más limpia para PostgreSQL: una tabla `asiento_documento_origen (asiento_id, tabla, registro_id)` sin FK físico a la tabla variable, validada por trigger o a nivel de aplicación.
- **Llave única adicional**: `plan_cuentas.clase` solo es asignable cuando `cuenta_padre_id IS NULL` (nivel 1); a nivel de aplicación o trigger, cada cuenta hija debe heredar automáticamente la `clase` de su raíz para mantener el árbol auto-consistente.
- **Llaves únicas de negocio** (no siempre representables en el ERD visual, pero deben ir como `UNIQUE` en el DDL):
  - `documentos_compra` / `documentos_venta`: `(empresa_id, tercero_id, tipo_documento_id, folio)`.
  - `plan_cuentas`: `(empresa_id, codigo_cuenta)`.
  - `indicadores_economicos`: `(fecha, indicador)`.
  - `empresas`: `(firma_contable_id, rut)` — el mismo RUT no debería repetirse dos veces dentro de la cartera de una misma firma.
- **`firma_contable_id` no se propaga a las tablas transaccionales**: basta con que viva en `empresas`. Para filtrar por firma (ej. en los informes de control interno de 4.8) se hace un join a través de `empresa_id`, evitando duplicar la columna de tenancy en decenas de tablas.
- **Particionamiento sugerido**: `asientos_lineas`, `documentos_compra`, `documentos_venta` y `cartolas_bancarias` son las tablas de mayor crecimiento; conviene particionarlas por `empresa_id` + año desde el inicio.
- Todas las tablas transaccionales (no solo maestras) deben incluir `created_at`, `updated_at` y `created_by` además de lo registrado en `bitacora_auditoria`, para trazabilidad básica sin tener que consultar la bitácora en cada caso.
- **Doble libro IFRS**: el campo `libro` en `asientos_contables` (y su reflejo en `activos_fijos`, `depreciaciones`, `pasivos`) es la única pieza estructural que necesita el modelo de doble libro. Todo query de reportes debe filtrar explícitamente por `libro` (`IN ('Tributario','Ambos')` o `IN ('IFRS','Ambos')` según corresponda) — un error común es olvidar este filtro y mezclar ambos libros en un mismo informe, duplicando o contaminando saldos. Se recomienda encapsular este filtro en una vista de base de datos por libro (`vista_saldos_tributario`, `vista_saldos_ifrs`) en vez de repetirlo en cada query de la aplicación.
- **Recomendación de implementación temprana**: agregar el campo `libro` al esquema desde el primer día de construcción del núcleo contable (con valor por defecto `'Ambos'`), aunque el primer cliente no use IFRS — es una columna con default, de costo casi nulo agregarla ahora, y mucho más cara de introducir después sobre una tabla `asientos_contables` ya con datos de producción.
