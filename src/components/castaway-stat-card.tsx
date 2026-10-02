"use client";

import type { ReactNode } from "react";
import type { LeagueState, Castaway, Player, Tribe } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { castawayEventStats } from "@/lib/game/active-roster-rows";
import { medalFor, MEDAL_EMOJI } from "@/lib/game/selectors";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { RoleBadge } from "@/components/role-badge";
import { XMarkIcon } from "@/components/icons";
import { cn } from "cn";

// ⇄ a trade drop, ↓ a replenish drop (an elimination), ↑ anyone added via either -- next to a name
// in a roster list, so a glance at "who's on this roster" also shows how they got there or left.
function movementSymbol(c: Castaway): { symbol: string; title: string } | null {
  if (c.departedVia === "trade") return { symbol: "⇄", title: "Traded away" };
  if (c.departedVia === "replenish") return { symbol: "↓", title: "Eliminated, replenished away" };
  if (c.acquiredVia === "trade") return { symbol: "↑", title: "Added via Swap" };
  if (c.acquiredVia === "replenish") return { symbol: "↑", title: "Added via Replenish" };
  return null;
}

// Up to 2 tribes this castaway was in BEFORE their current one -- original first, most recent
// previous second -- for the small badge(s) at the photo's bottom-left (see the render below).
// Nothing (empty array) if they've never moved, or moved but the league never actually recorded a
// startTribeId (predates GroupLogic, or was never through it).
function previousTribes(state: LeagueState, c: Castaway): Tribe[] {
  if (!c.startTribeId) return [];
  const changes = StateLogic.GroupLogic.changesFor(state, c.id)
    .map((g) => g.tribeId)
    .filter((id): id is string => !!id);
  const history = [c.startTribeId, ...changes]; // ends at the current tribe, once there's been a change
  const beforeCurrent = history.slice(0, -1);
  const seen = new Set<string>();
  const distinct: string[] = [];
  for (const id of beforeCurrent) {
    if (!seen.has(id)) {
      seen.add(id);
      distinct.push(id);
    }
  }
  const picked = distinct.length <= 2 ? distinct : [distinct[0], distinct[distinct.length - 1]];
  return picked.map((id) => state.tribes.find((t) => t.id === id)).filter((t): t is Tribe => !!t);
}

// Active Roster's own castaway card: photo, name, elimination medal/placement, owner tag -- the same
// visuals board-grid.tsx always drew -- plus a points badge overlapping the photo's bottom-right
// corner and an expandable breakdown of what actually earned those points, one line per event
// category the castaway has scored, in the same order as Active Roster Settings' own list.
//
// Shared between two places that both want "a castaway's card with its stats": the Overview board
// (one card per castaway league-wide, click to expand) and the Scoreboard's per-player Roster detail
// (already inside a <details> a player opened, so its cards are simply always expanded -- no second
// click to get to the same information).
export function CastawayStatCard({
  state,
  castaway: c,
  owners = [],
  formerOwner = null,
  showOwner = true,
  showPoints = true,
  showPlacementBadge = true,
  dimAllEliminated = false,
  expanded,
  onToggleExpand,
  children,
}: {
  state: LeagueState;
  castaway: Castaway;
  /** Current owner(s) -- first one colours the border; shared-ownership leagues can have several. */
  owners?: Player[];
  /** Who last owned them, if nobody does now (dropped via replenish/swap). */
  formerOwner?: Player | null;
  /** Hide the owner/former-owner name tag -- for a context (a player's own roster list) where it's redundant. */
  showOwner?: boolean;
  /** Whether there's a points badge / stat breakdown to show at all -- off outside Active Roster leagues. */
  showPoints?: boolean;
  /** Boot-order badge/medal in the corner -- meaningful for Classic Draft (elimination order IS the
      score), not for Active Roster or Eliminator Pool, which don't score on placement at all. The
      elimination X itself still always shows; only the numbered badge/medal is conditional. */
  showPlacementBadge?: boolean;
  /** Grey out the whole card for ANY eliminated castaway, medal or not -- for a "my roster" context
      (My Team, Roster detail) where "still on my team but out of the game" is what matters, not
      whether they placed well. Off by default: the Board still wants a medal winner to read as a
      highlight, not a loss. */
  dimAllEliminated?: boolean;
  expanded: boolean;
  /** Present = the card is clickable and toggles `expanded`; absent = always shown as given (Scoreboard's always-open cards). */
  onToggleExpand?: () => void;
  /** Extra lines under the name -- an Episode Recap's exit method, say. */
  children?: ReactNode;
}) {
  const owner = owners[0] ?? null;
  const medal = c.status === "eliminated" && showPlacementBadge ? medalFor(state, c.placementOrder) : null;
  const dimmed = c.status === "eliminated" && (dimAllEliminated || !medal);
  const stats = showPoints ? castawayEventStats(state, c.id) : null;
  const clickable = showPoints && !!onToggleExpand;
  const movement = movementSymbol(c);
  const priorTribes = previousTribes(state, c);

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-expanded={clickable ? expanded : undefined}
      onClick={onToggleExpand}
      onKeyDown={(e) => clickable && e.key === "Enter" && onToggleExpand?.()}
      className={cn(
        "relative rounded-[10px] border-2 bg-card p-[12px_10px_10px] text-center shadow-sm transition-[transform,box-shadow]",
        clickable && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        dimmed && "opacity-[.55] hover:opacity-80"
      )}
      style={{ borderColor: owner ? owner.color : "var(--border)" }}
    >
      {/* Boot-order badge/medal, card-corner -- only when showPlacementBadge (Classic Draft, where
          elimination order IS the score). The X mark below is independent of this and always shows
          for anyone eliminated, in every league type. */}
      {c.status === "eliminated" &&
        showPlacementBadge &&
        (medal ? (
          <div
            className="absolute right-[5px] top-[5px] z-10 flex h-[27px] w-[27px] items-center justify-center text-[1.1rem]"
            title={medal}
          >
            {MEDAL_EMOJI[medal]}
          </div>
        ) : (
          <div className="absolute right-[5px] top-[5px] z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-destructive font-mono text-[0.66rem] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,.25)]">
            {c.placementOrder}
          </div>
        ))}
      <div className="relative mx-auto mb-2 h-16 w-16">
        <CastawayAvatar
          castaway={c}
          className="flex h-16 w-16 items-center justify-center rounded-[14px] border border-border bg-secondary font-mono text-[1.05rem] font-bold text-muted-foreground"
        />
        {/* Scoped to the avatar box itself (not the whole card) so it stays centered on the photo
            regardless of whether the card is expanded, and never spills past the thumbnail. */}
        {c.status === "eliminated" && !medal && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[14px] bg-black/10" aria-hidden>
            <XMarkIcon className="h-9 w-9 text-destructive drop-shadow-[0_1px_2px_rgba(0,0,0,.4)]" />
          </div>
        )}
        {/* Total points this castaway has scored, all season -- their own record, not any one
            owner's cut of it (benched episodes still count here; see castawayEventStats). */}
        {stats && (
          <div
            className="absolute -bottom-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-card bg-primary px-1 font-mono text-[0.65rem] font-bold leading-none text-primary-foreground"
            title={`${stats.total} point${stats.total === 1 ? "" : "s"} scored`}
          >
            {stats.total}
          </div>
        )}
        {/* Where they started (and, if they've moved more than once, their most recent tribe before
            this one) -- no text, just the tribe's own color, so it reads as "traces of history"
            rather than competing with the points badge on the opposite corner. Two half-overlapping
            circles when there are two: original on the left, more recent on top/right. */}
        {priorTribes.length > 0 && (
          <div className="absolute -bottom-1 -left-1 flex">
            {priorTribes.map((t, i) => (
              <div
                key={t.id}
                className="h-3.5 w-3.5 rounded-full border-2 border-card"
                style={{ background: t.color, marginLeft: i === 0 ? 0 : -6, zIndex: i }}
                title={i === 0 ? `Started in ${t.name}` : `Previously in ${t.name}`}
              />
            ))}
          </div>
        )}
      </div>
      <div className="text-[0.84rem] font-semibold text-foreground">
        {c.name}
        {movement && (
          <span className="ml-1 text-muted-foreground" title={movement.title}>
            {movement.symbol}
          </span>
        )}
        <RoleBadge state={state} castawayId={c.id} />
      </div>
      {showOwner && owners.length > 0 && (
        <div className="mt-[3px] text-[0.7rem] font-semibold text-muted-foreground">{owners.map((o) => o.name).join(", ")}</div>
      )}
      {showOwner && formerOwner && (
        <div
          className="mt-[3px] text-[0.7rem] font-semibold text-muted-foreground line-through"
          title={c.departedVia === "trade" ? "Swapped away" : "Replenished away"}
        >
          {formerOwner.name}
        </div>
      )}
      {children}
      {stats && expanded && (
        <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-left">
          {stats.byType.length === 0 ? (
            <span className="text-[0.7rem] italic text-muted-foreground">Nothing scored yet.</span>
          ) : (
            stats.byType.map((s) => (
              <div key={s.type} className="flex items-center justify-between gap-2 text-[0.7rem]">
                <span className="flex-1 text-muted-foreground">{s.label}</span>
                <span className="shrink-0 font-mono font-semibold">
                  ×{s.count} <span className="text-muted-foreground">({s.count * s.points} pts)</span>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
