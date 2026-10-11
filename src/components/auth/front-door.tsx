"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";
import { m, useReducedMotion } from "@/components/motion";
import { Wordmark } from "./wordmark";

// The signed-out screens (sign in / create account, forgot and reset password) share one layout,
// a show's cold open: the wordmark on a top bar, a title card filling the upper part of the screen,
// and the form in a sheet rising from the bottom, like every other sheet in the app. The sheet is in
// the page's flow rather than fixed, so a phone keyboard scrolls the focused field into view instead
// of covering it. Wide screens keep the same column, capped at the bottom sheet's 480px. A `backdrop`
// (the show roll's art) fills everything above the sheet, behind the top bar and the title card.
export function FrontDoor({
  aside,
  title,
  backdrop,
  children,
}: {
  aside?: ReactNode;
  title: ReactNode;
  backdrop?: ReactNode;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="relative isolate flex flex-1 flex-col">
        {backdrop && <div className="absolute inset-0 -z-10 overflow-hidden">{backdrop}</div>}
        <header className="mx-auto flex w-full max-w-[480px] items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)]">
          <Wordmark />
          {aside}
        </header>
        <section className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-4 py-10">{title}</section>
      </div>
      <m.div
        initial={reduce ? false : { y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto w-full max-w-[480px] rounded-t-[14px] bg-card px-4 pt-4 pb-[max(env(safe-area-inset-bottom),20px)] shadow-sheet"
      >
        {children}
      </m.div>
    </div>
  );
}

/** A labelled 48px field. A password field gets a show/hide toggle; `labelAside` sits on the label's
 *  line, right-aligned (Forgot password?). */
export function Field({
  label,
  hint,
  labelAside,
  type = "text",
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & { label: string; hint?: string; labelAside?: ReactNode }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-foreground">
          {label}
          {hint && <span className="font-normal text-muted-foreground"> {hint}</span>}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={id}
          type={isPassword && shown ? "text" : type}
          className={cn(
            "h-12 w-full rounded-[4px] border border-input bg-background px-3 text-base text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground",
            "hover:border-muted-foreground/50 focus:border-chyron-line focus:shadow-[0_0_0_3px_var(--focus-halo)] focus:outline-none",
            isPassword && "pr-12",
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[4px] text-muted-foreground hover:text-foreground focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-chyron-line"
          >
            {shown ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        )}
      </div>
    </div>
  );
}

/** The sheet's one action: full width, 52px, chyron, named in condensed caps. */
export function SubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="type-caption mt-5 flex h-[52px] w-full items-center justify-center rounded-[3px] bg-chyron text-[22px] text-chyron-foreground transition-[filter,transform] hover:brightness-[1.06] active:translate-y-px focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:opacity-50 disabled:hover:brightness-100"
    >
      {children}
    </button>
  );
}

/** The id a form's fields point at (aria-describedby) while its error shows. */
export const FORM_ERROR_ID = "front-door-error";

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p id={FORM_ERROR_ID} role="alert" className="mt-4 text-sm font-medium text-destructive">
      {children}
    </p>
  );
}

/** A screen's heading in the title card, for the pages without the show roll. */
export function FrontDoorTitle({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return (
    <>
      <h1 className="type-caption text-[clamp(44px,12.5vw,60px)] leading-[0.95] text-balance">{children}</h1>
      {detail && <p className="mt-4 max-w-[34ch] text-base text-muted-foreground">{detail}</p>}
    </>
  );
}
