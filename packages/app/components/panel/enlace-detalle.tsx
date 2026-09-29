import Link from "next/link";
import type { ReactNode } from "react";
import { FlechaDetalle } from "./flecha-detalle";

export function EnlaceDetalle({ href, children, title = "Ver detalle" }: { href: string; children: ReactNode; title?: string }) {
  return <span className="inline-flex items-center gap-1.5">
    <FlechaDetalle href={href} title={title} />
    <Link href={href} className="hover:underline">{children}</Link>
  </span>;
}
