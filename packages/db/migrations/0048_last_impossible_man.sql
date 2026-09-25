CREATE TYPE "public"."cartola_campo_destino" AS ENUM('Fecha', 'Descripcion', 'NroDocumento', 'Cargo', 'Abono', 'MontoConSigno', 'Saldo', 'Sucursal', 'RutContraparte');--> statement-breakpoint
CREATE TYPE "public"."cartola_codificacion" AS ENUM('UTF-8', 'Latin-1');--> statement-breakpoint
CREATE TYPE "public"."cartola_estado" AS ENUM('Importada', 'Anulada');--> statement-breakpoint
CREATE TYPE "public"."cartola_formato_fecha" AS ENUM('dd/mm/aaaa', 'aaaa-mm-dd', 'aaaammdd');--> statement-breakpoint
CREATE TYPE "public"."cartola_formato_numero" AS ENUM('MilesPuntoDecimalComa', 'MilesComaDecimalPunto', 'SinMilesDecimalPunto');--> statement-breakpoint
CREATE TYPE "public"."cartola_movimiento_estado" AS ENUM('Pendiente');--> statement-breakpoint
CREATE TYPE "public"."cartola_origen" AS ENUM('Archivo', 'Manual');--> statement-breakpoint
CREATE TYPE "public"."cartola_regla_signo" AS ENUM('ColumnasSeparadas', 'ColumnaConSigno');--> statement-breakpoint
CREATE TYPE "public"."cartola_tipo_archivo" AS ENUM('Excel', 'CsvTxtDelimitado', 'TxtAnchoFijo');--> statement-breakpoint
CREATE TABLE "cartolas_formatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"banco_id" uuid NOT NULL,
	"empresa_id" uuid,
	"nombre" text NOT NULL,
	"tipo_archivo" "cartola_tipo_archivo" NOT NULL,
	"codificacion" "cartola_codificacion" DEFAULT 'UTF-8' NOT NULL,
	"separador" text,
	"filas_omitir_inicio" integer DEFAULT 0 NOT NULL,
	"filas_omitir_fin" integer DEFAULT 0 NOT NULL,
	"formato_fecha" "cartola_formato_fecha" NOT NULL,
	"formato_numero" "cartola_formato_numero" NOT NULL,
	"regla_signo" "cartola_regla_signo" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartolas_formato_campos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formato_id" uuid NOT NULL,
	"campo_destino" "cartola_campo_destino" NOT NULL,
	"columna_indice" integer,
	"posicion_inicio" integer,
	"posicion_largo" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartolas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cuenta_bancaria_id" uuid NOT NULL,
	"fecha_desde" date NOT NULL,
	"fecha_hasta" date NOT NULL,
	"saldo_inicial" numeric(18, 4) NOT NULL,
	"saldo_final" numeric(18, 4) NOT NULL,
	"origen" "cartola_origen" DEFAULT 'Archivo' NOT NULL,
	"archivo_nombre" text,
	"archivo_hash" text,
	"estado" "cartola_estado" DEFAULT 'Importada' NOT NULL,
	"usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartolas_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cartola_id" uuid NOT NULL,
	"cuenta_bancaria_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"descripcion" text NOT NULL,
	"nro_documento" text,
	"rut_contraparte" text,
	"monto" numeric(18, 4) NOT NULL,
	"codigo_transaccion" text,
	"huella" text NOT NULL,
	"estado_conciliacion" "cartola_movimiento_estado" DEFAULT 'Pendiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD COLUMN "saldo_inicial_conciliado" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "cuentas_bancarias" ADD COLUMN "fecha_saldo_inicial" date;--> statement-breakpoint
ALTER TABLE "cartolas_formatos" ADD CONSTRAINT "cartolas_formatos_banco_id_bancos_id_fk" FOREIGN KEY ("banco_id") REFERENCES "public"."bancos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas_formatos" ADD CONSTRAINT "cartolas_formatos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas_formato_campos" ADD CONSTRAINT "cartolas_formato_campos_formato_id_cartolas_formatos_id_fk" FOREIGN KEY ("formato_id") REFERENCES "public"."cartolas_formatos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas" ADD CONSTRAINT "cartolas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas" ADD CONSTRAINT "cartolas_cuenta_bancaria_id_cuentas_bancarias_id_fk" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas" ADD CONSTRAINT "cartolas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas_movimientos" ADD CONSTRAINT "cartolas_movimientos_cartola_id_cartolas_id_fk" FOREIGN KEY ("cartola_id") REFERENCES "public"."cartolas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartolas_movimientos" ADD CONSTRAINT "cartolas_movimientos_cuenta_bancaria_id_cuentas_bancarias_id_fk" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cartolas_formatos_global_banco_unique" ON "cartolas_formatos" USING btree ("banco_id") WHERE "cartolas_formatos"."empresa_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "cartolas_formatos_empresa_banco_unique" ON "cartolas_formatos" USING btree ("banco_id","empresa_id") WHERE "cartolas_formatos"."empresa_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "cartolas_formato_campos_formato_campo_unique" ON "cartolas_formato_campos" USING btree ("formato_id","campo_destino");--> statement-breakpoint
CREATE UNIQUE INDEX "cartolas_cuenta_archivo_hash_unique" ON "cartolas" USING btree ("cuenta_bancaria_id","archivo_hash") WHERE "cartolas"."archivo_hash" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "cartolas_movimientos_cuenta_huella_unique" ON "cartolas_movimientos" USING btree ("cuenta_bancaria_id","huella");