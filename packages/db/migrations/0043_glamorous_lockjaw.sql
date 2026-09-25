ALTER TYPE "public"."determinacion_rol" ADD VALUE 'utilidad_baja';--> statement-breakpoint
ALTER TYPE "public"."determinacion_rol" ADD VALUE 'perdida_baja';--> statement-breakpoint
ALTER TYPE "public"."determinacion_rol" ADD VALUE 'valor_libro_baja';--> statement-breakpoint
CREATE TABLE "activos_fijos_cierres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"libro" "libro_contable" NOT NULL,
	"anio" integer NOT NULL,
	"estado" "pago_estado" DEFAULT 'contabilizado' NOT NULL,
	"fecha_reapertura" date,
	"motivo_reapertura" text,
	"usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activos_fijos" ADD COLUMN "fecha_baja" date;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD COLUMN "asiento_reversa_id" uuid;--> statement-breakpoint
ALTER TABLE "activos_fijos_cierres" ADD CONSTRAINT "activos_fijos_cierres_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos_fijos_cierres" ADD CONSTRAINT "activos_fijos_cierres_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_cierres_empresa_libro_anio_unique" ON "activos_fijos_cierres" USING btree ("empresa_id","libro","anio");--> statement-breakpoint
ALTER TABLE "activos_fijos_documentos" ADD CONSTRAINT "activos_fijos_documentos_asiento_reversa_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_reversa_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;