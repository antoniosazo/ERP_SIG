-- Fecha de contabilización pasa a ser una fecha contable editable (antes: timestamp del posteo).
-- Rellena los documentos sin fecha (borradores) con su fecha de emisión.
UPDATE "documentos_venta"
   SET "fecha_contabilizacion" = "fecha_emision"
 WHERE "fecha_contabilizacion" IS NULL;
--> statement-breakpoint
ALTER TABLE "documentos_venta" ALTER COLUMN "fecha_contabilizacion" SET DATA TYPE date USING "fecha_contabilizacion"::date;
