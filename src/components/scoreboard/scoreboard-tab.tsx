"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Castaway, LeagueState, ScoreRow } from "@/lib/game/types";
import { useCanManage, useLeagueStore, useMyPlayerId } from "@/lib/store";
import { latestScoredEpisode } from "@/lib/game/episode-team-summary";
import { scoredEpisodes, teamEpisodeBreakdown } from "@/lib/game/team-episode-breakdown";
import { playerPickRows } from "@/lib/game/pickem-rows";
import StateLogic from "@/lib/game/state-logic.js";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { MoreButton } from "@/components/setup/settings-ui";
import { cn } from "cn";
import { EpisodeLinesModal } from "./episode-summary-modal";
import { YourSeason } from "./your-season";
import { useShowTerms } from "@/lib/use-show-terms";

// The Scoreboard (docs/PLAN-ux-redesign.md, 2f; the canvas's "Standings" boards): one compact list in
// the shape of each league type's scoring, every row opening that player's own page
// (/scoreboard/[player], player-score-page.tsx) with the detail -- roster, episodes, picks,
// predictions -- that used to sit in disclosures under every row.
//   Classic: each team's faces, the ones out greyed with where they finished.
//   Active Roster: a table of the last few episodes, the week's best score marked.
//   Eliminator Pool: streak, best and points, then everyone's settled picks.
export function ScoreboardTab() {
  const state = useLeagueStore((s) => s.state);
  const scores = StateLogic.computeScores(state);
  const type = StateLogic.getLeagueType(state);
  const canManage = useCanManage();
  const leagueId = useLeagueStore((s) => (s.mode === "live" ? s.leagueId : null));
  const [menuOpen, setMenuOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  // The commissioner writes every team's "why it mattered" line for the latest episode (Active
  // Roster). Live leagues only: there's no server to save to in demo mode.
  const ar = type.hasActiveRoster && !type.hasWeeklyPicks;
  const latest = ar ? latestScoredEpisode(state) : null;
  const canWrite = !!(latest && canManage && leagueId);
  const through = lastScored(state);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-h-11 items-center gap-3">
        <h2 className="type-caption flex-1 text-[28px] max-nav:hidden">Scoreboard</h2>
        <span className="text-sm text-muted-foreground max-nav:flex-1">{through ? `After episode ${through}` : "No results yet"}</span>
        {canWrite && <MoreButton label="Scoreboard actions" onClick={() => setMenuOpen(true)} className="-mr-2" />}
      </div>

      {scores.length === 0 ? (
        <p className="text-base text-muted-foreground">Add players in League Settings to get started.</p>
      ) : type.hasWeeklyPicks ? (
        <PoolBoard state={state} scores={scores} />
      ) : ar ? (
        <ActiveRosterBoard state={state} scores={scores} />
      ) : (
        <ClassicBoard state={state} scores={scores} />
      )}

      {menuOpen && latest && (
        <BottomSheet open onOpenChange={(o) => !o && setMenuOpen(false)} title="Scoreboard">
          <SheetAction
            onClick={() => {
              setMenuOpen(false);
              setWriting(true);
            }}
          >
            Write episode {latest.number} lines
          </SheetAction>
        </BottomSheet>
      )}
      {writing && latest && leagueId && (
        <EpisodeLinesModal
          leagueId={leagueId}
          epId={latest.id}
          epNumber={latest.number}
          teams={scores.map((r) => ({ id: r.playerId, name: r.name, color: r.color }))}
          onClose={() => setWriting(false)}
        />
      )}
    </div>
  );
}

/** The latest episode this viewer has results for, or null. */
function lastScored(state: LeagueState): number | null {
  const n = state.episodes.filter((ep) => !ep.resultsHidden && StateLogic.episodeHasResults(ep)).map((ep) => ep.number);
  return n.length ? Math.max(...n) : null;
}

/** "1", or "T1" when someone else has the same score. `key` is what the list is ranked by. */
export function rankLabels(scores: ScoreRow[], key: (r: ScoreRow) => number[]): string[] {
  const k = scores.map((r) => key(r).join(","));
  return scores.map((_, i) => {
    const first = k.indexOf(k[i]);
    const tied = k.lastIndexOf(k[i]) !== first;
    return `${tied ? "T" : ""}${first + 1}`;
  });
}

/** Whether row i is (joint) leader -- not when everyone's level, where nobody leads. */
export const leads = (ranks: string[], i: number) => ranks[i] === ranks[0] && ranks.some((r) => r !== ranks[0]);

export const classicKey = (r: ScoreRow) => [r.total];
export const poolKey = (r: ScoreRow) => [r.longestStreak ?? 0, r.total];

/** "1st", "2nd", "21st". */
export function ordinal(n: number) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
}

/** Where a castaway who's out finished: the winner 1st, the first one out last. */
export function finishedPlace(state: LeagueState, c: Castaway): number | null {
  return c.placementOrder ? state.castaways.length - c.placementOrder + 1 : null;
}

function YouBadge() {
  return <span className="rounded-[2px] bg-foreground px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-background">You</span>;
}

/** One player's row: the whole thing links to their page. Your own row is lifted. */
function PlayerLink({ id, me, className, children }: { id: string; me: boolean; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/scoreboard/${encodeURIComponent(id)}`}
      className={cn(
        "flex border-t border-border outline-none hover:bg-accent/40 focus-visible:bg-accent",
        me && "-mx-4 bg-muted px-4 nav:-mx-2 nav:rounded-[3px] nav:px-2",
        className
      )}
    >
      {children}
    </Link>
  );
}

function Rank({ label, first }: { label: string; first: boolean }) {
  return <span className={cn("type-num w-8 shrink-0 text-[26px] text-muted-foreground", first && "text-chyron-line")}>{label}</span>;
}

// ---- Classic: last team standing ----

function ClassicBoard({ state, scores }: { state: LeagueState; scores: ScoreRow[] }) {
  const me = useMyPlayerId();
  const terms = useShowTerms();
  const ranks = rankLabels(scores, classicKey);
  const bonus = state.settings.bonusEnabled;
  return (
    <div className="flex flex-col">
      <div className="flex flex-col border-b border-border">
        {scores.map((r, i) => {
          const team = [...r.roster].sort((a, b) => Number(a.status === "eliminated") - Number(b.status === "eliminated"));
          const standing = team.filter((c) => c.status !== "eliminated").length;
          const extra = [bonus && r.bonus !== 0 && `predictions +${r.bonus}`, r.finale !== 0 && `finale +${r.finale}`].filter(Boolean);
          const size = team.length > 5 ? "size-9" : "size-[50px]";
          return (
            <PlayerLink key={r.playerId} id={r.playerId} me={r.playerId === me} className="flex-col gap-2.5 py-3">
              <span className="flex items-center gap-3">
                <Rank label={ranks[i]} first={leads(ranks, i)} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[17px] font-semibold">
                    <span className="truncate">{r.name}</span>
                    {r.playerId === me && <YouBadge />}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {team.length === 0 ? "No team yet" : standing === team.length ? `All ${team.length} standing` : `${standing} of ${team.length} standing`}
                    {extra.length > 0 && ` · ${extra.join(" · ")}`}
                  </span>
                </span>
                <span className="type-num text-[32px]">{r.total}</span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
              </span>
              {team.length > 0 && (
                <span className="flex flex-wrap gap-x-2.5 gap-y-2 pl-11">
                  {team.map((c) => {
                    const out = c.status === "eliminated";
                    const place = out ? finishedPlace(state, c) : null;
                    return (
                      <span key={c.id} className="flex w-[54px] flex-col items-center gap-0.5">
                        <CastawayAvatar
                          castaway={c}
                          className={cn(
                            size,
                            "flex items-center justify-center rounded-[2px] bg-secondary text-xs font-bold [&_img]:object-top",
                            out && "grayscale brightness-[.6]"
                          )}
                        />
                        {out ? (
                          <span className="type-num text-[15px] text-live">{place ? ordinal(place) : "Out"}</span>
                        ) : (
                          <span className="text-[11px] font-bold uppercase text-good">In</span>
                        )}
                        <span className="w-full truncate text-center text-[11px] text-muted-foreground">{c.name.split(" ")[0]}</span>
                      </span>
                    );
                  })}
                </span>
              )}
            </PlayerLink>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        A {terms.castaway} who goes out scores their place in the boot order: first out scores 1, the winner most.
        {bonus ? " Right predictions add their points." : ""}
      </p>
    </div>
  );
}

// ---- Active Roster: a table of the last few episodes ----

function ActiveRosterBoard({ state, scores }: { state: LeagueState; scores: ScoreRow[] }) {
  const me = useMyPlayerId();
  const ranks = rankLabels(scores, classicKey);
  // The last three scored episodes, oldest on the left; each column's best score is marked.
  const eps = scoredEpisodes(state).slice(0, 3).reverse();
  const grid = scores.map((r) => eps.map((ep) => teamEpisodeBreakdown(state, ep.id, r.playerId).total));
  const best = eps.map((_, j) => Math.max(...grid.map((row) => row[j])));
  const col = "w-11 shrink-0 text-center";
  return (
    <div className="flex flex-col">
      <div className="flex min-h-[30px] items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <span className="w-8 shrink-0" />
        <span className="flex-1">Player</span>
        {eps.map((ep) => (
          <span key={ep.id} className={col}>
            Ep {ep.number}
          </span>
        ))}
        <span className="w-14 shrink-0 text-right">Total</span>
        <span className="w-5 shrink-0" />
      </div>
      <div className="flex flex-col border-b border-border">
        {scores.map((r, i) => (
          <PlayerLink key={r.playerId} id={r.playerId} me={r.playerId === me} className="min-h-[54px] items-center gap-1">
            <Rank label={ranks[i]} first={leads(ranks, i)} />
            <span className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold">
              <span className="truncate">{r.name}</span>
              {r.playerId === me && <YouBadge />}
            </span>
            {grid[i].map((n, j) => (
              <span key={eps[j].id} className={cn("type-num text-[22px]", col, n === best[j] && n > 0 && "text-chyron-line")}>
                {n}
              </span>
            ))}
            <span className="type-num w-14 shrink-0 text-right text-[28px]">{r.total}</span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
          </PlayerLink>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        {eps.length > 0 && "Yellow marks the best score of each episode. "}Tap a player for their roster and every episode.
      </p>
      {me && scores.some((r) => r.playerId === me) && (
        <div className="mt-6">
          <YourSeason state={state} playerId={me} />
        </div>
      )}
    </div>
  );
}

// ---- Eliminator Pool: streaks, then everyone's settled picks ----

function PoolBoard({ state, scores }: { state: LeagueState; scores: ScoreRow[] }) {
  const me = useMyPlayerId();
  const ranks = rankLabels(scores, poolKey);
  const col = "w-12 shrink-0 text-center";
  // Settled picks only: what someone picked for an episode that hasn't played out stays theirs
  // (pickem-pick-grid.tsx's rule). The last five, oldest on the left.
  const settled = [...new Set(scores.flatMap((r) => playerPickRows(state, r.playerId).filter((p) => p.correct !== null).map((p) => p.episode)))]
    .sort((a, b) => a - b)
    .slice(-5);
  return (
    <>
      <div className="flex flex-col">
        <div className="flex min-h-[30px] items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span className="w-8 shrink-0" />
          <span className="flex-1">Player</span>
          <span className={col}>Streak</span>
          <span className={col}>Best</span>
          <span className={col}>Points</span>
          <span className="w-5 shrink-0" />
        </div>
        <div className="flex flex-col border-b border-border">
          {scores.map((r, i) => (
            <PlayerLink key={r.playerId} id={r.playerId} me={r.playerId === me} className="min-h-[54px] items-center gap-1">
              <Rank label={ranks[i]} first={leads(ranks, i)} />
              <span className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold">
                <span className="truncate">{r.name}</span>
                {r.playerId === me && <YouBadge />}
              </span>
              <span className={cn("type-num text-[24px]", col)}>{r.currentStreak ?? 0}</span>
              <span className={cn("type-num text-[24px]", col)}>{r.longestStreak ?? 0}</span>
              <span className={cn("type-num text-[24px] text-muted-foreground", col)}>{r.total}</span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
            </PlayerLink>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">Ranked by best streak, then points.</p>
      </div>

      {settled.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="type-caption text-[24px]">Pick history</h3>
          <div className="flex flex-col border-b border-border">
            <div className="flex min-h-[30px] items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <span className="min-w-0 flex-1">Player</span>
              {settled.map((n) => (
                <span key={n} className="w-11 shrink-0 text-center">
                  Ep {n}
                </span>
              ))}
            </div>
            {scores.map((r) => {
              const rows = playerPickRows(state, r.playerId);
              return (
                <div key={r.playerId} className="flex min-h-[56px] items-center gap-1.5 border-t border-border">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.playerId === me ? "You" : r.name}</span>
                  {settled.map((n) => {
                    const p = rows.find((x) => x.episode === n);
                    const c = p?.castawayId ? StateLogic.getCastaway(state, p.castawayId) : undefined;
                    return (
                      <span key={n} className="flex w-11 shrink-0 justify-center" title={p?.castawayName ? `Ep ${n}: ${p.castawayName}${p.correct ? "" : " (went home)"}` : `Ep ${n}: no pick`}>
                        {c ? (
                          <span className="relative">
                            <CastawayAvatar
                              castaway={c}
                              className={cn(
                                "flex size-10 items-center justify-center rounded-[2px] bg-secondary text-[10px] font-bold [&_img]:object-top",
                                !p?.correct && "grayscale brightness-[.6]"
                              )}
                            />
                            {!p?.correct && (
                              <span className="absolute -bottom-1 -right-1 rounded-[2px] bg-live px-1 text-[9px] font-extrabold text-live-foreground">OUT</span>
                            )}
                          </span>
                        ) : (
                          <span className="flex size-10 items-center justify-center rounded-[2px] border border-dashed border-border text-muted-foreground">–</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
