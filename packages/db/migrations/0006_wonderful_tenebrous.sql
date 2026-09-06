ALTER TABLE "tipos_cambio" DROP CONSTRAINT "tipos_cambio_moneda_id_monedas_id_fk";
--> statement-breakpoint
ALTER TABLE "tipos_cambio" ADD CONSTRAINT "tipos_cambio_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE cascade ON UPDATE no action;