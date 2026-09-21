import type { SiiClient } from "./cliente";
import type { AccionDte, EventoDte, RespuestaSii } from "./reclamo-dte";
import type { DocRcv, Periodo, ResultadoPrueba } from "./tipos";

/** Cliente de prueba: devuelve un RCV fijo. Se activa con `SII_USAR_MOCK=1`. */
export class SiiClientMock implements SiiClient {
  async cerrarSesion(): Promise<void> {}

  async probar(): Promise<ResultadoPrueba> {
    return { ok: true, detalle: "Mock del SII activo (SII_USAR_MOCK=1)." };
  }

  async aceptarOReclamarDocumento(
    _rutDte: string,
    _tipoDoc: number,
    _folio: string,
    accion: AccionDte,
  ): Promise<RespuestaSii> {
    return { codigo: 0, descripcion: `Mock: acción ${accion} completada OK.` };
  }

  async listarEventosDocumento(
    _rutDte: string,
    _tipoDoc: number,
    _folio: string,
  ): Promise<{ respuesta: RespuestaSii; eventos: EventoDte[] }> {
    return { respuesta: { codigo: 16, descripcion: "Mock: sin eventos." }, eventos: [] };
  }

  async rcvCompras(periodo: Periodo): Promise<DocRcv[]> {
    return [
      {
        rutContraparte: "76192083-9",
        nombreContraparte: "Proveedor Demo SpA",
        tipoDte: 33,
        folio: `${periodo}001`,
        fechaEmision: `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}-05`,
        fechaRecepcionSii: `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}-06`,
        montoExento: 0,
        montoNeto: 100000,
        montoIva: 19000,
        montoTotal: 119000,
        estadoRcv: "PENDIENTE",
      },
      {
        rutContraparte: "77111222-3",
        nombreContraparte: "Servicios Demo Ltda",
        tipoDte: 34,
        folio: `${periodo}045`,
        fechaEmision: `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}-12`,
        montoExento: 50000,
        montoNeto: 0,
        montoIva: 0,
        montoTotal: 50000,
        estadoRcv: "REGISTRO",
      },
    ];
  }

  async rcvVentas(periodo: Periodo): Promise<DocRcv[]> {
    return [
      {
        rutContraparte: "60803000-K",
        nombreContraparte: "Cliente Demo",
        tipoDte: 33,
        folio: `${periodo}900`,
        fechaEmision: `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}-20`,
        montoExento: 0,
        montoNeto: 200000,
        montoIva: 38000,
        montoTotal: 238000,
        estadoRcv: "REGISTRO",
      },
    ];
  }

  async descargarXmlCompras(fechaDesde: string): Promise<Buffer> {
    return setDteMock({
      folio: "4001",
      fechaEmision: fechaDesde,
      rutEmisor: "76192083-9",
      razonSocialEmisor: "Proveedor Demo SpA",
      rutReceptor: "76148405-2",
      razonSocialReceptor: "Empresa Demo",
      montoNeto: 100000,
      montoIva: 19000,
      montoTotal: 119000,
    });
  }

  async descargarXmlVentas(fechaDesde: string): Promise<Buffer> {
    return setDteMock({
      folio: "900",
      fechaEmision: fechaDesde,
      rutEmisor: "76148405-2",
      razonSocialEmisor: "Empresa Demo",
      rutReceptor: "60803000-K",
      razonSocialReceptor: "Cliente Demo",
      montoNeto: 200000,
      montoIva: 38000,
      montoTotal: 238000,
    });
  }
}

/** Arma un `SetDTE` mínimo pero real (mismos tags que `dte-xml.ts` espera). */
function setDteMock(d: {
  folio: string;
  fechaEmision: string;
  rutEmisor: string;
  razonSocialEmisor: string;
  rutReceptor: string;
  razonSocialReceptor: string;
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
}): Buffer {
  const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<SetDTE>
<DTE version="1.0">
<Documento ID="MOCK${d.folio}">
<Encabezado>
<IdDoc><TipoDTE>33</TipoDTE><Folio>${d.folio}</Folio><FchEmis>${d.fechaEmision}</FchEmis></IdDoc>
<Emisor><RUTEmisor>${d.rutEmisor}</RUTEmisor><RznSoc>${d.razonSocialEmisor}</RznSoc></Emisor>
<Receptor><RUTRecep>${d.rutReceptor}</RUTRecep><RznSocRecep>${d.razonSocialReceptor}</RznSocRecep></Receptor>
<Totales><MntNeto>${d.montoNeto}</MntNeto><MntExe>0</MntExe><IVA>${d.montoIva}</IVA><MntTotal>${d.montoTotal}</MntTotal></Totales>
</Encabezado>
<Detalle><NroLinDet>1</NroLinDet><NmbItem>Ítem mock</NmbItem><QtyItem>1</QtyItem><PrcItem>${d.montoNeto}</PrcItem><MontoItem>${d.montoNeto}</MontoItem></Detalle>
</Documento>
</DTE>
</SetDTE>`;
  return Buffer.from(xml, "latin1");
}
