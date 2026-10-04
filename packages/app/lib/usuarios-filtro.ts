export type EstadoUsuario = "Activo" | "Invitado" | "Suspendido";
export type FiltroUsuarios = { texto: string; estado: EstadoUsuario | "todos" };

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca por nombre, email o nombre de empresa asignada (sin tildes ni mayúsculas) y por estado. */
export function filtrarUsuarios<T extends { nombre: string; email: string; estado: string; asignaciones: { empresaNombre: string }[] }>(
  usuarios: T[],
  { texto, estado }: FiltroUsuarios,
): T[] {
  const q = normalizar(texto.trim());
  return usuarios.filter(
    (u) =>
      (estado === "todos" || u.estado === estado) &&
      (!q || normalizar([u.nombre, u.email, ...u.asignaciones.map((a) => a.empresaNombre)].join(" ")).includes(q)),
  );
}
