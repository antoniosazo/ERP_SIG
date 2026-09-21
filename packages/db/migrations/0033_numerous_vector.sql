CREATE TYPE "public"."tipo_facturador" AS ENUM('SII Gratuito', 'Facturador comercial', 'No emite DTE');--> statement-breakpoint
ALTER TABLE "sii_credenciales" ADD COLUMN "tipo_facturador" "tipo_facturador" DEFAULT 'SII Gratuito' NOT NULL;--> statement-breakpoint
ALTER TABLE "sii_credenciales" ADD COLUMN "nombre_facturador" text;