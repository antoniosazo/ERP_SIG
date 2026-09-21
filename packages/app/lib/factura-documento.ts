import type { FacturaDatos } from "@/lib/factura-vista";

type ProductoRef = { codigo: string; nombre: string; tipo: string };

type Entrada = {
  origen: "compra" | "venta";
  documento: {
    folio: string | null;
    numeroInterno: string | null;
    estado: string;
    fechaEmision: string;
    fechaVencimiento: string | null;
    fechaContabilizacion: string | null;
    condicionPagoDias: number | null;
    glosa: string | null;
    montoNeto: string;
    montoExento: string;
    montoImpuesto: string;
    montoTotal: string;
  };
  lineas: {
    glosa: string | null;
    cantidad: string;
    precioUnitario: string;
    montoNeto: string;
    esExento: boolean;
    productoId: string | null;
  }[];
  empresa: { razonSocial: string; rut: string };
  tercero: { razonSocial: string; rut: string } | undefined;
  /** Nombre del tipo de documento (ej. "Factura Electrónica"). */
  tipoDocumento: string;
  productos: Map<string, ProductoRef>;
  /** Pagos aplicados y saldo pendiente (solo facturas y notas de débito contabilizadas). */
  saldo?: { pagado: number; notasCredito: number; saldo: number };
};

/** Arma la vista de factura de un documento ya cargado en el sistema (compra o venta). */
export function facturaDeDocumento(e: Entrada): FacturaDatos {
  const d = e.documento;
  const tercero = { razonSocial: e.tercero?.razonSocial ?? "—", rut: e.tercero?.rut ?? "" };
  const empresa = { razonSocial: e.empresa.razonSocial, rut: e.empresa.rut };

  const extras: { etiqueta: string; valor: string }[] = [];
  if (d.numeroInterno) extras.push({ etiqueta: "N° interno", valor: d.numeroInterno });
  extras.push({ etiqueta: "Estado", valor: d.estado });
  if (d.fechaVencimiento) extras.push({ etiqueta: "Vencimiento", valor: d.fechaVencimiento.slice(0, 10) });
  if (d.fechaContabilizacion) extras.push({ etiqueta: "Contabilización", valor: d.fechaContabilizacion.slice(0, 10) });
  if (d.condicionPagoDias != null) extras.push({ etiqueta: "Condición de pago", valor: `${d.condicionPagoDias} días` });
  if (e.saldo) {
    const clp = (n: number) => n.toLocaleString("es-CL");
    if (e.saldo.notasCredito > 0) extras.push({ etiqueta: "Notas de crédito", valor: clp(e.saldo.notasCredito) });
    extras.push({ etiqueta: "Pagado", valor: clp(e.saldo.pagado) });
    extras.push({ etiqueta: "Saldo pendiente", valor: clp(e.saldo.saldo) });
  }
  if (d.glosa) extras.push({ etiqueta: "Glosa", valor: d.glosa });

  return {
    titulo: e.tipoDocumento,
    folio: d.folio ?? "s/n",
    fechaEmision: d.fechaEmision,
    emisor: e.origen === "compra" ? tercero : empresa,
    receptor: e.origen === "compra" ? empresa : tercero,
    lineas: e.lineas.map((l) => {
      const prod = l.productoId ? e.productos.get(l.productoId) : undefined;
      const glosa = l.glosa ?? "";
      const nombre = prod?.nombre ?? (glosa || "Sin descripción");
      // La glosa cargada desde el SII es "nombre — descripción": se muestra solo lo que agrega.
      const resto = prod && glosa.startsWith(prod.nombre) ? glosa.slice(prod.nombre.length).replace(/^\s*—\s*/, "") : "";
      const partes = [prod ? `${prod.tipo} ${prod.codigo}` : "", resto].filter(Boolean);
      return {
        nombre,
        descripcion: partes.join(" · ") || undefined,
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario),
        montoItem: Number(l.montoNeto),
        exento: l.esExento,
      };
    }),
    referencias: [],
    montoNeto: Number(d.montoNeto),
    montoExento: Number(d.montoExento),
    montoIva: Number(d.montoImpuesto),
    montoTotal: Number(d.montoTotal),
    pie: "Documento del sistema. No es la representación impresa oficial (sin timbre electrónico).",
  };
}
