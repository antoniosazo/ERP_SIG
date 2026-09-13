CREATE TYPE "public"."sii_metodo_auth" AS ENUM('clave', 'certificado');--> statement-breakpoint
ALTER TABLE "sii_credenciales" ADD COLUMN "metodo_auth" "sii_metodo_auth" DEFAULT 'clave' NOT NULL;