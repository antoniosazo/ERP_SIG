import Image from "next/image";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth-helpers";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await obtenerSesion();
  if (session?.user) redirect("/admin/empresas");

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      {/* Panel de marca — solo desktop (≥1024px) */}
      <div className="hidden lg:flex lg:w-[45%] lg:flex-col lg:items-center lg:justify-center lg:gap-6 lg:bg-[#0F3D40] lg:px-12 lg:text-center">
        <Image src="/login.png" alt="Tessora ERP" width={140} height={140} priority />
        <div>
          <p className="font-heading text-4xl font-extrabold tracking-tight text-white">
            Tessora <span className="text-[#4DD9D9]">ERP</span>
          </p>
          <p className="mt-3 max-w-sm text-[14px] tracking-wide text-[#B8CDD0]">
            Gestión contable clara y a la medida para firmas que llevan la contabilidad de sus
            clientes.
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="relative min-h-screen flex flex-1 items-center justify-center px-4 py-12 lg:w-[55%]">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex flex-col items-center gap-4 text-center lg:hidden">
            <Image src="/login.png" alt="Tessora ERP" width={96} height={96} priority />
            <div>
              <p className="font-heading text-3xl font-extrabold tracking-tight">
                <span className="text-foreground">Tessora </span>
                <span className="text-primary">ERP</span>
              </p>
              <p className="text-sm tracking-wide text-muted-foreground">
                Sistema de Gestión Empresarial
              </p>
            </div>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-[24px] font-semibold text-[#0F2A2E]">Iniciar sesión</h1>
            <p className="mt-1 text-[14px] text-[#6B7C85]">Ingresa con tu cuenta de Tessora</p>
          </div>

          <LoginForm />
        </div>

        <p className="absolute inset-x-0 bottom-6 text-center text-[12px] text-[#8A9AA3]">
          © 2026 Tessora · v1.0 ·{" "}
          <button type="button" className="hover:underline">
            Soporte
          </button>
        </p>
      </div>
    </div>
  );
}
