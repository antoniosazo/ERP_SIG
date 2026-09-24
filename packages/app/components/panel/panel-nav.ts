import {
  BarChart3Icon,
  Building2Icon,
  CalendarDaysIcon,
  CoinsIcon,
  FileTextIcon,
  HistoryIcon,
  LayoutGridIcon,
  ListTreeIcon,
  NetworkIcon,
  PackageIcon,
  PercentIcon,
  SettingsIcon,
  Settings2Icon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  Wand2Icon,
  TagsIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

export type Item = { href: string; label: string; icon: typeof LayoutGridIcon; exact?: boolean };
export type Subgrupo = { label: string; items: Item[] };
/** Un grupo lleva sus opciones directas o, como Administración en SAP B1, subgrupos por área. */
export type Grupo = { label: string; icon: typeof LayoutGridIcon; items?: Item[]; subgrupos?: Subgrupo[] };

export const RESUMEN: Item = { href: "", label: "Resumen", icon: LayoutGridIcon, exact: true };

/** Árbol de exploración: lo comparten el menú lateral y el buscador global. */
export const GRUPOS: Grupo[] = [
  {
    label: "Administración",
    icon: SettingsIcon,
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
          { href: "/configuracion/determinacion-cuentas", label: "Reglas de imputación", icon: Wand2Icon },
          { href: "/configuracion/categorias", label: "Categorías contables", icon: TagsIcon },
          { href: "/configuracion/centros-costo", label: "Centros de costo", icon: NetworkIcon },
          { href: "/configuracion/impuestos", label: "Impuestos", icon: PercentIcon },
          { href: "/configuracion/cierre-ejercicio", label: "Cierre de ejercicio", icon: CalendarDaysIcon },
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
    icon: UsersIcon,
    items: [
      { href: "/maestros/terceros", label: "Socios de negocio", icon: UsersIcon },
      { href: "/maestros/grupos-terceros", label: "Grupos de socios", icon: TagsIcon },
    ],
  },
  {
    label: "Inventario",
    icon: PackageIcon,
    items: [
      { href: "/inventario/productos", label: "Productos", icon: PackageIcon },
      { href: "/inventario/grupos-productos", label: "Grupos de artículos", icon: TagsIcon },
      { href: "/inventario/stock", label: "Existencias", icon: ListTreeIcon },
    ],
  },
  {
    label: "Tesorería",
    icon: WalletIcon,
    items: [
      { href: "/tesoreria/pagos-recibidos", label: "Pagos recibidos", icon: TrendingUpIcon },
      { href: "/tesoreria/pagos-efectuados", label: "Pagos efectuados", icon: CoinsIcon },
      { href: "/tesoreria/cheques", label: "Cheques", icon: ListTreeIcon },
      { href: "/tesoreria/depositos", label: "Depósitos", icon: FileTextIcon },
    ],
  },
  {
    label: "Ventas",
    icon: ShoppingCartIcon,
    items: [
      { href: "/ventas/bandeja-sii", label: "Bandeja SII (XML)", icon: TrendingUpIcon },
      { href: "/ventas/facturas", label: "Facturas", icon: FileTextIcon },
      { href: "/ventas/notas-credito", label: "Notas de crédito", icon: FileTextIcon },
      { href: "/ventas/notas-debito", label: "Notas de débito", icon: FileTextIcon },
    ],
  },
  {
    label: "Compras",
    icon: ShoppingBagIcon,
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
  {
    label: "Informes",
    icon: BarChart3Icon,
    items: [
      { href: "/informes/balance", label: "Balance de 8 columnas", icon: ListTreeIcon },
      { href: "/informes/estado-resultados", label: "Estado de resultados", icon: TrendingUpIcon },
    ],
  },
];

