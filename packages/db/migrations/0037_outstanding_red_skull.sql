CREATE TYPE "public"."pago_estado" AS ENUM('contabilizado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."pago_tipo" AS ENUM('Recibido', 'Efectuado');--> statement-breakpoint
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
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_asiento_reversa_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_reversa_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_documentos" ADD CONSTRAINT "pagos_documentos_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_documentos" ADD CONSTRAINT "pagos_documentos_documento_compra_id_documentos_compra_id_fk" FOREIGN KEY ("documento_compra_id") REFERENCES "public"."documentos_compra"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_documentos" ADD CONSTRAINT "pagos_documentos_documento_venta_id_documentos_venta_id_fk" FOREIGN KEY ("documento_venta_id") REFERENCES "public"."documentos_venta"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_medios" ADD CONSTRAINT "pagos_medios_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_medios" ADD CONSTRAINT "pagos_medios_metodo_pago_id_metodos_pago_id_fk" FOREIGN KEY ("metodo_pago_id") REFERENCES "public"."metodos_pago"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_medios" ADD CONSTRAINT "pagos_medios_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_medios" ADD CONSTRAINT "pagos_medios_cheque_banco_id_bancos_id_fk" FOREIGN KEY ("cheque_banco_id") REFERENCES "public"."bancos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pagos_empresa_numero_unique" ON "pagos" USING btree ("empresa_id","numero_interno");