CREATE TYPE "public"."sii_ambiente" AS ENUM('certificacion', 'produccion');--> statement-breakpoint
CREATE TABLE "sii_credenciales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"rut" text NOT NULL,
	"clave_cifrada" text,
	"certificado_cifrado" text,
	"certificado_pass_cifrada" text,
	"ambiente" "sii_ambiente" DEFAULT 'produccion' NOT NULL,
	"certificado_vence" date,
	"ultima_sync_periodo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "documentos_venta" ADD COLUMN "estado_rcv" text;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD COLUMN "estado_rcv" text;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD COLUMN "sii_track_id" text;--> statement-breakpoint
ALTER TABLE "sii_credenciales" ADD CONSTRAINT "sii_credenciales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sii_importaciones" ADD CONSTRAINT "sii_importaciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sii_credenciales_empresa_unique" ON "sii_credenciales" USING btree ("empresa_id");