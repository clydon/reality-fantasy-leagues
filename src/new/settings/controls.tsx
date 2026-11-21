"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";

// Settings' controls (step 15 part 1; the 2026-10-31 redesign, .impeccable/mocks/settings/ option D; settings Round 1), shared
// with a show's Notifications sheet and a couch's chat row: a group's row (its name over its value, opening its page), a switch
// with its line, one of a few choices, two or three side by side, and a fold that opens in place. Each saves as it's tapped.
// Edges that must be seen (an off switch, an empty ring) are --edge, 3:1 on the ground.
//
// Round 1's one grammar (docs/design-round/settings-r1-first-view.md, R3): a row's second line is its value, and wherever a
// setting changes what reaches you, the value says what that leaves you with ("Off · they still land in the bell").

/** A setting that's on or off: its title, a line on what it does, and the switch (bone when on: yellow is only for a must). */
export function SwitchRow({
  on,
  title,
  line,
  onChange,
  data,
  disabled,
  still,
  quiet,
}: {
  on: boolean;
  title: string;
  line: string;
  onChange: (on: boolean) => void;
  data: string;
  disabled?: boolean;
  /** It can't apply now (nothing reaches you): drawn off, read-only, words at full contrast. */
  still?: boolean;
  /** It applies, but something holds it quiet (a mute): only the switch dims. */
  quiet?: boolean;
}) {
  const shown = still ? false : on;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      aria-disabled={still || undefined}
      data-setting={data}
      data-on={on ? "on" : "off"}
      data-still={still ? "" : undefined}
      disabled={disabled || still}
      onClick={() => onChange(!on)}
      className={`nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0 ${still ? "" : "disabled:opacity-60"}`}
    >
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
      <span
        aria-hidden
        className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${still || quiet ? "opacity-45" : ""} ${shown ? "bg-foreground" : "bg-secondary shadow-[inset_0_0_0_1px_var(--edge)]"}`}
      >
        <i className={`absolute top-[3px] size-6 rounded-full transition-[left] ${shown ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
      </span>
    </button>
  );
}

/** One of a few choices: a ring, its title (Recommended marked) and a line on what it does. */
export function Choice({ on, title, line, recommended, onPick, data }: { on: boolean; title: string; line: string; recommended?: boolean; onPick: () => void; data: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} data-choice={data} onClick={() => !on && onPick()} className="nd-press flex min-h-[56px] w-full items-center gap-3 py-1.5 text-left">
      <i className={`grid size-5 flex-none place-items-center rounded-full border-2 ${on ? "border-foreground" : "border-edge"}`} aria-hidden>
        {on && <i className="size-2.5 rounded-full bg-foreground" />}
      </i>
      <span className="min-w-0">
        <b className="block text-[15px] font-semibold">
          {title}
          {recommended && <Recommended className="ml-2" />}
        </b>
        {line && <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>}
      </span>
    </button>
  );
}

export const Recommended = ({ className = "" }: { className?: string }) => (
  <em className={`type-caption rounded-[2px] bg-secondary px-1.5 text-[11px] not-italic ${className}`}>Recommended</em>
);

/** Two or three choices side by side (Appearance, Couch chat): the chosen one in bone. `sub`: a word under each title.
 *  `attrs` gives each its data attribute (what the checks find). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onPick,
  attrs,
  disabled,
}: {
  label: string;
  options: { id: T; title: string; sub?: string }[];
  value: T;
  onPick: (id: T) => void;
  attrs: (id: T) => Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-[3px] rounded-[3px] bg-card p-[3px]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          {...attrs(o.id)}
          disabled={disabled}
          onClick={() => value !== o.id && onPick(o.id)}
          className={`nd-press flex min-w-0 flex-1 flex-col items-center justify-center rounded-[2px] px-1 text-center text-[14px] font-bold leading-tight transition-colors ${o.sub ? "h-[54px] gap-0.5" : "h-11"} ${value === o.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
        >
          <span className="max-w-full truncate">{o.title}</span>
          {o.sub && <small className="text-[12px] font-medium">{o.sub}</small>}
        </button>
      ))}
    </div>
  );
}

/** A setting with its title over its control and a line under it (Quick settings' Couch chat and Appearance). */
export function SettingBlock({ title, end, line, children, data }: { title: string; end?: ReactNode; line: ReactNode; children: ReactNode; data: string }) {
  return (
    <div {...{ [`data-${data}`]: "" }} className="border-t border-border pb-3.5 pt-3 first:border-t-0">
      <div className="mb-2.5 flex min-h-6 items-center justify-between gap-2">
        <b className="text-[15px] font-semibold">{title}</b>
        {end}
      </div>
      {children}
      <small className="mt-2 block text-[13px] leading-snug text-muted-foreground">{line}</small>
    </div>
  );
}

/** A group of settings on Your settings: its icon, its name over its value, and a chevron; a tap opens its page. */
export function GroupRow({ id, icon: Icon, title, value, onClick, tone }: { id: string; icon: LucideIcon; title: string; value: ReactNode; onClick: () => void; tone?: "off" }) {
  return (
    <button type="button" data-group={id} onClick={onClick} className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small data-group-value className={`mt-0.5 block text-[13px] leading-snug ${tone === "off" ? "text-foreground" : "text-muted-foreground"}`}>
          {value}
        </small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** Back to the starting value: "Reset to recommended" (ours) or "Use my default" (yours, on a show or a couch). */
export function ResetLink({ label, onClick, data }: { label: string; onClick: () => void; data: string }) {
  return (
    <button type="button" data-reset={data} onClick={onClick} className="-my-2.5 min-h-11 text-[13px] font-semibold underline underline-offset-[3px]">
      {label}
    </button>
  );
}

/** A page's section heading inside Your settings' pages: smaller than the page's own, with an optional line under it. */
export function PageSection({ title, line, children, data, className = "" }: { title: string; line?: ReactNode; children: ReactNode; data?: string; className?: string }) {
  return (
    <section {...(data ? { [`data-${data}`]: "" } : {})} className={`mt-6 px-4 first:mt-4 ${className}`}>
      <h4 className="type-caption text-[19px]">{title}</h4>
      {line && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{line}</p>}
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/** A long section folded shut under a row saying what it's set to: a tap opens it in place, and each opens on its own.
 *  `initial`: open from the start (a link that named it). */
export function Fold({ id, icon: Icon, title, value, children, initial = false }: { id: string; icon: LucideIcon; title: string; value: ReactNode; children: ReactNode; initial?: boolean }) {
  const [open, setOpen] = useState(initial);
  const body = useId();
  return (
    <div data-fold={id} data-open={open ? "open" : undefined} className="border-t border-border first:border-t-0">
      <button type="button" aria-expanded={open} aria-controls={body} onClick={() => setOpen(!open)} className="nd-press flex min-h-[64px] w-full items-center gap-3 py-2 text-left">
        <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">{title}</b>
          <small className={`mt-0.5 block text-[13px] leading-snug ${open ? "text-foreground" : "text-muted-foreground"}`} data-fold-value>
            {value}
          </small>
        </span>
        <ChevronDown className={`size-5 flex-none text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div id={body} className="nd-unfold pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
