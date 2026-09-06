CREATE TYPE "public"."stock_movimiento_tipo" AS ENUM('entrada', 'salida', 'ajuste');--> statement-breakpoint
CREATE TABLE "producto_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" numeric(19, 6) DEFAULT '0' NOT NULL,
	"costo_promedio" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"tipo" "stock_movimiento_tipo" NOT NULL,
	"cantidad" numeric(19, 6) NOT NULL,
	"costo_unitario" numeric(18, 4) NOT NULL,
	"costo_total" numeric(18, 4) NOT NULL,
	"saldo_cantidad" numeric(19, 6) NOT NULL,
	"saldo_costo_promedio" numeric(18, 4) NOT NULL,
	"origen_tabla" text,
	"origen_id" uuid,
	"asiento_id" uuid,
	"glosa" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "producto_stock" ADD CONSTRAINT "producto_stock_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_stock" ADD CONSTRAINT "producto_stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "producto_stock_empresa_producto_unique" ON "producto_stock" USING btree ("empresa_id","producto_id");--> statement-breakpoint
CREATE INDEX "stock_movimientos_empresa_producto_fecha_idx" ON "stock_movimientos" USING btree ("empresa_id","producto_id","fecha");