CREATE TYPE "public"."impuesto_tipo" AS ENUM('IVA Débito', 'IVA Crédito', 'Impuesto Adicional', 'Exento', 'No Afecto');--> statement-breakpoint
CREATE TABLE "impuestos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "impuesto_tipo" NOT NULL,
	"tasa" numeric(6, 3) DEFAULT '0' NOT NULL,
	"cuenta_contable_id" uuid,
	"recuperable_default" "iva_recuperable",
	"aplica_a" "tipo_operacion_documento" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "impuestos" ADD CONSTRAINT "impuestos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impuestos" ADD CONSTRAINT "impuestos_cuenta_contable_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "impuestos_empresa_codigo_unique" ON "impuestos" USING btree ("empresa_id","codigo") WHERE "impuestos"."empresa_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "impuestos_plantilla_codigo_unique" ON "impuestos" USING btree ("codigo") WHERE "impuestos"."empresa_id" is null;--> statement-breakpoint
INSERT INTO "impuestos" ("codigo", "nombre", "tipo", "tasa", "aplica_a", "recuperable_default") VALUES
 ('IVA-DF', 'IVA Débito Fiscal', 'IVA Débito', 19, 'Venta', NULL),
 ('IVA-CF', 'IVA Crédito Fiscal', 'IVA Crédito', 19, 'Compra', 'Total'),
 ('EXE', 'Exento', 'Exento', 0, 'Ambos', NULL),
 ('NAF', 'No Afecto', 'No Afecto', 0, 'Ambos', NULL);
--> statement-breakpoint
INSERT INTO "impuestos" ("empresa_id", "codigo", "nombre", "tipo", "tasa", "recuperable_default", "aplica_a", "activo", "created_at", "updated_at")
SELECT e."id", i."codigo", i."nombre", i."tipo", i."tasa", i."recuperable_default", i."aplica_a", i."activo", now(), now()
FROM "empresas" e CROSS JOIN "impuestos" i
WHERE i."empresa_id" IS NULL;
