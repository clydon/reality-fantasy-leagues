// Small shared pieces for reviewing proposed results (Admin > Shows & Seasons' season decisions, and
// a commissioner's episode research panel).

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "cn";

// Confidence as a small coloured dot whose level shows on hover -- present on every row (not only
// the low ones) so it can be read consistently, and kept out of the way until wanted. These levels
// are also what a future auto-accept would key on.
const CONFIDENCE_MEANING: Record<"high" | "medium" | "low", string> = {
  high: "stated plainly by the source",
  medium: "implied by the source",
  low: "inferred or from a single weak source — worth a look before accepting",
};
export function ConfidenceDot({ level }: { level: "high" | "medium" | "low" }) {
  const color = level === "high" ? "bg-good" : level === "medium" ? "bg-[#c99a3e]" : "bg-destructive";
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-border bg-card"
      title={`Confidence: ${level} — ${CONFIDENCE_MEANING[level]}`}
      aria-label={`Confidence: ${level}`}
    >
      <span className={`h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

// A decided row stays on the card, tinted, with its buttons dimmed but still live -- so a misclick
// or a change of mind is one click away (the routes undo what the earlier decision applied).
export function rowTint(status: "pending" | "accepted" | "rejected") {
  return status === "accepted" ? "bg-good/10 ring-1 ring-good/30" : status === "rejected" ? "bg-destructive/10 ring-1 ring-destructive/25" : "bg-secondary/40";
}
export function decidedButtonClass(status: "pending" | "accepted" | "rejected") {
  return status === "pending" ? "" : "opacity-45 hover:opacity-100";
}
// One scoring event's results as a group -- "Tribal reward win · 10 people" -- so an event a whole
// tribe shares is one line to read and decide, not ten. Collapsed unless it's small or something in it
// needs a look; the names preview says who without opening it. `action` sits outside the toggle (a
// group-wide accept or tick-all).
export function ResultGroup({
  title,
  names,
  noun,
  detail,
  defaultOpen,
  action,
  children,
}: {
  title: string;
  names: string[];
  /** Singular and plural, e.g. ["person", "people"]. */
  noun: [string, string];
  /** e.g. "8 pending" -- appended after the count. */
  detail?: string;
  defaultOpen: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const preview = names.length > 4 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
  return (
    <div className="rounded-md border border-border">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5">
        <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <ChevronDownIcon className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
          <span className="text-[0.75rem] font-semibold">{title}</span>
          <span className="text-[0.65rem] text-muted-foreground">
            {names.length} {names.length === 1 ? noun[0] : noun[1]}
            {detail ? ` · ${detail}` : ""}
          </span>
          {!open && <span className="min-w-0 truncate text-[0.65rem] text-muted-foreground">— {preview}</span>}
        </button>
        {action}
      </div>
      {open && <div className="flex flex-col gap-1 px-1.5 pb-1.5">{children}</div>}
    </div>
  );
}

export function StatusNote({ status }: { status: "pending" | "accepted" | "rejected" }) {
  if (status === "pending") return null;
  return (
    <span className={`text-[0.65rem] font-semibold uppercase tracking-wide ${status === "accepted" ? "text-good" : "text-destructive"}`}>
      {status}
    </span>
  );
}
