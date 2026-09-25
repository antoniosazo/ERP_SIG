import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { CAPACITACION_DOCS } from "@/lib/capacitacion-docs";
import { TypographyHeading } from "@/components/ui/typography";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function CapacitacionPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;

  return (
    <>
      <TypographyHeading
        title="Capacitación"
        description="Guías de cómo funciona cada módulo del sistema, pensadas para el equipo de la firma."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAPACITACION_DOCS.map((doc) => (
          <Link key={doc.slug} href={`/panel/${empresaId}/capacitacion/${doc.slug}`}>
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {doc.titulo}
                  <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </CardTitle>
                <CardDescription>{doc.descripcion}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
