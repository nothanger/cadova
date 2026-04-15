import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-[#8c91a3] selection:bg-primary selection:text-primary-foreground border-[var(--cadova-border)] flex h-12 w-full min-w-0 rounded-[8px] border bg-white px-4 py-2 text-base text-[var(--cadova-text)] transition-[color,box-shadow,border-color,background] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-[var(--cadova-primary)] focus-visible:ring-[rgba(80,68,245,0.1)] focus-visible:ring-[4px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
