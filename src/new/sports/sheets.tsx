"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useHome, useMySportsGames, useSportsWeek, useTeamSchedule } from "../data";
import { useNav } from "../nav";
import { paths } from "../routes";
import { Sheet } from "../ui/sheet";
import { MoreAction, OpenRow, PlayPlate, SportsLabel, WeekRow } from "./parts";
import { begun, useNow } from "./scores";
import { useStartSport } from "./start";
import { SportStartHandoff, type SportTarget } from "./start-handoff";
import { GameView, type StartWhen } from "./team";

// The sports sheets (docs/PLAN-start-a-game-gpt.md U1's sports slice): one game's, and Start a game on a team's games, opened from
// anywhere (the guide's Sports, a search's row, a sport's season) with openSports. A team opened this way goes to its page
// (docs/PLAN-sports-couch.md B2: src/new/screens/team-page.tsx; it was a sheet until then), as a league goes to its own (B1:
// src/new/screens/league-page.tsx, built from the league's parts below).

export type SportsView =
  | { kind: "team"; league: string; team: string }
  | { kind: "game"; league: string; team: string; game: string }
  | { kind: "start"; target: SportTarget; back?: SportsView };

let current: { view: SportsView | null; n: number } = { view: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Open a team's sheet, a game's, or Start a game on one; null closes them. */
export function openSports(view: SportsView | null) {
  current = { view, n: current.n + (view ? 1 : 0) };
  emit();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useView = () => useSyncExternalStore(subscribe, () => current, () => current);

/** The Start a game a team's sheet opens, by what was picked. */
export const startOn = (league: string, team: string, teamName: string, when: StartWhen, back?: SportsView): SportsView => ({
  kind: "start",
  target: { kind: "team", league, team, teamName, when },
  back,
});

export function SportsSheets() {
  const { view, n } = useView();
  const nav = useNav();
  const close = (o: boolean) => !o && openSports(null);
  // A team is a page now (B2): opening one pushes it, and nothing stays open here.
  useEffect(() => {
    if (view?.kind !== "team") return;
    openSports(null);
    nav.push(paths.team(view.league, view.team));
  }, [view, nav]);
  const browse = view && view.kind === "game" ? view : null;
  // The sheet's title is the matchup ("Cowboys at Giants", B4), read from the team's schedule the sheet reads anyway.
  const sched = useTeamSchedule(browse?.league ?? null, browse?.team ?? null).data;
  const sg = browse ? sched?.games.find((x) => x.id === browse.game) : null;
  const title = sched && sg ? `${(sg.home === false ? sched.team : sg.opponent)?.short ?? "To be decided"} at ${(sg.home === false ? sg.opponent : sched.team)?.short ?? "To be decided"}` : "A game";
  return (
    <>
      <Sheet
        key={`sports-${n}`}
        open={!!browse}
        onOpenChange={close}
        title={title}
      >
        {browse && <GameFromSchedule league={browse.league} team={browse.team} game={browse.game} />}
      </Sheet>
      <SportStartHandoff
        key={`sports-start-${n}`}
        target={view?.kind === "start" ? view.target : null}
        onOpenChange={close}
        onBack={view?.kind === "start" && view.back ? () => openSports(view.back!) : undefined}
      />
    </>
  );
}

function GameFromSchedule({ league, team, game }: { league: string; team: string; game: string }) {
  const sched = useTeamSchedule(league, team);
  const s = sched.data;
  const g = s?.games.find((x) => x.id === game);
  if (!s || !g) return <p className="text-[14px] text-muted-foreground">{sched.isLoading ? "Loading…" : "That game isn't on their schedule."}</p>;
  return (
    <GameView
      g={g}
      s={s}
      onStarted={() => openSports(null)}
      onStart={(when) => openSports(startOn(league, team, s.team.short, when, { kind: "game", league, team, game }))}
      onSlate={() => openSports({ kind: "start", target: { kind: "slate", league, leagueName: s.leagueName ?? league }, back: { kind: "game", league, team, game } })}
    />
  );
}

/** Your games in a league (each game of yours on one of its sports seasons) and the move due in each: a league's page's This week
 *  and Games (docs/PLAN-sports-couch.md B1). */
export function useLeagueGames(league: string) {
  const home = useHome().data;
  const seasons = useMySportsGames(true).data?.seasons;
  const here = new Set((seasons ?? []).filter((s) => s.league === league).map((s) => s.seasonId));
  const yours = (home?.shows ?? []).filter((s) => here.has(s.seasonId)).flatMap((s) => s.games.filter((g) => !g.archived).map((g) => ({ g, seasonId: s.seasonId })));
  const moveOf = (leagueId: string) => home?.moves.find((m) => m.leagueId === leagueId) ?? null;
  const moves = yours.map(({ g }) => moveOf(g.leagueId)).filter((m): m is NonNullable<typeof m> => !!m);
  return { yours, moveOf, moves, due: moves.length > 0, ready: !!home && !!seasons };
}

/** Your games in a league, each its due move in its own words (chyron-line) or Open the game, the move's own door. */
export function LeagueGameRows({ league, quiet }: { league: string; quiet?: boolean }) {
  const { yours, moveOf } = useLeagueGames(league);
  const nav = useNav();
  if (!yours.length) return null;
  return (
    <div data-league-yours>
      {yours.map(({ g, seasonId }) => {
        const m = moveOf(g.leagueId);
        return (
          <OpenRow
            key={g.leagueId}
            data={`yours-${g.leagueId}`}
            title={g.name}
            // `quiet`: a page whose strip already says the move (This week) keeps it muted here, said once in yellow.
            line={m ? <span className={quiet ? "font-semibold" : "font-semibold text-chyron-line"}>{m.text}</span> : "Open the game"}
            onClick={() => nav.push(m?.href ?? paths.show(seasonId), { channel: true })}
          />
        );
      })}
    </div>
  );
}

/** A league's week of games (`from`: the week's first day in the East, else from today; `to` its last), that league's alone. */
export function useLeagueWeek(league: string, from: string | null = null, to: string | null = null, enabled = true) {
  const week = useSportsWeek(from, [league], enabled, { only: true, to });
  const days = (week.data?.days ?? [])
    .filter((d) => !to || d.day <= to)
    .map((d) => ({ ...d, games: d.games.filter((g) => g.league === league) }))
    .filter((d) => d.games.length);
  return { days, games: days.flatMap((d) => d.games), loading: week.isLoading, error: week.isError, refetch: week.refetch };
}

/**
 * Starting a game on a league (U0's board: "a league opens This week and Next week"): Play this week's games (Pick'em on every game
 * still to come, one tap) and the season week by week. The one yellow only while nothing of yours is due (the One Chyron Rule).
 */
export function LeagueStart({ league, leagueName, from, to, quiet, rows }: { league: string; leagueName: string; from?: string | null; to?: string | null; quiet?: boolean; rows?: boolean }) {
  const { games } = useLeagueWeek(league, from ?? null, to ?? null);
  const { due } = useLeagueGames(league);
  const { start, busy, couch } = useStartSport();
  const now = useNow();
  const left = games.filter((g) => !begun(g, now)).length;
  // A sports start needs a couch today (C4 brings solo play): with none, nothing here that would only say so (the Games tab's
  // spec: a solo player's This week offered a start that dead-ended).
  if (!couch) return null;
  const play = () => void start({ league, slate: {}, game: "pickem", only: true });
  return (
    <div data-league-start>
      {/* `quiet` (This week): never the yellow there, and only this week's; the season is the Games tab's. */}
      {/* The plate's line stops at the count: "· tells the couch" wrapped it to three lines (the Games tab's check); the toast says
          the couch hears. `rows` (Games): when it isn't the plate, a start is a quiet row, not a box (PFD: boxes outweighed a due move). */}
      {left > 0 &&
        (due || quiet ? (
          rows ? (
            <OpenRow data="week" title="Play this week's games" line={`Pick'em on every game still to come · ${left} ${left === 1 ? "game" : "games"}`} onClick={play} />
          ) : (
            <MoreAction data="week" title="Play this week's games" line={`Pick'em on every game still to come · ${left} ${left === 1 ? "game" : "games"}`} onClick={play} />
          )
        ) : (
          <PlayPlate data="week" disabled={busy} title="Play this week's games" line={`Pick'em on every game still to come · ${left} ${left === 1 ? "game" : "games"}`} onClick={play} />
        ))}
      {!quiet &&
        (rows ? (
          <OpenRow data="league-season" title="Play the season, week by week" line="A season-long league, or pick'em every week" onClick={() => openSports({ kind: "start", target: { kind: "slate", league, leagueName } })} />
        ) : (
          <MoreAction
            data="league-season"
            title="Play the season, week by week"
            line="A season-long league, or pick'em every week"
            onClick={() => openSports({ kind: "start", target: { kind: "slate", league, leagueName } })}
          />
        ))}
    </div>
  );
}

/** A league's week, day by day, each game the guide's row (a tap: the home side's sheet). */
export function LeagueDays({ league, leagueName, from, to }: { league: string; leagueName: string; from?: string | null; to?: string | null }) {
  const { days, loading } = useLeagueWeek(league, from ?? null, to ?? null);
  return (
    <div data-league-days>
      {loading && <p className="mt-4 text-[14px] text-muted-foreground">Loading this week&rsquo;s games…</p>}
      {days.map((d) => (
        <div key={d.day}>
          <SportsLabel>{new Date(`${d.day}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</SportsLabel>
          {d.games.map((g) => (
            <WeekRow key={g.id} g={g} onClick={() => openSports({ kind: "team", league, team: g.sides[1].id })} />
          ))}
        </div>
      ))}
      {!loading && !days.length && <p className="mt-4 text-[14px] text-muted-foreground">No {leagueName} games this week.</p>}
    </div>
  );
}
