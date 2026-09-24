"use client";

import { useState } from "react";
import {
  BellIcon,
  DownloadIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { MoneyInput } from "@/components/ui/money-input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CardSkeleton, FormSkeleton, Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Tercero = { id: string; nombre: string; rut: string; tipo: string; estado: string; saldo: number };

const TERCEROS_DEMO: Tercero[] = [
  { id: "1", nombre: "Comercial Los Andes SpA", rut: "76.123.456-7", tipo: "Cliente", estado: "Activo", saldo: 1250000 },
  { id: "2", nombre: "Distribuidora Maipú Ltda.", rut: "77.456.123-K", tipo: "Proveedor", estado: "Activo", saldo: -430500 },
  { id: "3", nombre: "Juan Pérez Soto", rut: "12.345.678-9", tipo: "Cliente", estado: "Inactivo", saldo: 0 },
  { id: "4", nombre: "Transportes del Sur", rut: "78.998.111-3", tipo: "Proveedor", estado: "Activo", saldo: -1875300 },
  { id: "5", nombre: "Inversiones Cordillera", rut: "76.554.221-9", tipo: "Cliente", estado: "Activo", saldo: 3400000 },
];

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

const columnas: DataTableColumn<Tercero>[] = [
  { key: "nombre", header: "Nombre", cell: (t) => <span className="font-medium">{t.nombre}</span> },
  { key: "rut", header: "RUT", cell: (t) => <span className="tabular-nums">{t.rut}</span> },
  { key: "tipo", header: "Tipo", cell: (t) => t.tipo },
  { key: "estado", header: "Estado", cell: (t) => <StatusBadge estado={t.estado} /> },
  {
    key: "saldo",
    header: "Saldo",
    align: "right",
    sortable: true,
    sortValue: (t) => t.saldo,
    cell: (t) => (
      <span className={t.saldo < 0 ? "text-danger" : ""}>{CLP.format(t.saldo)}</span>
    ),
  },
];

export default function DevUiPage() {
  const [monto, setMonto] = useState<number | null>(1234567);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtradas = TERCEROS_DEMO.filter((t) =>
    t.nombre.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-10 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo de componentes</h1>
        <p className="text-sm text-muted-foreground">
          Sistema de diseño unificado del panel — tokens y componentes base (/dev/ui, no forma
          parte del producto final).
        </p>
      </div>

      {/* ── Tokens ─────────────────────────────────────────────────────── */}
      <Seccion titulo="Tokens de color">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <Swatch nombre="primary" clase="bg-primary" />
          <Swatch nombre="primary-hover" clase="bg-primary-hover" />
          <Swatch nombre="background" clase="bg-background border border-border" />
          <Swatch nombre="card" clase="bg-card border border-border" />
          <Swatch nombre="border" clase="bg-border" />
          <Swatch nombre="muted" clase="bg-muted" />
          <Swatch nombre="success" clase="bg-success" />
          <Swatch nombre="warning" clase="bg-warning" />
          <Swatch nombre="danger" clase="bg-danger" />
          <Swatch nombre="info" clase="bg-info" />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <div>
            <p className="text-2xl font-semibold text-foreground">Texto principal</p>
            <p className="text-xs text-muted-foreground">gray-900</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Texto secundario</p>
            <p className="text-xs text-muted-foreground">gray-500</p>
          </div>
          <div>
            <p className="text-sm text-disabled-foreground">Texto deshabilitado</p>
            <p className="text-xs text-muted-foreground">gray-400</p>
          </div>
          <div>
            <p className="text-sm tabular-nums">$ 1.234.567</p>
            <p className="text-xs text-muted-foreground">tabular-nums</p>
          </div>
        </div>
      </Seccion>

      {/* ── PageHeader ─────────────────────────────────────────────────── */}
      <Seccion titulo="PageHeader">
        <div className="rounded-xl border border-border p-4">
          <PageHeader
            breadcrumb={[
              { label: "Empresa Segura", href: "#" },
              { label: "Socios de negocio", href: "#" },
              { label: "Listado" },
            ]}
            title="Socios de negocio"
            description="Clientes y proveedores de la empresa."
            actions={
              <Button size="md">
                <PlusIcon /> Crear socio
              </Button>
            }
          />
        </div>
      </Seccion>

      {/* ── Buttons ────────────────────────────────────────────────────── */}
      <Seccion titulo="Button">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="md">Primary</Button>
          <Button variant="outline" size="md">Secondary</Button>
          <Button variant="ghost" size="md">Ghost</Button>
          <Button variant="danger" size="md">Danger</Button>
          <Button size="md" loading>Guardando…</Button>
          <Button size="md" disabled>Deshabilitado</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm">sm (32px)</Button>
          <Button size="md">md (40px)</Button>
          <Button size="md">
            <DownloadIcon /> Con ícono
          </Button>
        </div>
      </Seccion>

      {/* ── Inputs ─────────────────────────────────────────────────────── */}
      <Seccion titulo="Input, Select, Textarea, DatePicker, MoneyInput">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Nombre" htmlFor="dev-nombre" helper="Razón social o nombre completo">
            <Input id="dev-nombre" placeholder="Ej: Comercial Los Andes" />
          </FormField>
          <FormField label="Email" htmlFor="dev-email" error="Ingresa un email válido">
            <Input id="dev-email" defaultValue="no-es-un-email" aria-invalid />
          </FormField>
          <FormField label="Tipo" htmlFor="dev-tipo">
            <Select defaultValue="cliente">
              <SelectTrigger id="dev-tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="proveedor">Proveedor</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Fecha de emisión" htmlFor="dev-fecha">
            <DatePicker id="dev-fecha" defaultValue="2026-09-24" />
          </FormField>
          <FormField label="Monto" htmlFor="dev-monto" helper="Formato CLP, sin decimales">
            <MoneyInput id="dev-monto" value={monto} onValueChange={setMonto} />
          </FormField>
          <FormField label="Observaciones" htmlFor="dev-obs" className="sm:col-span-2 lg:col-span-3">
            <Textarea id="dev-obs" placeholder="Notas internas…" />
          </FormField>
        </div>
      </Seccion>

      {/* ── Card ───────────────────────────────────────────────────────── */}
      <Seccion titulo="Card">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Título de sección</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              bg-white, border, rounded-xl, p-6 — sin sombra (la sombra queda solo para
              dropdowns y modales).
            </p>
          </CardContent>
        </Card>
      </Seccion>

      {/* ── KpiCard ────────────────────────────────────────────────────── */}
      <Seccion titulo="KpiCard">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Clientes activos" value={128} description="+12 este mes" href="#" />
          <KpiCard label="Facturas del mes" value="342" description="$ 48.200.000" href="#" />
          <KpiCard label="Por cobrar" value={CLP.format(15230000)} description="18 documentos" />
          <KpiCard label="Vencidas" value={4} description="Requieren gestión" href="#" />
        </div>
      </Seccion>

      {/* ── StatusBadge ────────────────────────────────────────────────── */}
      <Seccion titulo="StatusBadge">
        <div className="flex flex-wrap gap-4">
          {["Activo", "Inactivo", "Borrador", "Emitido", "Anulado", "Pagado", "Pendiente", "Vencido"].map((e) => (
            <StatusBadge key={e} estado={e} />
          ))}
        </div>
      </Seccion>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <Seccion titulo="Tabs">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="text-sm text-muted-foreground">
            Contenido de la pestaña General.
          </TabsContent>
          <TabsContent value="movimientos" className="text-sm text-muted-foreground">
            Contenido de la pestaña Movimientos.
          </TabsContent>
          <TabsContent value="documentos" className="text-sm text-muted-foreground">
            Contenido de la pestaña Documentos.
          </TabsContent>
          <TabsContent value="historial" className="text-sm text-muted-foreground">
            Contenido de la pestaña Historial.
          </TabsContent>
        </Tabs>
      </Seccion>

      {/* ── DataTable ──────────────────────────────────────────────────── */}
      <Seccion titulo="DataTable + Toolbar">
        <div className="space-y-3">
          <TableToolbar
            query={query}
            onQueryChange={setQuery}
            placeholder="Buscar socio…"
            filters={
              <>
                <Badge variant="outline">Tipo: Todos</Badge>
                <Badge variant="outline">Estado: Todos</Badge>
              </>
            }
            action={
              <Button size="md">
                <PlusIcon /> Crear socio
              </Button>
            }
          />
          <DataTable
            columns={columnas}
            rows={filtradas}
            getRowId={(t) => t.id}
            selectable
            rowActions={() => (
              <>
                <div className="px-2 py-1.5 text-sm hover:bg-accent">Editar</div>
                <div className="px-2 py-1.5 text-sm text-danger hover:bg-accent">Eliminar</div>
              </>
            )}
            renderBulkActions={(ids) => (
              <Button size="sm" variant="danger" onClick={() => toast.success(`${ids.length} eliminados`)}>
                <Trash2Icon /> Eliminar
              </Button>
            )}
            emptyIcon={UsersIcon}
            emptyTitle="No se encontraron socios"
            emptyDescription="Probá con otro término de búsqueda."
          />
        </div>
      </Seccion>

      {/* ── EmptyState ─────────────────────────────────────────────────── */}
      <Seccion titulo="EmptyState">
        <div className="rounded-xl border border-border">
          <EmptyState
            icon={UsersIcon}
            title="Aún no hay socios de negocio"
            description="Creá el primero para empezar a facturar."
            action={
              <Button size="md">
                <PlusIcon /> Crear socio
              </Button>
            }
          />
        </div>
      </Seccion>

      {/* ── Skeletons ──────────────────────────────────────────────────── */}
      <Seccion titulo="Skeleton">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <TableSkeleton rows={3} columns={4} />
          <FormSkeleton fields={4} />
        </div>
      </Seccion>

      {/* ── Modal / Drawer / Toast ─────────────────────────────────────── */}
      <Seccion titulo="Modal, Drawer y Toast">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="md">Abrir modal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar socio</DialogTitle>
                <DialogDescription>Formulario corto dentro de un modal.</DialogDescription>
              </DialogHeader>
              <FormField label="Nombre" htmlFor="modal-nombre">
                <Input id="modal-nombre" defaultValue="Comercial Los Andes SpA" />
              </FormField>
              <DialogFooter>
                <Button variant="outline" size="md">Cancelar</Button>
                <Button size="md">Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="danger" size="md" onClick={() => setConfirmOpen(true)}>
            <Trash2Icon /> Eliminar (confirmación)
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="¿Eliminar este socio?"
            description="Esta acción no se puede deshacer."
            confirmLabel="Eliminar"
            onConfirm={async () => {
              await new Promise((r) => setTimeout(r, 600));
              toast.success("Socio eliminado");
            }}
          />

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="md">Abrir drawer (480px)</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[480px] max-w-[90vw]">
              <SheetHeader>
                <SheetTitle>Crear socio</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 overflow-y-auto">
                <FormField label="Nombre" htmlFor="drawer-nombre">
                  <Input id="drawer-nombre" placeholder="Razón social" />
                </FormField>
                <FormField label="RUT" htmlFor="drawer-rut">
                  <Input id="drawer-rut" placeholder="76.123.456-7" />
                </FormField>
              </div>
            </SheetContent>
          </Sheet>

          <Button variant="outline" size="md" onClick={() => toast.success("Guardado correctamente")}>
            <BellIcon /> Toast de éxito
          </Button>
          <Button variant="outline" size="md" onClick={() => toast.error("No se pudo guardar")}>
            Toast de error
          </Button>
        </div>
      </Seccion>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Swatch({ nombre, clase }: { nombre: string; clase: string }) {
  return (
    <div className="space-y-1.5">
      <div className={`h-12 rounded-lg ${clase}`} />
      <p className="text-xs text-muted-foreground">{nombre}</p>
    </div>
  );
}
