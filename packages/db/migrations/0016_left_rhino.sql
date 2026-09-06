CREATE TYPE "public"."cuenta_modo_moneda" AS ENUM('Local', 'Funcional', 'Extranjera fija', 'Cualquiera');--> statement-breakpoint
CREATE TYPE "public"."determinacion_contexto" AS ENUM('venta', 'compra', 'impuesto', 'general');--> statement-breakpoint
CREATE TYPE "public"."determinacion_rol" AS ENUM('ingreso', 'ingreso_exento', 'iva_debito', 'iva_credito', 'cuenta_por_cobrar', 'cuenta_por_pagar', 'descuento_venta', 'diferencia_cambio', 'ajuste');--> statement-breakpoint
CREATE TABLE "reglas_determinacion_cuenta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"contexto" "determinacion_contexto" NOT NULL,
	"rol" "determinacion_rol" NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD COLUMN "modo_moneda" "cuenta_modo_moneda" DEFAULT 'Funcional' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD COLUMN "moneda_fija_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD COLUMN "relevante_flujo_caja" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reglas_determinacion_cuenta" ADD CONSTRAINT "reglas_determinacion_cuenta_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglas_determinacion_cuenta" ADD CONSTRAINT "reglas_determinacion_cuenta_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reglas_determinacion_cuenta_empresa_contexto_rol_unique" ON "reglas_determinacion_cuenta" USING btree ("empresa_id","contexto","rol");--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_moneda_fija_id_monedas_id_fk" FOREIGN KEY ("moneda_fija_id") REFERENCES "public"."monedas"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Mapea el flag antiguo al nuevo modo de moneda.
UPDATE "plan_cuentas" SET "modo_moneda" = (CASE WHEN "admite_moneda_extranjera" THEN 'Cualquiera' ELSE 'Funcional' END)::"cuenta_modo_moneda";
