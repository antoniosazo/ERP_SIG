ALTER TABLE "monedas" DROP CONSTRAINT "monedas_codigo_unique";--> statement-breakpoint
ALTER TABLE "monedas" ADD COLUMN "empresa_id" uuid;--> statement-breakpoint
ALTER TABLE "monedas" ADD COLUMN "codigo_iso" text;--> statement-breakpoint
ALTER TABLE "monedas" ADD CONSTRAINT "monedas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monedas_empresa_codigo_unique" ON "monedas" USING btree ("empresa_id","codigo") WHERE "monedas"."empresa_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "monedas_plantilla_codigo_unique" ON "monedas" USING btree ("codigo") WHERE "monedas"."empresa_id" is null;--> statement-breakpoint
UPDATE "monedas" SET "codigo_iso" = "codigo" WHERE "empresa_id" IS NULL AND "codigo" IN ('CLP', 'USD', 'EUR');--> statement-breakpoint
INSERT INTO "monedas" ("empresa_id", "codigo", "nombre", "tipo", "simbolo", "decimales", "codigo_iso", "created_at", "updated_at")
SELECT e."id", m."codigo", m."nombre", m."tipo", m."simbolo", m."decimales", m."codigo_iso", now(), now()
FROM "empresas" e CROSS JOIN "monedas" m
WHERE m."empresa_id" IS NULL;--> statement-breakpoint
UPDATE "empresas" e SET "moneda_funcional_id" = c."id"
FROM "monedas" c, "monedas" o
WHERE c."empresa_id" = e."id" AND o."id" = e."moneda_funcional_id" AND c."codigo" = o."codigo";--> statement-breakpoint
UPDATE "empresas" e SET "moneda_reporte_id" = c."id"
FROM "monedas" c, "monedas" o
WHERE e."moneda_reporte_id" IS NOT NULL AND c."empresa_id" = e."id" AND o."id" = e."moneda_reporte_id" AND c."codigo" = o."codigo";--> statement-breakpoint
UPDATE "asientos_lineas" al SET "moneda_origen_id" = c."id"
FROM "asientos_contables" ac, "monedas" c, "monedas" o
WHERE al."asiento_id" = ac."id" AND c."empresa_id" = ac."empresa_id" AND o."id" = al."moneda_origen_id" AND c."codigo" = o."codigo";
