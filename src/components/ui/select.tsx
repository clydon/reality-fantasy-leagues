import * as React from "react";
import { cn } from "cn";

// Same rule as Input (public/styles.css groups input[type=...] and select together) -- kept as
// its own component rather than reusing <Input as="select"> since the element itself differs.
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "rounded-md border border-border bg-card px-2.5 py-[7px] text-[0.88rem] text-foreground transition-[border-color,box-shadow]",
        "hover:border-[#cfcabf] focus:border-primary focus:shadow-[0_0_0_3px_rgba(204,91,57,.12)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
