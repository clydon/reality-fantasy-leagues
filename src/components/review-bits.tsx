// Small shared pieces for reviewing proposed results (Admin > Shows & Seasons' season decisions).

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
export function StatusNote({ status }: { status: "pending" | "accepted" | "rejected" }) {
  if (status === "pending") return null;
  return (
    <span className={`text-[0.65rem] font-semibold uppercase tracking-wide ${status === "accepted" ? "text-good" : "text-destructive"}`}>
      {status}
    </span>
  );
}
