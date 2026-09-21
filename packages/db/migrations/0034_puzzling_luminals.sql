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
ALTER TABLE "sii_credenciales" ADD COLUMN "xml_ultima_descarga_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sii_credenciales" ADD COLUMN "xml_ultima_descarga_detalle" text;--> statement-breakpoint
ALTER TABLE "sii_dtes_pendientes" ADD CONSTRAINT "sii_dtes_pendientes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sii_dtes_pendientes_unico" ON "sii_dtes_pendientes" USING btree ("empresa_id","origen","tipo_dte","folio","rut_contraparte");