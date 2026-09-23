import * as React from "react";
import { cn } from "cn";

// Ported 1:1 from public/styles.css's shared input[type=text],input[type=number],...,select rule
// -- same component covers text/number/password/date/email, matching that CSS's own grouping.
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "rounded-md border border-border bg-card px-2.5 py-[7px] font-[family-name:var(--font-sans)] text-[0.88rem] text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground",
        "hover:border-[#cfcabf] focus:border-primary focus:shadow-[0_0_0_3px_rgba(204,91,57,.12)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
