ALTER TABLE "periodos_contables" ALTER COLUMN "estado" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "periodos_contables" ALTER COLUMN "estado" SET DEFAULT 'Desbloqueado'::text;--> statement-breakpoint
UPDATE "periodos_contables" SET "estado" = 'Desbloqueado' WHERE "estado" IN ('Abierto', 'Reabierto');--> statement-breakpoint
UPDATE "periodos_contables" SET "estado" = 'Bloqueado' WHERE "estado" = 'Cerrado';--> statement-breakpoint
DROP TYPE "public"."periodo_estado";--> statement-breakpoint
CREATE TYPE "public"."periodo_estado" AS ENUM('Desbloqueado', 'Período de cierre', 'Bloqueado', 'Bloqueado excepto ventas');--> statement-breakpoint
ALTER TABLE "periodos_contables" ALTER COLUMN "estado" SET DEFAULT 'Desbloqueado'::"public"."periodo_estado";--> statement-breakpoint
ALTER TABLE "periodos_contables" ALTER COLUMN "estado" SET DATA TYPE "public"."periodo_estado" USING "estado"::"public"."periodo_estado";--> statement-breakpoint
ALTER TABLE "periodos_contables" ADD COLUMN "usuario_cierre_id" uuid;--> statement-breakpoint
ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_usuario_cierre_id_usuarios_id_fk" FOREIGN KEY ("usuario_cierre_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;
