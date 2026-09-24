"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { EyeIcon, EyeOffIcon, Loader2Icon, LockIcon, MailIcon } from "lucide-react";
import { loginSchema } from "@erp/shared";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const inputBaseCls = cn(
  "h-11 rounded-[8px] bg-white pl-9 text-[#0F2A2E] transition-shadow",
  "border border-[#D6DEE3]",
  "focus-visible:border-[#00B3B3] focus-visible:ring-[3px] focus-visible:ring-[#00B3B3]/15",
  "aria-invalid:border-[#D64545]",
  "aria-invalid:focus-visible:border-[#D64545] aria-invalid:focus-visible:ring-[3px] aria-invalid:focus-visible:ring-[#D64545]/12",
  "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#fff] [&:-webkit-autofill]:[-webkit-text-fill-color:#0F2A2E]",
);

const iconCls = (conError: boolean) =>
  cn(
    "pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2",
    conError ? "text-[#D64545]" : "text-[#8A9AA3]",
  );

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit((data) => {
    setErrorGeneral(null);
    startTransition(async () => {
      const result = await loginAction(data);
      if (result.ok) {
        router.push("/admin/empresas");
        router.refresh();
      } else {
        setErrorGeneral(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {errorGeneral && (
        <div
          role="alert"
          className="rounded-[8px] border border-[#D64545]/30 bg-[#D64545]/8 px-3 py-2 text-sm text-[#D64545]"
        >
          {errorGeneral}
        </div>
      )}

      <div>
        <Label htmlFor="email" className="mb-1.5 text-[#0F2A2E]">
          Email
        </Label>
        <div className="relative">
          <MailIcon className={iconCls(!!errors.email)} />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={!!errors.email}
            aria-describedby="email-error"
            className={inputBaseCls}
            {...register("email")}
          />
        </div>
        <p id="email-error" className="mt-1 min-h-[16px] text-[13px] text-[#D64545]">
          {errors.email?.message}
        </p>
      </div>

      <div>
        <Label htmlFor="password" className="mb-1.5 text-[#0F2A2E]">
          Contraseña
        </Label>
        <div className="relative">
          <LockIcon className={iconCls(!!errors.password)} />
          <Input
            id="password"
            type={mostrarPassword ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-error"
            className={cn(inputBaseCls, "pr-9")}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setMostrarPassword((v) => !v)}
            aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-[#8A9AA3] hover:text-[#0F2A2E]"
          >
            {mostrarPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
        <p id="password-error" className="mt-1 min-h-[16px] text-[13px] text-[#D64545]">
          {errors.password?.message}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <label htmlFor="recordarme" className="flex items-center gap-2 text-sm text-[#0F2A2E]">
          <input
            id="recordarme"
            type="checkbox"
            className="size-4 rounded-[4px] border-[#D6DEE3] accent-[#00B3B3]"
          />
          Recordarme
        </label>
        <button
          type="button"
          onClick={() =>
            toast.info("Pedile a tu Administrador que te genere un nuevo link de acceso.")
          }
          className="text-[14px] text-[#00B3B3] hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full bg-[#00B3B3] font-semibold text-white hover:bg-[#009999] focus-visible:ring-[#00B3B3]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00B3B3]"
      >
        {isPending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Ingresando…
          </>
        ) : (
          "Iniciar sesión"
        )}
      </Button>
    </form>
  );
}
