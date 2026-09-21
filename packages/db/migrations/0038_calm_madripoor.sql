CREATE TYPE "public"."cheque_estado" AS ENUM('en_cartera', 'depositado', 'protestado', 'emitido', 'cobrado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."cheque_tipo" AS ENUM('Recibido', 'Emitido');--> statement-breakpoint
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
ALTER TABLE "pagos_documentos" ADD COLUMN "cheque_id" uuid;--> statement-breakpoint
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
CREATE UNIQUE INDEX "cheques_pago_medio_unique" ON "cheques" USING btree ("pago_medio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "depositos_empresa_numero_unique" ON "depositos" USING btree ("empresa_id","numero_interno");--> statement-breakpoint
CREATE UNIQUE INDEX "depositos_cheques_unico" ON "depositos_cheques" USING btree ("deposito_id","cheque_id");--> statement-breakpoint
ALTER TABLE "pagos_documentos" ADD CONSTRAINT "pagos_documentos_cheque_id_cheques_id_fk" FOREIGN KEY ("cheque_id") REFERENCES "public"."cheques"("id") ON DELETE restrict ON UPDATE no action;