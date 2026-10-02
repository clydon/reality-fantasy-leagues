"use client";

import type { Castaway, Episode, LeagueState } from "@/lib/game/types";
import type { ReactNode } from "react";
import StateLogic from "@/lib/game/state-logic.js";
import { episodeRecapWins } from "@/lib/game/episode-recap";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { Button } from "@/components/ui/button";
import { useShowTerms } from "@/lib/use-show-terms";

const CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5";

// The top of an opened EpisodeCard: what happened, as player cards. The episode's headline wins first
// (the format's `recap` list -- Survivor's Reward and Immunity), a whole tribe as one card, then
// everyone who left, each card with how they went. `onUndoExit` is the commissioner's edit mode.
export function EpisodeRecap({
  ep,
  state,
  onUndoExit,
}: {
  ep: Episode;
  state: LeagueState;
  onUndoExit?: (castawayId: string) => void;
}) {
  const terms = useShowTerms();
  const wins = episodeRecapWins(state, ep);
  // Boot order is only the score in a Classic league -- elsewhere the corner number is noise.
  const showPlacement = !StateLogic.getLeagueType(state).hasActiveRoster;
  const exits = ep.events
    .map((ev) => ({ ev, c: StateLogic.getCastaway(state, ev.castawayId) }))
    .filter((x): x is { ev: (typeof ep.events)[number]; c: Castaway } => !!x.c);

  const card = (c: Castaway, extra?: ReactNode) => (
    <CastawayStatCard
      key={c.id}
      state={state}
      castaway={c}
      owners={c.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is NonNullable<typeof p> => !!p)}
      showPoints={false}
      showPlacementBadge={showPlacement}
      expanded={false}
    >
      {extra}
    </CastawayStatCard>
  );

  if (wins.length === 0 && exits.length === 0) {
    return <div className="text-sm italic text-muted-foreground">Nothing logged yet.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {wins.map((w) => (
        <div key={w.label}>
          <h5 className="mb-1.5 text-xs font-semibold">{w.label}</h5>
          {/* A tribe win is one card in the tribe's colour, not every member -- a whole tribe's photos
              would crowd out the rest of the recap. Same grid as the player cards beside it. */}
          <div className={CARD_GRID}>
            {w.tribes.map(({ tribe }) => (
              <div
                key={tribe.id}
                className="flex min-h-[120px] flex-col items-center justify-center rounded-[10px] border-2 p-[12px_10px_10px] text-center text-white shadow-sm"
                style={{ background: tribe.color, borderColor: tribe.color }}
              >
                <div className="text-[0.95rem] font-bold uppercase tracking-[1px]">{tribe.name}</div>
                <div className="mt-1 text-[0.68rem] font-semibold opacity-85">{terms.tribe}</div>
              </div>
            ))}
            {w.castaways.map((c) => card(c))}
          </div>
        </div>
      ))}
      {exits.length > 0 && (
        <div>
          <h5 className="mb-1.5 text-xs font-semibold">Eliminated</h5>
          <div className={CARD_GRID}>
            {exits.map(({ ev, c }) =>
              card(
                c,
                <>
                  <div className="mt-1 text-[0.68rem] leading-tight text-muted-foreground">
                    {ev.method}
                    {typeof ev.juryVotes === "number" && ` · ${ev.juryVotes} jury vote${ev.juryVotes === 1 ? "" : "s"}`}
                  </div>
                  {onUndoExit && (
                    <Button variant="destructive" size="xs" className="mt-1.5" onClick={() => onUndoExit(c.id)}>
                      Undo
                    </Button>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
