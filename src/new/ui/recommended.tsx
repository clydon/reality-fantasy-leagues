// The one Recommended tag (settings rule 5, "Recommended, marked the same way everywhere"; settings Round 4). The word in the condensed
// caps, muted, with no fill: the fill chip it replaces (Your settings') vanished on a raised choice (Manage this game's, the desk's
// cards), where this reads the same as on the ground. Your settings, Manage this game, the draft room, a couch's results sheet and
// the desk use it. `onFill`: on a chosen choice drawn in bone (the draft room's), the choice's own ink, dimmed, in place of muted.

export function Recommended({ className = "", onFill = false }: { className?: string; onFill?: boolean }) {
  return (
    <span
      data-recommended
      className={`type-caption inline-block text-[12px] not-italic leading-none tracking-[0.05em] ${onFill ? "opacity-75" : "text-muted-foreground"} ${className}`}
    >
      Recommended
    </span>
  );
}
