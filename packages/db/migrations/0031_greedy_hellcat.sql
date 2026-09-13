ALTER TABLE "productos" DROP CONSTRAINT "productos_cuenta_ingreso_id_plan_cuentas_id_fk";
--> statement-breakpoint
ALTER TABLE "productos" DROP CONSTRAINT "productos_impuesto_id_impuestos_id_fk";
--> statement-breakpoint
ALTER TABLE "productos" DROP CONSTRAINT "productos_centro_costo_id_centros_costo_id_fk";
--> statement-breakpoint
ALTER TABLE "productos" DROP CONSTRAINT "productos_categoria_contable_id_categorias_contables_id_fk";
--> statement-breakpoint
ALTER TABLE "productos" DROP CONSTRAINT "productos_cuenta_inventario_id_plan_cuentas_id_fk";
--> statement-breakpoint
ALTER TABLE "productos" DROP CONSTRAINT "productos_cuenta_costo_venta_id_plan_cuentas_id_fk";
--> statement-breakpoint
ALTER TABLE "productos" DROP CONSTRAINT "productos_cuenta_gasto_compra_id_plan_cuentas_id_fk";
--> statement-breakpoint
ALTER TABLE "productos" DROP CONSTRAINT "productos_impuesto_compra_id_impuestos_id_fk";
--> statement-breakpoint
ALTER TABLE "productos" DROP COLUMN "cuenta_ingreso_id";--> statement-breakpoint
ALTER TABLE "productos" DROP COLUMN "impuesto_id";--> statement-breakpoint
ALTER TABLE "productos" DROP COLUMN "centro_costo_id";--> statement-breakpoint
ALTER TABLE "productos" DROP COLUMN "categoria_contable_id";--> statement-breakpoint
ALTER TABLE "productos" DROP COLUMN "cuenta_inventario_id";--> statement-breakpoint
ALTER TABLE "productos" DROP COLUMN "cuenta_costo_venta_id";--> statement-breakpoint
ALTER TABLE "productos" DROP COLUMN "cuenta_gasto_compra_id";--> statement-breakpoint
ALTER TABLE "productos" DROP COLUMN "impuesto_compra_id";