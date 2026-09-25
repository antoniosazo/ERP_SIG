CREATE TYPE "public"."activo_fijo_doc_estado" AS ENUM('borrador', 'contabilizado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_doc_tipo" AS ENUM('CAP', 'CAP_NC', 'MEJ', 'DEP', 'DEP_MAN', 'DET', 'REV', 'CM', 'TRF', 'TRF_CLASE', 'BAJA_VTA', 'BAJA_CAST', 'APERT');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_estado" AS ENUM('Nuevo', 'En curso', 'Activo', 'Inactivo', 'Dado de baja');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_metodo_dep" AS ENUM('Lineal', 'Saldo decreciente', 'Dígitos', 'Unidades de producción', 'Inmediata', 'Manual', 'Sin depreciación');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_regla_baja" AS ENUM('Hasta fecha', 'Hasta mes anterior', 'Mes completo');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_regla_inicio" AS ENUM('Fecha exacta', 'Mes siguiente', 'Inicio de mes', 'Medio período');--> statement-breakpoint
CREATE TYPE "public"."activo_fijo_tipo" AS ENUM('Tangible', 'Intangible', 'Terreno', 'En curso');--> statement-breakpoint
ALTER TYPE "public"."determinacion_rol" ADD VALUE 'activo_fijo';--> statement-breakpoint
ALTER TYPE "public"."determinacion_rol" ADD VALUE 'depreciacion_acumulada';--> statement-breakpoint
ALTER TYPE "public"."determinacion_rol" ADD VALUE 'gasto_depreciacion';--> statement-breakpoint
ALTER TYPE "public"."determinacion_rol" ADD VALUE 'cuenta_compensacion_capitalizacion';--> statement-breakpoint
ALTER TYPE "public"."serie_ambito" ADD VALUE 'activo_fijo';--> statement-breakpoint
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
	"clase_id" uuid NOT NULL,
	"centro_costo_id" uuid,
	"estado" "activo_fijo_estado" DEFAULT 'Nuevo' NOT NULL,
	"ubicacion" text,
	"numero_serie" text,
	"marca" text,
	"modelo" text,
	"fecha_adquisicion" date,
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
	"doc_anulado_id" uuid,
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
ALTER TABLE "activos_fijos_clases" ADD CONSTRAINT "activos_fijos_clases_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_clase_id_activos_fijos_clases_id_fk" FOREIGN KEY ("clase_id") REFERENCES "public"."activos_fijos_clases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_activo_plan_cuentas_id_fk" FOREIGN KEY ("cta_activo") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_dep_acumulada_plan_cuentas_id_fk" FOREIGN KEY ("cta_dep_acumulada") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_gasto_dep_plan_cuentas_id_fk" FOREIGN KEY ("cta_gasto_dep") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_compensacion_capitalizacion_plan_cuentas_id_fk" FOREIGN KEY ("cta_compensacion_capitalizacion") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_utilidad_baja_plan_cuentas_id_fk" FOREIGN KEY ("cta_utilidad_baja") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_perdida_baja_plan_cuentas_id_fk" FOREIGN KEY ("cta_perdida_baja") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_valor_libro_baja_plan_cuentas_id_fk" FOREIGN KEY ("cta_valor_libro_baja") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_clase_id_activos_fijos_clases_id_fk" FOREIGN KEY ("clase_id") REFERENCES "public"."activos_fijos_clases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_valoraciones" ADD CONSTRAINT "activos_fijos_valoraciones_activo_id_activos_fijos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos_fijos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD CONSTRAINT "activos_fijos_documentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD CONSTRAINT "activos_fijos_documentos_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD CONSTRAINT "activos_fijos_documentos_doc_anulado_id_activos_fijos_documentos_id_fk" FOREIGN KEY ("doc_anulado_id") REFERENCES "public"."activos_fijos_documentos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD CONSTRAINT "activos_fijos_documentos_usuario_creacion_id_usuarios_id_fk" FOREIGN KEY ("usuario_creacion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos_lineas" ADD CONSTRAINT "activos_fijos_documentos_lineas_documento_id_activos_fijos_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."activos_fijos_documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos_lineas" ADD CONSTRAINT "activos_fijos_documentos_lineas_activo_id_activos_fijos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos_fijos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_valores_periodo" ADD CONSTRAINT "activos_fijos_valores_periodo_activo_id_activos_fijos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos_fijos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_valores_periodo" ADD CONSTRAINT "activos_fijos_valores_periodo_periodo_id_periodos_contables_id_fk" FOREIGN KEY ("periodo_id") REFERENCES "public"."periodos_contables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_saldos" ADD CONSTRAINT "activos_fijos_saldos_activo_id_activos_fijos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos_fijos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_clases_empresa_codigo_unique" ON "activos_fijos_clases" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_empresa_codigo_unique" ON "activos_fijos" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_documentos_empresa_tipo_anio_numero_unique" ON "activos_fijos_documentos" USING btree ("empresa_id","tipo_doc","anio","numero");