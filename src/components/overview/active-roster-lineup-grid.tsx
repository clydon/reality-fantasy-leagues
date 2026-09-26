"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { useShowTerms } from "@/lib/use-show-terms";
import { cn } from "cn";

// Active Roster: YOUR lineup for the current episode (StateLogic.currentEpisode), as a grid of your
// whole drafted roster. Tap a card to field it (up to activeSlots), tap an active one again to bench
// it -- the same tap-to-toggle interaction as Eliminator Pool's pick grid (pickem-pick-grid.tsx),
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
  const mutate = useMutate();

  if (!myPlayerId) return null;
  const roster = state.castaways.filter((c) => c.ownerIds.includes(myPlayerId));
  if (roster.length === 0) return null;

  const ep = StateLogic.currentEpisode(state);
  const activeSlots = state.settings.activeSlots;
  const locked = !ep || !!ep.lineupsLocked;
  const lineup = ep ? StateLogic.activeRosterLineupFor(state, ep.id, myPlayerId) : [];

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
    <div className="mb-5 rounded-lg border border-border bg-card p-4 shadow-sm">
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
            ? "Lineups are locked for this episode."
            : `Tap up to ${activeSlots} ${terms.castaways} to field them this episode — only active ones score.`}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2.5">
        {roster.map((c) => {
          const out = c.status === "eliminated";
          const active = lineup.includes(c.id);
          // Benching an already-active castaway is always allowed (including one just eliminated);
          // fielding a new one isn't, once they're out or the slots are full.
          const canTap = !locked && !!ep && (active || (!out && lineup.length < activeSlots));
          return (
            <button
              key={c.id}
              type="button"
              disabled={!canTap}
              onClick={() => toggle(c.id)}
              title={out ? `${c.name} is out` : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-lg border-2 bg-card p-2 text-center transition-colors",
                active ? "border-primary bg-primary/5" : "border-border",
                canTap && "cursor-pointer hover:border-primary",
                out && !active && "opacity-45 grayscale"
              )}
            >
              <CastawayAvatar
                castaway={c}
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-xs font-bold"
              />
              <span className="text-xs font-medium leading-tight">{c.name}</span>
              {active && (
                <span className="rounded bg-primary px-1.5 py-px text-[0.6rem] font-bold text-primary-foreground">Active</span>
              )}
              {out && (
                <span
                  className="pointer-events-none absolute inset-0 flex items-center justify-center text-[2.75rem] font-black text-destructive"
                  aria-hidden
                >
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
