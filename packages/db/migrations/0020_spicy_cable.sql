CREATE TYPE "public"."metodo_valoracion" AS ENUM('Promedio', 'FIFO');--> statement-breakpoint
ALTER TYPE "public"."serie_ambito" ADD VALUE 'producto';--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD COLUMN "cuenta_inventario_default_id" uuid;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD COLUMN "cuenta_costo_venta_default_id" uuid;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD COLUMN "cuenta_gasto_compra_default_id" uuid;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD COLUMN "impuesto_compra_default_id" uuid;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "es_venta" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "es_compra" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "es_inventario" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "metodo_valoracion" "metodo_valoracion" DEFAULT 'Promedio' NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "costo_estandar" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "cuenta_inventario_id" uuid;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "cuenta_costo_venta_id" uuid;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "cuenta_gasto_compra_id" uuid;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "impuesto_compra_id" uuid;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_inventario_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_inventario_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_costo_venta_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_costo_venta_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_gasto_compra_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_gasto_compra_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_impuesto_compra_default_id_impuestos_id_fk" FOREIGN KEY ("impuesto_compra_default_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_cuenta_inventario_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_inventario_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_cuenta_costo_venta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_costo_venta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_cuenta_gasto_compra_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_gasto_compra_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_impuesto_compra_id_impuestos_id_fk" FOREIGN KEY ("impuesto_compra_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;