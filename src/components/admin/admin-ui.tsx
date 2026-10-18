"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { create } from "zustand";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { AdminShow, ShowSeason } from "@/lib/game/types";
import { MoreButton } from "@/components/setup/settings-ui";
import { tourMark } from "@/lib/tour/tour-store";
import { cn } from "cn";

// Shared pieces for the admin area (docs/PLAN-ux-redesign.md 3a-3g; the canvas's "A · Admin" page).
// Admin used to be one page holding everything; it's now a set of pages under /admin, each with its
// own route, so back works and nothing nests four levels deep. These are the parts every one of
// those pages uses: the page frame, the header title it hands to the mobile header, the shows query
// they share, and the rows, buttons and sticky bar they're built from.

/** What the mobile admin header shows: the page's own name and where Back goes. Set by AdminPage. */
export const useAdminHeader = create<{ title: string; back: string | null }>(() => ({ title: "Admin", back: null }));

/**
 * One admin page. On a phone the header above carries the title and Back, so the page starts with
 * its one-line summary; on desktop it shows the back link and the title itself.
 */
export function AdminPage({
  title,
  subtitle,
  back,
  actions,
  wide,
  children,
}: {
  title: string;
  /** One muted line under the title: "Airing · 4 leagues". */
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  /** Opens the page's ⋯ sheet. */
  actions?: { label: string; onClick: () => void };
  /** Tables and two-column pages get the full content width; forms stay narrow. */
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    useAdminHeader.setState({ title, back: back?.href ?? null });
  }, [title, back?.href]);
  return (
    // At least a screen tall (less the header, tab bar and padding), so a StickyBar on a short page
    // rests at the bottom instead of halfway up.
    <div className={cn("flex min-h-[calc(100dvh-160px)] flex-col gap-6 nav:min-h-[calc(100dvh-130px)]", wide ? "max-w-[980px]" : "max-w-[680px]")}>
      <div className={cn("flex items-end gap-3", !subtitle && !actions && "max-nav:hidden")}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {back && (
            <Link
              href={back.href}
              className="-ml-1 inline-flex min-h-11 items-center gap-0.5 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-foreground max-nav:hidden"
            >
              <ChevronLeft className="size-5" strokeWidth={2.2} aria-hidden />
              {back.label}
            </Link>
          )}
          <h2 className="type-caption text-[28px] max-nav:hidden">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <MoreButton label={actions.label} onClick={actions.onClick} className="ml-auto" />}
      </div>
      {children}
    </div>
  );
}

/** Every show with its seasons and pipeline state -- the admin area's one shared query. */
export function useAdminShows() {
  return useQuery({ queryKey: ["admin-shows"], queryFn: () => api.adminListShows() });
}

/** A season's own name, or its number. */
export function seasonName(season: Pick<ShowSeason, "name" | "seasonNumber">) {
  return season.name || `Season ${season.seasonNumber}`;
}

/** "Survivor 51": the show and season together, for headers and to-do rows. */
export function seasonShort(show: Pick<AdminShow, "name">, season: Pick<ShowSeason, "name" | "seasonNumber">) {
  return season.name ? `${show.name}: ${season.name}` : `${show.name} ${season.seasonNumber}`;
}

/** The season with this id and the show it belongs to, from the shared shows query. */
export function useAdminSeason(seasonId: string) {
  const q = useAdminShows();
  const show = q.data?.shows.find((s) => s.seasons.some((x) => x.id === seasonId)) ?? null;
  const season = show?.seasons.find((x) => x.id === seasonId) ?? null;
  return { ...q, show, season };
}

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
 * A row: an optional 40px icon square, a title and one line of detail, then whatever goes on the
 * right (a button, a chip, a ⋯). With `href` and nothing on the right, the whole row is a link with
 * a chevron.
 */
export function Row({
  icon: Icon,
  lead,
  title,
  detail,
  href,
  trailing,
  dim,
  className,
}: {
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Anything in place of the icon: a photo, a colour square. */
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  href?: string;
  trailing?: ReactNode;
  dim?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {Icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-muted">
          <Icon className="size-5" strokeWidth={2.1} />
        </span>
      )}
      {lead}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2 text-base font-semibold">{title}</span>
        {detail && <span className="text-[13px] leading-snug text-muted-foreground">{detail}</span>}
      </span>
    </>
  );
  const cls = cn("flex min-h-[60px] items-center gap-3 py-2", dim && "opacity-60", className);
  if (href && !trailing) {
    return (
      <Link href={href} className={cn(cls, "outline-none hover:bg-accent/40 focus-visible:bg-accent")}>
        {body}
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
      </Link>
    );
  }
  return (
    <div className={cls}>
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 self-stretch outline-none focus-visible:bg-accent">
          {body}
        </Link>
      ) : (
        body
      )}
      {trailing}
    </div>
  );
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
}: {
  href?: string;
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

/** A typical cost beside a paid action, small and tabular. */
export function Cost({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="text-xs tabular-nums text-muted-foreground" title={title}>
      {children}
    </span>
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

/** "That didn't work." with the server's own message when there is one. */
export function errorText(e: unknown, fallback = "That didn't work."): string {
  return e instanceof ApiError ? e.message : fallback;
}

/** "Oct 7" in the viewer's zone; with the year when it isn't this one. */
export function shortDate(iso: string | Date): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" });
}

/** shortDate plus a 12-hour time: "Oct 16, 3:42 PM". */
export function shortDateTime(iso: string | Date): string {
  const time = new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${shortDate(iso)}, ${time}`;
}

/** "3 results", "1 result". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
