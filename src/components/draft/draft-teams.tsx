"use client";

import type { Castaway, LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useShowTerms } from "@/lib/use-show-terms";
import { useMyPlayerId } from "@/lib/store";
import { PhotoSquare, shortNames } from "./draft-ui";
import { playersInDraftOrder } from "./draft-helpers";

// Every team's draft picks, in draft order (the canvas's "Your 13" grid, once per player). Shows who
// each player originally drafted, whatever happened since (StateLogic.originalDraftPicks); current
// rosters live on the Scoreboard. `badge` lets the blind reveal mark how many teams share someone.
export function DraftTeams({
  state,
  badge,
  skip,
}: {
  state: LeagueState;
  badge?: (c: Castaway) => React.ReactNode;
  /** A player to leave out (the viewer, when their own team is shown above). */
  skip?: string | null;
}) {
  const me = useMyPlayerId();
  const size = StateLogic.rosterSize(state);
  return (
    <div className="flex flex-col gap-5">
      {playersInDraftOrder(state)
        .filter((p) => p.id !== skip)
        .map((p) => (
          <TeamBlock key={p.id} state={state} player={p} you={p.id === me} size={size} badge={badge} />
        ))}
    </div>
  );
}

function TeamBlock({
  state,
  player,
  you,
  size,
  badge,
}: {
  state: LeagueState;
  player: Player;
  you: boolean;
  size: number;
  badge?: (c: Castaway) => React.ReactNode;
}) {
  const terms = useShowTerms();
  const picks = StateLogic.originalDraftPicks(state, player.id);
  const names = shortNames(picks);
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex min-h-8 items-center gap-2 border-b border-border pb-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: player.color }} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{player.name}</span>
        {you && <YouBadge />}
        <span className="type-num text-[18px] text-muted-foreground">
          {picks.length}/{size}
        </span>
      </div>
      {picks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {terms.castaways} yet.</p>
      ) : (
        <ul className="grid grid-cols-5 gap-x-1.5 gap-y-3 sm:grid-cols-7">
          {picks.map((c) => {
            const gone = !c.ownerIds.includes(player.id);
            return (
              <li key={c.id} className="flex min-w-0 flex-col items-center gap-1">
                <PhotoSquare castaway={c} size={54} faded={c.status === "eliminated" || gone} expandable badge={badge?.(c)} />
                <span className="w-full truncate text-center text-[11px] font-bold">{names.get(c.id)}</span>
                {(c.status === "eliminated" || gone) && (
                  <span className="-mt-1 text-[10px] text-muted-foreground">
                    {gone ? (c.departedVia === "trade" ? "Swapped" : "Replaced") : "Out"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function YouBadge() {
  return <span className="rounded-[2px] bg-foreground px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-background">You</span>;
}
