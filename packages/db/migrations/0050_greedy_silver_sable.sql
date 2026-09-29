ALTER TABLE "asientos_contables" ALTER COLUMN "correlativo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asientos_contables" ADD COLUMN "referencia" text;--> statement-breakpoint
ALTER TABLE "asientos_contables" ADD COLUMN "fecha_reversa" date;--> statement-breakpoint
ALTER TABLE "asientos_contables" ADD COLUMN "usuario_id" uuid;--> statement-breakpoint
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asientos_contables_documento_origen_idx" ON "asientos_contables" USING btree ("documento_origen_tabla","documento_origen_id");--> statement-breakpoint
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_correlativo_si_no_borrador" CHECK ("asientos_contables"."estado" = 'borrador' or "asientos_contables"."correlativo" is not null);