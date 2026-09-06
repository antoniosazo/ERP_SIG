CREATE TYPE "public"."documento_compra_estado" AS ENUM('borrador', 'abierto', 'contabilizado', 'cerrado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."documento_compra_tipo" AS ENUM('pedido', 'entrada_mercaderia', 'factura', 'nota_credito', 'nota_debito');--> statement-breakpoint
ALTER TYPE "public"."determinacion_rol" ADD VALUE 'gasto';--> statement-breakpoint
ALTER TYPE "public"."determinacion_rol" ADD VALUE 'inventario';--> statement-breakpoint
ALTER TYPE "public"."determinacion_rol" ADD VALUE 'gr_ir';--> statement-breakpoint
ALTER TYPE "public"."serie_ambito" ADD VALUE 'compra';--> statement-breakpoint
CREATE TABLE "documentos_compra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"doc_tipo" "documento_compra_tipo" NOT NULL,
	"numero_interno" text,
	"tipo_documento_id" uuid NOT NULL,
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
	"usuario_creacion_id" uuid,
	"usuario_contabilizacion_id" uuid,
	"motivo_anulacion" text,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_tipo_documento_id_tipos_documento_id_fk" FOREIGN KEY ("tipo_documento_id") REFERENCES "public"."tipos_documento"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_documento_base_id_documentos_compra_id_fk" FOREIGN KEY ("documento_base_id") REFERENCES "public"."documentos_compra"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_usuario_creacion_id_usuarios_id_fk" FOREIGN KEY ("usuario_creacion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD CONSTRAINT "documentos_compra_usuario_contabilizacion_id_usuarios_id_fk" FOREIGN KEY ("usuario_contabilizacion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_documento_compra_id_documentos_compra_id_fk" FOREIGN KEY ("documento_compra_id") REFERENCES "public"."documentos_compra"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_cuenta_imputacion_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_imputacion_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_categoria_contable_id_categorias_contables_id_fk" FOREIGN KEY ("categoria_contable_id") REFERENCES "public"."categorias_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_impuesto_id_impuestos_id_fk" FOREIGN KEY ("impuesto_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_compra_lineas" ADD CONSTRAINT "documentos_compra_lineas_documento_base_linea_id_documentos_compra_lineas_id_fk" FOREIGN KEY ("documento_base_linea_id") REFERENCES "public"."documentos_compra_lineas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documentos_compra_empresa_tipo_estado_idx" ON "documentos_compra" USING btree ("empresa_id","doc_tipo","estado");--> statement-breakpoint
CREATE INDEX "documentos_compra_empresa_tercero_idx" ON "documentos_compra" USING btree ("empresa_id","tercero_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_compra_empresa_prov_tipo_folio_unique" ON "documentos_compra" USING btree ("empresa_id","tercero_id","tipo_documento_id","folio") WHERE "documentos_compra"."folio" is not null;