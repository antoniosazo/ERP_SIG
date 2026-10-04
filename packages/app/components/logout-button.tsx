"use client";

import { useTransition } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => startTransition(() => logoutAction())}>
      {isPending ? "Cerrando sesión…" : "Cerrar sesión"}
    </Button>
  );
}
