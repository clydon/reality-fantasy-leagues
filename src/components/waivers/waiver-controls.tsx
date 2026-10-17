"use client";

import type { ReactNode } from "react";
import { Check, Clock, ListOrdered, Minus, Plus, UserX, Waypoints } from "lucide-react";
import type { WaiverFeel } from "@/lib/game/types";
import { cn } from "cn";
import { FEELS, FEEL_LABEL, swapsLabel, type shapeBullets } from "./waivers-words";

// The controls waiver settings are made of (docs/PLAN-waivers-v2.md "1A", "3B"; the "Waivers v2
// options" canvas): a segmented switch, the −/+ swaps counter (None · 1 · 2 … · All), a switch, and the
// Suggested card with its Casual · Balanced · Competitive switch. League Settings › Waivers, the Open a
// waiver window sheet and the create wizard all use these.

/** A row of equal segments; the chosen one is You-filled (bone in Night, ink in Studio). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-0.5 rounded-[4px] border border-border bg-background p-0.5", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 truncate rounded-[3px] px-1 text-sm focus-visible:outline-3 focus-visible:outline-chyron-line disabled:cursor-default",
              on ? "bg-foreground font-bold text-background" : "font-semibold text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** −/+ for swaps: None · 1 · 2 … · All (the whole roster). */
export function SwapCounter({ value, roster, onChange, disabled, label = "Swaps" }: { value: number; roster: number; onChange: (n: number) => void; disabled?: boolean; label?: string }) {
  const btn = "flex size-11 items-center justify-center hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron-line disabled:opacity-35";
  return (
    <span className="inline-grid shrink-0 grid-cols-[44px_56px_44px] items-center rounded-[4px] border border-input">
      <button type="button" className={btn} aria-label={`${label}: fewer`} disabled={disabled || value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
        <Minus className="size-5" strokeWidth={2.4} aria-hidden />
      </button>
      <span className="type-num text-center text-[22px]" aria-live="polite">
        {swapsLabel(value, roster)}
      </span>
      <button type="button" className={btn} aria-label={`${label}: more`} disabled={disabled || value >= roster} onClick={() => onChange(Math.min(roster, value + 1))}>
        <Plus className="size-5" strokeWidth={2.4} aria-hidden />
      </button>
    </span>
  );
}

/** A switch row. `tone="you"` fills it bone/ink rather than chyron, for a sheet whose one yellow is its button. */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  tone = "chyron",
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  tone?: "chyron" | "you";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-[60px] w-full items-center gap-3 border-b border-border py-2.5 text-left outline-none focus-visible:bg-accent disabled:cursor-default"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        {hint && <span className="text-[13px] leading-snug text-muted-foreground">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-[46px] shrink-0 rounded-full transition-colors",
          checked ? (tone === "you" ? "bg-foreground" : "bg-chyron") : "bg-input",
          disabled && "opacity-50",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] size-[22px] rounded-full transition-[left]",
            checked ? cn("left-[21px]", tone === "you" ? "bg-background" : "bg-chyron-foreground") : "left-[3px] bg-foreground",
          )}
        />
      </span>
    </button>
  );
}

const ICONS = { out: UserX, win: Waypoints, ord: ListOrdered, clk: Clock };

/**
 * The Suggested card: what suits this league (a line of its numbers), the Casual · Balanced · Competitive
 * switch, four bullets the switch rewrites, then Apply (chyron, following the switch) -- or, once the
 * league is on it, a teal tick. `footer` replaces the Apply part (the wizard has its own).
 */
export function FeelCard({
  heading = "Suggested",
  numbers,
  feel,
  onFeel,
  bullets,
  applied,
  onApply,
  busy,
  disabled,
  footer,
}: {
  heading?: ReactNode;
  numbers?: ReactNode;
  feel: WaiverFeel;
  onFeel: (f: WaiverFeel) => void;
  bullets: ReturnType<typeof shapeBullets>;
  applied?: boolean;
  onApply?: () => void;
  busy?: boolean;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5 rounded-[4px] border border-border bg-card px-3.5 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="type-caption text-[22px]">{heading}</h2>
        {numbers && <span className="text-[13px] text-muted-foreground">{numbers}</span>}
      </div>
      <Segmented label="Style" options={FEELS.map((f) => ({ value: f, label: FEEL_LABEL[f] }))} value={feel} onChange={onFeel} disabled={disabled} />
      <ul className="flex flex-col gap-2.5">
        {bullets.map((b) => {
          const Icon = ICONS[b.icon];
          return (
            <li key={b.icon} className="grid grid-cols-[22px_1fr] items-start gap-2.5 text-[15px] leading-[1.4]">
              <span className="flex size-[22px] items-center justify-center rounded-[3px] bg-muted" aria-hidden>
                <Icon className="size-[13px]" strokeWidth={2.5} />
              </span>
              <span>{b.text}</span>
            </li>
          );
        })}
      </ul>
      {footer ??
        (applied ? (
          <p className="flex min-h-12 items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 text-good" strokeWidth={2.5} aria-hidden />
            Your league is on {FEEL_LABEL[feel]}.
          </p>
        ) : (
          onApply && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onApply}
                disabled={busy || disabled}
                className="min-h-12 rounded-[6px] bg-chyron text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:opacity-60"
              >
                {busy ? "Applying…" : `Apply ${FEEL_LABEL[feel]} settings`}
              </button>
              <span className="text-center text-[13px] text-muted-foreground">Or set your own below.</span>
            </div>
          )
        ))}
    </section>
  );
}
