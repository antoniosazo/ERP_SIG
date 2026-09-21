import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Botón circular amarillo con flecha: lleva al detalle o al documento de origen. */
export function FlechaDetalle({
  href,
  title = "Ver detalle",
  className,
}: {
  href: string;
  title?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm ring-1 ring-amber-500/40 transition duration-150 hover:scale-110 hover:bg-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
        className,
      )}
    >
      <ArrowRightIcon className="size-3.5" strokeWidth={2.75} />
    </Link>
  );
}
