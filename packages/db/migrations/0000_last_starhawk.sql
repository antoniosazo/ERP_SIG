CREATE TYPE "public"."asiento_estado" AS ENUM('borrador', 'contabilizado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."asiento_tipo" AS ENUM('manual', 'traspaso', 'ingreso', 'egreso', 'ajuste', 'automatico');--> statement-breakpoint
CREATE TYPE "public"."categoria_aplica_a" AS ENUM('Compra', 'Venta', 'Honorario', 'Ambos');--> statement-breakpoint
CREATE TYPE "public"."clase_cuenta" AS ENUM('Activo', 'Pasivo', 'Patrimonio', 'Ingresos', 'Costos y Gastos', 'Cuentas de Orden');--> statement-breakpoint
CREATE TYPE "public"."clasificacion_corriente" AS ENUM('Corriente', 'No Corriente', 'No Aplica');--> statement-breakpoint
CREATE TYPE "public"."empresa_estado" AS ENUM('Activa', 'Inactiva');--> statement-breakpoint
CREATE TYPE "public"."firma_estado" AS ENUM('Activa', 'Suspendida');--> statement-breakpoint
CREATE TYPE "public"."iva_recuperable" AS ENUM('Total', 'Parcial', 'No Recuperable');--> statement-breakpoint
CREATE TYPE "public"."libro_contable" AS ENUM('Tributario', 'IFRS', 'Ambos');--> statement-breakpoint
CREATE TYPE "public"."moneda_tipo" AS ENUM('Moneda', 'Unidad de Reajuste');--> statement-breakpoint
CREATE TYPE "public"."naturaleza_cuenta" AS ENUM('Deudora', 'Acreedora');--> statement-breakpoint
CREATE TYPE "public"."periodo_estado" AS ENUM('Abierto', 'Cerrado', 'Reabierto');--> statement-breakpoint
CREATE TYPE "public"."plan_contratado" AS ENUM('Basico', 'Profesional', 'Enterprise');--> statement-breakpoint
CREATE TYPE "public"."tipo_cambio_origen" AS ENUM('Manual', 'Importado archivo', 'Sincronizado API');--> statement-breakpoint
CREATE TYPE "public"."tipo_operacion_documento" AS ENUM('Compra', 'Venta', 'Ambos');--> statement-breakpoint
CREATE TYPE "public"."tipo_tercero" AS ENUM('Cliente', 'Proveedor', 'Prestador Honorarios', 'Otro');--> statement-breakpoint
CREATE TABLE "firmas_contables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rut" text NOT NULL,
	"razon_social" text NOT NULL,
	"plan_contratado" "plan_contratado" DEFAULT 'Basico' NOT NULL,
	"estado" "firma_estado" DEFAULT 'Activa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "firmas_contables_rut_unique" UNIQUE("rut")
);
--> statement-breakpoint
CREATE TABLE "monedas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "moneda_tipo" NOT NULL,
	"simbolo" text NOT NULL,
	"decimales" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monedas_codigo_unique" UNIQUE("codigo")
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
	"firma_contable_id" uuid NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresas_firma_rut_unique" UNIQUE("firma_contable_id","rut")
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
	"tipo" text,
	"clasificacion_corriente" "clasificacion_corriente" DEFAULT 'No Aplica' NOT NULL,
	"nivel_imputable" boolean DEFAULT true NOT NULL,
	"requiere_centro_costo" boolean DEFAULT false NOT NULL,
	"requiere_analisis_terceros" boolean DEFAULT false NOT NULL,
	"admite_moneda_extranjera" boolean DEFAULT false NOT NULL,
	"es_cuenta_ajuste" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "terceros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"rut" text NOT NULL,
	"razon_social" text NOT NULL,
	"tipo_tercero" "tipo_tercero" NOT NULL,
	"cuenta_contable_asociada_id" uuid,
	"categoria_contable_default_id" uuid,
	"retencion_honorarios_pct" numeric(5, 2),
	"es_emisor_boleta_honorarios" boolean DEFAULT false NOT NULL,
	"es_receptor_boleta_honorarios" boolean DEFAULT false NOT NULL,
	"pendiente_completar" boolean DEFAULT false NOT NULL,
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
	"estado" "periodo_estado" DEFAULT 'Abierto' NOT NULL,
	"fecha_cierre" timestamp with time zone,
	"motivo_reapertura" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asientos_contables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"correlativo" integer NOT NULL,
	"anio" integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM fecha)::int) STORED NOT NULL,
	"fecha" date NOT NULL,
	"glosa" text NOT NULL,
	"tipo" "asiento_tipo" NOT NULL,
	"origen" text,
	"libro" "libro_contable" DEFAULT 'Ambos' NOT NULL,
	"estado" "asiento_estado" DEFAULT 'borrador' NOT NULL,
	"documento_origen_id" uuid,
	"documento_origen_tabla" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "tipos_cambio" ADD CONSTRAINT "tipos_cambio_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_firma_contable_id_firmas_contables_id_fk" FOREIGN KEY ("firma_contable_id") REFERENCES "public"."firmas_contables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_moneda_funcional_id_monedas_id_fk" FOREIGN KEY ("moneda_funcional_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_moneda_reporte_id_monedas_id_fk" FOREIGN KEY ("moneda_reporte_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_plan_cuentas_plantilla_id_plan_cuentas_plantillas_id_fk" FOREIGN KEY ("plan_cuentas_plantilla_id") REFERENCES "public"."plan_cuentas_plantillas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_plantilla_id_plan_cuentas_plantillas_id_fk" FOREIGN KEY ("plantilla_id") REFERENCES "public"."plan_cuentas_plantillas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_cuenta_padre_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_padre_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_centro_padre_id_centros_costo_id_fk" FOREIGN KEY ("centro_padre_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_cuenta_gasto_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_gasto_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_cuenta_ingreso_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_ingreso_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_cuenta_costo_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_costo_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_cuenta_activo_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_activo_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_contables" ADD CONSTRAINT "categorias_contables_centro_costo_default_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_default_id") REFERENCES "public"."centros_costo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_cuenta_contable_asociada_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_asociada_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_categoria_contable_default_id_categorias_contables_id_fk" FOREIGN KEY ("categoria_contable_default_id") REFERENCES "public"."categorias_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_moneda_origen_id_monedas_id_fk" FOREIGN KEY ("moneda_origen_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_cuentas_empresa_codigo_unique" ON "plan_cuentas" USING btree ("empresa_id","codigo_cuenta") WHERE "plan_cuentas"."empresa_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_cuentas_plantilla_codigo_unique" ON "plan_cuentas" USING btree ("plantilla_id","codigo_cuenta") WHERE "plan_cuentas"."plantilla_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "centros_costo_empresa_codigo_unique" ON "centros_costo" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_contables_empresa_nombre_unique" ON "categorias_contables" USING btree ("empresa_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "terceros_empresa_rut_unique" ON "terceros" USING btree ("empresa_id","rut");--> statement-breakpoint
CREATE UNIQUE INDEX "periodos_contables_empresa_anio_mes_unique" ON "periodos_contables" USING btree ("empresa_id","anio","mes");--> statement-breakpoint
CREATE UNIQUE INDEX "asientos_contables_empresa_anio_correlativo_unique" ON "asientos_contables" USING btree ("empresa_id","anio","correlativo");