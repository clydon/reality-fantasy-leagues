import * as React from "react";
import { cn } from "cn";

// Ported from public/styles.css's .modal-box select,.modal-box textarea rule -- the only place
// the live app uses a textarea at all (the report modal). Slightly larger font/padding than
// Input's (.9rem/8px-10px vs .88rem/7px-10px), matching that scoped rule exactly rather than
// reusing Input's values.
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full resize-y rounded-md border border-border bg-card px-2.5 py-2 text-[0.9rem] text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground",
        "hover:border-[#cfcabf] focus:border-primary focus:shadow-[0_0_0_3px_rgba(204,91,57,.12)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
