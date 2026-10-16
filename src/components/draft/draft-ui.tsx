"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type { Castaway, LeagueState } from "@/lib/game/types";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { RoleBadge } from "@/components/role-badge";
import { cn } from "cn";

// Shared pieces for the draft and the mid-season pickers (docs/PLAN-ux-redesign.md, 2d; the canvas's
// "A · Draft, scouting & mid-season" boards). Every picker on a phone works the same way: tap a tile to
// select it, then confirm in a bar that sits above the tab bar. Nothing is drafted, assigned or swapped
// by a single tap on a tile.

/** First names, with a last initial wherever two castaways in the list share one. */
export function shortNames(cast: Pick<Castaway, "id" | "name">[]): Map<string, string> {
  const first = (n: string) => n.trim().split(/\s+/)[0] || n;
  const counts = new Map<string, number>();
  for (const c of cast) counts.set(first(c.name), (counts.get(first(c.name)) ?? 0) + 1);
  return new Map(
    cast.map((c) => {
      const f = first(c.name);
      if ((counts.get(f) ?? 0) < 2) return [c.id, f];
      const parts = c.name.trim().split(/\s+/);
      return [c.id, parts.length > 1 ? `${f} ${parts[parts.length - 1][0]}.` : c.name];
    }),
  );
}

/** A section heading in condensed caps, with an optional link or note on the right. */
export function SectionHead({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-end justify-between gap-3">
      <h3 className="type-caption pb-1.5 text-[24px]">{children}</h3>
      {aside}
    </div>
  );
}

/**
 * A castaway as a tile: photo on top, first name in condensed caps on a white plate below, tribe
 * under it. A button when `onClick` is given; otherwise read-only. `mark` shows a chyron tick
 * (selected to add) or a red cross (selected to drop).
 */
export function CastTile({
  castaway,
  label,
  state,
  photoHeight = 70,
  mark,
  rank,
  dim,
  onClick,
  disabled,
  detail,
}: {
  castaway: Castaway;
  /** The short name shown on the tile (see shortNames). */
  label: string;
  /** Replaces the tribe line under the name (e.g. "Used Ep 1"). */
  detail?: ReactNode;
  state: LeagueState;
  photoHeight?: number;
  mark?: "add" | "drop";
  /** A ranked claim (waivers): its place in the list, as a numbered chyron badge. */
  rank?: number;
  /** Greyed: can't be picked right now (taken, or the roster's full). */
  dim?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const tribe = castaway.tribeId ? state.tribes.find((t) => t.id === castaway.tribeId) : null;
  const body = (
    <>
      <CastawayAvatar
        castaway={castaway}
        className={cn(
          "flex w-full items-center justify-center bg-muted text-base font-bold text-muted-foreground [&_img]:object-top",
          dim && "[&_img]:brightness-[.6] [&_img]:grayscale",
        )}
      />
      <span className="flex min-w-0 flex-col gap-0.5 px-[7px] pb-1.5 pt-[5px]">
        <span className="type-caption truncate text-[15px]">{label}</span>
        <span className={cn("flex min-h-[14px] min-w-0 items-center gap-1 text-[11px]", dim ? "text-muted-foreground" : "text-plate-muted")}>
          {detail ?? (
            <>
              {tribe && <span className="size-2 shrink-0 rounded-[1px]" style={{ background: tribe.color }} aria-hidden />}
              <span className="truncate">{tribe?.name}</span>
              <RoleBadge state={state} castawayId={castaway.id} />
            </>
          )}
        </span>
      </span>
      {rank !== undefined && (
        <span className="type-num absolute right-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-chyron px-1.5 text-[15px] text-chyron-foreground" aria-hidden>
          {rank}
        </span>
      )}
      {mark && (
        <span
          className={cn(
            "absolute right-1 top-1 flex size-6 items-center justify-center rounded-full",
            mark === "add" ? "bg-chyron text-chyron-foreground" : "bg-live text-white",
          )}
          aria-hidden
        >
          {mark === "add" ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
        </span>
      )}
    </>
  );
  const cls = cn(
    // Fixed photo height on phones (the canvas's tiles); on wide screens the tiles are wider, so the
    // photo keeps a portrait-friendly ratio instead of cropping to a strip of forehead.
    "relative flex min-w-0 flex-col overflow-hidden rounded-[3px] text-left [&>div:first-child]:h-[var(--photo-h)] sm:[&>div:first-child]:aspect-square sm:[&>div:first-child]:h-auto",
    dim ? "bg-muted text-muted-foreground opacity-75" : "bg-plate text-plate-foreground",
    (mark === "add" || rank !== undefined) && "outline-3 outline-offset-2 outline-chyron-line",
    mark === "drop" && "outline-3 outline-offset-2 outline-live",
  );
  const style = { "--photo-h": `${photoHeight}px` } as React.CSSProperties;
  if (!onClick) {
    return (
      <div className={cls} style={style}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cn(cls, "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:cursor-default")}
      style={style}
      aria-pressed={!!mark || rank !== undefined}
      aria-label={rank !== undefined ? `${castaway.name}, choice ${rank}` : castaway.name}
      disabled={disabled}
      onClick={onClick}
    >
      {body}
    </button>
  );
}

// `data-tour`: every picker's tiles and confirm bar are the guided tour's targets for drafting and
// picking up (lib/tour/steps.ts).
/** A grid of tiles: 4 across on a phone (3 for the roomier mid-season pickers), more on wider screens. */
export function TileGrid({ cols = 4, children }: { cols?: 3 | 4; children: ReactNode }) {
  return (
    <div
      data-tour="picker-tiles"
      className={cn(
        "grid gap-2",
        cols === 4 ? "grid-cols-4 sm:grid-cols-6 nav:grid-cols-7" : "grid-cols-3 gap-2.5 sm:grid-cols-5 nav:grid-cols-6",
      )}
    >
      {children}
    </div>
  );
}

/** A small square photo, as in a roster strip; `badge` sits on its top-right corner. */
export function PhotoSquare({
  castaway,
  size = 40,
  badge,
  faded,
  expandable,
}: {
  castaway: Castaway;
  size?: number;
  badge?: ReactNode;
  faded?: boolean;
  expandable?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <CastawayAvatar
        expandable={expandable}
        castaway={castaway}
        className={cn(
          "flex size-full items-center justify-center rounded-[2px] bg-muted text-[11px] font-bold text-muted-foreground [&_img]:object-top",
          faded && "opacity-55 grayscale",
        )}
      />
      {badge}
    </span>
  );
}

/** An empty roster slot: a dashed square with the pick it'll be filled by. */
export function EmptySlot({ size = 40, children }: { size?: number; children?: ReactNode }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[3px] border-2 border-dashed border-input text-[11px] font-bold text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

/** A turn in an order strip: "30 You", "31 Sam". `you` is bone-white like the You badge; `now` gets a chyron edge. */
export function TurnPill({ children, you, now, done }: { children: ReactNode; you?: boolean; now?: boolean; done?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-[3px] px-2.5 text-[13px] font-semibold",
        you ? "bg-foreground text-background" : "bg-card text-foreground",
        now && "shadow-[inset_0_-3px_0_var(--chyron-line)]",
        done && "text-muted-foreground line-through",
      )}
    >
      {children}
    </span>
  );
}

/** Tribe filter chips: "All 18", then each tribe with its colour. Hidden when there are no tribes. */
export function useTribeFilter(cast: Castaway[], state: LeagueState) {
  const [tribeId, setTribeId] = useState<string | null>(null);
  const tribes = state.tribes.filter((t) => cast.some((c) => c.tribeId === t.id));
  // A tribe that's emptied out (everyone picked) drops back to All.
  const active = tribeId && tribes.some((t) => t.id === tribeId) ? tribeId : null;
  const shown = active ? cast.filter((c) => c.tribeId === active) : cast;
  const chips =
    tribes.length < 2 ? null : (
      <div role="group" aria-label="Filter by tribe" className="flex flex-wrap gap-2">
        <FilterChip on={!active} onClick={() => setTribeId(null)}>
          All {cast.length}
        </FilterChip>
        {tribes.map((t) => (
          <FilterChip key={t.id} on={active === t.id} onClick={() => setTribeId(t.id)}>
            <span className="size-2.5 rounded-[2px]" style={{ background: t.color }} aria-hidden />
            {t.name}
          </FilterChip>
        ))}
      </div>
    );
  return { shown, chips };
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-[3px] border px-3.5 text-sm",
        on ? "border-foreground bg-foreground font-bold text-background" : "border-input font-semibold text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The confirm bar: sticks to the bottom of the screen, just above the mobile tab bar, while its
 * picker is on screen. Left: what's selected (or whose turn it is); right: the one action.
 */
export function ConfirmBar({ note, title, children }: { note: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div
      className="sticky bottom-[var(--tabbar-h)] z-40 -mx-4 mt-2 flex items-center gap-3 border-t border-input bg-card px-4 py-3 shadow-bar nav:mx-0 nav:rounded-[3px] nav:border"
      role="status"
      data-confirm-bar
      data-tour="picker-confirm"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-xs text-muted-foreground">{note}</span>
        <span className="type-caption truncate text-[22px]">{title}</span>
      </span>
      {children}
    </div>
  );
}

/** The bar's primary action: chyron, 48px tall. */
export function BarButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-12 max-w-[60%] shrink-0 truncate rounded-[3px] bg-chyron px-4 text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:bg-muted disabled:text-muted-foreground disabled:hover:brightness-100"
    >
      {children}
    </button>
  );
}

/** A plain full-width-on-phones secondary button in the same 48px, square-cornered shape. */
export function PlainButton({
  onClick,
  href,
  danger,
  disabled,
  children,
  className,
  tour,
}: {
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  /** A `data-tour` name, for the guided tour to light it. */
  tour?: string;
}) {
  const cls = cn(
    "flex min-h-12 items-center justify-center gap-1.5 rounded-[3px] border px-4 text-[15px] font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:opacity-40",
    danger ? "border-live/40 text-live hover:bg-live/10" : "border-input bg-card text-foreground hover:bg-secondary",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls} data-tour={tour}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} data-tour={tour}>
      {children}
    </button>
  );
}
