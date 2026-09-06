import * as React from "react";

import { cn } from "@/lib/utils";

interface TypographyHeadingProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
}

function TypographyHeading({
  title,
  description,
  className,
  ...props
}: TypographyHeadingProps) {
  return (
    <div
      className={cn("flex md:items-center justify-between gap-2", className)}
      {...props}
    >
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { TypographyHeading };
