"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Collapsible } from "radix-ui";
import {
  getGrupos,
  getGruposServer,
  setGrupo,
  subscribePanelPrefs,
} from "@/components/panel/panel-prefs";
import {
  Building2Icon,
  CalendarDaysIcon,
  ChevronRightIcon,
  CoinsIcon,
  FileTextIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  ListTreeIcon,
  NetworkIcon,
  PackageIcon,
  PercentIcon,
  Settings2Icon,
  Wand2Icon,
  TagsIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: typeof LayoutDashboardIcon; exact?: boolean };
type Subgrupo = { label: string; items: Item[] };
/** Un grupo lleva sus opciones directas o, como Administración en SAP B1, subgrupos por área. */
type Grupo = { label: string; items?: Item[]; subgrupos?: Subgrupo[] };

const RESUMEN: Item = { href: "", label: "Resumen", icon: LayoutDashboardIcon, exact: true };

const GRUPOS: Grupo[] = [
  {
    label: "Administración",
    subgrupos: [
      {
        label: "Empresa y sistema",
        items: [
          { href: "/configuracion/empresa", label: "Detalles de la empresa", icon: Building2Icon },
          { href: "/configuracion/visualizacion", label: "Visualización", icon: Settings2Icon },
          { href: "/configuracion/periodos", label: "Períodos contables", icon: CalendarDaysIcon },
          { href: "/configuracion/auditoria", label: "Auditoría", icon: HistoryIcon },
        ],
      },
      {
        label: "Contabilidad",
        items: [
          { href: "/configuracion/plan-cuentas", label: "Plan de cuentas", icon: ListTreeIcon },
          { href: "/configuracion/determinacion-cuentas", label: "Determinación de cuentas", icon: Wand2Icon },
          { href: "/configuracion/categorias", label: "Categorías contables", icon: TagsIcon },
          { href: "/configuracion/centros-costo", label: "Centros de costo", icon: NetworkIcon },
          { href: "/configuracion/impuestos", label: "Impuestos", icon: PercentIcon },
        ],
      },
      {
        label: "Monedas",
        items: [
          { href: "/configuracion/monedas", label: "Monedas", icon: CoinsIcon },
          { href: "/configuracion/tipos-cambio", label: "Tipos de cambio", icon: TrendingUpIcon },
        ],
      },
      {
        label: "Bancos y pagos",
        items: [
          { href: "/configuracion/cuentas-bancarias", label: "Cuentas bancarias", icon: CoinsIcon },
          { href: "/configuracion/metodos-pago", label: "Métodos de pago", icon: CoinsIcon },
        ],
      },
      {
        label: "Integraciones",
        items: [{ href: "/configuracion/sii", label: "Conexión SII", icon: NetworkIcon }],
      },
    ],
  },
  {
    label: "Socios de Negocio",
    items: [
      { href: "/maestros/terceros", label: "Socios de negocio", icon: UsersIcon },
      { href: "/maestros/grupos-terceros", label: "Grupos de socios", icon: TagsIcon },
    ],
  },
  {
    label: "Inventario",
    items: [
      { href: "/inventario/productos", label: "Productos", icon: PackageIcon },
      { href: "/inventario/grupos-productos", label: "Grupos de artículos", icon: TagsIcon },
      { href: "/inventario/stock", label: "Existencias", icon: ListTreeIcon },
    ],
  },
  {
    label: "Tesorería",
    items: [
      { href: "/tesoreria/pagos-recibidos", label: "Pagos recibidos", icon: TrendingUpIcon },
      { href: "/tesoreria/pagos-efectuados", label: "Pagos efectuados", icon: CoinsIcon },
      { href: "/tesoreria/cheques", label: "Cheques", icon: ListTreeIcon },
      { href: "/tesoreria/depositos", label: "Depósitos", icon: FileTextIcon },
    ],
  },
  {
    label: "Ventas",
    items: [
      { href: "/ventas/bandeja-sii", label: "Bandeja SII (XML)", icon: TrendingUpIcon },
      { href: "/ventas/facturas", label: "Facturas", icon: FileTextIcon },
      { href: "/ventas/notas-credito", label: "Notas de crédito", icon: FileTextIcon },
      { href: "/ventas/notas-debito", label: "Notas de débito", icon: FileTextIcon },
    ],
  },
  {
    label: "Compras",
    items: [
      { href: "/compras/bandeja-sii", label: "Bandeja SII (XML)", icon: TrendingUpIcon },
      { href: "/compras/pedidos", label: "Pedidos", icon: FileTextIcon },
      { href: "/compras/entradas", label: "Entradas de mercadería", icon: PackageIcon },
      { href: "/compras/facturas", label: "Facturas", icon: FileTextIcon },
      { href: "/compras/notas-credito", label: "Notas de crédito", icon: FileTextIcon },
      { href: "/compras/notas-debito", label: "Notas de débito", icon: FileTextIcon },
      { href: "/compras/gr-ir", label: "Conciliación GR-IR", icon: NetworkIcon },
    ],
  },
];

/** Navegación en árbol del entorno por empresa (`/panel/[empresaId]`). */
export function PanelSidebar({ empresaId }: { empresaId: string }) {
  const pathname = usePathname();
  const base = `/panel/${empresaId}`;
  const abierto = useSyncExternalStore(subscribePanelPrefs, getGrupos, getGruposServer);

  function esActivo(item: Item) {
    const href = `${base}${item.href}`;
    return item.exact ? pathname === href : pathname.startsWith(href);
  }

  const linkCls = (activo: boolean) =>
    cn(
      "flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors",
      activo
        ? "bg-secondary font-medium text-secondary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const renderItem = (item: Item) => {
    const activo = esActivo(item);
    const Icono = item.icon;
    return (
      <Link
        key={item.href}
        href={`${base}${item.href}`}
        aria-current={activo ? "page" : undefined}
        className={linkCls(activo)}
        style={activo ? { boxShadow: "inset 2px 0 0 var(--tree-active-bar)" } : undefined}
      >
        <Icono className="size-4 shrink-0" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Explorador
      </p>

      <Link
        href={base}
        aria-current={esActivo(RESUMEN) ? "page" : undefined}
        className={linkCls(esActivo(RESUMEN))}
        style={esActivo(RESUMEN) ? { boxShadow: "inset 2px 0 0 var(--tree-active-bar)" } : undefined}
      >
        <LayoutDashboardIcon className="size-4 shrink-0" />
        {RESUMEN.label}
      </Link>

      {GRUPOS.map((grupo) => {
        const todos = grupo.items ?? grupo.subgrupos?.flatMap((sg) => sg.items) ?? [];
        // Sin preferencia guardada, un grupo se abre solo si la pantalla actual está dentro.
        const abrirPorDefecto = grupo.subgrupos ? todos.some(esActivo) : true;
        return (
          <Collapsible.Root
            key={grupo.label}
            open={abierto[grupo.label] ?? abrirPorDefecto}
            onOpenChange={(o) => setGrupo(grupo.label, o)}
            className="mt-1.5"
          >
            <Collapsible.Trigger className="group flex w-full items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground">
              <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
              {grupo.label}
            </Collapsible.Trigger>
            <Collapsible.Content className="mt-0.5 flex flex-col gap-0.5">
              {grupo.items?.map(renderItem)}
              {grupo.subgrupos?.map((sg) => {
                const clave = `${grupo.label}/${sg.label}`;
                return (
                  <Collapsible.Root
                    key={clave}
                    open={abierto[clave] ?? sg.items.some(esActivo)}
                    onOpenChange={(o) => setGrupo(clave, o)}
                  >
                    <Collapsible.Trigger className="group flex w-full items-center gap-1 rounded-sm px-2 py-1 pl-3 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                      <ChevronRightIcon className="size-3 transition-transform group-data-[state=open]:rotate-90" />
                      {sg.label}
                    </Collapsible.Trigger>
                    <Collapsible.Content className="flex flex-col gap-0.5 pl-3">
                      {sg.items.map(renderItem)}
                    </Collapsible.Content>
                  </Collapsible.Root>
                );
              })}
            </Collapsible.Content>
          </Collapsible.Root>
        );
      })}
    </nav>
  );
}
