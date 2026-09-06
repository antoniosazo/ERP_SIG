CREATE TYPE "public"."cuenta_bancaria_tipo" AS ENUM('Corriente', 'Vista', 'Ahorro', 'Otra');--> statement-breakpoint
CREATE TYPE "public"."direccion_tipo" AS ENUM('Facturación', 'Despacho');--> statement-breakpoint
CREATE TYPE "public"."serie_ambito" AS ENUM('tercero');--> statement-breakpoint
CREATE TABLE "terceros_grupos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terceros_contactos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tercero_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"apellido" text,
	"cargo" text,
	"telefono" text,
	"movil" text,
	"email" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terceros_direcciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tercero_id" uuid NOT NULL,
	"tipo" "direccion_tipo" NOT NULL,
	"nombre" text,
	"calle" text,
	"numero" text,
	"comuna" text,
	"ciudad" text,
	"region" text,
	"pais" text DEFAULT 'Chile' NOT NULL,
	"codigo_postal" text,
	"es_principal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terceros_cuentas_bancarias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tercero_id" uuid NOT NULL,
	"banco_id" uuid NOT NULL,
	"tipo_cuenta" "cuenta_bancaria_tipo" NOT NULL,
	"numero_cuenta" text NOT NULL,
	"titular" text,
	"rut_titular" text,
	"es_principal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series_numeracion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"ambito" "serie_ambito" NOT NULL,
	"clave" text NOT NULL,
	"prefijo" text DEFAULT '' NOT NULL,
	"proximo" integer DEFAULT 1 NOT NULL,
	"digitos" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "codigo" text;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "nombre_fantasia" text;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "giro" text;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "telefono" text;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "sitio_web" text;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "direccion" text;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "notas" text;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "grupo_id" uuid;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "moneda_id" uuid;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "impuesto_default_id" uuid;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "condicion_pago_dias" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "limite_credito" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "activo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "bloqueado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "motivo_bloqueo" text;--> statement-breakpoint
ALTER TABLE "terceros_grupos" ADD CONSTRAINT "terceros_grupos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_contactos" ADD CONSTRAINT "terceros_contactos_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_direcciones" ADD CONSTRAINT "terceros_direcciones_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_cuentas_bancarias" ADD CONSTRAINT "terceros_cuentas_bancarias_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros_cuentas_bancarias" ADD CONSTRAINT "terceros_cuentas_bancarias_banco_id_bancos_id_fk" FOREIGN KEY ("banco_id") REFERENCES "public"."bancos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_numeracion" ADD CONSTRAINT "series_numeracion_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "terceros_grupos_empresa_codigo_unique" ON "terceros_grupos" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "series_numeracion_empresa_ambito_clave_unique" ON "series_numeracion" USING btree ("empresa_id","ambito","clave");--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_grupo_id_terceros_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."terceros_grupos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_moneda_id_monedas_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."monedas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_impuesto_default_id_impuestos_id_fk" FOREIGN KEY ("impuesto_default_id") REFERENCES "public"."impuestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "terceros_empresa_codigo_unique" ON "terceros" USING btree ("empresa_id","codigo") WHERE "terceros"."codigo" is not null;--> statement-breakpoint
UPDATE "terceros" t SET "codigo" = pref.prefijo || lpad(num.n::text, 5, '0')
FROM (
  SELECT "id", "empresa_id", "tipo_tercero",
         row_number() OVER (PARTITION BY "empresa_id", "tipo_tercero" ORDER BY "created_at", "id") AS n
  FROM "terceros"
) num
JOIN (VALUES ('Cliente','CL-'),('Proveedor','PR-'),('Prestador Honorarios','HON-'),('Otro','OT-')) AS pref(tipo, prefijo)
  ON pref.tipo = num."tipo_tercero"::text
WHERE t."id" = num."id";
--> statement-breakpoint
INSERT INTO "series_numeracion" ("empresa_id", "ambito", "clave", "prefijo", "proximo", "digitos")
SELECT e."id", 'tercero', p.tipo, p.prefijo,
       1 + (SELECT count(*) FROM "terceros" t WHERE t."empresa_id" = e."id" AND t."tipo_tercero"::text = p.tipo),
       5
FROM "empresas" e
CROSS JOIN (VALUES ('Cliente','CL-'),('Proveedor','PR-'),('Prestador Honorarios','HON-'),('Otro','OT-')) AS p(tipo, prefijo);
