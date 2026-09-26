"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { XMarkIcon } from "@/components/icons";
import { useShowTerms } from "@/lib/use-show-terms";
import { cn } from "cn";

// Pick'em: YOUR pick for the upcoming episode, as a grid of the whole cast. Everyone's picks live on
// the Episodes tab; this is the one thing each player does every week, so it sits on Overview.
//
// Each card is one of:
//   your pick     -- highlighted
//   available     -- tap to pick
//   used          -- grayed, with the episode you picked them in: already picked this cycle (no one
//                    twice until you've picked everyone still in the game), or last time (never back
//                    to back). See PickEmLogic.eligibility for both rules.
//   eliminated    -- a big X
export function PickEmPickGrid({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const myPlayerId = useMyPlayerId();
  const mutate = useMutate();

  if (!myPlayerId) return null;
  const ep = StateLogic.pickEmUpcomingEpisode(state);
  const history = StateLogic.pickEmHistory(state, myPlayerId);
  const closed = !ep || ep.events.length > 0;
  const eligibility = ep ? StateLogic.pickEmEligibility(state, ep.id, myPlayerId) : { available: [], blocked: {} };
  const myPick = ep ? StateLogic.pickEmPickFor(state, ep.id, myPlayerId) : null;

  async function pick(castawayId: string) {
    if (!ep || closed || !myPlayerId) return;
    await mutate(
      (s) => StateLogic.setPickEmPick(s, ep.id, myPlayerId, castawayId),
      () => api.setPickEmPick(leagueId!, ep.id, myPlayerId, castawayId)
    );
  }

  return (
    <div id="pickem-grid" className="mb-5 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          {ep ? `Your pick for episode ${ep.number}` : "Your pick"}
        </h3>
        <span className="ml-auto text-xs text-muted-foreground">
          Streak <b className="text-foreground">{history.currentStreak}</b> · Longest{" "}
          <b className="text-foreground">{history.longestStreak}</b> · {history.total} pts
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {!ep
          ? "There's no episode to pick for yet."
          : closed
          ? "Picks are closed — this episode's results are in."
          : myPick
            ? `Picked ${StateLogic.getCastaway(state, myPick.castawayId)?.name ?? "?"} to survive. Tap another to change it.`
            : `Pick a ${terms.castaway} you think survives this episode. No repeats until you've picked everyone still in, and never the same one twice in a row.`}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2.5">
        {state.castaways.map((c) => {
          const out = c.status === "eliminated";
          const mine = myPick?.castawayId === c.id;
          const used = eligibility.blocked[c.id];
          const canPick = !closed && !out && !mine && eligibility.available.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={!canPick}
              onClick={() => pick(c.id)}
              title={
                out
                  ? `${c.name} is out`
                  : used
                    ? used.reason === "backToBack"
                      ? `Your last pick (episode ${used.episode}) -- not twice in a row`
                      : `Already picked this cycle (episode ${used.episode})`
                    : undefined
              }
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-lg border-2 bg-card p-2 text-center transition-colors",
                mine ? "border-primary bg-primary/5" : "border-border",
                canPick && "cursor-pointer hover:border-primary",
                (used || out) && !mine && "opacity-45 grayscale"
              )}
            >
              <div className="relative h-11 w-11">
                <CastawayAvatar
                  castaway={c}
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-xs font-bold"
                />
                {out && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/10" aria-hidden>
                    <XMarkIcon className="h-7 w-7 text-destructive drop-shadow-[0_1px_2px_rgba(0,0,0,.4)]" />
                  </div>
                )}
              </div>
              <span className="text-xs font-medium leading-tight">{c.name}</span>
              {mine && <span className="rounded bg-primary px-1.5 py-px text-[0.6rem] font-bold text-primary-foreground">Your pick</span>}
              {used && !out && !mine && (
                <span className="rounded bg-muted-foreground px-1.5 py-px text-[0.6rem] font-bold text-white">
                  Ep. {used.episode}
                  {used.reason === "backToBack" ? " · last" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
