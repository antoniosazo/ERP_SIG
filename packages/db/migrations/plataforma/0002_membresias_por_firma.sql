CREATE TYPE "public"."membresia_estado" AS ENUM('Activa', 'Suspendida');--> statement-breakpoint
CREATE TABLE "membresias_firma" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"firma_contable_id" uuid NOT NULL,
	"es_admin_firma" boolean DEFAULT false NOT NULL,
	"estado" "membresia_estado" DEFAULT 'Activa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membresias_firma_usuario_firma_unique" UNIQUE("usuario_id","firma_contable_id")
);
--> statement-breakpoint
-- Cada cuenta existente pasa a ser miembro de su firma, con su nivel de administrador. Quien estaba
-- suspendido queda con la membresía suspendida y la cuenta vuelve a su estado real (activa si ya
-- tenía contraseña, o invitada): la suspensión ahora es por firma, no de la cuenta.
INSERT INTO "membresias_firma" ("usuario_id", "firma_contable_id", "es_admin_firma", "estado")
SELECT "id", "firma_contable_id", "es_admin_firma",
       CASE WHEN "estado" = 'Suspendido' THEN 'Suspendida'::"membresia_estado" ELSE 'Activa'::"membresia_estado" END
FROM "usuarios";--> statement-breakpoint
UPDATE "usuarios"
SET "estado" = CASE WHEN "password_hash" IS NOT NULL THEN 'Activo'::"usuario_estado" ELSE 'Invitado'::"usuario_estado" END
WHERE "estado" = 'Suspendido';--> statement-breakpoint
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_firma_contable_id_firmas_contables_id_fk";
--> statement-breakpoint
ALTER TABLE "membresias_firma" ADD CONSTRAINT "membresias_firma_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membresias_firma" ADD CONSTRAINT "membresias_firma_firma_contable_id_firmas_contables_id_fk" FOREIGN KEY ("firma_contable_id") REFERENCES "public"."firmas_contables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membresias_firma_firma_idx" ON "membresias_firma" USING btree ("firma_contable_id");--> statement-breakpoint
ALTER TABLE "usuarios" DROP COLUMN "firma_contable_id";--> statement-breakpoint
ALTER TABLE "usuarios" DROP COLUMN "es_admin_firma";