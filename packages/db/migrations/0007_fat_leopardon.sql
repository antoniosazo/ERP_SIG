ALTER TABLE "empresas" ADD COLUMN "separador_decimal" text DEFAULT ',' NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "separador_miles" text DEFAULT '.' NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "decimales_monto" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "decimales_tipo_cambio" integer DEFAULT 6 NOT NULL;