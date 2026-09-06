CREATE TYPE "public"."auditoria_accion" AS ENUM('crear', 'editar', 'eliminar', 'cambio_estado');--> statement-breakpoint
CREATE TABLE "bitacora_auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"usuario_id" uuid,
	"usuario_nombre" text NOT NULL,
	"tabla_afectada" text NOT NULL,
	"registro_id" uuid NOT NULL,
	"etiqueta" text NOT NULL,
	"accion" "auditoria_accion" NOT NULL,
	"valores_anteriores" jsonb,
	"valores_nuevos" jsonb,
	"motivo" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bitacora_auditoria" ADD CONSTRAINT "bitacora_auditoria_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bitacora_auditoria" ADD CONSTRAINT "bitacora_auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bitacora_auditoria_empresa_creado_idx" ON "bitacora_auditoria" USING btree ("empresa_id","creado_en");--> statement-breakpoint
CREATE INDEX "bitacora_auditoria_registro_idx" ON "bitacora_auditoria" USING btree ("tabla_afectada","registro_id");