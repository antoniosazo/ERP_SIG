ALTER TYPE "public"."determinacion_rol" ADD VALUE 'resultado_ejercicio';--> statement-breakpoint
CREATE TABLE "cierres_ejercicio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"cuenta_resultado_id" uuid NOT NULL,
	"monto_resultado" numeric(18, 4) NOT NULL,
	"estado" "pago_estado" DEFAULT 'contabilizado' NOT NULL,
	"asiento_id" uuid,
	"asiento_reversa_id" uuid,
	"fecha_reapertura" date,
	"motivo_reapertura" text,
	"usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cierres_ejercicio" ADD CONSTRAINT "cierres_ejercicio_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_ejercicio" ADD CONSTRAINT "cierres_ejercicio_cuenta_resultado_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_resultado_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_ejercicio" ADD CONSTRAINT "cierres_ejercicio_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_ejercicio" ADD CONSTRAINT "cierres_ejercicio_asiento_reversa_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_reversa_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_ejercicio" ADD CONSTRAINT "cierres_ejercicio_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cierres_ejercicio_empresa_anio_unique" ON "cierres_ejercicio" USING btree ("empresa_id","anio");