"use client";

import type { Castaway, Episode, LeagueState } from "@/lib/game/types";
import type { ReactNode } from "react";
import StateLogic from "@/lib/game/state-logic.js";
import { episodeRecapWins } from "@/lib/game/episode-recap";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { Button } from "@/components/ui/button";
import { useShowTerms } from "@/lib/use-show-terms";
import { cn } from "cn";

// Every recap card is the same small width, so a tribe reward, a tribe immunity and one boot share a
// single phone line (three ~96px cards inside the episode card's ~320px).
const CARD_W = "w-24 shrink-0";

// The top of an opened EpisodeCard: what happened, as player cards. The episode's headline wins first
// (the format's `recap` list -- Survivor's Reward and Immunity), a whole tribe as one card, then
// everyone who left, each card with how they went. Groups sit side by side and wrap when they don't fit. `onUndoExit` is the commissioner's edit mode.
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
      compact
      className={CARD_W}
    >
      {extra}
    </CastawayStatCard>
  );

  if (wins.length === 0 && exits.length === 0) {
    return <div className="text-sm italic text-muted-foreground">Nothing logged yet.</div>;
  }

  // One labelled group: its heading over a row of cards, stretched to the tallest so they line up.
  const group = (label: string, cards: ReactNode) => (
    <div key={label} className="flex min-w-0 max-w-full flex-col">
      <h5 className="mb-1 text-[0.7rem] font-semibold">{label}</h5>
      <div className="flex flex-1 flex-wrap gap-1.5">{cards}</div>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-3">
      {wins.map((w) =>
        group(
          w.label,
          <>
            {/* A tribe win is one card in the tribe's colour, not every member -- a whole tribe's
                photos would crowd out the rest of the recap. */}
            {w.tribes.map(({ tribe }) => (
              <div
                key={tribe.id}
                className={cn(CARD_W, "flex flex-col items-center justify-center rounded-[10px] border-2 p-1.5 text-center text-white shadow-sm")}
                style={{ background: tribe.color, borderColor: tribe.color }}
              >
                <div className="break-words text-[0.8rem] font-bold uppercase leading-tight tracking-[1px]">{tribe.name}</div>
                <div className="mt-0.5 text-[0.62rem] font-semibold opacity-85">{terms.tribe}</div>
              </div>
            ))}
            {w.castaways.map((c) => card(c))}
          </>
        )
      )}
      {exits.length > 0 &&
        group(
          "Eliminated",
          exits.map(({ ev, c }) =>
            card(
              c,
              <>
                <div className="mt-0.5 text-[0.62rem] leading-tight text-muted-foreground">
                  {ev.method}
                  {typeof ev.juryVotes === "number" && ` · ${ev.juryVotes} jury vote${ev.juryVotes === 1 ? "" : "s"}`}
                </div>
                {onUndoExit && (
                  <Button variant="destructive" size="xs" className="mt-1" onClick={() => onUndoExit(c.id)}>
                    Undo
                  </Button>
                )}
              </>
            )
          )
        )}
    </div>
  );
}
