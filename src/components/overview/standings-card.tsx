"use client";

import type { Castaway, LeagueState } from "@/lib/game/types";
import { useMyPlayerId } from "@/lib/store";
import { cn } from "cn";
import StateLogic from "@/lib/game/state-logic.js";
import { useHiddenResults } from "@/components/results-in-banner";
import { AsOfPill } from "./latest-episode-card";
import { classicKey, leads, poolKey, rankLabels } from "@/components/scoreboard/scoreboard-tab";
import { latestScoredEpisode } from "@/lib/game/episode-team-summary";
import { teamEpisodeBreakdown } from "@/lib/game/team-episode-breakdown";
import { signed } from "@/lib/game/lineup-view";
import { standingLine, teamOrder } from "@/lib/game/classic-view";
import { finishedPlace } from "@/components/scoreboard/scoreboard-tab";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { isKnockedOut } from "@/lib/game/selectors";
import { pickWindow } from "@/lib/game/pool-view";
import { DashAside, DashCard } from "./dash-card";

// Direct port of renderOverview()'s "Standings" card -- the wide one, using the same
// StateLogic.computeScores(state) the live app and server both call (ScoringLogic.compute
// under the hood). Nothing here re-implements scoring; it's the same shared logic.
export function StandingsCard({ state }: { state: LeagueState }) {
  const scores = StateLogic.computeScores(state);
  // Pick'em ranks by longest streak (total points only break ties -- the Scoreboard has them), so
  // that's the number shown. A wrong or missed pick only resets a streak; nobody's out. While this
  // week's pick is open each row says whether they've picked (never what: that waits until it airs).
  const pickem = StateLogic.getLeagueType(state).hasWeeklyPicks;
  const me = useMyPlayerId();
  const { hidden } = useHiddenResults();
  // Ties read "T1", and nobody's rank is chyron when everyone is level (the Scoreboard's rules).
  const ranks = rankLabels(scores, pickem ? poolKey : classicKey);
  // Active Roster: what each scored in the latest episode, beside the total (the Scoreboard's column).
  const type = StateLogic.getLeagueType(state);
  const lastEp = type.hasActiveRoster ? latestScoredEpisode(state) : null;
  // Classic (the canvas's Classic Home): a team IS the draft and the score is who's still standing,
  // so each row carries its faces, the ones out greyed with where they finished.
  const classic = type.hasRoster && !type.hasActiveRoster && !pickem;
  const week = pickem ? pickWindow(state) : null;
  const pickOpen = week?.open && week.ep ? week.ep : null;

  return (
    <DashCard title="Standings" wide aside={scores.length > 0 && <DashAside href="/scoreboard">Full board</DashAside>}>
      {scores.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add players in League Settings to get started.</p>
      ) : (
        <>
          {/* Results waiting to be revealed: say these are the standings from before them. */}
          {hidden.length > 0 && <AsOfPill state={state} />}
          {pickem && (
            <div className="flex justify-end gap-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              {pickOpen && <span className="w-16 text-center">Ep {pickOpen.number}</span>}
              <span className="min-w-9 text-right">Best</span>
            </div>
          )}
          {scores.map((r, i) => {
            const picked = pickOpen ? !!StateLogic.pickEmPickFor(state, pickOpen.id, r.playerId) : false;
            return (
              // Direction A: condensed tabular rank and score either side, the leader's rank in chyron
              // yellow, your own row lifted so you can find yourself at a glance.
              <div
                key={r.playerId}
                className={cn(
                  "flex min-h-[48px] items-center gap-3 border-t border-border text-base first:border-t-0",
                  classic && "min-h-[62px] py-2",
                  r.playerId === me && "-mx-2 rounded-[3px] bg-muted px-2",
                )}
              >
                <span className={cn("type-num w-8 shrink-0 text-[24px] text-muted-foreground", leads(ranks, i) && "text-chyron-line")}>{ranks[i]}</span>
                {!classic && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />}
                {classic ? (
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                      <span className="truncate font-semibold">{r.name}</span>
                      {r.playerId === me && <YouBadge />}
                      <span className="shrink-0 text-[12px] text-muted-foreground">{standingLine(r.roster)}</span>
                    </span>
                    {r.roster.length > 0 && <TeamFaces state={state} roster={r.roster} />}
                  </span>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-2 truncate font-semibold">
                    {r.name}
                    {r.playerId === me && <YouBadge />}
                  </span>
                )}
                {pickem ? (
                  <>
                    {pickOpen && (
                      <span
                        className={cn(
                          "w-16 shrink-0 rounded-[2px] py-px text-center text-[11px] font-bold uppercase tracking-wide",
                          picked ? "bg-good text-good-foreground" : "bg-input text-foreground",
                        )}
                      >
                        {picked ? "Picked" : "Not yet"}
                      </span>
                    )}
                    <span className="type-num min-w-9 shrink-0 text-right text-[26px]">{r.longestStreak ?? 0}</span>
                  </>
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
    </DashCard>
  );
}

function YouBadge() {
  return <span className="shrink-0 rounded-[2px] bg-foreground px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-background">You</span>;
}

// A Classic team as small faces: still in first, then who's out (greyed, with the place they finished
// in the corner; a winner or finalist keeps their colour). Wraps for a big roster.
function TeamFaces({ state, roster }: { state: LeagueState; roster: Castaway[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {teamOrder(roster).map((c) => {
        const out = c.status === "eliminated";
        const knocked = isKnockedOut(state, c);
        const place = out ? finishedPlace(state, c) : null;
        return (
          <span key={c.id} className="relative" title={place ? `${c.name}, finished ${place}` : c.name}>
            <CastawayAvatar
              castaway={c}
              className={cn(
                "flex size-[30px] items-center justify-center rounded-[2px] bg-secondary text-[10px] font-bold text-muted-foreground [&_img]:object-top",
                knocked && "grayscale brightness-[.6]",
              )}
            />
            {place !== null && (
              <span
                className={cn(
                  "absolute -bottom-[3px] -right-[3px] rounded-[2px] px-[3px] text-[9px] font-extrabold leading-[1.35] tabular-nums",
                  knocked ? "bg-live text-live-foreground" : "bg-good text-good-foreground",
                )}
              >
                {place}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
