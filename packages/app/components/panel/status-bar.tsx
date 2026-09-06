import { periodoDe } from "@erp/db";

const ESTADO_PERIODO: Record<string, string> = {
  Desbloqueado: "Abierto",
  "Período de cierre": "En cierre",
  Bloqueado: "Bloqueado",
  "Bloqueado excepto ventas": "Bloq. excepto ventas",
};

/** Barra de estado inferior (estilo ERP de escritorio). */
export async function StatusBar({
  empresaId,
  razonSocial,
  monedaFuncional,
  userName,
  rol,
}: {
  empresaId: string;
  razonSocial: string;
  monedaFuncional: string | null;
  userName: string;
  rol: string | null;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const periodo = await periodoDe(empresaId, hoy).catch(() => null);
  const periodoTxt = periodo
    ? `${periodo.anio}-${String(periodo.mes).padStart(2, "0")} · ${ESTADO_PERIODO[periodo.estado] ?? periodo.estado}`
    : "sin ejercicio";

  return (
    <div className="flex h-6 shrink-0 items-center bg-chrome text-[11.5px] text-chrome-foreground">
      <Seg>{razonSocial}</Seg>
      <Seg>Período: {periodoTxt}</Seg>
      {monedaFuncional && <Seg>Moneda funcional: {monedaFuncional}</Seg>}
      <span className="flex-1" />
      <Seg>{rol ? `${rol}: ${userName}` : userName}</Seg>
      <Seg>
        <span className="inline-block size-1.5 rounded-full bg-primary" /> Conectado
      </Seg>
    </div>
  );
}

function Seg({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 border-r border-white/15 px-3 first:pl-3 last:border-r-0">
      {children}
    </span>
  );
}
