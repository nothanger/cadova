import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "resize-none border-[var(--cadova-border)] placeholder:text-[#8c91a3] focus-visible:border-[var(--cadova-primary)] focus-visible:ring-[rgba(80,68,245,0.1)] aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex field-sizing-content min-h-24 w-full rounded-[8px] border bg-white px-4 py-3 text-base text-[var(--cadova-text)] transition-[color,box-shadow,border-color] outline-none [-webkit-appearance:none] [appearance:none] focus-visible:ring-[4px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
