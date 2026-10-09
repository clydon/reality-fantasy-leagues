"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Minus, MoreHorizontal, Plus } from "lucide-react";
import { useCanManage } from "@/lib/store";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "cn";

// Shared pieces for League Settings as a list of pages (docs/PLAN-ux-redesign.md, 2b; the canvas's
// "Settings-Index" and "Settings-Players"): the page frame with its back link, the index's rows that
// show their current value, and the settings controls every page uses -- toggle rows, number
// steppers, full-width fields, and locked values shown as plain text.

/** One settings sub-page: a back link and title on desktop (the mobile header has both), then content. */
export function SettingsPage({
  title,
  back = { href: "/setup", label: "League Settings" },
  actions,
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  /** Opens the page's ⋯ sheet; the button only shows when given. */
  actions?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <div className={cn("flex items-end gap-3", !actions && "max-nav:hidden")}>
        <div className="flex min-w-0 flex-1 flex-col gap-1 max-nav:hidden">
          <Link
            href={back.href}
            className="-ml-1 inline-flex min-h-11 items-center gap-0.5 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-5" strokeWidth={2.2} aria-hidden />
            {back.label}
          </Link>
          <h2 className="type-caption text-[28px]">{title}</h2>
        </div>
        {actions && <MoreButton label={actions.label} onClick={actions.onClick} className="ml-auto" />}
      </div>
      {children}
    </div>
  );
}

/** The 44px ⋯ button that opens a row's or a page's bottom sheet. */
export function MoreButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-3 focus-visible:outline-chyron",
        className
      )}
    >
      <MoreHorizontal className="size-5" aria-hidden />
    </button>
  );
}

/** A condensed caps heading over a group of rows. */
export function GroupHead({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-9 items-end justify-between gap-3 pb-1.5">
      <h3 className="type-caption text-[22px]">{children}</h3>
      {aside}
    </div>
  );
}

/** Rows divided by hairlines, with a closing one underneath. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col border-b border-border [&>*]:border-t [&>*]:border-border", className)}>{children}</div>;
}

/** The settings index's row: icon, name, its current value underneath, chevron. */
export function IndexRow({
  href,
  icon: Icon,
  title,
  value,
  alert,
}: {
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  value?: ReactNode;
  /** A chyron dot: something here needs the commissioner. */
  alert?: boolean;
}) {
  return (
    <Link href={href} className="flex min-h-[60px] items-center gap-3 py-2 outline-none hover:bg-accent/40 focus-visible:bg-accent">
      <Icon className="size-[22px] shrink-0 text-muted-foreground" strokeWidth={2} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-base font-semibold">
          {title}
          {alert && <span className="size-2 rounded-full bg-chyron" aria-label="Needs attention" />}
        </span>
        {value && <span className="truncate text-[13px] text-muted-foreground">{value}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
    </Link>
  );
}

/** A switch row: label (and a line of help) on the left, the switch on the right. The whole row toggles. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left outline-none focus-visible:bg-accent disabled:cursor-default"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        {hint && <span className="text-[13px] leading-snug text-muted-foreground">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-chyron" : "bg-muted",
          disabled && "opacity-50"
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full transition-[left]",
            checked ? "left-6 bg-chyron-foreground" : "left-1 bg-muted-foreground"
          )}
        />
      </span>
    </button>
  );
}

/** − value + with 44px buttons. Commits each tap. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  disabled,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Names the buttons for screen readers ("Active slots"). */
  label: string;
}) {
  const clamp = (n: number) => Math.max(min, max === undefined ? n : Math.min(max, n));
  const btn =
    "flex size-11 items-center justify-center rounded-[3px] border border-input text-foreground hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron disabled:opacity-35";
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className={btn}
        aria-label={`${label}: one less`}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - step))}
      >
        <Minus className="size-5" strokeWidth={2.4} aria-hidden />
      </button>
      <span className="type-num min-w-10 text-center text-[24px]" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={`${label}: one more`}
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(clamp(value + step))}
      >
        <Plus className="size-5" strokeWidth={2.4} aria-hidden />
      </button>
    </span>
  );
}

/** A setting with a number: label and help on the left, a stepper on the right (just the number when disabled). */
export function StepperRow({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 py-2.5">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        {hint && <span className="text-[13px] leading-snug text-muted-foreground">{hint}</span>}
      </span>
      {/* Read-only: just the number, not a pair of dead buttons. */}
      {disabled ? (
        <span className="type-num min-w-10 shrink-0 text-right text-[24px]">{value}</span>
      ) : (
        <Stepper label={label} value={value} onChange={onChange} min={min} max={max} />
      )}
    </div>
  );
}

/** A labelled full-width field: label above, the control, a line of help below. */
export function Field({ label, htmlFor, hint, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A value that can't be changed any more, as plain text with a lock -- not a greyed-out control. */
export function LockedValue({ label, value, lock = true }: { label: ReactNode; value: ReactNode; lock?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{label}</span>
      <span className="flex min-h-7 items-center gap-2 text-base">
        {lock && <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Locked" />}
        {value}
      </span>
    </div>
  );
}

/** "Only your commissioner can change these", once per page, for anyone who can't. */
export function ReadOnlyNote() {
  const canManage = useCanManage();
  if (canManage) return null;
  return <p className="text-sm text-muted-foreground">Only your commissioner (or an admin) can change these.</p>;
}

/** A league-type page reached in a league that doesn't have it (an old link, a type change). */
export function NotInThisLeague({ what }: { what: string }) {
  return (
    <p className="text-base text-muted-foreground">
      This league doesn&rsquo;t use {what}.{" "}
      <Link href="/setup" className="font-semibold text-foreground underline underline-offset-2">
        Back to League Settings
      </Link>
    </p>
  );
}

/** A disclosure for set-once or rarely used options ("More options"), closed by default. */
export function MoreOptions({
  label = "More options",
  children,
  defaultOpen = false,
}: {
  label?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn("size-5 transition-transform", open && "rotate-90")} strokeWidth={2.2} aria-hidden />
        {label}
      </button>
      {open && children}
    </div>
  );
}

/** A small caps chip: "Pending", "Changed", "Inactive". `tone` chyron is for one thing that needs action. */
export function Chip({ children, tone = "quiet" }: { children: ReactNode; tone?: "chyron" | "quiet" | "live" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[2px] px-1.5 py-px text-[11px] font-bold uppercase tracking-wide",
        tone === "chyron"
          ? "bg-chyron text-chyron-foreground"
          : tone === "live"
            ? "bg-live text-live-foreground"
            : "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

/** The primary action inside a sheet or a form: chyron, 48px, full width on phones. */
export function PrimaryButton({
  onClick,
  disabled,
  children,
  className,
  type = "button",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-12 shrink-0 rounded-[3px] bg-chyron px-5 text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron disabled:bg-muted disabled:text-muted-foreground disabled:hover:brightness-100",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Text fields in the settings pages: 48px, square-cornered, full width. */
export const fieldCls =
  "min-h-12 w-full rounded-[3px] border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-chyron focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/** A sheet with one text field and a primary button. */
export function TextSheet({
  title,
  description,
  label,
  help,
  initial = "",
  allowEmpty = false,
  submit,
  onSubmit,
  onClose,
}: {
  title: string;
  description?: string;
  label: string;
  help?: string;
  initial?: string;
  /** Lets an empty value through (to clear something, like a photo). */
  allowEmpty?: boolean;
  submit: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();
  return (
    <BottomSheet open onOpenChange={(o) => !o && onClose()} title={title} description={description}>
      <form
        className="flex flex-col gap-3 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed || allowEmpty) onSubmit(trimmed);
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{label}</span>
          <input className={fieldCls} value={value} autoFocus onChange={(e) => setValue(e.target.value)} />
        </label>
        {help && <p className="text-[13px] leading-snug text-muted-foreground">{help}</p>}
        <PrimaryButton type="submit" disabled={!trimmed && !allowEmpty}>
          {submit}
        </PrimaryButton>
      </form>
    </BottomSheet>
  );
}
