# ERP_SIG

ERP contable para contabilidad externalizada (Chile). Monorepo pnpm.

## Stack

- **`packages/shared`** — enums, esquemas Zod y utilidades compartidas.
- **`packages/db`** — Drizzle ORM + Neon Postgres: esquema, migraciones y queries.
- **`packages/app`** — Next.js 16 (App Router, Turbopack), Tailwind v4 / shadcn.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env      # completar DATABASE_URL (Neon) y demás variables
pnpm --filter @erp/db db:migrate
pnpm dev                  # http://localhost:3000
```

## Módulos

Configuración (plan de cuentas, monedas, impuestos, períodos, determinación de
cuentas, centros de costo, categorías, auditoría) · Maestros (socios de negocio) ·
Inventario (productos, grupos, existencias/Kardex) · Ventas (facturas, NC, ND) ·
Compras (pedidos, entradas de mercadería/GRPO, facturas, NC, ND, conciliación GR-IR).
