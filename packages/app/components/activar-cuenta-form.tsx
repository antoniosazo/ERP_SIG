"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { activarCuentaSchema } from "@erp/shared";
import { activarCuentaAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ActivarCuentaForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(activarCuentaSchema),
    defaultValues: { token, password: "", confirmarPassword: "" },
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await activarCuentaAction(data);
      if (result.ok) {
        toast.success("Contraseña definida. Ya puedes iniciar sesión.");
        router.push("/login");
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" {...register("token")} />
      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmarPassword">Confirmar contraseña</Label>
        <Input
          id="confirmarPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmarPassword")}
        />
        {errors.confirmarPassword && (
          <p className="text-sm text-destructive">{errors.confirmarPassword.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Guardando..." : "Definir contraseña"}
      </Button>
    </form>
  );
}
