"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { tourMark } from "@/lib/tour/tour-store";
import { cn } from "cn";

// Buttons, steps, notices and the sticky bar the classic design's flows are built from (the create-league wizard's
// research, episode results, the scoreboard's lines, the tour). They were classic admin's shared pieces until its pages
// retired (docs/PLAN-desk-parity.md step 8).

/** A condensed caps section heading with an optional aside ("All 21", a count). */
export function Section({ title, aside, children, className }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-9 items-end justify-between gap-3">
        <h3 className="type-caption text-[24px]">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Rows divided by hairlines, with a closing one underneath. */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col border-b border-border [&>*]:border-t [&>*]:border-border", className)}>{children}</div>;
}

/**
 * The 44px buttons that sit in rows and bars. Chyron is for the one thing to do next; plain is
 * everything else. Never red: deleting lives in a sheet or a Danger zone.
 */
export function ActButton({
  href,
  onClick,
  tone = "plain",
  disabled,
  children,
  className,
  type = "button",
  external,
}: {
  href?: string;
  /** href is another site's: opens in a new tab, so this page (and anything typed on it) stays put. */
  external?: boolean;
  onClick?: () => void;
  tone?: "chyron" | "plain";
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
}) {
  const cls = cn(
    "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[3px] px-3.5 text-[15px] font-bold transition-[filter,background-color] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:opacity-45",
    tone === "chyron"
      ? "bg-chyron text-chyron-foreground hover:brightness-[1.06] disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
      : "border border-input bg-card text-foreground hover:bg-secondary",
    className,
  );
  if (href && !disabled && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

/**
 * A bar stuck to the bottom of the page, above the phone's tab bar: one muted line of what the
 * action does, then the action. Full bleed on phones, a bordered bar on desktop.
 */
export function StickyBar({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div
      className="sticky bottom-[var(--tabbar-h,0px)] z-40 -mx-4 mt-auto flex items-center gap-3 border-t border-input bg-card px-4 py-3 shadow-bar nav:mx-0 nav:rounded-[3px] nav:border"
      data-admin-bar
    >
      {note && <span className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">{note}</span>}
      {children}
    </div>
  );
}

/** A numbered step, chyron while it's the one to do. */
export function StepNum({ n, on }: { n: number; on?: boolean }) {
  return (
    <span
      className={cn(
        "type-num flex size-[30px] shrink-0 items-center justify-center rounded-full text-[18px]",
        on ? "bg-chyron text-chyron-foreground" : "bg-muted text-foreground",
      )}
      aria-hidden
    >
      {n}
    </span>
  );
}

/** A numbered step's row: the number, a label, and whatever the step needs underneath. */
export function Step({ n, on, label, children }: { n: number; on?: boolean; label: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <StepNum n={n} on={on} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="pt-1 text-[15px] font-semibold">{label}</span>
        {children}
      </div>
    </li>
  );
}

/** Copies text, saying so for two seconds. A blocked clipboard leaves the text selectable wherever it's shown. */
export function CopyButton({
  text,
  label = "Copy prompt",
  tone = "chyron",
  disabled,
  tourId,
}: {
  text: string | undefined;
  label?: string;
  tone?: "chyron" | "plain";
  disabled?: boolean;
  /** The guided tour's name for this button: lit as a target, and noted as done once it copies. */
  tourId?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked (permissions, non-HTTPS): the tour carries on, since nothing is pasted anywhere */
      if (!tourId) return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (tourId) tourMark(tourId);
  }
  return (
    <span className="self-start" data-tour={tourId}>
      <ActButton tone={tone} onClick={copy} disabled={disabled || !text}>
        {copied ? <Check className="size-[18px]" strokeWidth={2.4} aria-hidden /> : <Copy className="size-[18px]" strokeWidth={2.2} aria-hidden />}
        {copied ? "Copied" : label}
      </ActButton>
    </span>
  );
}

/** A result line under an action: teal when it worked, red when it didn't. */
export function Notice({ tone = "good", children }: { tone?: "good" | "bad" | "quiet"; children: ReactNode }) {
  return (
    <p
      role={tone === "bad" ? "alert" : "status"}
      className={cn("text-sm leading-snug", tone === "good" ? "font-semibold text-good" : tone === "bad" ? "font-semibold text-destructive" : "text-muted-foreground")}
    >
      {children}
    </p>
  );
}

/** A two-way (or more) segmented control: the chosen side is bone-white, like the You badge. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-[3px] bg-card p-[3px]">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          className={cn(
            "min-h-10 flex-1 rounded-[2px] px-2 text-sm font-semibold",
            value === v ? "bg-foreground font-bold text-background" : "text-foreground hover:bg-muted",
          )}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** "3 results", "1 result". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
