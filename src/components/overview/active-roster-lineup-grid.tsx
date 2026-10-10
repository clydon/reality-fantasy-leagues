"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useMyPlayerId } from "@/lib/store";
import { lineupStatus } from "@/lib/game/lineup-view";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { CastTile, shortNames } from "@/components/draft/draft-ui";
import { RevealFirst, useHiddenResults } from "@/components/results-in-banner";

// Active Roster on Overview: who you're starting this week (the canvas's AR-Home), as tiles, with your
// bench as small faces underneath. Read-only: "Change" and an open slot go to the Lineup page
// (src/components/lineup/lineup-page.tsx), where it's set. The alert strip above already says when
// it isn't set, so this doesn't repeat it.
export function StartingThisWeek({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const { hidden } = useHiddenResults();

  if (!myPlayerId) return null;
  if (hidden.length > 0) return <RevealFirst what="set your next lineup" />;
  const roster = state.castaways.filter((c) => c.ownerIds.includes(myPlayerId));
  const ep = StateLogic.currentEpisode(state);
  if (roster.length === 0 || !ep) return null;

  const locked = StateLogic.ActiveRosterLogic.isLineupLocked(state, ep.id);
  const { starters, bench, activeSlots, carried } = lineupStatus(state, ep, myPlayerId);
  const names = shortNames(roster);
  const earlier = carried && starters.length > 0;

  return (
    <section id="lineup" className="flex scroll-mt-20 flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="section-title">{locked ? `Episode ${ep.number} starters` : "Starting this week"}</h3>
        {locked ? (
          <span className="text-sm text-muted-foreground">Locked</span>
        ) : (
          <Link href="/lineup" className="-my-3 py-3 text-sm font-semibold text-chyron-line hover:underline">
            Change
          </Link>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {Array.from({ length: Math.max(activeSlots, starters.length) }, (_, i) => {
          const c = starters[i];
          return c ? (
            <CastTile key={c.id} castaway={c} label={names.get(c.id) ?? c.name} state={state} photoHeight={112} />
          ) : locked ? (
            <div key={`open-${i}`} className="min-h-[152px] rounded-[3px] border-2 border-dashed border-border" aria-label="Empty slot" />
          ) : (
            <Link
              key={`open-${i}`}
              href="/lineup"
              className="flex min-h-[152px] flex-col items-center justify-center gap-1.5 rounded-[3px] border-2 border-dashed border-plate-muted text-[13px] text-muted-foreground hover:border-muted-foreground"
            >
              <Plus className="size-[22px]" aria-hidden />
              Open slot
            </Link>
          );
        })}
      </div>
      {(bench.length > 0 || earlier) && (
        <div className="flex min-h-8 flex-wrap items-center gap-2.5 text-sm">
          {bench.length > 0 && <span className="text-muted-foreground">Bench</span>}
          {bench.map((c) => (
            <CastawayAvatar
              key={c.id}
              castaway={c}
              expandable
              className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-bold text-muted-foreground [&_img]:object-top"
            />
          ))}
          {/* Nobody chose for this episode: the last lineup stands in (ActiveRosterLogic.lineupFor). */}
          {earlier && <span className="text-[13px] text-muted-foreground">Same lineup as last week</span>}
        </div>
      )}
    </section>
  );
}
