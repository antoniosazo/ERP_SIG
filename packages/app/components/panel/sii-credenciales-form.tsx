"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SiiAmbiente, SiiMetodoAuth } from "@erp/shared";
import {
  guardarCredencialesSiiAction,
  probarConexionSiiAction,
  type EstadoCredencialesSii,
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
  const [metodoAuth, setMetodoAuth] = useState<SiiMetodoAuth>(estado.metodoAuth);
  const [rutTitularCertificado, setRutTitularCertificado] = useState(
    estado.rutTitularCertificado ?? "",
  );
  const [clave, setClave] = useState("");
  const [certPass, setCertPass] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [ambiente, setAmbiente] = useState<SiiAmbiente>(estado.ambiente);

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
        metodoAuth,
        rutTitularCertificado: metodoAuth === "certificado" ? rutTitularCertificado : undefined,
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

  return (
    <div className="max-w-xl space-y-5">
      <div className="rounded-lg border p-4 text-sm">
        <p className="font-medium">Estado</p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          <li>RUT: {estado.rut ?? "—"}</li>
          <li>
            Conecta con:{" "}
            {estado.metodoAuth === "certificado" ? "Certificado digital" : "Clave Tributaria"}
          </li>
          <li>Clave Tributaria: {estado.tieneClave ? "configurada ✓" : "—"}</li>
          <li>
            Certificado digital: {estado.tieneCertificado ? "configurado ✓" : "—"}
            {estado.certificadoVence ? ` (vence ${estado.certificadoVence})` : ""}
            {estado.rutTitularCertificado ? ` · titular ${estado.rutTitularCertificado}` : ""}
          </li>
          <li>Ambiente: {estado.ambiente}</li>
          <li>Última importación: {estado.ultimaSyncPeriodo ?? "—"}</li>
        </ul>
      </div>

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
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sii-rut-titular">RUT del titular del certificado</Label>
            <Input
              id="sii-rut-titular"
              value={rutTitularCertificado}
              onChange={(e) => setRutTitularCertificado(e.target.value)}
              placeholder={rut || "12345678-9"}
            />
            <p className="text-xs text-muted-foreground">
              Déjalo vacío si el certificado es de la propia empresa. Complétalo cuando
              el certificado es de una persona que <strong>representa</strong> a la
              empresa ante el SII (por ejemplo, el contador o el dueño) — el login se
              hace con este RUT y el RCV se sigue pidiendo para el RUT del contribuyente
              de arriba.
            </p>
          </div>
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
    </div>
  );
}
