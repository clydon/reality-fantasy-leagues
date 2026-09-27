"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import { castawayEarnedStats, castawayEpisodeStats, castawayRosterStats, castawaysEverOwned } from "@/lib/game/active-roster-rows";
import StateLogic from "@/lib/game/state-logic.js";
import { useMyPlayerId } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { CastawayStatRow } from "@/components/castaway-stat-row";
import { DashCard, DashLink } from "./dash-card";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "cn";

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
  // Full season: points they scored for you (only while in your lineup), or everything they scored
  // while on your roster, benched weeks included.
  const [scoredForYou, setScoredForYou] = useState(true);
  // Whose stats: yours by default, and back to yours whenever the page is opened again (plain state,
  // never saved).
  const [viewId, setViewId] = useState(myPlayerId);
  const [menuOpen, setMenuOpen] = useState(false);
  const viewing = StateLogic.getPlayer(state, viewId);
  const mine = viewId === myPlayerId;
  const others = state.players.filter((p) => !p.disabled);

  const lastEp = [...state.episodes]
    .filter((ep) => StateLogic.inPlay(state, ep.number) && StateLogic.episodeHasResults(ep))
    .sort((a, b) => b.number - a.number)[0];

  const rows =
    view === "week"
      ? lastEp
        ? StateLogic.activeRosterLineupFor(state, lastEp.id, viewId)
            .map((id) => StateLogic.getCastaway(state, id))
            .filter((c): c is NonNullable<typeof c> => !!c)
            .map((c) => ({ c, stats: castawayEpisodeStats(state, lastEp.id, c.id) }))
        : []
      : castawaysEverOwned(state, viewId).map((c) => ({
          c,
          stats: scoredForYou ? castawayEarnedStats(state, viewId, c.id) : castawayRosterStats(state, viewId, c.id),
        }));
  rows.sort((a, b) => b.stats.total - a.stats.total || a.c.name.localeCompare(b.c.name));
  const total = StateLogic.roundPoints(rows.reduce((sum, r) => sum + r.stats.total, 0));
  // Last week's bench: everyone on your roster you didn't field, and what they'd have scored. Not in
  // the total -- benched points were never yours. Anyone already out before that episode isn't shown.
  const fieldedIds = new Set(rows.map((r) => r.c.id));
  const bench =
    view === "week" && lastEp
      ? state.castaways
          .filter((c) => c.ownerIds.includes(viewId) && !fieldedIds.has(c.id))
          .filter((c) => {
            const outEp = c.exitEpisodeId ? state.episodes.find((e) => e.id === c.exitEpisodeId) : null;
            return !outEp || outEp.number >= lastEp.number;
          })
          .map((c) => ({ c, stats: castawayEpisodeStats(state, lastEp.id, c.id) }))
          .sort((a, b) => b.stats.total - a.stats.total || a.c.name.localeCompare(b.c.name))
      : [];

  return (
    <DashCard
      title={
        <div className="relative">
          <button
            className="flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
          >
            {mine ? "Your Stats" : `${viewing?.name ?? "?"}'s Stats`}
            <ChevronDownIcon className={cn("h-3.5 w-3.5 transition-transform", menuOpen && "rotate-180")} />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-[min(80vw,240px)] rounded-lg border border-border bg-card p-1.5 normal-case tracking-normal shadow-md">
              {others.map((p) => (
                <button
                  key={p.id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-semibold text-foreground hover:bg-secondary",
                    p.id === viewId && "bg-secondary"
                  )}
                  onClick={() => {
                    setViewId(p.id);
                    setMenuOpen(false);
                  }}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="flex-1 truncate">{p.id === myPlayerId ? `You (${p.name})` : p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      }
      wide
      aside={
        <span className="text-sm">
          <b className="font-mono text-lg">{total}</b>
          <span className="text-muted-foreground">
            {" "}
            pts{view === "week" ? (lastEp ? ` · Episode ${lastEp.number}` : "") : scoredForYou ? " this season" : " incl. bench"}
          </span>
        </span>
      }
    >
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
        {view === "season" && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={scoredForYou} onChange={(e) => setScoredForYou(e.target.checked)} />
            {mine ? "Scored for you only" : "Scored for them only"}
          </label>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {view === "week" && !lastEp
            ? "No episodes played yet."
            : view === "week"
              ? mine ? "You didn't field anyone last episode." : `${viewing?.name ?? "They"} didn't field anyone last episode.`
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
      {bench.length > 0 && (
        <>
          <div className="my-2.5 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Bench — not scored</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-2 opacity-80">
            {bench.map(({ c, stats }) => (
              <CastawayStatRow key={c.id} state={state} castaway={c} stats={stats} fade={false} emptyText="Didn't score this episode." />
            ))}
          </div>
        </>
      )}
      {view === "season" && (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          {scoredForYou
            ? "Everyone you've had this season, by the points they earned you while in your lineup."
            : "Everyone you've had this season, by everything they scored while on your roster — benched weeks included."}
        </p>
      )}
      <DashLink href="/research">Go to Research →</DashLink>
    </DashCard>
  );
}
