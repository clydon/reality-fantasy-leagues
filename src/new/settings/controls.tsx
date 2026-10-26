"use client";

// Settings' two controls (step 15 part 1), shared with a show's Notifications sheet (part 2): a switch with its line, and one of
// a few choices. Each saves as it's tapped.

/** A setting that's on or off: its title, a line on what it does, and the switch (bone when on: yellow is only for a must). */
export function SwitchRow({ on, title, line, onChange, data, disabled }: { on: boolean; title: string; line: string; onChange: (on: boolean) => void; data: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-setting={data}
      data-on={on ? "on" : "off"}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0 disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
      <span aria-hidden className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${on ? "bg-foreground" : "bg-secondary"}`}>
        <i className={`absolute top-[3px] size-6 rounded-full transition-[left] ${on ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
      </span>
    </button>
  );
}

/** One of a few choices: a ring, its title (Recommended marked) and a line on what it does. */
export function Choice({ on, title, line, recommended, onPick, data }: { on: boolean; title: string; line: string; recommended?: boolean; onPick: () => void; data: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} data-choice={data} onClick={() => !on && onPick()} className="nd-press flex min-h-[56px] w-full items-center gap-3 py-1.5 text-left">
      <i className={`grid size-5 flex-none place-items-center rounded-full border-2 ${on ? "border-foreground" : "border-input"}`} aria-hidden>
        {on && <i className="size-2.5 rounded-full bg-foreground" />}
      </i>
      <span className="min-w-0">
        <b className="block text-[15px] font-semibold">
          {title}
          {recommended && <em className="type-caption ml-2 rounded-[2px] bg-secondary px-1.5 text-[11px] not-italic">Recommended</em>}
        </b>
        {line && <small className="text-[13px] text-muted-foreground">{line}</small>}
      </span>
    </button>
  );
}
