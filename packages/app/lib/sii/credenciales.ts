import { obtenerCredencialesSii } from "@erp/db";
import type { SiiAmbiente } from "@erp/shared";
import { descifrar, descifrarOpcional } from "./cripto";
import type { CredencialesSii } from "./tipos";

/** Credenciales del SII de la empresa, descifradas en memoria. Solo servidor. */
export async function credencialesEnClaro(empresaId: string): Promise<CredencialesSii> {
  const row = await obtenerCredencialesSii(empresaId);
  if (!row) throw new Error("Configura primero la conexión con el SII.");
  const ambiente = row.ambiente as SiiAmbiente;
  if (row.metodoAuth === "certificado") {
    if (!row.certificadoCifrado) {
      throw new Error("Configura primero el certificado digital (.pfx / .p12) en Conexión SII.");
    }
    return {
      metodo: "certificado",
      rut: row.rut,
      rutTitular: row.rutTitular || row.rut,
      ambiente,
      certificadoBase64: descifrar(row.certificadoCifrado),
      certPass: descifrarOpcional(row.certificadoPassCifrada),
    };
  }
  if (!row.claveCifrada) {
    throw new Error("Configura primero el RUT y la Clave Tributaria en Conexión SII.");
  }
  return {
    metodo: "clave",
    rut: row.rut,
    rutTitular: row.rutTitular || row.rut,
    ambiente,
    clave: descifrar(row.claveCifrada),
  };
}
