CREATE TYPE "public"."activo_fijo_doc_estado" AS ENUM('borrador', 'contabilizado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_doc_tipo" AS ENUM('CAP', 'CAP_NC', 'MEJ', 'DEP', 'DEP_MAN', 'DET', 'REV', 'CM', 'TRF', 'TRF_CLASE', 'BAJA_VTA', 'BAJA_CAST', 'APERT');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_estado" AS ENUM('Nuevo', 'En curso', 'Activo', 'Inactivo', 'Dado de baja');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_metodo_dep" AS ENUM('Lineal', 'Saldo decreciente', 'Dígitos', 'Unidades de producción', 'Inmediata', 'Manual', 'Sin depreciación');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_regimen_depreciacion" AS ENUM('Normal', 'Acelerada', 'Instantanea');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_regla_baja" AS ENUM('Hasta fecha', 'Hasta mes anterior', 'Mes completo');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_regla_inicio" AS ENUM('Fecha exacta', 'Mes siguiente', 'Inicio de mes', 'Medio período');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_tipo" AS ENUM('Tangible', 'Intangible', 'Terreno', 'En curso');--> statement-breakpoint
CREATE TYPE "public"."asiento_estado" AS ENUM('borrador', 'contabilizado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."asiento_tipo" AS ENUM('manual', 'traspaso', 'ingreso', 'egreso', 'ajuste', 'automatico');--> statement-breakpoint
CREATE TYPE "public"."auditoria_accion" AS ENUM('crear', 'editar', 'eliminar', 'cambio_estado');--> statement-breakpoint
CREATE TYPE "public"."cartola_campo_destino" AS ENUM('Fecha', 'Descripcion', 'NroDocumento', 'Cargo', 'Abono', 'MontoConSigno', 'Saldo', 'Sucursal', 'RutContraparte');--> statement-breakpoint
CREATE TYPE "public"."cartola_codificacion" AS ENUM('UTF-8', 'Latin-1');--> statement-breakpoint
CREATE TYPE "public"."cartola_estado" AS ENUM('Importada', 'Anulada');--> statement-breakpoint
CREATE TYPE "public"."cartola_formato_fecha" AS ENUM('dd/mm/aaaa', 'aaaa-mm-dd', 'aaaammdd');--> statement-breakpoint
CREATE TYPE "public"."cartola_formato_numero" AS ENUM('MilesPuntoDecimalComa', 'MilesComaDecimalPunto', 'SinMilesDecimalPunto');--> statement-breakpoint
CREATE TYPE "public"."cartola_movimiento_estado" AS ENUM('Pendiente');--> statement-breakpoint
CREATE TYPE "public"."cartola_origen" AS ENUM('Archivo', 'Manual');--> statement-breakpoint
CREATE TYPE "public"."cartola_regla_signo" AS ENUM('ColumnasSeparadas', 'ColumnaConSigno');--> statement-breakpoint
CREATE TYPE "public"."cartola_tipo_archivo" AS ENUM('Excel', 'CsvTxtDelimitado', 'TxtAnchoFijo');--> statement-breakpoint
CREATE TYPE "public"."categoria_aplica_a" AS ENUM('Compra', 'Venta', 'Honorario', 'Ambos');--> statement-breakpoint
CREATE TYPE "public"."cheque_estado" AS ENUM('en_cartera', 'depositado', 'protestado', 'emitido', 'cobrado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."cheque_tipo" AS ENUM('Recibido', 'Emitido');--> statement-breakpoint
CREATE TYPE "public"."clase_cuenta" AS ENUM('Activo', 'Pasivo', 'Patrimonio', 'Ingresos', 'Costos y Gastos', 'Cuentas de Orden');--> statement-breakpoint
CREATE TYPE "public"."clasificacion_corriente" AS ENUM('Corriente', 'No Corriente', 'No Aplica');--> statement-breakpoint
CREATE TYPE "public"."cuenta_bancaria_tipo" AS ENUM('Corriente', 'Vista', 'Ahorro', 'Otra');--> statement-breakpoint
CREATE TYPE "public"."cuenta_modo_moneda" AS ENUM('Local', 'Funcional', 'Extranjera fija', 'Cualquiera');--> statement-breakpoint
CREATE TYPE "public"."determinacion_contexto" AS ENUM('venta', 'compra', 'impuesto', 'general');--> statement-breakpoint
CREATE TYPE "public"."determinacion_rol" AS ENUM('ingreso', 'ingreso_exento', 'iva_debito', 'iva_credito', 'cuenta_por_cobrar', 'cuenta_por_pagar', 'descuento_venta', 'diferencia_cambio', 'ajuste', 'gasto', 'inventario', 'gr_ir', 'costo_venta', 'resultado_ejercicio', 'activo_fijo', 'depreciacion_acumulada', 'gasto_depreciacion', 'cuenta_compensacion_capitalizacion', 'utilidad_baja', 'perdida_baja', 'valor_libro_baja', 'correccion_monetaria');--> statement-breakpoint
CREATE TYPE "public"."direccion_tipo" AS ENUM('Facturación', 'Despacho');--> statement-breakpoint
CREATE TYPE "public"."documento_compra_estado" AS ENUM('borrador', 'abierto', 'contabilizado', 'cerrado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."documento_compra_tipo" AS ENUM('pedido', 'entrada_mercaderia', 'factura', 'nota_credito', 'nota_debito');--> statement-breakpoint
CREATE TYPE "public"."documento_modalidad" AS ENUM('Artículo', 'Servicio');--> statement-breakpoint
CREATE TYPE "public"."documento_venta_clase" AS ENUM('Factura', 'Nota de Crédito', 'Nota de Débito');--> statement-breakpoint
CREATE TYPE "public"."documento_venta_estado" AS ENUM('borrador', 'contabilizado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."empresa_estado" AS ENUM('Activa', 'Inactiva');--> statement-breakpoint
CREATE TYPE "public"."impuesto_tipo" AS ENUM('IVA Débito', 'IVA Crédito', 'Impuesto Adicional', 'Exento', 'No Afecto');--> statement-breakpoint
CREATE TYPE "public"."iva_recuperable" AS ENUM('Total', 'Parcial', 'No Recuperable');--> statement-breakpoint
CREATE TYPE "public"."libro_contable" AS ENUM('Tributario', 'IFRS', 'Ambos');--> statement-breakpoint
CREATE TYPE "public"."metodo_pago_sentido" AS ENUM('Recibido', 'Efectuado', 'Ambos');--> statement-breakpoint
CREATE TYPE "public"."metodo_pago_tipo" AS ENUM('Efectivo', 'Cheque', 'Transferencia', 'Tarjeta');--> statement-breakpoint
CREATE TYPE "public"."metodo_valoracion" AS ENUM('Promedio', 'FIFO');--> statement-breakpoint
CREATE TYPE "public"."moneda_tipo" AS ENUM('Moneda', 'Unidad de Reajuste');--> statement-breakpoint
CREATE TYPE "public"."naturaleza_cuenta" AS ENUM('Deudora', 'Acreedora');--> statement-breakpoint
CREATE TYPE "public"."pago_estado" AS ENUM('contabilizado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."pago_tipo" AS ENUM('Recibido', 'Efectuado');--> statement-breakpoint
CREATE TYPE "public"."periodo_estado" AS ENUM('Desbloqueado', 'Período de cierre', 'Bloqueado', 'Bloqueado excepto ventas');--> statement-breakpoint
CREATE TYPE "public"."producto_tipo" AS ENUM('Producto', 'Servicio');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('Administrador', 'Contador', 'Asistente');--> statement-breakpoint
CREATE TYPE "public"."serie_ambito" AS ENUM('tercero', 'venta', 'producto', 'compra', 'pago', 'activo_fijo');--> statement-breakpoint
CREATE TYPE "public"."sii_ambiente" AS ENUM('certificacion', 'produccion');--> statement-breakpoint
CREATE TYPE "public"."sii_metodo_auth" AS ENUM('clave', 'certificado');--> statement-breakpoint
CREATE TYPE "public"."stock_movimiento_tipo" AS ENUM('entrada', 'salida', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."tipo_cambio_origen" AS ENUM('Manual', 'Importado archivo', 'Sincronizado API');--> statement-breakpoint
CREATE TYPE "public"."tipo_cuenta" AS ENUM('Banco', 'Caja', 'Cliente', 'Proveedor', 'Impuesto', 'Remuneraciones', 'ActivoFijo', 'Ingreso', 'Costo', 'Gasto', 'Patrimonio', 'Orden', 'Otra');--> statement-breakpoint
CREATE TYPE "public"."tipo_facturador" AS ENUM('SII Gratuito', 'Facturador comercial', 'No emite DTE');--> statement-breakpoint
CREATE TYPE "public"."tipo_operacion_documento" AS ENUM('Compra', 'Venta', 'Ambos');--> statement-breakpoint
CREATE TYPE "public"."tipo_tercero" AS ENUM('Cliente', 'Proveedor', 'Prestador Honorarios', 'Otro');--> statement-breakpoint
CREATE TABLE "monedas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "moneda_tipo" NOT NULL,
	"simbolo" text NOT NULL,
	"decimales" integer DEFAULT 2 NOT NULL,
	"codigo_iso" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_cambio" (
	"fecha" date NOT NULL,
	"moneda_id" uuid NOT NULL,
	"valor_en_clp" numeric(18, 6) NOT NULL,
	"origen" "tipo_cambio_origen" DEFAULT 'Manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_cambio_fecha_moneda_id_pk" PRIMARY KEY("fecha","moneda_id")
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rut" text NOT NULL,
	"razon_social" text NOT NULL,
	"giro" text NOT NULL,
	"direccion" text,
	"regimen_tributario" text NOT NULL,
	"fecha_inicio_actividades" date,
	"moneda_funcional_id" uuid NOT NULL,
	"moneda_reporte_id" uuid,
	"permite_multimoneda" boolean DEFAULT false NOT NULL,
	"aplica_ifrs" boolean DEFAULT false NOT NULL,
	"plan_cuentas_plantilla_id" uuid NOT NULL,
	"fecha_primer_periodo_contable" date NOT NULL,
	"estado" "empresa_estado" DEFAULT 'Activa' NOT NULL,
	"separador_decimal" text DEFAULT ',' NOT NULL,
	"separador_miles" text DEFAULT '.' NOT NULL,
	"decimales_tipo_cambio" integer DEFAULT 6 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresas_rut_unique" UNIQUE("rut")
);
--> statement-breakpoint
CREATE TABLE "plan_cuentas_plantillas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_cuentas_plantillas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "plan_cuentas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"plantilla_id" uuid,
	"cuenta_padre_id" uuid,
	"codigo_cuenta" text NOT NULL,
	"nombre_cuenta" text NOT NULL,
	"clase" "clase_cuenta" NOT NULL,
	"naturaleza" "naturaleza_cuenta" NOT NULL,
	"tipo_cuenta" "tipo_cuenta" DEFAULT 'Otra' NOT NULL,
	"clasificacion_corriente" "clasificacion_corriente" DEFAULT 'No Aplica' NOT NULL,
	"nivel_imputable" boolean DEFAULT true NOT NULL,
	"requiere_centro_costo" boolean DEFAULT false NOT NULL,
	"requiere_analisis_terceros" boolean DEFAULT false NOT NULL,
	"modo_moneda" "cuenta_modo_moneda" DEFAULT 'Funcional' NOT NULL,
	"moneda_fija_id" uuid,
	"relevante_flujo_caja" boolean DEFAULT false NOT NULL,
	"es_cuenta_ajuste" boolean DEFAULT false NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_cuentas_empresa_xor_plantilla" CHECK (("plan_cuentas"."empresa_id" is not null and "plan_cuentas"."plantilla_id" is null) or ("plan_cuentas"."empresa_id" is null and "plan_cuentas"."plantilla_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "centros_costo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"centro_padre_id" uuid,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"estado" text DEFAULT 'Activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuentas_bancarias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"banco_id" uuid NOT NULL,
	"tipo_cuenta" "cuenta_bancaria_tipo" DEFAULT 'Corriente' NOT NULL,
	"numero_cuenta" text NOT NULL,
	"alias" text,
	"moneda_id" uuid NOT NULL,
	"cuenta_contable_id" uuid NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"saldo_inicial_conciliado" numeric(18, 4) DEFAULT '0' NOT NULL,
	"fecha_saldo_inicial" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metodos_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "metodo_pago_tipo" NOT NULL,
	"sentido" "metodo_pago_sentido" DEFAULT 'Ambos' NOT NULL,
	"cuenta_bancaria_id" uuid,
	"cuenta_contable_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"tipo" "cheque_tipo" NOT NULL,
	"pago_id" uuid NOT NULL,
	"pago_medio_id" uuid NOT NULL,
	"tercero_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"banco_id" uuid,
	"monto" numeric(18, 4) NOT NULL,
	"fecha_emision" date NOT NULL,
	"fecha_cobro" date,
	"estado" "cheque_estado" NOT NULL,
	"deposito_id" uuid,
	"fecha_protesto" date,
	"motivo_protesto" text,
	"asiento_protesto_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "depositos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"numero_interno" text NOT NULL,
	"fecha" date NOT NULL,
	"fecha_contabilizacion" date NOT NULL,
	"cuenta_bancaria_id" uuid NOT NULL,
	"monto_total" numeric(18, 4) NOT NULL,
	"glosa" text,
	"estado" "pago_estado" DEFAULT 'contabilizado' NOT NULL,
	"asiento_id" uuid,
	"asiento_reversa_id" uuid,
	"motivo_anulacion" text,
	"usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "depositos_cheques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deposito_id" uuid NOT NULL,
	"cheque_id" uuid NOT NULL,
	"monto" numeric(18, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"tipo" "pago_tipo" NOT NULL,
	"numero_interno" text NOT NULL,
	"tercero_id" uuid NOT NULL,
	"fecha_pago" date NOT NULL,
	"fecha_contabilizacion" date NOT NULL,
	"moneda_id" uuid NOT NULL,
	"tipo_cambio" numeric(18, 6) DEFAULT '1' NOT NULL,
	"monto_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_aplicado" numeric(18, 4) DEFAULT '0' NOT NULL,
	"glosa" text,
	"referencia" text,
	"estado" "pago_estado" DEFAULT 'contabilizado' NOT NULL,
	"asiento_id" uuid,
	"asiento_reversa_id" uuid,
	"motivo_anulacion" text,
	"usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pago_id" uuid NOT NULL,
	"documento_compra_id" uuid,
	"documento_venta_id" uuid,
	"monto_aplicado" numeric(18, 4) NOT NULL,
	"cheque_id" uuid,
	CONSTRAINT "pagos_documentos_un_documento" CHECK (("pagos_documentos"."documento_compra_id" is null) <> ("pagos_documentos"."documento_venta_id" is null))
);
--> statement-breakpoint
CREATE TABLE "pagos_medios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pago_id" uuid NOT NULL,
	"numero_linea" integer NOT NULL,
	"metodo_pago_id" uuid NOT NULL,
	"tipo" "metodo_pago_tipo" NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"referencia" text,
	"cheque_numero" text,
	"cheque_banco_id" uuid,
	"fecha_cobro" date
);
--> statement-breakpoint
CREATE TABLE "cierres_ejercicio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"cuenta_resultado_id" uuid NOT NULL,
	"monto_resultado" numeric(18, 4) NOT NULL,
	"estado" "pago_estado" DEFAULT 'contabilizado' NOT NULL,
	"asiento_id" uuid,
	"asiento_reversa_id" uuid,
	"fecha_reapertura" date,
	"motivo_reapertura" text,
	"usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo_sii" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo_operacion" "tipo_operacion_documento" NOT NULL,
	"afecto_iva" boolean DEFAULT true NOT NULL,
	"documento_relacionable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_documento_codigo_sii_unique" UNIQUE("codigo_sii")
);
--> statement-breakpoint
CREATE TABLE "bancos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"codigo_sbif" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bancos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "categorias_contables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"aplica_a" "categoria_aplica_a" NOT NULL,
	"cuenta_gasto_id" uuid,
	"cuenta_ingreso_id" uuid,
	"cuenta_costo_id" uuid,
	"cuenta_activo_id" uuid,
	"centro_costo_default_id" uuid,
	"iva_recuperable_default" "iva_recuperable",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reglas_determinacion_cuenta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"contexto" "determinacion_contexto" NOT NULL,
	"rol" "determinacion_rol" NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impuestos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "impuesto_tipo" NOT NULL,
	"tasa" numeric(6, 3) DEFAULT '0' NOT NULL,
	"cuenta_contable_id" uuid,
	"recuperable_default" "iva_recuperable",
	"aplica_a" "tipo_operacion_documento" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terceros_grupos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"cuenta_contable_asociada_id" uuid,
	"categoria_contable_default_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terceros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text,
	"rut" text NOT NULL,
	"razon_social" text NOT NULL,
	"tipo_tercero" "tipo_tercero" NOT NULL,
	"nombre_fantasia" text,
	"giro" text,
	"email" text,
	"telefono" text,
	"sitio_web" text,
	"direccion" text,
	"notas" text,
	"grupo_id" uuid,
	"moneda_id" uuid,
	"impuesto_default_id" uuid,
	"cuenta_contable_asociada_id" uuid,
	"categoria_contable_default_id" uuid,
	"metodo_pago_default_id" uuid,
	"condicion_pago_dias" integer DEFAULT 0 NOT NULL,
	"limite_credito" numeric(18, 4) DEFAULT '0' NOT NULL,
	"retencion_honorarios_pct" numeric(5, 2),
	"es_emisor_boleta_honorarios" boolean DEFAULT false NOT NULL,
	"es_receptor_boleta_honorarios" boolean DEFAULT false NOT NULL,
	"pendiente_completar" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"bloqueado" boolean DEFAULT false NOT NULL,
	"motivo_bloqueo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terceros_contactos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tercero_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"apellido" text,
	"cargo" text,
	"telefono" text,
	"movil" text,
	"email" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terceros_direcciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tercero_id" uuid NOT NULL,
	"tipo" "direccion_tipo" NOT NULL,
	"nombre" text,
	"calle" text,
	"numero" text,
	"comuna" text,
	"ciudad" text,
	"region" text,
	"pais" text DEFAULT 'Chile' NOT NULL,
	"codigo_postal" text,
	"es_principal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terceros_cuentas_bancarias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tercero_id" uuid NOT NULL,
	"banco_id" uuid NOT NULL,
	"tipo_cuenta" "cuenta_bancaria_tipo" NOT NULL,
	"numero_cuenta" text NOT NULL,
	"titular" text,
	"rut_titular" text,
	"es_principal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartolas_formatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"banco_id" uuid NOT NULL,
	"empresa_id" uuid,
	"nombre" text NOT NULL,
	"tipo_archivo" "cartola_tipo_archivo" NOT NULL,
	"codificacion" "cartola_codificacion" DEFAULT 'UTF-8' NOT NULL,
	"separador" text,
	"filas_omitir_inicio" integer DEFAULT 0 NOT NULL,
	"filas_omitir_fin" integer DEFAULT 0 NOT NULL,
	"formato_fecha" "cartola_formato_fecha" NOT NULL,
	"formato_numero" "cartola_formato_numero" NOT NULL,
	"regla_signo" "cartola_regla_signo" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartolas_formato_campos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formato_id" uuid NOT NULL,
	"campo_destino" "cartola_campo_destino" NOT NULL,
	"columna_indice" integer,
	"posicion_inicio" integer,
	"posicion_largo" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartolas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cuenta_bancaria_id" uuid NOT NULL,
	"fecha_desde" date NOT NULL,
	"fecha_hasta" date NOT NULL,
	"saldo_inicial" numeric(18, 4) NOT NULL,
	"saldo_final" numeric(18, 4) NOT NULL,
	"origen" "cartola_origen" DEFAULT 'Archivo' NOT NULL,
	"archivo_nombre" text,
	"archivo_hash" text,
	"estado" "cartola_estado" DEFAULT 'Importada' NOT NULL,
	"usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartolas_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cartola_id" uuid NOT NULL,
	"cuenta_bancaria_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"descripcion" text NOT NULL,
	"nro_documento" text,
	"rut_contraparte" text,
	"monto" numeric(18, 4) NOT NULL,
	"codigo_transaccion" text,
	"huella" text NOT NULL,
	"estado_conciliacion" "cartola_movimiento_estado" DEFAULT 'Pendiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series_numeracion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"ambito" "serie_ambito" NOT NULL,
	"clave" text NOT NULL,
	"prefijo" text DEFAULT '' NOT NULL,
	"proximo" integer DEFAULT 1 NOT NULL,
	"digitos" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "periodos_contables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date NOT NULL,
	"estado" "periodo_estado" DEFAULT 'Bloqueado' NOT NULL,
	"fecha_cierre" timestamp with time zone,
	"usuario_cierre_id" uuid,
	"motivo_reapertura" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asientos_contables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"correlativo" integer,
	"anio" integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM fecha)::int) STORED NOT NULL,
	"fecha" date NOT NULL,
	"glosa" text NOT NULL,
	"tipo" "asiento_tipo" NOT NULL,
	"origen" text,
	"libro" "libro_contable" DEFAULT 'Ambos' NOT NULL,
	"estado" "asiento_estado" DEFAULT 'borrador' NOT NULL,
	"documento_origen_id" uuid,
	"documento_origen_tabla" text,
	"referencia" text,
	"fecha_reversa" date,
	"usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asientos_contables_correlativo_si_no_borrador" CHECK ("asientos_contables"."estado" = 'borrador' or "asientos_contables"."correlativo" is not null)
);
--> statement-breakpoint
CREATE TABLE "asientos_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asiento_id" uuid NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"centro_costo_id" uuid,
	"tercero_id" uuid,
	"glosa" text,
	"monto_debe_origen" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_haber_origen" numeric(18, 4) DEFAULT '0' NOT NULL,
	"moneda_origen_id" uuid NOT NULL,
	"tipo_cambio_aplicado" numeric(18, 6),
	"monto_debe_funcional" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_haber_funcional" numeric(18, 4) DEFAULT '0' NOT NULL,
	"documento_referencia_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos_grupos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"cuenta_ingreso_default_id" uuid,
	"impuesto_default_id" uuid,
	"centro_costo_default_id" uuid,
	"categoria_contable_default_id" uuid,
	"cuenta_inventario_default_id" uuid,
	"cuenta_costo_venta_default_id" uuid,
	"cuenta_gasto_compra_default_id" uuid,
	"impuesto_compra_default_id" uuid,
	"cuenta_dotacion_default_id" uuid,
	"cuenta_desviacion_default_id" uuid,
	"cuenta_diferencia_precio_default_id" uuid,
	"cuenta_ajuste_stock_negativo_default_id" uuid,
	"cuenta_compensacion_stock_reduccion_default_id" uuid,
	"cuenta_compensacion_stock_aumento_default_id" uuid,
	"cuenta_devolucion_venta_default_id" uuid,
	"cuenta_ingreso_extranjero_default_id" uuid,
	"cuenta_costo_extranjero_default_id" uuid,
	"cuenta_diferencia_cambio_default_id" uuid,
	"cuenta_compensacion_mercaderia_default_id" uuid,
	"cuenta_reduccion_libro_mayor_default_id" uuid,
	"cuenta_aumento_libro_mayor_default_id" uuid,
	"cuenta_stock_wip_default_id" uuid,
	"cuenta_desviacion_stock_wip_default_id" uuid,
	"cuenta_pyg_compensacion_wip_default_id" uuid,
	"cuenta_pyg_compensacion_stock_default_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"grupo_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "producto_tipo" DEFAULT 'Producto' NOT NULL,
	"estado" text DEFAULT 'Activo' NOT NULL,
	"precio_unitario" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unidad_medida" text,
	"codigo_barras" text,
	"glosa_sugerida" text,
	"es_venta" boolean DEFAULT true NOT NULL,
	"es_compra" boolean DEFAULT false NOT NULL,
	"es_inventario" boolean DEFAULT false NOT NULL,
	"metodo_valoracion" "metodo_valoracion" DEFAULT 'Promedio' NOT NULL,
	"costo_estandar" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos_venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"numero_interno" text,
	"clase" "documento_venta_clase" NOT NULL,
	"modalidad" "documento_modalidad" DEFAULT 'Artículo' NOT NULL,
	"tipo_documento_id" uuid NOT NULL,
	"tercero_id" uuid NOT NULL,
	"folio" text,
	"fecha_emision" date NOT NULL,
	"fecha_vencimiento" date,
	"num_at_card" text,
	"moneda_id" uuid NOT NULL,
	"tipo_cambio" numeric(18, 6) DEFAULT '1' NOT NULL,
	"descuento_global_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"nombre_cliente" text,
	"condicion_pago_dias" integer,
	"vendedor_id" uuid,
	"contacto_id" uuid,
	"direccion_facturacion" text,
	"direccion_despacho" text,
	"monto_neto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_exento" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"glosa" text,
	"estado" "documento_venta_estado" DEFAULT 'borrador' NOT NULL,
	"documento_referencia_id" uuid,
	"asiento_id" uuid,
	"asiento_reversa_id" uuid,
	"fecha_contabilizacion" date,
	"usuario_contabilizacion_id" uuid,
	"usuario_creacion_id" uuid,
	"motivo_anulacion" text,
	"estado_rcv" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos_venta_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_venta_id" uuid NOT NULL,
	"numero_linea" integer NOT NULL,
	"glosa" text,
	"producto_id" uuid,
	"cuenta_ingreso_id" uuid NOT NULL,
	"categoria_contable_id" uuid,
	"centro_costo_id" uuid,
	"impuesto_id" uuid,
	"cantidad" numeric(19, 6) DEFAULT '1' NOT NULL,
	"precio_unitario" numeric(18, 4) DEFAULT '0' NOT NULL,
	"descuento_linea_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"monto_neto" numeric(18, 4) NOT NULL,
	"es_exento" boolean DEFAULT false NOT NULL,
	"monto_impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"fecha_diferimiento" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos_compra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"doc_tipo" "documento_compra_tipo" NOT NULL,
	"modalidad" "documento_modalidad" DEFAULT 'Artículo' NOT NULL,
	"numero_interno" text,
	"tipo_documento_id" uuid,
	"tercero_id" uuid NOT NULL,
	"folio" text,
	"fecha_emision" date NOT NULL,
	"fecha_vencimiento" date,
	"fecha_contabilizacion" date,
	"num_at_card" text,
	"moneda_id" uuid NOT NULL,
	"tipo_cambio" numeric(18, 6) DEFAULT '1' NOT NULL,
	"descuento_global_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"condicion_pago_dias" integer,
	"monto_neto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_exento" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_iva_no_recuperable" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"glosa" text,
	"estado" "documento_compra_estado" DEFAULT 'borrador' NOT NULL,
	"documento_base_id" uuid,
	"asiento_id" uuid,
	"asiento_reversa_id" uuid,
	"usuario_creacion_id" uuid,
	"usuario_contabilizacion_id" uuid,
	"motivo_anulacion" text,
	"estado_rcv" text,
	"sii_track_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos_compra_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_compra_id" uuid NOT NULL,
	"numero_linea" integer NOT NULL,
	"glosa" text,
	"producto_id" uuid,
	"cuenta_imputacion_id" uuid NOT NULL,
	"categoria_contable_id" uuid,
	"centro_costo_id" uuid,
	"impuesto_id" uuid,
	"cantidad" numeric(19, 6) DEFAULT '1' NOT NULL,
	"precio_unitario" numeric(18, 4) DEFAULT '0' NOT NULL,
	"descuento_linea_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"monto_neto" numeric(18, 4) NOT NULL,
	"es_exento" boolean DEFAULT false NOT NULL,
	"monto_impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"iva_recuperable" "iva_recuperable",
	"cantidad_pendiente" numeric(19, 6) DEFAULT '0' NOT NULL,
	"documento_base_linea_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documentos_compra_lineas_cantidad_positiva" CHECK ("documentos_compra_lineas"."cantidad" > 0),
	CONSTRAINT "documentos_compra_lineas_pendiente_no_negativo" CHECK ("documentos_compra_lineas"."cantidad_pendiente" >= 0),
	CONSTRAINT "documentos_compra_lineas_pendiente_hasta_cantidad" CHECK ("documentos_compra_lineas"."cantidad_pendiente" <= "documentos_compra_lineas"."cantidad")
);
--> statement-breakpoint
CREATE TABLE "producto_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" numeric(19, 6) DEFAULT '0' NOT NULL,
	"costo_promedio" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"tipo" "stock_movimiento_tipo" NOT NULL,
	"cantidad" numeric(19, 6) NOT NULL,
	"costo_unitario" numeric(18, 4) NOT NULL,
	"costo_total" numeric(18, 4) NOT NULL,
	"saldo_cantidad" numeric(19, 6) NOT NULL,
	"saldo_costo_promedio" numeric(18, 4) NOT NULL,
	"origen_tabla" text,
	"origen_id" uuid,
	"asiento_id" uuid,
	"glosa" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sii_credenciales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"rut" text NOT NULL,
	"tipo_facturador" "tipo_facturador" DEFAULT 'SII Gratuito' NOT NULL,
	"nombre_facturador" text,
	"metodo_auth" "sii_metodo_auth" DEFAULT 'clave' NOT NULL,
	"rut_titular" text,
	"clave_cifrada" text,
	"certificado_cifrado" text,
	"certificado_pass_cifrada" text,
	"ambiente" "sii_ambiente" DEFAULT 'produccion' NOT NULL,
	"certificado_vence" date,
	"ultima_sync_periodo" text,
	"xml_ultima_descarga_en" timestamp with time zone,
	"xml_ultima_descarga_detalle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sii_dtes_pendientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"origen" text NOT NULL,
	"tipo_dte" integer NOT NULL,
	"folio" text NOT NULL,
	"rut_contraparte" text NOT NULL,
	"razon_social_contraparte" text,
	"fecha_emision" date NOT NULL,
	"monto_neto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_exento" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_iva" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"datos" jsonb NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"documento_id" uuid,
	"error" text,
	"descargado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"resuelto_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sii_importaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"periodo" text NOT NULL,
	"origen" text NOT NULL,
	"creados" integer DEFAULT 0 NOT NULL,
	"existentes" integer DEFAULT 0 NOT NULL,
	"errores" integer DEFAULT 0 NOT NULL,
	"detalle" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario_empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"rol" "rol" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bitacora_auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"usuario_id" uuid,
	"usuario_nombre" text NOT NULL,
	"tabla_afectada" text NOT NULL,
	"registro_id" uuid NOT NULL,
	"etiqueta" text NOT NULL,
	"accion" "auditoria_accion" NOT NULL,
	"valores_anteriores" jsonb,
	"valores_nuevos" jsonb,
	"motivo" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferencias_formulario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"clave" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activos_fijos_clases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo_activo" "activo_fijo_tipo" DEFAULT 'Tangible' NOT NULL,
	"numeracion_serie" text,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activos_fijos_clases_cuentas" (
	"clase_id" uuid NOT NULL,
	"libro" "libro_contable" NOT NULL,
	"cta_activo" uuid,
	"cta_dep_acumulada" uuid,
	"cta_gasto_dep" uuid,
	"cta_compensacion_capitalizacion" uuid,
	"cta_utilidad_baja" uuid,
	"cta_perdida_baja" uuid,
	"cta_valor_libro_baja" uuid,
	"cta_correccion_monetaria" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activos_fijos_clases_cuentas_clase_id_libro_pk" PRIMARY KEY("clase_id","libro")
);
--> statement-breakpoint
CREATE TABLE "activos_fijos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"descripcion" text NOT NULL,
	"clase_id" uuid,
	"centro_costo_id" uuid,
	"estado" "activo_fijo_estado" DEFAULT 'Nuevo' NOT NULL,
	"ubicacion" text,
	"numero_serie" text,
	"marca" text,
	"modelo" text,
	"fecha_adquisicion" date,
	"fecha_baja" date,
	"documento_origen_id" uuid,
	"documento_origen_tabla" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activos_fijos_valoraciones" (
	"activo_id" uuid NOT NULL,
	"libro" "libro_contable" NOT NULL,
	"metodo_dep" "activo_fijo_metodo_dep" DEFAULT 'Lineal' NOT NULL,
	"regla_inicio" "activo_fijo_regla_inicio" DEFAULT 'Mes siguiente' NOT NULL,
	"regla_baja" "activo_fijo_regla_baja" DEFAULT 'Hasta mes anterior' NOT NULL,
	"fecha_inicio_dep" date,
	"vida_util_meses" integer NOT NULL,
	"valor_residual" numeric(18, 4) DEFAULT '0' NOT NULL,
	"bloqueado" boolean DEFAULT false NOT NULL,
	"regimen_depreciacion" "activo_fijo_regimen_depreciacion" DEFAULT 'Normal' NOT NULL,
	"vida_util_normal_meses" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activos_fijos_valoraciones_activo_id_libro_pk" PRIMARY KEY("activo_id","libro")
);
--> statement-breakpoint
CREATE TABLE "activos_fijos_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"anio" integer NOT NULL,
	"tipo_doc" "activo_fijo_doc_tipo" NOT NULL,
	"estado" "activo_fijo_doc_estado" DEFAULT 'borrador' NOT NULL,
	"libro" "libro_contable",
	"fecha" date NOT NULL,
	"fecha_contabilizacion" date,
	"glosa" text,
	"asiento_id" uuid,
	"motivo_anulacion" text,
	"asiento_reversa_id" uuid,
	"usuario_creacion_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activos_fijos_documentos_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"numero_linea" integer NOT NULL,
	"activo_id" uuid NOT NULL,
	"libro" "libro_contable" NOT NULL,
	"importe" numeric(18, 4) NOT NULL,
	"dep_acumulada_retirada" numeric(18, 4) DEFAULT '0' NOT NULL,
	"glosa" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activos_fijos_valores_periodo" (
	"activo_id" uuid NOT NULL,
	"libro" "libro_contable" NOT NULL,
	"periodo_id" uuid NOT NULL,
	"dep_planificada" numeric(18, 4) DEFAULT '0' NOT NULL,
	"dep_contabilizada" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activos_fijos_valores_periodo_activo_id_libro_periodo_id_pk" PRIMARY KEY("activo_id","libro","periodo_id")
);
--> statement-breakpoint
CREATE TABLE "activos_fijos_saldos" (
	"activo_id" uuid NOT NULL,
	"libro" "libro_contable" NOT NULL,
	"anio" integer NOT NULL,
	"costo_inicial" numeric(18, 4) DEFAULT '0' NOT NULL,
	"altas" numeric(18, 4) DEFAULT '0' NOT NULL,
	"bajas" numeric(18, 4) DEFAULT '0' NOT NULL,
	"costo_final" numeric(18, 4) DEFAULT '0' NOT NULL,
	"dep_acumulada_inicial" numeric(18, 4) DEFAULT '0' NOT NULL,
	"dep_ejercicio" numeric(18, 4) DEFAULT '0' NOT NULL,
	"dep_bajas" numeric(18, 4) DEFAULT '0' NOT NULL,
	"dep_acumulada_final" numeric(18, 4) DEFAULT '0' NOT NULL,
	"valor_libro" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activos_fijos_saldos_activo_id_libro_anio_pk" PRIMARY KEY("activo_id","libro","anio")
);
--> statement-breakpoint
CREATE TABLE "activos_fijos_cierres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"libro" "libro_contable" NOT NULL,
	"anio" integer NOT NULL,
	"estado" "pago_estado" DEFAULT 'contabilizado' NOT NULL,
	"fecha_reapertura" date,
	"motivo_reapertura" text,
	"usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activos_fijos_vidas_utiles_sii" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"categoria" text NOT NULL,
	"descripcion" text,
	"vida_util_normal_meses" integer NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factores_correccion_monetaria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"factor_porcentaje" numeric(8, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monedas" ADD CONSTRAINT "monedas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipos_cambio" ADD CONSTRAINT "tipos_cambio_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_moneda_funcional_id_monedas_id_fk" FOREIGN KEY ("moneda_funcional_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_moneda_reporte_id_monedas_id_fk" FOREIGN KEY ("moneda_reporte_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_plan_cuentas_plantilla_id_plan_cuentas_plantillas_id_fk" FOREIGN KEY ("plan_cuentas_plantilla_id") REFERENCES "public"."plan_cuentas_plantillas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_plantilla_id_plan_cuentas_plantillas_id_fk" FOREIGN KEY ("plantilla_id") REFERENCES "public"."plan_cuentas_plantillas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_cuenta_padre_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_padre_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_moneda_fija_id_monedas_id_fk" FOREIGN KEY ("moneda_fija_id") REFERENCES "public"."monedas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_centro_padre_id_centros_costo_id_fk" FOREIGN KEY ("centro_padre_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_banco_id_bancos_id_fk" FOREIGN KEY ("banco_id") REFERENCES "public"."bancos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_cuenta_contable_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_cuenta_bancaria_id_cuentas_bancarias_id_fk" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_cuenta_contable_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_pago_medio_id_pagos_medios_id_fk" FOREIGN KEY ("pago_medio_id") REFERENCES "public"."pagos_medios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_banco_id_bancos_id_fk" FOREIGN KEY ("banco_id") REFERENCES "public"."bancos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_asiento_protesto_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_protesto_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depositos" ADD CONSTRAINT "depositos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depositos" ADD CONSTRAINT "depositos_cuenta_bancaria_id_cuentas_bancarias_id_fk" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depositos" ADD CONSTRAINT "depositos_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depositos" ADD CONSTRAINT "depositos_asiento_reversa_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_reversa_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depositos" ADD CONSTRAINT "depositos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depositos_cheques" ADD CONSTRAINT "depositos_cheques_deposito_id_depositos_id_fk" FOREIGN KEY ("deposito_id") REFERENCES "public"."depositos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depositos_cheques" ADD CONSTRAINT "depositos_cheques_cheque_id_cheques_id_fk" FOREIGN KEY ("cheque_id") REFERENCES "public"."cheques"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_asiento_reversa_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_reversa_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_documentos" ADD CONSTRAINT "pagos_documentos_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_documentos" ADD CONSTRAINT "pagos_documentos_documento_compra_id_documentos_compra_id_fk" FOREIGN KEY ("documento_compra_id") REFERENCES "public"."documentos_compra"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_documentos" ADD CONSTRAINT "pagos_documentos_documento_venta_id_documentos_venta_id_fk" FOREIGN KEY ("documento_venta_id") REFERENCES "public"."documentos_venta"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_documentos" ADD CONSTRAINT "pagos_documentos_cheque_id_cheques_id_fk" FOREIGN KEY ("cheque_id") REFERENCES "public"."cheques"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_medios" ADD CONSTRAINT "pagos_medios_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_medios" ADD CONSTRAINT "pagos_medios_metodo_pago_id_metodos_pago_id_fk" FOREIGN KEY ("metodo_pago_id") REFERENCES "public"."metodos_pago"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_medios" ADD CONSTRAINT "pagos_medios_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_medios" ADD CONSTRAINT "pagos_medios_cheque_banco_id_bancos_id_fk" FOREIGN KEY ("cheque_banco_id") REFERENCES "public"."bancos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_ejercicio" ADD CONSTRAINT "cierres_ejercicio_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_ejercicio" ADD CONSTRAINT "cierres_ejercicio_cuenta_resultado_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_resultado_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_ejercicio" ADD CONSTRAINT "cierres_ejercicio_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_ejercicio" ADD CONSTRAINT "cierres_ejercicio_asiento_reversa_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_reversa_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_ejercicio" ADD CONSTRAINT "cierres_ejercicio_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_cuenta_gasto_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_gasto_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_cuenta_ingreso_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_ingreso_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_cuenta_costo_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_costo_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_cuenta_activo_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_activo_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_centro_costo_default_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_default_id") REFERENCES "public"."centros_costo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglas_determinacion_cuenta" ADD CONSTRAINT "reglas_determinacion_cuenta_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglas_determinacion_cuenta" ADD CONSTRAINT "reglas_determinacion_cuenta_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impuestos" ADD CONSTRAINT "impuestos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impuestos" ADD CONSTRAINT "impuestos_cuenta_contable_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_grupos" ADD CONSTRAINT "terceros_grupos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_grupos" ADD CONSTRAINT "terceros_grupos_cuenta_contable_asociada_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_asociada_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_grupos" ADD CONSTRAINT "terceros_grupos_categoria_contable_default_id_categorias_contables_id_fk" FOREIGN KEY ("categoria_contable_default_id") REFERENCES "public"."categorias_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_grupo_id_terceros_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."terceros_grupos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_impuesto_default_id_impuestos_id_fk" FOREIGN KEY ("impuesto_default_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_cuenta_contable_asociada_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_asociada_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_categoria_contable_default_id_categorias_contables_id_fk" FOREIGN KEY ("categoria_contable_default_id") REFERENCES "public"."categorias_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_metodo_pago_default_id_metodos_pago_id_fk" FOREIGN KEY ("metodo_pago_default_id") REFERENCES "public"."metodos_pago"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_contactos" ADD CONSTRAINT "terceros_contactos_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_direcciones" ADD CONSTRAINT "terceros_direcciones_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_cuentas_bancarias" ADD CONSTRAINT "terceros_cuentas_bancarias_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_cuentas_bancarias" ADD CONSTRAINT "terceros_cuentas_bancarias_banco_id_bancos_id_fk" FOREIGN KEY ("banco_id") REFERENCES "public"."bancos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas_formatos" ADD CONSTRAINT "cartolas_formatos_banco_id_bancos_id_fk" FOREIGN KEY ("banco_id") REFERENCES "public"."bancos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas_formatos" ADD CONSTRAINT "cartolas_formatos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas_formato_campos" ADD CONSTRAINT "cartolas_formato_campos_formato_id_cartolas_formatos_id_fk" FOREIGN KEY ("formato_id") REFERENCES "public"."cartolas_formatos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas" ADD CONSTRAINT "cartolas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas" ADD CONSTRAINT "cartolas_cuenta_bancaria_id_cuentas_bancarias_id_fk" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas" ADD CONSTRAINT "cartolas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas_movimientos" ADD CONSTRAINT "cartolas_movimientos_cartola_id_cartolas_id_fk" FOREIGN KEY ("cartola_id") REFERENCES "public"."cartolas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas_movimientos" ADD CONSTRAINT "cartolas_movimientos_cuenta_bancaria_id_cuentas_bancarias_id_fk" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_numeracion" ADD CONSTRAINT "series_numeracion_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_usuario_cierre_id_usuarios_id_fk" FOREIGN KEY ("usuario_cierre_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_moneda_origen_id_monedas_id_fk" FOREIGN KEY ("moneda_origen_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_ingreso_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_ingreso_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_impuesto_default_id_impuestos_id_fk" FOREIGN KEY ("impuesto_default_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_centro_costo_default_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_default_id") REFERENCES "public"."centros_costo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_categoria_contable_default_id_categorias_contables_id_fk" FOREIGN KEY ("categoria_contable_default_id") REFERENCES "public"."categorias_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_inventario_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_inventario_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_costo_venta_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_costo_venta_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_gasto_compra_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_gasto_compra_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_impuesto_compra_default_id_impuestos_id_fk" FOREIGN KEY ("impuesto_compra_default_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_dotacion_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_dotacion_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_desviacion_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_desviacion_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_diferencia_precio_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_diferencia_precio_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_ajuste_stock_negativo_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_ajuste_stock_negativo_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_compensacion_stock_reduccion_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_compensacion_stock_reduccion_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_compensacion_stock_aumento_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_compensacion_stock_aumento_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_devolucion_venta_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_devolucion_venta_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_ingreso_extranjero_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_ingreso_extranjero_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_costo_extranjero_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_costo_extranjero_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_diferencia_cambio_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_diferencia_cambio_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_compensacion_mercaderia_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_compensacion_mercaderia_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_reduccion_libro_mayor_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_reduccion_libro_mayor_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_aumento_libro_mayor_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_aumento_libro_mayor_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_stock_wip_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_stock_wip_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_desviacion_stock_wip_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_desviacion_stock_wip_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_pyg_compensacion_wip_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_pyg_compensacion_wip_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_pyg_compensacion_stock_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_pyg_compensacion_stock_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_grupo_id_productos_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."productos_grupos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_tipo_documento_id_tipos_documento_id_fk" FOREIGN KEY ("tipo_documento_id") REFERENCES "public"."tipos_documento"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_vendedor_id_usuarios_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_contacto_id_terceros_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."terceros_contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_documento_referencia_id_documentos_venta_id_fk" FOREIGN KEY ("documento_referencia_id") REFERENCES "public"."documentos_venta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_asiento_reversa_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_reversa_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_usuario_contabilizacion_id_usuarios_id_fk" FOREIGN KEY ("usuario_contabilizacion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_usuario_creacion_id_usuarios_id_fk" FOREIGN KEY ("usuario_creacion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_documento_venta_id_documentos_venta_id_fk" FOREIGN KEY ("documento_venta_id") REFERENCES "public"."documentos_venta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_cuenta_ingreso_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_ingreso_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_categoria_contable_id_categorias_contables_id_fk" FOREIGN KEY ("categoria_contable_id") REFERENCES "public"."categorias_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_impuesto_id_impuestos_id_fk" FOREIGN KEY ("impuesto_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_tipo_documento_id_tipos_documento_id_fk" FOREIGN KEY ("tipo_documento_id") REFERENCES "public"."tipos_documento"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_documento_base_id_documentos_compra_id_fk" FOREIGN KEY ("documento_base_id") REFERENCES "public"."documentos_compra"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_asiento_reversa_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_reversa_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_usuario_creacion_id_usuarios_id_fk" FOREIGN KEY ("usuario_creacion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_usuario_contabilizacion_id_usuarios_id_fk" FOREIGN KEY ("usuario_contabilizacion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_documento_compra_id_documentos_compra_id_fk" FOREIGN KEY ("documento_compra_id") REFERENCES "public"."documentos_compra"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_cuenta_imputacion_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_imputacion_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_categoria_contable_id_categorias_contables_id_fk" FOREIGN KEY ("categoria_contable_id") REFERENCES "public"."categorias_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_impuesto_id_impuestos_id_fk" FOREIGN KEY ("impuesto_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_documento_base_linea_id_documentos_compra_lineas_id_fk" FOREIGN KEY ("documento_base_linea_id") REFERENCES "public"."documentos_compra_lineas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_stock" ADD CONSTRAINT "producto_stock_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_stock" ADD CONSTRAINT "producto_stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sii_credenciales" ADD CONSTRAINT "sii_credenciales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sii_dtes_pendientes" ADD CONSTRAINT "sii_dtes_pendientes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sii_importaciones" ADD CONSTRAINT "sii_importaciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_empresa" ADD CONSTRAINT "usuario_empresa_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_empresa" ADD CONSTRAINT "usuario_empresa_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bitacora_auditoria" ADD CONSTRAINT "bitacora_auditoria_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bitacora_auditoria" ADD CONSTRAINT "bitacora_auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferencias_formulario" ADD CONSTRAINT "preferencias_formulario_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases" ADD CONSTRAINT "activos_fijos_clases_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_clase_id_activos_fijos_clases_id_fk" FOREIGN KEY ("clase_id") REFERENCES "public"."activos_fijos_clases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_activo_plan_cuentas_id_fk" FOREIGN KEY ("cta_activo") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_dep_acumulada_plan_cuentas_id_fk" FOREIGN KEY ("cta_dep_acumulada") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_gasto_dep_plan_cuentas_id_fk" FOREIGN KEY ("cta_gasto_dep") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_compensacion_capitalizacion_plan_cuentas_id_fk" FOREIGN KEY ("cta_compensacion_capitalizacion") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_utilidad_baja_plan_cuentas_id_fk" FOREIGN KEY ("cta_utilidad_baja") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_perdida_baja_plan_cuentas_id_fk" FOREIGN KEY ("cta_perdida_baja") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_valor_libro_baja_plan_cuentas_id_fk" FOREIGN KEY ("cta_valor_libro_baja") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_correccion_monetaria_plan_cuentas_id_fk" FOREIGN KEY ("cta_correccion_monetaria") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_clase_id_activos_fijos_clases_id_fk" FOREIGN KEY ("clase_id") REFERENCES "public"."activos_fijos_clases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_valoraciones" ADD CONSTRAINT "activos_fijos_valoraciones_activo_id_activos_fijos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos_fijos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD CONSTRAINT "activos_fijos_documentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD CONSTRAINT "activos_fijos_documentos_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD CONSTRAINT "activos_fijos_documentos_asiento_reversa_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_reversa_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD CONSTRAINT "activos_fijos_documentos_usuario_creacion_id_usuarios_id_fk" FOREIGN KEY ("usuario_creacion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos_lineas" ADD CONSTRAINT "activos_fijos_documentos_lineas_documento_id_activos_fijos_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."activos_fijos_documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos_lineas" ADD CONSTRAINT "activos_fijos_documentos_lineas_activo_id_activos_fijos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos_fijos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_valores_periodo" ADD CONSTRAINT "activos_fijos_valores_periodo_activo_id_activos_fijos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos_fijos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_valores_periodo" ADD CONSTRAINT "activos_fijos_valores_periodo_periodo_id_periodos_contables_id_fk" FOREIGN KEY ("periodo_id") REFERENCES "public"."periodos_contables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_saldos" ADD CONSTRAINT "activos_fijos_saldos_activo_id_activos_fijos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos_fijos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_cierres" ADD CONSTRAINT "activos_fijos_cierres_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_cierres" ADD CONSTRAINT "activos_fijos_cierres_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_vidas_utiles_sii" ADD CONSTRAINT "activos_fijos_vidas_utiles_sii_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monedas_empresa_codigo_unique" ON "monedas" USING btree ("empresa_id","codigo") WHERE "monedas"."empresa_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "monedas_plantilla_codigo_unique" ON "monedas" USING btree ("codigo") WHERE "monedas"."empresa_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_cuentas_empresa_codigo_unique" ON "plan_cuentas" USING btree ("empresa_id","codigo_cuenta") WHERE "plan_cuentas"."empresa_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_cuentas_plantilla_codigo_unique" ON "plan_cuentas" USING btree ("plantilla_id","codigo_cuenta") WHERE "plan_cuentas"."plantilla_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "centros_costo_empresa_codigo_unique" ON "centros_costo" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "cuentas_bancarias_empresa_banco_numero_unique" ON "cuentas_bancarias" USING btree ("empresa_id","banco_id","numero_cuenta");--> statement-breakpoint
CREATE UNIQUE INDEX "metodos_pago_empresa_nombre_unique" ON "metodos_pago" USING btree ("empresa_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "cheques_pago_medio_unique" ON "cheques" USING btree ("pago_medio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "depositos_empresa_numero_unique" ON "depositos" USING btree ("empresa_id","numero_interno");--> statement-breakpoint
CREATE UNIQUE INDEX "depositos_cheques_unico" ON "depositos_cheques" USING btree ("deposito_id","cheque_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pagos_empresa_numero_unique" ON "pagos" USING btree ("empresa_id","numero_interno");--> statement-breakpoint
CREATE UNIQUE INDEX "cierres_ejercicio_empresa_anio_unique" ON "cierres_ejercicio" USING btree ("empresa_id","anio");--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_contables_empresa_nombre_unique" ON "categorias_contables" USING btree ("empresa_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "reglas_determinacion_cuenta_empresa_contexto_rol_unique" ON "reglas_determinacion_cuenta" USING btree ("empresa_id","contexto","rol");--> statement-breakpoint
CREATE UNIQUE INDEX "impuestos_empresa_codigo_unique" ON "impuestos" USING btree ("empresa_id","codigo") WHERE "impuestos"."empresa_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "impuestos_plantilla_codigo_unique" ON "impuestos" USING btree ("codigo") WHERE "impuestos"."empresa_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "terceros_grupos_empresa_codigo_unique" ON "terceros_grupos" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "terceros_empresa_rut_unique" ON "terceros" USING btree ("empresa_id","rut");--> statement-breakpoint
CREATE UNIQUE INDEX "terceros_empresa_codigo_unique" ON "terceros" USING btree ("empresa_id","codigo") WHERE "terceros"."codigo" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "cartolas_formatos_global_banco_unique" ON "cartolas_formatos" USING btree ("banco_id") WHERE "cartolas_formatos"."empresa_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "cartolas_formato_campos_formato_campo_unique" ON "cartolas_formato_campos" USING btree ("formato_id","campo_destino");--> statement-breakpoint
CREATE UNIQUE INDEX "cartolas_cuenta_archivo_hash_unique" ON "cartolas" USING btree ("cuenta_bancaria_id","archivo_hash") WHERE "cartolas"."archivo_hash" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "cartolas_movimientos_cuenta_huella_unique" ON "cartolas_movimientos" USING btree ("cuenta_bancaria_id","huella");--> statement-breakpoint
CREATE UNIQUE INDEX "series_numeracion_empresa_ambito_clave_unique" ON "series_numeracion" USING btree ("empresa_id","ambito","clave");--> statement-breakpoint
CREATE UNIQUE INDEX "periodos_contables_empresa_anio_mes_unique" ON "periodos_contables" USING btree ("empresa_id","anio","mes");--> statement-breakpoint
CREATE UNIQUE INDEX "asientos_contables_empresa_anio_correlativo_unique" ON "asientos_contables" USING btree ("empresa_id","anio","correlativo");--> statement-breakpoint
CREATE INDEX "asientos_contables_documento_origen_idx" ON "asientos_contables" USING btree ("documento_origen_tabla","documento_origen_id");--> statement-breakpoint
CREATE UNIQUE INDEX "productos_grupos_empresa_nombre_unique" ON "productos_grupos" USING btree ("empresa_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "productos_empresa_codigo_unique" ON "productos" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE INDEX "productos_empresa_estado_idx" ON "productos" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX "productos_empresa_barcode_idx" ON "productos" USING btree ("empresa_id","codigo_barras") WHERE "productos"."codigo_barras" is not null;--> statement-breakpoint
CREATE INDEX "documentos_venta_empresa_estado_idx" ON "documentos_venta" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX "documentos_venta_empresa_tercero_idx" ON "documentos_venta" USING btree ("empresa_id","tercero_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_venta_empresa_tipo_folio_unique" ON "documentos_venta" USING btree ("empresa_id","tipo_documento_id","folio") WHERE "documentos_venta"."folio" is not null;--> statement-breakpoint
CREATE INDEX "documentos_compra_empresa_tipo_estado_idx" ON "documentos_compra" USING btree ("empresa_id","doc_tipo","estado");--> statement-breakpoint
CREATE INDEX "documentos_compra_empresa_tercero_idx" ON "documentos_compra" USING btree ("empresa_id","tercero_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_compra_empresa_prov_tipo_folio_unique" ON "documentos_compra" USING btree ("empresa_id","tercero_id","tipo_documento_id","folio") WHERE "documentos_compra"."folio" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_compra_lineas_documento_numero_unique" ON "documentos_compra_lineas" USING btree ("documento_compra_id","numero_linea");--> statement-breakpoint
CREATE UNIQUE INDEX "producto_stock_empresa_producto_unique" ON "producto_stock" USING btree ("empresa_id","producto_id");--> statement-breakpoint
CREATE INDEX "stock_movimientos_empresa_producto_fecha_idx" ON "stock_movimientos" USING btree ("empresa_id","producto_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "sii_credenciales_empresa_unique" ON "sii_credenciales" USING btree ("empresa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sii_dtes_pendientes_unico" ON "sii_dtes_pendientes" USING btree ("empresa_id","origen","tipo_dte","folio","rut_contraparte");--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_empresa_usuario_empresa_unique" ON "usuario_empresa" USING btree ("usuario_id","empresa_id");--> statement-breakpoint
CREATE INDEX "bitacora_auditoria_empresa_creado_idx" ON "bitacora_auditoria" USING btree ("empresa_id","creado_en");--> statement-breakpoint
CREATE INDEX "bitacora_auditoria_registro_idx" ON "bitacora_auditoria" USING btree ("tabla_afectada","registro_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preferencias_formulario_usuario_clave_unique" ON "preferencias_formulario" USING btree ("usuario_id","clave");--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_clases_empresa_codigo_unique" ON "activos_fijos_clases" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_empresa_codigo_unique" ON "activos_fijos" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_documentos_empresa_tipo_anio_numero_unique" ON "activos_fijos_documentos" USING btree ("empresa_id","tipo_doc","anio","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_cierres_empresa_libro_anio_unique" ON "activos_fijos_cierres" USING btree ("empresa_id","libro","anio");--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_vidas_utiles_sii_global_categoria_unique" ON "activos_fijos_vidas_utiles_sii" USING btree ("categoria") WHERE "activos_fijos_vidas_utiles_sii"."empresa_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_vidas_utiles_sii_empresa_categoria_unique" ON "activos_fijos_vidas_utiles_sii" USING btree ("empresa_id","categoria") WHERE "activos_fijos_vidas_utiles_sii"."empresa_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "factores_correccion_monetaria_anio_mes_unique" ON "factores_correccion_monetaria" USING btree ("anio","mes");