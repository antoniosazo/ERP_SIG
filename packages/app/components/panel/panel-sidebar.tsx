import { NavTree } from "@/components/panel/nav-tree";

/** Navegación en árbol del entorno por empresa (`/panel/[empresaId]`), escritorio. */
export function PanelSidebar({ empresaId }: { empresaId: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-3">
      <NavTree empresaId={empresaId} />
    </div>
  );
}
