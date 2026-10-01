import type { AristaMapa, NodoMapa, SocioMapa, TipoRelacion } from "@erp/db";

export type NodoMapaDTO = NodoMapa & { href: string | null };
export type SocioMapaDTO = SocioMapa & { href: string };
export type MapaRelacionesDTO = {
  raiz: string;
  socio: SocioMapaDTO | null;
  nodos: NodoMapaDTO[];
  aristas: AristaMapa[];
  truncado: boolean;
};

export const ETIQUETA_RELACION: Record<TipoRelacion, string> = {
  base: "Genera",
  corrige: "Corregido por",
  pago: "Pagado con",
  cheque: "Cheque",
  deposito: "Depositado en",
  protesto: "Protesto",
  asiento: "Asiento",
  reversa: "Reversa",
  activo: "Activo creado",
  movimiento: "Movimiento",
};

export const TARJETA = { ancho: 200, alto: 112, separacionX: 130, separacionY: 28, margen: 12 } as const;

export type Posicion = { x: number; y: number; capa: number };
export type Flecha = AristaMapa & { x1: number; y1: number; x2: number; y2: number };
export type Disposicion = { posiciones: Map<string, Posicion>; flechas: Flecha[]; ancho: number; alto: number };

/**
 * Dispone el grafo de izquierda a derecha, como el mapa de relaciones de SAP: cada documento
 * va en la columna de su etapa (el origen a la izquierda) y se alinea con sus antecedentes
 * para que las cadenas simples queden en línea recta.
 */
export function disponerGrafo(mapa: Pick<MapaRelacionesDTO, "nodos" | "aristas">): Disposicion {
  const { ancho: W, alto: H, separacionX, separacionY, margen } = TARJETA;
  const porClave = new Map(mapa.nodos.map((n) => [n.clave, n]));
  const validas = mapa.aristas.filter((a) => a.desde !== a.hasta && porClave.has(a.desde) && porClave.has(a.hasta));
  const padres = new Map<string, string[]>();
  for (const a of validas) padres.set(a.hasta, [...(padres.get(a.hasta) ?? []), a.desde]);

  const capaDe = new Map<string, number>();
  const enCurso = new Set<string>();
  const capa = (c: string): number => {
    const conocida = capaDe.get(c);
    if (conocida !== undefined) return conocida;
    if (enCurso.has(c)) return 0;
    enCurso.add(c);
    const valor = Math.max(-1, ...(padres.get(c) ?? []).map(capa)) + 1;
    enCurso.delete(c);
    capaDe.set(c, valor);
    return valor;
  };
  for (const n of mapa.nodos) capa(n.clave);

  const fecha = (c: string) => porClave.get(c)?.fecha ?? "9999-12-31";
  const porCapa = new Map<number, string[]>();
  for (const n of mapa.nodos) porCapa.set(capaDe.get(n.clave)!, [...(porCapa.get(capaDe.get(n.clave)!) ?? []), n.clave]);

  const paso = H + separacionY;
  const yDe = new Map<string, number>();
  for (const k of [...porCapa.keys()].sort((a, b) => a - b)) {
    const claves = porCapa.get(k)!;
    const deseada = (c: string) => {
      const ys = (padres.get(c) ?? []).filter((p) => capaDe.get(p)! < k && yDe.has(p)).map((p) => yDe.get(p)!);
      return ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : null;
    };
    const ordenadas = claves
      .map((c, i) => ({ c, d: deseada(c) ?? i * paso }))
      .sort((a, b) => a.d - b.d || fecha(a.c).localeCompare(fecha(b.c)) || a.c.localeCompare(b.c));
    let minimo = -Infinity;
    for (const { c, d } of ordenadas) {
      const y = Math.max(d, minimo);
      yDe.set(c, y);
      minimo = y + paso;
    }
  }
  const arriba = Math.min(0, ...yDe.values());
  const posiciones = new Map<string, Posicion>();
  for (const n of mapa.nodos) {
    const k = capaDe.get(n.clave)!;
    posiciones.set(n.clave, { x: margen + k * (W + separacionX), y: margen + yDe.get(n.clave)! - arriba, capa: k });
  }

  // Las aristas que no avanzan de columna (solo pasan en ciclos) no se dibujan.
  const flechas: Flecha[] = validas
    .filter((a) => posiciones.get(a.desde)!.capa < posiciones.get(a.hasta)!.capa)
    .map((a) => {
      const d = posiciones.get(a.desde)!;
      const h = posiciones.get(a.hasta)!;
      return { ...a, x1: d.x + W, y1: d.y + H / 2, x2: h.x, y2: h.y + H / 2 };
    });

  const ancho = Math.max(0, ...[...posiciones.values()].map((p) => p.x + W)) + margen;
  const alto = Math.max(0, ...[...posiciones.values()].map((p) => p.y + H)) + margen;
  return { posiciones, flechas, ancho, alto };
}
