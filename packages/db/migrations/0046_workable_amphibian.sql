CREATE TYPE "public"."activo_fijo_regimen_depreciacion" AS ENUM('Normal', 'Acelerada', 'Instantanea');--> statement-breakpoint
ALTER TYPE "public"."determinacion_rol" ADD VALUE 'correccion_monetaria';--> statement-breakpoint
CREATE TABLE "activos_fijos_vidas_utiles_sii" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"categoria" text NOT NULL,
	"descripcion" text,
	"vida_util_normal_meses" integer NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factores_correccion_monetaria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"factor_porcentaje" numeric(8, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD COLUMN "cta_correccion_monetaria" uuid;--> statement-breakpoint
ALTER TABLE "activos_fijos_valoraciones" ADD COLUMN "regimen_depreciacion" "activo_fijo_regimen_depreciacion" DEFAULT 'Normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "activos_fijos_valoraciones" ADD COLUMN "vida_util_normal_meses" integer;--> statement-breakpoint
ALTER TABLE "activos_fijos_vidas_utiles_sii" ADD CONSTRAINT "activos_fijos_vidas_utiles_sii_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activos_fijos_vidas_utiles_sii_empresa_categoria_unique" ON "activos_fijos_vidas_utiles_sii" USING btree ("empresa_id","categoria");--> statement-breakpoint
CREATE UNIQUE INDEX "factores_correccion_monetaria_anio_mes_unique" ON "factores_correccion_monetaria" USING btree ("anio","mes");--> statement-breakpoint
ALTER TABLE "activos_fijos_clases_cuentas" ADD CONSTRAINT "activos_fijos_clases_cuentas_cta_correccion_monetaria_plan_cuentas_id_fk" FOREIGN KEY ("cta_correccion_monetaria") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;