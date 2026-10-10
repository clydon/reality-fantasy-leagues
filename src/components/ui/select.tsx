import * as React from "react";
import { cn } from "cn";

// Same rule as Input (public/styles.css groups input[type=...] and select together) -- kept as
// its own component rather than reusing <Input as="select"> since the element itself differs.
// `size="sm"` mirrors Input's -- see that component's comment for why it has no original CSS rule.
export function Select({
  className,
  children,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "default" | "sm" }) {
  return (
    <select
      data-slot="select"
      className={cn(
        "rounded-md border border-input bg-card text-foreground transition-[border-color,box-shadow]",
        "hover:border-muted-foreground/40 focus:border-chyron-line focus:shadow-[0_0_0_3px_var(--focus-halo)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Phones: at least 44px tall (40 for the dense sm size) so a thumb can hit it; the 16px text
        // floor that stops iOS zooming in on focus is a global rule in globals.css.
        size === "sm" ? "px-2 py-1 text-[0.75rem] max-nav:min-h-10" : "px-2.5 py-[7px] text-[0.88rem] max-nav:min-h-11",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
