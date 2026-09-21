/**
 * PDF de una factura armado en el navegador con los datos ya cargados (XML del SII o un
 * documento del sistema). No es la representación impresa oficial: no lleva timbre electrónico.
 */
import type { FacturaDatos } from "@/lib/factura-vista";

const clp = (n: number) => n.toLocaleString("es-CL");

const PIE_POR_DEFECTO =
  "Copia de trabajo. No es la representación impresa oficial (sin timbre electrónico).";

export async function descargarPdfFactura(f: FacturaDatos): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 14;
  const derecha = ancho - margen;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(f.titulo.toUpperCase(), margen, 18);
  doc.setFontSize(11);
  doc.text(`N° ${f.folio}`, derecha, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Fecha de emisión: ${f.fechaEmision.slice(0, 10)}`, derecha, 24, { align: "right" });
  doc.setDrawColor(40);
  doc.setLineWidth(0.6);
  doc.line(margen, 27, derecha, 27);

  const cuadro = (x: number, titulo: string, razon: string, rut: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(titulo.toUpperCase(), x, 34);
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(razon || "—", 84), x, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`RUT: ${rut || "—"}`, x, 47);
  };
  cuadro(margen, "Emisor", f.emisor.razonSocial, f.emisor.rut);
  cuadro(margen + 96, "Receptor", f.receptor.razonSocial, f.receptor.rut);

  let y = 54;
  const extras = f.extras ?? [];
  if (extras.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(extras.map((e) => `${e.etiqueta}: ${e.valor}`).join("   |   "), margen, y, {
      maxWidth: ancho - margen * 2,
    });
    doc.setTextColor(0);
    y += 7;
  }
  if (f.referencias.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(110);
    doc.text("REFERENCIAS", margen, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const r of f.referencias) {
      y += 5;
      const texto = `Doc. ${r.tipoDocRef} N° ${r.folioRef}${r.fechaRef ? ` del ${r.fechaRef}` : ""}${r.razonRef ? ` - ${r.razonRef}` : ""}`;
      doc.text(doc.splitTextToSize(texto, ancho - margen * 2), margen, y);
    }
    y += 5;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margen, right: margen },
    head: [["#", "Descripción", "Cant.", "Precio unit.", "Monto"]],
    body: f.lineas.length
      ? f.lineas.map((l, i) => [
          String(i + 1),
          `${l.nombre}${l.exento ? " (exento)" : ""}${l.descripcion ? `\n${l.descripcion}` : ""}`,
          l.cantidad != null ? String(l.cantidad) : "-",
          l.precioUnitario != null ? clp(l.precioUnitario) : "-",
          clp(l.montoItem),
        ])
      : [["", "Sin líneas de detalle.", "", "", ""]],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [55, 65, 81] },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { halign: "right", cellWidth: 20 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 28 },
    },
  });

  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let yt = (lastTable?.finalY ?? y) + 8;
  if (yt > alto - 45) {
    doc.addPage();
    yt = 20;
  }
  const tasa = f.montoNeto > 0 && f.montoIva > 0 ? Math.round((f.montoIva / f.montoNeto) * 100) : 0;
  const filas: [string, string][] = [];
  if (f.montoNeto > 0) filas.push(["Monto neto", clp(f.montoNeto)]);
  if (f.montoExento > 0) filas.push(["Monto exento", clp(f.montoExento)]);
  filas.push([`IVA${tasa ? ` (${tasa}%)` : ""}`, clp(f.montoIva)]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const [k, v] of filas) {
    doc.text(k, derecha - 60, yt);
    doc.text(v, derecha, yt, { align: "right" });
    yt += 6;
  }
  doc.setLineWidth(0.3);
  doc.line(derecha - 60, yt - 3.5, derecha, yt - 3.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", derecha - 60, yt + 2);
  doc.text(clp(f.montoTotal), derecha, yt + 2, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(f.pie ?? PIE_POR_DEFECTO, margen, alto - 8);

  const rut = (f.emisor.rut || "").replace(/[^0-9kK-]/g, "");
  doc.save(`${f.titulo.replace(/\s+/g, "_")}_${f.folio}_${rut}.pdf`);
}
