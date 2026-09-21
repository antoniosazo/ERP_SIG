CREATE TYPE "public"."documento_modalidad" AS ENUM('Artículo', 'Servicio');--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD COLUMN "modalidad" "documento_modalidad" DEFAULT 'Artículo' NOT NULL;--> statement-breakpoint
ALTER TABLE "documentos_compra" ADD COLUMN "modalidad" "documento_modalidad" DEFAULT 'Artículo' NOT NULL;