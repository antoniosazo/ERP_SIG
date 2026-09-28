import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FiltroFechasCuentas({ desde, hasta, error }: { desde?: string; hasta: string; error?: string | null }) {
  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <form method="get" className="flex flex-wrap items-end gap-3">
        {desde !== undefined && <div className="space-y-1">
          <label htmlFor="desde" className="text-xs text-muted-foreground">Desde</label>
          <Input id="desde" name="desde" type="date" required defaultValue={desde} className="h-8 w-40" />
        </div>}
        <div className="space-y-1">
          <label htmlFor="hasta" className="text-xs text-muted-foreground">Hasta</label>
          <Input id="hasta" name="hasta" type="date" required defaultValue={hasta} className="h-8 w-40" />
        </div>
        <Button type="submit" size="sm" variant="outline">Consultar</Button>
      </form>
    </div>
  );
}
