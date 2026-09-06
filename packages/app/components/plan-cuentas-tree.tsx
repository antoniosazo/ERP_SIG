type CuentaNodo = {
  id: string;
  codigoCuenta: string;
  nombreCuenta: string;
  clase: string;
  cuentaPadreId: string | null;
};

function construirArbol(cuentas: CuentaNodo[]): Map<string | null, CuentaNodo[]> {
  const porPadre = new Map<string | null, CuentaNodo[]>();
  for (const cuenta of cuentas) {
    const hijos = porPadre.get(cuenta.cuentaPadreId) ?? [];
    hijos.push(cuenta);
    porPadre.set(cuenta.cuentaPadreId, hijos);
  }
  return porPadre;
}

function Nodo({
  cuenta,
  porPadre,
  nivel,
}: {
  cuenta: CuentaNodo;
  porPadre: Map<string | null, CuentaNodo[]>;
  nivel: number;
}) {
  const hijos = porPadre.get(cuenta.id) ?? [];
  return (
    <li>
      <div
        className="flex items-baseline gap-3 border-b py-1.5 text-sm"
        style={{ paddingLeft: `${nivel * 1.25}rem` }}
      >
        <span className="w-20 shrink-0 font-mono text-muted-foreground">
          {cuenta.codigoCuenta}
        </span>
        <span className={nivel === 0 ? "font-semibold" : ""}>{cuenta.nombreCuenta}</span>
        {nivel === 0 && (
          <span className="text-xs text-muted-foreground">({cuenta.clase})</span>
        )}
      </div>
      {hijos.length > 0 && (
        <ul>
          {hijos.map((hijo) => (
            <Nodo key={hijo.id} cuenta={hijo} porPadre={porPadre} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Renderiza el árbol de `plan_cuentas` de una empresa (verificación visual del clonado desde plantilla). */
export function PlanCuentasTree({ cuentas }: { cuentas: CuentaNodo[] }) {
  if (cuentas.length === 0) {
    return <p className="text-sm text-muted-foreground">Esta empresa no tiene plan de cuentas.</p>;
  }

  const porPadre = construirArbol(cuentas);
  const raices = porPadre.get(null) ?? [];

  return (
    <ul>
      {raices.map((raiz) => (
        <Nodo key={raiz.id} cuenta={raiz} porPadre={porPadre} nivel={0} />
      ))}
    </ul>
  );
}
