"use client";

import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { castawayEarnedStats, castawayRosterStats, castawaysEverOwned } from "@/lib/game/active-roster-rows";
import { scoredEpisodes } from "@/lib/game/team-episode-breakdown";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { cn } from "cn";

// Active Roster's "Your season" under the Scoreboard table (the canvas's AR-Scoreboard): four
// one-line answers about how you've used your roster. Earned points only count episodes someone was
// in your lineup (castawayEarnedStats, the same rule as your score); benched is what they scored on
// your roster while not starting. A card with no answer yet is left out.
export function YourSeason({ state, playerId }: { state: LeagueState; playerId: string }) {
  const eps = scoredEpisodes(state);
  if (eps.length === 0) return null;
  const pts = (n: number) => `${n} pt${n === 1 ? "" : "s"}`;
  const rows = castawaysEverOwned(state, playerId).map((c) => {
    const earned = castawayEarnedStats(state, playerId, c.id).total;
    const benched = StateLogic.roundPoints(castawayRosterStats(state, playerId, c.id).total - earned);
    const starts = eps.filter((ep) => StateLogic.activeRosterLineupFor(state, ep.id, playerId).includes(c.id)).length;
    const everStarted = state.episodes.some(
      (ep) => StateLogic.inPlay(state, ep.number) && StateLogic.activeRosterLineupFor(state, ep.id, playerId).includes(c.id)
    );
    return { c, earned, benched, starts, everStarted };
  });
  const top = <K extends "earned" | "benched" | "starts">(key: K, list = rows) =>
    [...list].filter((r) => r[key] > 0).sort((a, b) => b[key] - a[key] || a.c.name.localeCompare(b.c.name))[0];

  const best = top("earned");
  const bench = top("benched");
  const most = top("starts");
  const never = [...rows]
    .filter((r) => !r.everStarted && r.c.ownerIds.includes(playerId))
    .sort((a, b) => b.benched - a.benched || a.c.name.localeCompare(b.c.name))[0];

  const cards = [
    best && { label: "Best starter", c: best.c, value: pts(best.earned) },
    bench && { label: "Most left on the bench", c: bench.c, value: pts(bench.benched), quiet: true },
    most && { label: "Most starts", c: most.c, value: `${most.starts} of ${eps.length}` },
    never && { label: "Never started", c: never.c, value: never.benched > 0 ? `${pts(never.benched)} benched` : "No points yet", quiet: true },
  ].filter((x): x is { label: string; c: Castaway; value: string; quiet?: boolean } => !!x);
  if (cards.length === 0) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="type-caption text-[24px]">Your season</h3>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {cards.map(({ label, c, value, quiet }) => (
          <div key={label} className="flex min-w-0 flex-col gap-1.5 rounded-[4px] bg-card px-3.5 py-3">
            <span className="truncate text-[13px] text-muted-foreground">{label}</span>
            <span className="flex min-w-0 items-center gap-2.5">
              <CastawayAvatar
                castaway={c}
                expandable
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-muted text-[11px] font-bold text-muted-foreground [&_img]:object-top"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] font-semibold">{c.name.split(/\s+/)[0]}</span>
                <span className={cn("type-num truncate text-[20px]", quiet && "text-muted-foreground")}>{value}</span>
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
