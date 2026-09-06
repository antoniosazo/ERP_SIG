CREATE TYPE "public"."producto_tipo" AS ENUM('Producto', 'Servicio');--> statement-breakpoint
CREATE TABLE "productos_grupos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"cuenta_ingreso_default_id" uuid,
	"impuesto_default_id" uuid,
	"centro_costo_default_id" uuid,
	"categoria_contable_default_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"grupo_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "producto_tipo" DEFAULT 'Producto' NOT NULL,
	"estado" text DEFAULT 'Activo' NOT NULL,
	"precio_unitario" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unidad_medida" text,
	"codigo_barras" text,
	"glosa_sugerida" text,
	"cuenta_ingreso_id" uuid,
	"impuesto_id" uuid,
	"centro_costo_id" uuid,
	"categoria_contable_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD COLUMN "producto_id" uuid;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_cuenta_ingreso_default_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_ingreso_default_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_impuesto_default_id_impuestos_id_fk" FOREIGN KEY ("impuesto_default_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_centro_costo_default_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_default_id") REFERENCES "public"."centros_costo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos" ADD CONSTRAINT "productos_grupos_categoria_contable_default_id_categorias_contables_id_fk" FOREIGN KEY ("categoria_contable_default_id") REFERENCES "public"."categorias_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_grupo_id_productos_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."productos_grupos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_cuenta_ingreso_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_ingreso_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_impuesto_id_impuestos_id_fk" FOREIGN KEY ("impuesto_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_contable_id_categorias_contables_id_fk" FOREIGN KEY ("categoria_contable_id") REFERENCES "public"."categorias_contables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "productos_grupos_empresa_nombre_unique" ON "productos_grupos" USING btree ("empresa_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "productos_empresa_codigo_unique" ON "productos" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE INDEX "productos_empresa_estado_idx" ON "productos" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX "productos_empresa_barcode_idx" ON "productos" USING btree ("empresa_id","codigo_barras") WHERE "productos"."codigo_barras" is not null;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD CONSTRAINT "documentos_venta_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;