import * as React from "react";
import { cn } from "cn";

// Ported 1:1 from public/styles.css's shared input[type=text],input[type=number],...,select rule
// -- same component covers text/number/password/date/email, matching that CSS's own grouping.
// `size="sm"` has no original CSS rule to port (the live app's dense card-grid inputs -- bet-card,
// side-bets-section -- were always bespoke one-off classes, not a variant of this shared rule);
// it's new design for that same dense-card-grid job, sized to match Button's `size="xs"`.
export function Input({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & { size?: "default" | "sm" }) {
  return (
    <input
      data-slot="input"
      className={cn(
        "rounded-md border border-input bg-card font-[family-name:var(--font-sans)] text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground",
        "hover:border-muted-foreground/40 focus:border-chyron-line focus:shadow-[0_0_0_3px_var(--focus-halo)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Phones: at least 44px tall (40 for the dense sm size) so a thumb can hit it; the 16px text
        // floor that stops iOS zooming in on focus is a global rule in globals.css.
        size === "sm" ? "px-2 py-1 text-[0.75rem] max-nav:min-h-10" : "px-2.5 py-[7px] text-[0.88rem] max-nav:min-h-11",
        className
      )}
      {...props}
    />
  );
}
