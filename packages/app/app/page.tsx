import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth-helpers";
import { rutaInicial } from "@/lib/inicio";

export default async function Home() {
  const session = await obtenerSesion();
  redirect(session?.user ? rutaInicial(session.user) : "/login");
}
