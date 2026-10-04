# ERP_SIG

ERP contable para contabilidad externalizada (Chile). Monorepo pnpm.

## Stack

- **`packages/shared`** — enums, esquemas Zod y utilidades compartidas.
- **`packages/db`** — Drizzle ORM + Postgres (Neon en la nube): esquemas, migraciones y queries.
- **`packages/app`** — Next.js 16 (App Router, Turbopack), Tailwind v4 / shadcn.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env      # PLATAFORMA_DATABASE_URL, FIRMAS_DATABASE_URL y demás variables
pnpm db:local start       # Postgres 18 local en el puerto 54320 (no hace falta Docker)
pnpm db:migrate           # base de plataforma y la de cada firma
pnpm crear-firma --superadmin   # primera firma, su base y su Administrador
pnpm dev                  # http://localhost:3000
```

## Bases de datos

Una base de **plataforma** (firmas, cuentas de usuario, registro de la base de cada firma)
y **una base por firma contable** con todo lo contable. `db` (en `@erp/db`) consulta la
base de la firma de la sesión; sin firma activa falla, así que una empresa de otra firma no
existe en la base consultada. Scripts y tareas fijan la firma con `conFirma(firmaId, fn)`.

- Una **cuenta** (email y contraseña) puede pertenecer a varias firmas: la **membresía** (`membresias_firma`)
  dice si es admin de cada firma y si su acceso está vigente. Quien tiene varias elige con cuál trabajar al
  iniciar sesión (`/elegir-firma`) y puede cambiarla; el superadmin siempre elige desde Firmas. Suspender,
  editar roles y empresas afecta solo a esa firma; la contraseña, el nombre y el email son de la cuenta y no
  se tocan desde una firma si la persona trabaja en otras.
- Las migraciones viven en `packages/db/migrations/{plataforma,firma}` (`pnpm db:generate`
  genera ambas) y se aplican con `pnpm db:migrate`, fuera de la app. Cada firma registra su
  versión de esquema; si queda atrás, solo esa firma entra en mantenimiento.
- Los cambios de esquema deben ser aditivos (agregar antes de quitar), porque durante una
  actualización conviven bases de firma con la versión nueva y la anterior.
- En la nube cada firma es **un proyecto Neon** propio (por defecto en `aws-sa-east-1`,
  São Paulo), creado por la API de Neon al dar de alta la firma. Su conexión se guarda cifrada
  (`FIRMAS_CONEXION_KEY`) en la base de plataforma. Los proyectos se borran a mano desde la
  consola de Neon. En desarrollo (`FIRMAS_PROVEEDOR=servidor`) cada firma es una base en el
  Postgres local.

## Módulos

Finanzas (asientos manuales y libro diario — ver
[modulo-asientos-manuales.md](modulo-asientos-manuales.md)) ·
Configuración (plan de cuentas, monedas, impuestos, períodos, determinación de
cuentas, centros de costo, categorías, auditoría) · Maestros (socios de negocio) ·
Inventario (productos, grupos, existencias/Kardex) · Ventas (facturas, NC, ND) ·
Compras (pedidos, entradas de mercadería/GRPO, facturas, NC, ND, conciliación GR-IR) ·
Activo Fijo (clases, maestro, capitalización, depreciación — ver
[modulo-activo-fijo.md](modulo-activo-fijo.md)).
