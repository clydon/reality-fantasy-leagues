"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import { castawayEarnedStats, castawayEpisodeStats, castawaysEverOwned } from "@/lib/game/active-roster-rows";
import StateLogic from "@/lib/game/state-logic.js";
import { useMyPlayerId } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { CastawayStatRow } from "@/components/castaway-stat-row";
import { DashCard, DashLink } from "./dash-card";

// Second card on Overview, right after Standings -- "what do I personally have in this league,
// right now." Shape depends on the league type, same way the rest of Overview already branches:
//   pickem          -- no roster at all, so this is just your current weekly pick, one line.
//   classic-draft   -- your drafted roster as plain photo cards (boot-order badge still shows --
//                      that's this type's actual score).
//   active-roster   -- your roster as rows with each castaway's stat breakdown already open next to
//                      the photo (CastawayStatRow), since that breakdown IS the point of this type.
export function YourTeamCard({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const terms = useShowTerms();
  const leagueType = StateLogic.getLeagueType(state);

  if (!myPlayerId) return null;

  if (leagueType.hasWeeklyPicks) {
    const ep = StateLogic.pickEmUpcomingEpisode(state);
    const myPick = ep ? StateLogic.pickEmPickFor(state, ep.id, myPlayerId) : null;
    const pickedName = myPick ? StateLogic.getCastaway(state, myPick.castawayId)?.name : null;
    return (
      <DashCard title="Your Pick" wide>
        <p className="text-sm">
          {ep ? (
            <>
              Your Episode {ep.number} Pick to Survive: <b>{pickedName ?? "Not picked yet"}</b>
            </>
          ) : (
            "There's no episode to pick for yet."
          )}
        </p>
        <DashLink href="#pickem-grid">Change your pick ↓</DashLink>
      </DashCard>
    );
  }

  if (!leagueType.hasRoster) return null;
  if (leagueType.hasActiveRoster) return <ActiveRosterTeam state={state} myPlayerId={myPlayerId} />;

  const roster = state.castaways.filter((c) => c.ownerIds.includes(myPlayerId));

  return (
    <DashCard title="Your Team" wide>
      {roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven&rsquo;t drafted any {terms.castaways} yet.</p>
      ) : leagueType.hasActiveRoster ? (
        <div className="flex flex-col gap-2">
          {roster.map((c) => (
            <CastawayStatRow key={c.id} state={state} castaway={c} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
          {roster.map((c) => (
            <CastawayStatCard key={c.id} state={state} castaway={c} showOwner={false} showPoints={false} dimAllEliminated expanded />
          ))}
        </div>
      )}
    </DashCard>
  );
}

// Active Roster's Your Team, with the old Last Week card folded in. Two views:
//   Last week   -- the lineup you fielded in the most recently played episode, best scorer first, with
//                  what each did that episode. Nobody's faded: they all played.
//   Full season -- everyone you've had this season, by the points they earned YOU (only episodes they
//                  were in your lineup count, the same rule as your score).
function ActiveRosterTeam({ state, myPlayerId }: { state: LeagueState; myPlayerId: string }) {
  const terms = useShowTerms();
  const [view, setView] = useState<"week" | "season">("week");

  const lastEp = [...state.episodes]
    .filter((ep) => StateLogic.inPlay(state, ep.number) && StateLogic.episodeHasResults(ep))
    .sort((a, b) => b.number - a.number)[0];

  const rows =
    view === "week"
      ? lastEp
        ? StateLogic.activeRosterLineupFor(state, lastEp.id, myPlayerId)
            .map((id) => StateLogic.getCastaway(state, id))
            .filter((c): c is NonNullable<typeof c> => !!c)
            .map((c) => ({ c, stats: castawayEpisodeStats(state, lastEp.id, c.id) }))
        : []
      : castawaysEverOwned(state, myPlayerId).map((c) => ({ c, stats: castawayEarnedStats(state, myPlayerId, c.id) }));
  rows.sort((a, b) => b.stats.total - a.stats.total || a.c.name.localeCompare(b.c.name));
  const total = StateLogic.roundPoints(rows.reduce((sum, r) => sum + r.stats.total, 0));

  return (
    <DashCard title="Your Team" wide>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-border">
          {(
            [
              ["week", "Last week"],
              ["season", "Full season"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              className={
                "px-2.5 py-1 text-xs font-semibold " +
                (view === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary")
              }
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm">
          <b className="font-mono text-lg">{total}</b>
          <span className="text-muted-foreground">
            {" "}
            pts{view === "week" ? (lastEp ? ` · Episode ${lastEp.number}` : "") : " this season"}
          </span>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {view === "week" && !lastEp
            ? "No episodes played yet."
            : view === "week"
              ? "You didn't field anyone last episode."
              : `You haven't drafted any ${terms.castaways} yet.`}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ c, stats }) => (
            <CastawayStatRow
              key={c.id}
              state={state}
              castaway={c}
              stats={stats}
              fade={view === "season"}
              emptyText={view === "week" ? "Didn't score this episode." : "Didn't score for you."}
            />
          ))}
        </div>
      )}
      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        {view === "week"
          ? `Your active lineup that episode — only fielded ${terms.castaways} score.`
          : `Everyone you've had this season, by the points they earned you while in your lineup.`}
      </p>
      <DashLink href="/research">Go to Research →</DashLink>
    </DashCard>
  );
}
