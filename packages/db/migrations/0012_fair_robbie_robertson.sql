CREATE TYPE "public"."documento_venta_clase" AS ENUM('Factura', 'Nota de Crédito', 'Nota de Débito');--> statement-breakpoint
CREATE TYPE "public"."documento_venta_estado" AS ENUM('borrador', 'contabilizado', 'anulado');--> statement-breakpoint
ALTER TYPE "public"."serie_ambito" ADD VALUE 'venta';--> statement-breakpoint
CREATE TABLE "documentos_venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"numero_interno" text,
	"clase" "documento_venta_clase" NOT NULL,
	"tipo_documento_id" uuid NOT NULL,
	"tercero_id" uuid NOT NULL,
	"folio" text,
	"fecha_emision" date NOT NULL,
	"fecha_vencimiento" date,
	"num_at_card" text,
	"moneda_id" uuid NOT NULL,
	"tipo_cambio" numeric(18, 6) DEFAULT '1' NOT NULL,
	"monto_neto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_exento" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"monto_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"glosa" text,
	"estado" "documento_venta_estado" DEFAULT 'borrador' NOT NULL,
	"documento_referencia_id" uuid,
	"asiento_id" uuid,
	"fecha_contabilizacion" timestamp with time zone,
	"usuario_contabilizacion_id" uuid,
	"motivo_anulacion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos_venta_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_venta_id" uuid NOT NULL,
	"numero_linea" integer NOT NULL,
	"glosa" text,
	"cuenta_ingreso_id" uuid NOT NULL,
	"categoria_contable_id" uuid,
	"centro_costo_id" uuid,
	"impuesto_id" uuid,
	"monto_neto" numeric(18, 4) NOT NULL,
	"es_exento" boolean DEFAULT false NOT NULL,
	"monto_impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_tipo_documento_id_tipos_documento_id_fk" FOREIGN KEY ("tipo_documento_id") REFERENCES "public"."tipos_documento"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_documento_referencia_id_documentos_venta_id_fk" FOREIGN KEY ("documento_referencia_id") REFERENCES "public"."documentos_venta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_usuario_contabilizacion_id_usuarios_id_fk" FOREIGN KEY ("usuario_contabilizacion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_documento_venta_id_documentos_venta_id_fk" FOREIGN KEY ("documento_venta_id") REFERENCES "public"."documentos_venta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_cuenta_ingreso_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_ingreso_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_categoria_contable_id_categorias_contables_id_fk" FOREIGN KEY ("categoria_contable_id") REFERENCES "public"."categorias_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_impuesto_id_impuestos_id_fk" FOREIGN KEY ("impuesto_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documentos_venta_empresa_estado_idx" ON "documentos_venta" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX "documentos_venta_empresa_tercero_idx" ON "documentos_venta" USING btree ("empresa_id","tercero_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_venta_empresa_tipo_folio_unique" ON "documentos_venta" USING btree ("empresa_id","tipo_documento_id","folio") WHERE "documentos_venta"."folio" is not null;