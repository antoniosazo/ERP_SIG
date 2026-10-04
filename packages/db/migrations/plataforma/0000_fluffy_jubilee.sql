CREATE TYPE "public"."base_firma_estado" AS ENUM('pendiente', 'lista', 'error');--> statement-breakpoint
CREATE TYPE "public"."base_proveedor" AS ENUM('neon', 'servidor');--> statement-breakpoint
CREATE TYPE "public"."firma_estado" AS ENUM('Activa', 'Suspendida');--> statement-breakpoint
CREATE TYPE "public"."plan_contratado" AS ENUM('Basico', 'Profesional', 'Enterprise');--> statement-breakpoint
CREATE TYPE "public"."token_tipo" AS ENUM('invitacion', 'reset_password');--> statement-breakpoint
CREATE TYPE "public"."usuario_estado" AS ENUM('Invitado', 'Activo', 'Suspendido');--> statement-breakpoint
CREATE TABLE "firmas_contables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rut" text NOT NULL,
	"razon_social" text NOT NULL,
	"plan_contratado" "plan_contratado" DEFAULT 'Basico' NOT NULL,
	"estado" "firma_estado" DEFAULT 'Activa' NOT NULL,
	"proveedor" "base_proveedor" NOT NULL,
	"neon_proyecto_id" text,
	"region" text,
	"base_datos" text,
	"conexion_cifrada" text,
	"estado_base" "base_firma_estado" DEFAULT 'pendiente' NOT NULL,
	"version_esquema" text,
	"migrada_en" timestamp with time zone,
	"error_migracion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "firmas_contables_rut_unique" UNIQUE("rut")
);
--> statement-breakpoint
CREATE TABLE "tokens_acceso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" "token_tipo" NOT NULL,
	"token" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"usado_en" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_acceso_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firma_contable_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"estado" "usuario_estado" DEFAULT 'Invitado' NOT NULL,
	"es_admin_firma" boolean DEFAULT false NOT NULL,
	"es_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "tokens_acceso" ADD CONSTRAINT "tokens_acceso_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_firma_contable_id_firmas_contables_id_fk" FOREIGN KEY ("firma_contable_id") REFERENCES "public"."firmas_contables"("id") ON DELETE restrict ON UPDATE no action;