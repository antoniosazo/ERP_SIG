CREATE TABLE "preferencias_formulario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"clave" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD COLUMN "descuento_global_pct" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD COLUMN "nombre_cliente" text;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD COLUMN "condicion_pago_dias" integer;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD COLUMN "vendedor_id" uuid;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD COLUMN "contacto_id" uuid;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD COLUMN "direccion_facturacion" text;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD COLUMN "direccion_despacho" text;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD COLUMN "usuario_creacion_id" uuid;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD COLUMN "cantidad" numeric(19, 6) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD COLUMN "precio_unitario" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD COLUMN "descuento_linea_pct" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "documentos_venta_lineas" ADD COLUMN "fecha_diferimiento" date;--> statement-breakpoint
ALTER TABLE "preferencias_formulario" ADD CONSTRAINT "preferencias_formulario_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "preferencias_formulario_usuario_clave_unique" ON "preferencias_formulario" USING btree ("usuario_id","clave");--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_vendedor_id_usuarios_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_contacto_id_terceros_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."terceros_contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_venta" ADD CONSTRAINT "documentos_venta_usuario_creacion_id_usuarios_id_fk" FOREIGN KEY ("usuario_creacion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill: líneas previas al modelo cantidad × precio → precio unitario = neto, cantidad = 1.
UPDATE "documentos_venta_lineas" SET "precio_unitario" = "monto_neto" WHERE "precio_unitario" = 0;