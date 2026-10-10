"use client";

import type { LeagueState } from "@/lib/game/types";
import { useMyPlayerId } from "@/lib/store";
import { cn } from "cn";
import StateLogic from "@/lib/game/state-logic.js";
import { useHiddenResults } from "@/components/results-in-banner";
import { AsOfPill } from "./latest-episode-card";
import { classicKey, leads, poolKey, rankLabels } from "@/components/scoreboard/scoreboard-tab";
import { latestScoredEpisode } from "@/lib/game/episode-team-summary";
import { teamEpisodeBreakdown } from "@/lib/game/team-episode-breakdown";
import { signed } from "@/lib/game/lineup-view";
import { DashCard, DashLink } from "./dash-card";

// Direct port of renderOverview()'s "Standings" card -- the wide one, using the same
// StateLogic.computeScores(state) the live app and server both call (ScoringLogic.compute
// under the hood). Nothing here re-implements scoring; it's the same shared logic.
export function StandingsCard({ state }: { state: LeagueState }) {
  const scores = StateLogic.computeScores(state);
  // Pick'em ranks by longest streak (total points only break ties -- the Scoreboard has them), so
  // that's the number shown, with 🔥 when it's still going, or else the streak they're on now. A
  // wrong or missed pick only resets a streak; nobody's out.
  const pickem = StateLogic.getLeagueType(state).hasWeeklyPicks;
  const me = useMyPlayerId();
  const { hidden } = useHiddenResults();
  // Ties read "T1", and nobody's rank is chyron when everyone is level (the Scoreboard's rules).
  const ranks = rankLabels(scores, pickem ? poolKey : classicKey);
  // Active Roster: what each scored in the latest episode, beside the total (the Scoreboard's column).
  const lastEp = StateLogic.getLeagueType(state).hasActiveRoster ? latestScoredEpisode(state) : null;

  return (
    <DashCard title="Standings" wide>
      {scores.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add players in League Settings to get started.</p>
      ) : (
        <>
          {/* Results waiting to be revealed: say these are the standings from before them. */}
          {hidden.length > 0 && <AsOfPill state={state} />}
          {pickem && (
            <div className="flex justify-end text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Best streak</div>
          )}
          {scores.map((r, i) => {
            const best = r.longestStreak ?? 0;
            const now = r.currentStreak ?? 0;
            return (
              // Direction A: condensed tabular rank and score either side, the leader's rank in chyron
              // yellow, your own row lifted so you can find yourself at a glance.
              <div
                key={r.playerId}
                className={cn(
                  "flex min-h-[48px] items-center gap-3 border-t border-border text-base first:border-t-0",
                  r.playerId === me && "-mx-2 rounded-[3px] bg-muted px-2",
                )}
              >
                <span className={cn("type-num w-8 shrink-0 text-[24px] text-muted-foreground", leads(ranks, i) && "dark:text-chyron")}>{ranks[i]}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="flex min-w-0 flex-1 items-center gap-2 truncate font-semibold">
                  {r.name}
                  {r.playerId === me && (
                    <span className="rounded-[2px] bg-foreground px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-background">You</span>
                  )}
                </span>
                {pickem ? (
                  <span className="flex shrink-0 items-baseline gap-1.5 font-mono">
                    {best > 0 && now === best ? (
                      <span className="text-xs" title="Still going">🔥</span>
                    ) : (
                      now > 0 && <span className="text-xs text-muted-foreground">now {now}</span>
                    )}
                    <b className="min-w-[1.5ch] text-right">{best}</b>
                  </span>
                ) : (
                  <>
                    {lastEp && (
                      <span className="shrink-0 text-[13px] text-muted-foreground" title={`Episode ${lastEp.number}`}>
                        {signed(teamEpisodeBreakdown(state, lastEp.id, r.playerId).total)}
                      </span>
                    )}
                    <span className="type-num min-w-9 shrink-0 text-right text-[26px]">{r.total}</span>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
      <DashLink href="/scoreboard">View full scoreboard →</DashLink>
    </DashCard>
  );
}
