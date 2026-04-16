import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex touch-manipulation select-none items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-sm font-semibold transition-all [-webkit-tap-highlight-color:transparent] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[4px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border-0 bg-[linear-gradient(135deg,var(--cadova-primary),var(--cadova-primary-hover))] text-primary-foreground shadow-[0_16px_38px_rgba(80,68,245,0.24)] hover:shadow-[0_18px_44px_rgba(80,68,245,0.3)]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border border-[var(--cadova-border)] bg-white/80 text-[var(--cadova-text)] shadow-[0_10px_30px_rgba(15,16,33,0.04)] hover:bg-[var(--cadova-primary-soft)] hover:text-[var(--cadova-navy)]",
        secondary:
          "border border-[var(--cadova-border)] bg-[var(--cadova-primary-soft)] text-[var(--cadova-navy)] hover:bg-white",
        ghost:
          "text-[var(--cadova-muted)] hover:bg-[var(--cadova-primary-soft)] hover:text-[var(--cadova-navy)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 rounded-[8px] gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-[8px] px-6 has-[>svg]:px-4",
        icon: "size-10 rounded-[8px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
