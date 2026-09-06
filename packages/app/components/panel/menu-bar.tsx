"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Menubar } from "radix-ui";
import { CheckIcon } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { setUiThemeAction } from "@/lib/actions/ui-theme";
import type { UiTheme } from "@/lib/ui-theme";
import { usePanelShell } from "@/components/panel/panel-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const triggerCls =
  "rounded-sm px-2.5 py-1 text-[12.5px] outline-none data-[state=open]:bg-white/15 hover:bg-white/12";
const contentCls =
  "z-50 min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md";
const itemCls =
  "flex cursor-default items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45";
const sepCls = "my-1 h-px bg-border";

export function MenuBar({
  empresaId,
  razonSocial,
  rut,
  userName,
  ui,
}: {
  empresaId: string;
  razonSocial: string;
  rut: string;
  userName: string;
  ui: UiTheme;
}) {
  const router = useRouter();
  const { treeCollapsed, toggleTree } = usePanelShell();
  const [, startTransition] = useTransition();
  const [acercaDe, setAcercaDe] = useState(false);
  const base = `/panel/${empresaId}`;

  const irA = (href: string) => router.push(`${base}${href}`);
  const setTema = (t: UiTheme) => startTransition(() => setUiThemeAction(t));

  return (
    <>
      <div className="flex h-8 shrink-0 items-center gap-1 bg-chrome px-2.5 text-chrome-foreground">
        <span className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
          <span className="block size-3.5 rounded-[3px] bg-gradient-to-br from-primary/80 to-primary" />
          ContaERP
        </span>

        <Menubar.Root className="flex items-center gap-0.5">
          <Menubar.Menu>
            <Menubar.Trigger className={triggerCls}>Archivo</Menubar.Trigger>
            <Menubar.Portal>
              <Menubar.Content className={contentCls} align="start" sideOffset={4}>
                <Menubar.Item className={itemCls} onSelect={() => irA("/ventas/facturas")}>
                  Ir a Facturas
                </Menubar.Item>
                <Menubar.Item className={itemCls} onSelect={() => router.push("/admin/empresas")}>
                  Volver a la cartera
                </Menubar.Item>
                <Menubar.Separator className={sepCls} />
                <Menubar.Item className={itemCls} onSelect={() => startTransition(() => logoutAction())}>
                  Cerrar sesión
                </Menubar.Item>
              </Menubar.Content>
            </Menubar.Portal>
          </Menubar.Menu>

          <Menubar.Menu>
            <Menubar.Trigger className={triggerCls}>Editar</Menubar.Trigger>
            <Menubar.Portal>
              <Menubar.Content className={contentCls} align="start" sideOffset={4}>
                <Menubar.Item className={itemCls} disabled>
                  Deshacer
                </Menubar.Item>
                <Menubar.Item className={itemCls} disabled>
                  Rehacer
                </Menubar.Item>
              </Menubar.Content>
            </Menubar.Portal>
          </Menubar.Menu>

          <Menubar.Menu>
            <Menubar.Trigger className={triggerCls}>Ver</Menubar.Trigger>
            <Menubar.Portal>
              <Menubar.Content className={contentCls} align="start" sideOffset={4}>
                <Menubar.Item className={itemCls} onSelect={() => setTema("classic")}>
                  Vista Clásica
                  {ui === "classic" && <CheckIcon className="size-3.5" />}
                </Menubar.Item>
                <Menubar.Item className={itemCls} onSelect={() => setTema("moderno")}>
                  Vista Moderna
                  {ui === "moderno" && <CheckIcon className="size-3.5" />}
                </Menubar.Item>
                <Menubar.Separator className={sepCls} />
                <Menubar.Item className={itemCls} onSelect={toggleTree}>
                  {treeCollapsed ? "Mostrar árbol" : "Ocultar árbol"}
                </Menubar.Item>
              </Menubar.Content>
            </Menubar.Portal>
          </Menubar.Menu>

          <Menubar.Menu>
            <Menubar.Trigger className={triggerCls}>Módulos</Menubar.Trigger>
            <Menubar.Portal>
              <Menubar.Content className={contentCls} align="start" sideOffset={4}>
                <Menubar.Item className={itemCls} onSelect={() => irA("/configuracion/empresa")}>
                  Configuración
                </Menubar.Item>
                <Menubar.Item className={itemCls} onSelect={() => irA("/maestros/terceros")}>
                  Socios de negocio
                </Menubar.Item>
                <Menubar.Item className={itemCls} onSelect={() => irA("/inventario/productos")}>
                  Inventario
                </Menubar.Item>
                <Menubar.Item className={itemCls} onSelect={() => irA("/ventas/facturas")}>
                  Ventas
                </Menubar.Item>
                <Menubar.Item className={itemCls} onSelect={() => irA("/compras/facturas")}>
                  Compras
                </Menubar.Item>
                <Menubar.Item className={itemCls} onSelect={() => irA("/configuracion/plan-cuentas")}>
                  Plan de cuentas
                </Menubar.Item>
                <Menubar.Item className={itemCls} onSelect={() => irA("/configuracion/auditoria")}>
                  Auditoría
                </Menubar.Item>
              </Menubar.Content>
            </Menubar.Portal>
          </Menubar.Menu>

          <Menubar.Menu>
            <Menubar.Trigger className={triggerCls}>Herramientas</Menubar.Trigger>
            <Menubar.Portal>
              <Menubar.Content className={contentCls} align="start" sideOffset={4}>
                <Menubar.Item className={itemCls} onSelect={() => irA("/configuracion/visualizacion")}>
                  Visualización
                </Menubar.Item>
                <Menubar.Item className={itemCls} onSelect={() => irA("/configuracion/periodos")}>
                  Períodos contables
                </Menubar.Item>
              </Menubar.Content>
            </Menubar.Portal>
          </Menubar.Menu>

          <Menubar.Menu>
            <Menubar.Trigger className={triggerCls}>Ventana</Menubar.Trigger>
            <Menubar.Portal>
              <Menubar.Content className={contentCls} align="start" sideOffset={4}>
                <Menubar.Item className={itemCls} disabled>
                  Sin ventanas abiertas
                </Menubar.Item>
              </Menubar.Content>
            </Menubar.Portal>
          </Menubar.Menu>

          <Menubar.Menu>
            <Menubar.Trigger className={triggerCls}>Ayuda</Menubar.Trigger>
            <Menubar.Portal>
              <Menubar.Content className={contentCls} align="start" sideOffset={4}>
                <Menubar.Item className={itemCls} onSelect={() => setAcercaDe(true)}>
                  Acerca de ContaERP
                </Menubar.Item>
              </Menubar.Content>
            </Menubar.Portal>
          </Menubar.Menu>
        </Menubar.Root>

        <span className="flex-1" />
        <span className="truncate text-[12px] text-chrome-muted">
          {razonSocial} — {rut}
        </span>
      </div>

      <Dialog open={acercaDe} onOpenChange={setAcercaDe}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ContaERP</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ERP contable para firmas de contabilidad externalizada. Sesión de {userName}.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
