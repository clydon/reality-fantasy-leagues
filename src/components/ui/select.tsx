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
        "rounded-md border border-border bg-card text-foreground transition-[border-color,box-shadow]",
        "hover:border-[#cfcabf] focus:border-primary focus:shadow-[0_0_0_3px_rgba(204,91,57,.12)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2 py-1 text-[0.75rem]" : "px-2.5 py-[7px] text-[0.88rem]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
