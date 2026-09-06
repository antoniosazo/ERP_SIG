CREATE TYPE "public"."rol" AS ENUM('Administrador', 'Contador', 'Asistente');--> statement-breakpoint
CREATE TYPE "public"."token_tipo" AS ENUM('invitacion', 'reset_password');--> statement-breakpoint
CREATE TYPE "public"."usuario_estado" AS ENUM('Invitado', 'Activo', 'Suspendido');--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firma_contable_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"estado" "usuario_estado" DEFAULT 'Invitado' NOT NULL,
	"es_admin_firma" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "usuario_empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"rol" "rol" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_firma_contable_id_firmas_contables_id_fk" FOREIGN KEY ("firma_contable_id") REFERENCES "public"."firmas_contables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_empresa" ADD CONSTRAINT "usuario_empresa_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_empresa" ADD CONSTRAINT "usuario_empresa_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens_acceso" ADD CONSTRAINT "tokens_acceso_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_empresa_usuario_empresa_unique" ON "usuario_empresa" USING btree ("usuario_id","empresa_id");