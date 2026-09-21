"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TIPO_FACTURADOR, type SiiAmbiente, type SiiMetodoAuth, type TipoFacturador } from "@erp/shared";
import {
  guardarCredencialesSiiAction,
  probarConexionSiiAction,
  probarDescargaXmlDteAction,
  type EstadoCredencialesSii,
  type ResultadoPruebaXmlDte,
} from "@/lib/actions/sii";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SiiCredencialesForm({
  empresaId,
  estado,
}: {
  empresaId: string;
  estado: EstadoCredencialesSii;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rut, setRut] = useState(estado.rut ?? "");
  const [tipoFacturador, setTipoFacturador] = useState<TipoFacturador>(estado.tipoFacturador);
  const [nombreFacturador, setNombreFacturador] = useState(estado.nombreFacturador ?? "");
  const [metodoAuth, setMetodoAuth] = useState<SiiMetodoAuth>(estado.metodoAuth);
  const [rutTitular, setRutTitular] = useState(estado.rutTitular ?? "");
  const [clave, setClave] = useState("");
  const [certPass, setCertPass] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [ambiente, setAmbiente] = useState<SiiAmbiente>(estado.ambiente);
  const [resultadoXml, setResultadoXml] = useState<ResultadoPruebaXmlDte | null>(null);

  function guardar() {
    startTransition(async () => {
      let certificadoBase64: string | undefined;
      if (certFile) {
        const bytes = new Uint8Array(await certFile.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
        certificadoBase64 = btoa(bin);
      }
      const r = await guardarCredencialesSiiAction(empresaId, {
        rut,
        tipoFacturador,
        nombreFacturador: tipoFacturador === "Facturador comercial" ? nombreFacturador : undefined,
        metodoAuth,
        rutTitular: rutTitular || undefined,
        clave: clave || undefined,
        certificadoBase64,
        certPass: certPass || undefined,
        ambiente,
      });
      if (r.ok) {
        toast.success("Credenciales guardadas (cifradas).");
        setClave("");
        setCertPass("");
        setCertFile(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function probar() {
    startTransition(async () => {
      const r = await probarConexionSiiAction(empresaId);
      if (r.ok) toast.success(r.detalle);
      else toast.error(r.detalle);
    });
  }

  function probarXml(origen: "compra" | "venta") {
    startTransition(async () => {
      setResultadoXml(null);
      const r = await probarDescargaXmlDteAction(empresaId, origen);
      setResultadoXml(r);
      if (r.ok) toast.success(r.detalle);
      else toast.error(r.detalle);
    });
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="rounded-lg border p-4 text-sm">
        <p className="font-medium">Estado</p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          <li>RUT: {estado.rut ?? "—"}</li>
          <li>
            Tipo de facturación: {estado.tipoFacturador}
            {estado.tipoFacturador === "Facturador comercial" && estado.nombreFacturador
              ? ` (${estado.nombreFacturador})`
              : ""}
          </li>
          <li>
            Conecta con:{" "}
            {estado.metodoAuth === "certificado" ? "Certificado digital" : "Clave Tributaria"}
          </li>
          <li>Clave Tributaria: {estado.tieneClave ? "configurada ✓" : "—"}</li>
          <li>
            Certificado digital: {estado.tieneCertificado ? "configurado ✓" : "—"}
            {estado.certificadoVence ? ` (vence ${estado.certificadoVence})` : ""}
          </li>
          {estado.rutTitular && <li>RUT del titular / mandatario: {estado.rutTitular}</li>}
          <li>Ambiente: {estado.ambiente}</li>
          <li>Última importación: {estado.ultimaSyncPeriodo ?? "—"}</li>
        </ul>
      </div>

      <div className="space-y-2">
        <Label>Tipo de facturación</Label>
        <Select
          value={tipoFacturador}
          onValueChange={(v) => setTipoFacturador(v as TipoFacturador)}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPO_FACTURADOR.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Con qué emite/recibe DTE esta empresa. Determina qué vía de importación tiene
          sentido ofrecerle (ej. subir el XML del Historial de DTE solo aplica a "SII
          Gratuito").
        </p>
      </div>

      {tipoFacturador === "Facturador comercial" && (
        <div className="space-y-2">
          <Label htmlFor="sii-nombre-facturador">Nombre del facturador</Label>
          <Input
            id="sii-nombre-facturador"
            value={nombreFacturador}
            onChange={(e) => setNombreFacturador(e.target.value)}
            placeholder="Nubox, Bsale, Defontana, etc."
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="sii-rut">RUT del contribuyente</Label>
        <Input
          id="sii-rut"
          value={rut}
          onChange={(e) => setRut(e.target.value)}
          placeholder="76192083-9"
        />
      </div>

      <div className="space-y-2">
        <Label>Conectar con</Label>
        <Select value={metodoAuth} onValueChange={(v) => setMetodoAuth(v as SiiMetodoAuth)}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="clave">Clave Tributaria</SelectItem>
            <SelectItem value="certificado">Certificado digital</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Define qué credencial se usa para autenticarse contra el SII. Puedes guardar
          ambas y cambiar el método cuando quieras, sin volver a subir nada.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sii-rut-titular">RUT del titular / mandatario</Label>
        <Input
          id="sii-rut-titular"
          value={rutTitular}
          onChange={(e) => setRutTitular(e.target.value)}
          placeholder={rut || "12345678-9"}
        />
        <p className="text-xs text-muted-foreground">
          Déjalo vacío si el login es con las credenciales de la propia empresa.
          Complétalo cuando quien tiene la Clave Tributaria o el certificado es una
          persona que <strong>representa</strong> a la empresa ante el SII (por ejemplo,
          el contador con su propia clave, operando &quot;a nombre de&quot;) — el login
          se hace con este RUT y el RCV se sigue pidiendo para el RUT del contribuyente
          de arriba. Aplica igual con Clave Tributaria o con Certificado digital.
        </p>
      </div>

      {metodoAuth === "clave" ? (
        <div className="space-y-2">
          <Label htmlFor="sii-clave">Clave Tributaria</Label>
          <Input
            id="sii-clave"
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder={estado.tieneClave ? "•••••••• (dejar vacío para no cambiar)" : ""}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Si hay RUT del titular/mandatario, es la clave de <strong>esa</strong>{" "}
            persona, no la del contribuyente.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sii-cert">Certificado digital (.pfx / .p12)</Label>
            <Input
              id="sii-cert"
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
            />
            {estado.tieneCertificado && !certFile && (
              <p className="text-xs text-muted-foreground">
                Ya hay uno guardado; sube otro solo si quieres reemplazarlo.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sii-certpass">Contraseña del certificado</Label>
            <Input
              id="sii-certpass"
              type="password"
              value={certPass}
              onChange={(e) => setCertPass(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Si subes un archivo nuevo, vuelve a escribir su contraseña aquí — no se
              reutiliza la que estaba guardada antes, y si no coinciden la conexión
              falla con &quot;revisa la contraseña&quot;.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Ambiente</Label>
        <Select value={ambiente} onValueChange={(v) => setAmbiente(v as SiiAmbiente)}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="certificacion">Certificación (maullín) — para probar</SelectItem>
            <SelectItem value="produccion">Producción (palena)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Las credenciales y el certificado se guardan cifrados (AES‑256‑GCM) y solo se
        descifran en el servidor al conectarse con el SII. Nunca se muestran ni se
        registran.
      </p>

      <div className="flex gap-2">
        <Button onClick={guardar} disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          variant="outline"
          onClick={probar}
          disabled={
            isPending ||
            (estado.metodoAuth === "certificado" ? !estado.tieneCertificado : !estado.tieneClave)
          }
        >
          Probar conexión
        </Button>
      </div>

      {tipoFacturador === "SII Gratuito" && (
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Descarga automática de XML (en pruebas)</p>
            <p className="text-xs text-muted-foreground">
              Descarga del Sistema de Facturación Gratuita (últimos 30 días) sin crear
              nada todavía — solo para confirmar que la sesión funciona con ese portal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || (estado.metodoAuth === "certificado" ? !estado.tieneCertificado : !estado.tieneClave)}
              onClick={() => probarXml("compra")}
            >
              Probar XML compras
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || (estado.metodoAuth === "certificado" ? !estado.tieneCertificado : !estado.tieneClave)}
              onClick={() => probarXml("venta")}
            >
              Probar XML ventas
            </Button>
          </div>
          {resultadoXml?.ok && resultadoXml.documentos.length > 0 && (
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {resultadoXml.documentos.map((d, i) => (
                <li key={i}>
                  Tipo {d.tipoDte} · Folio {d.folio} · {d.fechaEmision} · {d.rutContraparte}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
