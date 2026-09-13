/**
 * Decodifica un `.pfx`/`.p12` a `key`/`cert` en PEM usando `node-forge` (implementación
 * ASN.1/PKCS12 en JS puro). Muchos certificados chilenos (SII, notarías, etc.) se
 * exportaron con cifrado "legacy" (RC2-40-CBC / 3DES) que OpenSSL 3 (el que trae Node
 * 20+) ya no soporta por defecto — ahí es donde falla `https.request({ pfx, passphrase })`
 * con `Unsupported PKCS12 PFX data`. `node-forge` no depende del OpenSSL del sistema,
 * así que lee esos archivos igual.
 */
import forge from "node-forge";

export type ClavePemCert = { key: string; cert: string; ca: string[] };

export function pfxAPem(pfxBase64: string, passphrase: string): ClavePemCert {
  let p12Asn1: forge.asn1.Asn1;
  try {
    const der = forge.util.decode64(pfxBase64);
    p12Asn1 = forge.asn1.fromDer(der);
  } catch {
    throw new Error("El archivo del certificado no es un .pfx/.p12 válido.");
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
  } catch {
    throw new Error(
      "No se pudo abrir el certificado digital: revisa la contraseña del certificado.",
    );
  }

  const oidShroudedKey = forge.pki.oids.pkcs8ShroudedKeyBag;
  const oidKeyBag = forge.pki.oids.keyBag;
  const oidCertBag = forge.pki.oids.certBag;
  if (!oidShroudedKey || !oidKeyBag || !oidCertBag) {
    throw new Error("No se pudo leer el certificado (OIDs de PKCS12 no disponibles).");
  }

  const keyBag =
    p12.getBags({ bagType: oidShroudedKey })[oidShroudedKey]?.[0] ??
    p12.getBags({ bagType: oidKeyBag })[oidKeyBag]?.[0];
  const certBags: forge.pkcs12.Bag[] = p12.getBags({ bagType: oidCertBag })[oidCertBag] ?? [];

  if (!keyBag?.key || certBags.length === 0) {
    throw new Error("El certificado no contiene una clave privada y un certificado válidos.");
  }

  const key = forge.pki.privateKeyToPem(keyBag.key);
  const [primero, ...resto] = certBags
    .map((b: forge.pkcs12.Bag) => b.cert)
    .filter((c: forge.pki.Certificate | undefined): c is forge.pki.Certificate => !!c);
  if (!primero) {
    throw new Error("El certificado no contiene una clave privada y un certificado válidos.");
  }
  return {
    key,
    cert: forge.pki.certificateToPem(primero),
    ca: resto.map((c) => forge.pki.certificateToPem(c)),
  };
}
