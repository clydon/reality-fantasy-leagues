"use client";

import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { NavLink } from "../nav";

// The new design's small parts (the mock's .btn, .row, .sh, .chip, .gd-chip). Rules they carry (the critique,
// 2026-10-23/24): yellow only for what you must do (an optional action is an outline); one spoiler chip
// everywhere; plates are for single moments, never stacked as list items (CaptionPlate is classic's, re-exported).

export { CaptionPlate } from "@/components/ui/caption-plate";

const BTN = {
  /** You need to do it: the one yellow on the screen. */
  must: "bg-chyron text-chyron-foreground",
  /** Optional: an outline on the panel. */
  optional: "bg-card outline-1 -outline-offset-1 outline-input",
  /** A plain strong action that isn't a duty (bone fill). */
  ink: "bg-foreground text-background",
};

const btnClass = (tone: keyof typeof BTN, wide?: boolean) =>
  `nd-press flex h-[52px] items-center justify-center gap-2 rounded-[3px] px-4 text-center text-[15px] font-bold hover:brightness-110 ${BTN[tone]} ${wide ? "w-full" : ""}`;

export function Btn({ tone = "optional", wide, className = "", ...props }: ComponentProps<"button"> & { tone?: keyof typeof BTN; wide?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`${btnClass(tone, wide)} disabled:bg-secondary disabled:text-muted-foreground disabled:outline-0 ${className}`}
    />
  );
}

/** A Btn that goes somewhere. */
export function BtnLink({ tone = "optional", wide, className = "", ...props }: ComponentProps<typeof NavLink> & { tone?: keyof typeof BTN; wide?: boolean }) {
  return <NavLink {...props} className={`${btnClass(tone, wide)} ${className}`} />;
}

/** A section's heading: condensed caps, with an aside or one link on its line. `flush`: inside something already padded. */
export function SectionHead({ title, aside, flush, className = "" }: { title: ReactNode; aside?: ReactNode; flush?: boolean; className?: string }) {
  return (
    <div className={`mb-3 flex items-baseline justify-between gap-3 ${flush ? "" : "px-4"} ${className}`}>
      <h2 className="type-caption text-[24px]">{title}</h2>
      {aside && <span className="text-[13px] text-muted-foreground">{aside}</span>}
    </div>
  );
}

type RowBase = { icon?: LucideIcon; iconClass?: string; title: ReactNode; detail?: ReactNode; end?: ReactNode; dot?: boolean };

function RowBody({ icon: Icon, iconClass = "bg-secondary", title, detail, end, dot, chevron }: RowBase & { chevron?: boolean }) {
  return (
    <>
      {Icon && (
        <span className={`grid size-10 flex-none place-items-center overflow-hidden rounded-[3px] ${iconClass}`}>
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        {detail && <small className="mt-0.5 block text-[13px] text-muted-foreground">{detail}</small>}
      </span>
      {end}
      {dot && <i className="size-2.5 flex-none rounded-full bg-chyron-line" aria-label="Needs you" />}
      {chevron && <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />}
    </>
  );
}

const ROW = "nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0";

/** A list row: an icon box, a title with one muted line, and what's on its end. A link when it has `href`. */
export function Row(props: RowBase & ({ href: string; onClick?: never } | { href?: never; onClick?: () => void })) {
  if (props.href) {
    return (
      <NavLink href={props.href} className={ROW}>
        <RowBody {...props} chevron />
      </NavLink>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={ROW}>
      <RowBody {...props} chevron={!!props.onClick} />
    </button>
  );
}

export function Chip({ on, className = "", ...props }: ComponentProps<"button"> & { on?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      {...props}
      className={`inline-flex h-9 items-center rounded-[2px] px-3 text-sm font-semibold transition-colors ${on ? "bg-foreground text-background" : "bg-secondary"} ${className}`}
    />
  );
}

/** Nothing here (yet): what this place is for, and the one thing to do about it. */
export function EmptyState({ icon: Icon, title, line, action }: { icon?: LucideIcon; title: ReactNode; line?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {Icon && (
        <span className="mb-3 grid size-12 place-items-center rounded-[3px] bg-secondary text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <b className="type-caption text-[22px]">{title}</b>
      {line && <p className="mt-2 max-w-[300px] text-sm leading-snug text-muted-foreground">{line}</p>}
      {action && <div className="mt-5 w-full max-w-[300px]">{action}</div>}
    </div>
  );
}

/**
 * The one spoiler chip, on every guarded surface: "Spoiler-safe · you're on Ep N · Change". `seenThrough` null:
 * spoiler protection is off (Account settings), so there's nothing to guard.
 */
export function GuardChip({ seenThrough, onChange, className = "" }: { seenThrough: number | null; onChange?: () => void; className?: string }) {
  if (seenThrough == null) {
    return <p className={`flex h-9 items-center px-0.5 text-xs font-semibold text-muted-foreground ${className}`}>Spoiler protection is off: you see results as they come</p>;
  }
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex h-9 w-full items-center gap-[7px] rounded-[3px] bg-good/10 px-2.5 text-left text-xs font-bold text-good ${className}`}
    >
      <ShieldCheck className="size-[15px] flex-none" aria-hidden />
      <span className="flex-1">
        <b>Spoiler-safe</b> · {seenThrough ? `you're on Ep ${seenThrough}` : "not started yet"}
      </span>
      {onChange && <b className="text-foreground">Change</b>}
    </button>
  );
}
