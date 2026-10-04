-- Emails en minúsculas y sin espacios, antes de exigir unicidad sin distinguir mayúsculas.
-- Si dos cuentas coinciden al normalizarse, la creación del índice falla a propósito: hay que
-- resolverlo a mano antes de seguir.
UPDATE "usuarios" SET "email" = lower(btrim("email"));--> statement-breakpoint
-- Los links pendientes se guardaban en claro; desde ahora se guarda su hash, así que los
-- vigentes ya no se pueden validar. Hay que generar links nuevos.
DELETE FROM "tokens_acceso" WHERE "usado_en" IS NULL;--> statement-breakpoint
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_email_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_lower_unique" ON "usuarios" USING btree (lower("email"));