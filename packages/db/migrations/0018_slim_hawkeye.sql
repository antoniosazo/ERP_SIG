CREATE TYPE "public"."tipo_cuenta" AS ENUM('Banco', 'Caja', 'Cliente', 'Proveedor', 'Impuesto', 'Remuneraciones', 'ActivoFijo', 'Ingreso', 'Costo', 'Gasto', 'Patrimonio', 'Orden', 'Otra');--> statement-breakpoint
ALTER TABLE "plan_cuentas" ADD COLUMN "tipo_cuenta" "tipo_cuenta" DEFAULT 'Otra' NOT NULL;--> statement-breakpoint
-- Deriva el rol funcional desde el texto libre `tipo`, la `clase` y el nombre de la cuenta.
UPDATE "plan_cuentas" SET "tipo_cuenta" = (
  CASE
    WHEN lower(coalesce("tipo", '')) IN ('banco', 'caja', 'cliente', 'proveedor', 'impuesto', 'remuneraciones', 'ingreso', 'costo', 'gasto', 'patrimonio', 'orden')
      THEN initcap(lower("tipo"))
    WHEN "nombre_cuenta" ~* 'banco' THEN 'Banco'
    WHEN "nombre_cuenta" ~* 'caja' THEN 'Caja'
    WHEN "nombre_cuenta" ~* 'cliente|deudores por venta|cuentas? por cobrar' THEN 'Cliente'
    WHEN "nombre_cuenta" ~* 'proveedor|acreedores|cuentas? por pagar' THEN 'Proveedor'
    WHEN "nombre_cuenta" ~* 'iva|impuesto|ppm|retenci' THEN 'Impuesto'
    WHEN "nombre_cuenta" ~* 'sueldo|remunerac|leyes sociales|prevision|finiquito' THEN 'Remuneraciones'
    WHEN "nombre_cuenta" ~* 'activo fijo|depreciaci|maquinaria|veh.culo|muebles' THEN 'ActivoFijo'
    WHEN "clase" = 'Ingresos' THEN 'Ingreso'
    WHEN "nombre_cuenta" ~* 'costo de venta' THEN 'Costo'
    WHEN "clase" = 'Costos y Gastos' THEN 'Gasto'
    WHEN "clase" = 'Patrimonio' THEN 'Patrimonio'
    WHEN "clase" = 'Cuentas de Orden' THEN 'Orden'
    ELSE 'Otra'
  END
)::"tipo_cuenta";