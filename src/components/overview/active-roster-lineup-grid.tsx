"use client";

import type { Castaway, LeagueState } from "@/lib/game/types";
import { sortByTribe } from "@/lib/game/sort-by-tribe";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { XMarkIcon } from "@/components/icons";
import { useShowTerms } from "@/lib/use-show-terms";
import { cn } from "cn";
import { RevealFirst, useHiddenResults } from "@/components/results-in-banner";
import { formatInTz } from "@/lib/game/air-schedule.js";

// Active Roster: YOUR lineup for the current episode (StateLogic.currentEpisode): an Active row of
// activeSlots slots (empty ones as dashed outlines), then the rest of your roster by current tribe.
// Tap a roster card to field it (up to activeSlots), tap a starter to bench it -- the same
// tap-to-toggle interaction as Eliminator Pool's pick grid (pickem-pick-grid.tsx),
// since both are "this week's choice from your people" even though the rule underneath differs (field
// up to N to score vs. pick exactly one to survive).
//
// Self-service only, like the pick grid: this sets YOUR OWN lineup. Setting a lineup on behalf of
// another player (an inactive one, say) isn't offered here -- see episode-active-roster-section.tsx
// for what the episode card still shows (read-only, plus the commissioner's lock).
export function ActiveRosterLineupGrid({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const myPlayerId = useMyPlayerId();
  const { hidden: hiddenResults } = useHiddenResults();
  const mutate = useMutate();

  if (!myPlayerId) return null;
  if (hiddenResults.length > 0) return <RevealFirst what="set your next lineup" />;
  const roster = state.castaways.filter((c) => c.ownerIds.includes(myPlayerId));
  if (roster.length === 0) return null;

  const ep = StateLogic.currentEpisode(state);
  const activeSlots = state.settings.activeSlots;
  // Open until the episode starts airing (or has results, or a commissioner locked it by hand).
  const locked = !ep || StateLogic.ActiveRosterLogic.isLineupLocked(state, ep.id);
  const lineup = ep ? StateLogic.activeRosterLineupFor(state, ep.id, myPlayerId) : [];
  const starters = lineup.map((id) => roster.find((c) => c.id === id)).filter((c): c is Castaway => !!c);
  const bench = [
    ...sortByTribe(roster.filter((c) => !lineup.includes(c.id) && c.status !== "eliminated"), state),
    ...roster.filter((c) => !lineup.includes(c.id) && c.status === "eliminated"),
  ];

  async function toggle(castawayId: string) {
    if (!ep || locked || !myPlayerId) return;
    const active = lineup.includes(castawayId);
    if (!active && lineup.length >= activeSlots) return;
    const next = active ? lineup.filter((id) => id !== castawayId) : [...lineup, castawayId];
    await mutate(
      (s) => StateLogic.setActiveRosterLineup(s, ep.id, myPlayerId, next),
      () => api.setActiveRosterLineup(leagueId!, ep.id, myPlayerId, next)
    );
  }

  return (
    <div id="lineup" className="mb-5 scroll-mt-20 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          {ep ? `Your lineup for episode ${ep.number}` : "Your lineup"}
        </h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {lineup.length}/{activeSlots} active
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {!ep
          ? "There's no episode to field a lineup for yet."
          : locked
            ? `Episode ${ep.number} has started — lineups are locked.`
            : `Tap a ${terms.castaway} in your roster to start them, or a starter to bench them — only active ones score.${
                ep.airsAt ? ` Locks when it airs, ${formatInTz(new Date(ep.airsAt), localTz())}.` : ""
              }`}
      </p>
      {/* Active: one slot per active spot, filled in lineup order; an empty one is a dashed outline of
          a card, waiting for someone from the roster below. */}
      <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Active</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-x-2.5 gap-y-4 pt-2">
        {Array.from({ length: Math.max(activeSlots, lineup.length) }, (_, i) => {
          const c = starters[i];
          return c ? (
            <LineupCard key={c.id} state={state} castaway={c} active showTribe canTap={!locked && !!ep} onTap={() => toggle(c.id)} />
          ) : (
            <div
              key={`empty-${i}`}
              className="flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border p-2"
              aria-label="Empty slot"
            >
              <div className="h-11 w-11 rounded-lg border-2 border-dashed border-border" />
              <span className="text-[0.65rem] text-muted-foreground">Empty</span>
            </div>
          );
        })}
      </div>

      <div className="my-4 h-px bg-border" />

      {/* The roster: everyone not starting, by current tribe (a swap or merge shows as it stands),
          eliminated last. */}
      <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Roster</div>
      {bench.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">Everyone on your roster is starting.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-x-2.5 gap-y-4 pt-2">
          {bench.map((c) => (
            <LineupCard
              key={c.id}
              state={state}
              castaway={c}
              active={false}
              showTribe
              // Fielding someone new isn't possible once they're out or the slots are full.
              canTap={!locked && !!ep && c.status !== "eliminated" && lineup.length < activeSlots}
              onTap={() => toggle(c.id)}
            />
          ))}
        </div>
      )}

      <ScoringChart state={state} />
    </div>
  );
}

function LineupCard({
  state,
  castaway: c,
  active,
  canTap,
  showTribe,
  onTap,
}: {
  state: LeagueState;
  castaway: Castaway;
  active: boolean;
  canTap: boolean;
  showTribe?: boolean;
  onTap: () => void;
}) {
  const out = c.status === "eliminated";
  const tribe = showTribe && c.tribeId ? state.tribes.find((t) => t.id === c.tribeId) : null;
  return (
    <button
      type="button"
      disabled={!canTap}
      onClick={onTap}
      title={out ? `${c.name} is out` : undefined}
      className={cn(
        "relative flex min-h-[104px] flex-col items-center gap-1.5 rounded-lg border-2 bg-card p-2 text-center transition-colors",
        active ? "border-primary bg-primary/5" : "border-border",
        canTap && "cursor-pointer hover:border-primary",
        out && "opacity-[.55] saturate-[.75]"
      )}
    >
      {/* Current tribe, centred on the card's top edge above the photo. */}
      {tribe && (
        <span
          className="absolute -top-2 left-1/2 max-w-[90%] -translate-x-1/2 truncate rounded-full px-1.5 py-px text-[0.55rem] font-bold uppercase tracking-wide text-white shadow-sm"
          style={{ background: tribe.color }}
        >
          {tribe.name}
        </span>
      )}
      <div className="relative mt-1 h-11 w-11">
        <CastawayAvatar castaway={c} className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-xs font-bold" />
        {out && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/10" aria-hidden>
            <XMarkIcon className="h-7 w-7 text-destructive drop-shadow-[0_1px_2px_rgba(0,0,0,.4)]" />
          </div>
        )}
      </div>
      <span className="text-xs font-medium leading-tight">{c.name}</span>
    </button>
  );
}

// What each event is worth in this league, collapsed by default -- for deciding who to start.
// Grouped by the show's own categories (format.eventCategories: Challenges, Tribal Council, Endgame...)
// in that order, highest points first within each; zero-point events are left out as noise, and a
// category with nothing left is skipped.
function ScoringChart({ state }: { state: LeagueState }) {
  const format = StateLogic.formatOf(state);
  const row = (id: string) => {
    const def = format.events.find((e) => e.id === id);
    return def ? { id, label: def.label, points: StateLogic.ActiveRosterLogic.pointsFor(state, id) } : null;
  };
  const listed = new Set(format.eventCategories.flatMap((c) => c.events));
  const groups = [
    ...format.eventCategories.map((c) => ({ id: c.id, label: c.label, ids: c.events })),
    { id: "other", label: "Other", ids: format.events.map((e) => e.id).filter((id) => !listed.has(id)) },
  ]
    .map((g) => ({
      ...g,
      rows: g.ids
        .map(row)
        .filter((r): r is NonNullable<typeof r> => !!r && r.points !== 0)
        .sort((a, b) => b.points - a.points),
    }))
    .filter((g) => g.rows.length > 0);
  if (groups.length === 0) return null;
  return (
    <details className="mt-4 border-t border-border pt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">How starters score</summary>
      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id}>
            <div className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{g.label}</div>
            {g.rows.map((r) => (
              <div key={r.id} className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1 text-xs">
                <span className="min-w-0 text-muted-foreground">{r.label}</span>
                <span className={cn("shrink-0 font-mono font-semibold", r.points > 0 ? "text-good" : "text-destructive")}>
                  {r.points > 0 ? `+${r.points}` : r.points}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

// The viewer's own time zone, for "locks when it airs" -- the schedule itself is in the show's.
function localTz(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
