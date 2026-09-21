CREATE TYPE "public"."metodo_pago_sentido" AS ENUM('Recibido', 'Efectuado', 'Ambos');--> statement-breakpoint
CREATE TYPE "public"."metodo_pago_tipo" AS ENUM('Efectivo', 'Cheque', 'Transferencia', 'Tarjeta');--> statement-breakpoint
ALTER TYPE "public"."serie_ambito" ADD VALUE 'pago';--> statement-breakpoint
CREATE TABLE "cuentas_bancarias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"banco_id" uuid NOT NULL,
	"tipo_cuenta" "cuenta_bancaria_tipo" DEFAULT 'Corriente' NOT NULL,
	"numero_cuenta" text NOT NULL,
	"alias" text,
	"moneda_id" uuid NOT NULL,
	"cuenta_contable_id" uuid NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metodos_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "metodo_pago_tipo" NOT NULL,
	"sentido" "metodo_pago_sentido" DEFAULT 'Ambos' NOT NULL,
	"cuenta_bancaria_id" uuid,
	"cuenta_contable_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "metodo_pago_default_id" uuid;--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_banco_id_bancos_id_fk" FOREIGN KEY ("banco_id") REFERENCES "public"."bancos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_cuenta_contable_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_cuenta_bancaria_id_cuentas_bancarias_id_fk" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_cuenta_contable_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cuentas_bancarias_empresa_banco_numero_unique" ON "cuentas_bancarias" USING btree ("empresa_id","banco_id","numero_cuenta");--> statement-breakpoint
CREATE UNIQUE INDEX "metodos_pago_empresa_nombre_unique" ON "metodos_pago" USING btree ("empresa_id","nombre");--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_metodo_pago_default_id_metodos_pago_id_fk" FOREIGN KEY ("metodo_pago_default_id") REFERENCES "public"."metodos_pago"("id") ON DELETE set null ON UPDATE no action;