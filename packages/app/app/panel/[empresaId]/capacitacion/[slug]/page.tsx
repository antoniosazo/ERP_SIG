import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buscarCapacitacionDoc, leerCapacitacionDoc } from "@/lib/capacitacion-docs";
import { PageHeader } from "@/components/ui/page-header";

export default async function CapacitacionDocPage({
  params,
}: {
  params: Promise<{ empresaId: string; slug: string }>;
}) {
  const { empresaId, slug } = await params;
  const doc = buscarCapacitacionDoc(slug);
  if (!doc) notFound();

  const contenido = await leerCapacitacionDoc(doc.archivo);

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Capacitación", href: `/panel/${empresaId}/capacitacion` },
          { label: doc.titulo },
        ]}
        title={doc.titulo}
        description={doc.descripcion}
      />

      <article
        className="
          max-w-3xl space-y-4 text-sm leading-relaxed text-foreground
          [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:mt-2
          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-6
          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4
          [&_p]:leading-relaxed
          [&_strong]:font-semibold [&_strong]:text-foreground
          [&_a]:underline [&_a]:underline-offset-2 [&_a]:text-foreground
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
          [&_li]:leading-relaxed
          [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono
          [&_hr]:border-foreground/10 [&_hr]:my-6
          [&_thead]:text-left [&_thead]:text-xs [&_thead]:text-muted-foreground
          [&_th]:px-3 [&_th]:py-2 [&_th]:border-b [&_th]:border-foreground/10
          [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-foreground/5 [&_td]:align-top
        "
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ children }) => (
              <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
                <table className="w-full text-sm">{children}</table>
              </div>
            ),
          }}
        >
          {contenido}
        </Markdown>
      </article>
    </>
  );
}
