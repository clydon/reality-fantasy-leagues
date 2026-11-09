"use client";

import { useSyncExternalStore } from "react";
import { useSportsWeek, useTeamSchedule } from "../data";
import { Sheet } from "../ui/sheet";
import { MoreAction, PlayPlate, SportsLabel, WeekRow } from "./parts";
import { begun } from "./scores";
import { useStartSport } from "./start";
import { SportStartSheet, type SportTarget } from "./start-sport";
import { GameView, TeamView, type StartWhen } from "./team";

// The sports sheets (docs/PLAN-start-a-game-gpt.md U1's sports slice): a team's (a sheet, as the user decided 2026-11-08), one of
// its games, a league's week, and Start a game on any of them, opened from anywhere (the guide's Sports, a search's row, a sport's
// season) with openSports. Add a show draws a team as a step of its own sheet instead (watching/sheets.tsx), on the same TeamView.

export type SportsView =
  | { kind: "team"; league: string; team: string }
  | { kind: "game"; league: string; team: string; game: string }
  | { kind: "league"; league: string; leagueName: string }
  | { kind: "start"; target: SportTarget; back?: SportsView };

let current: { view: SportsView | null; n: number } = { view: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Open a team's sheet, a game's, a league's week, or Start a game on one; null closes them. */
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
  const close = (o: boolean) => !o && openSports(null);
  const browse = view && view.kind !== "start" ? view : null;
  return (
    <>
      <Sheet
        key={`sports-${n}`}
        open={!!browse}
        onOpenChange={close}
        title={browse?.kind === "league" ? browse.leagueName : browse?.kind === "game" ? "A game" : "A team"}
        back={browse?.kind === "game" ? { label: "Back to the team", onClick: () => openSports({ kind: "team", league: browse.league, team: browse.team }) } : undefined}
      >
        {browse?.kind === "team" && (
          <TeamView
            league={browse.league}
            team={browse.team}
            onStart={(when, name) => openSports(startOn(browse.league, browse.team, name, when, browse))}
            onGame={(g) => openSports({ kind: "game", league: browse.league, team: browse.team, game: g.id })}
            onStarted={() => openSports(null)}
          />
        )}
        {browse?.kind === "game" && <GameFromSchedule league={browse.league} team={browse.team} game={browse.game} />}
        {browse?.kind === "league" && <LeagueView league={browse.league} leagueName={browse.leagueName} onStarted={() => openSports(null)} />}
      </Sheet>
      <SportStartSheet
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
  return <GameView g={g} s={s} onStarted={() => openSports(null)} onStart={(when) => openSports(startOn(league, team, s.team.short, when, { kind: "game", league, team, game }))} />;
}

/** A league's week (U0's board: "a league opens This week and Next week, each row a game"): Play this week's games (Pick'em on every
 *  game still to come, one tap), and the season week by week (Start a game on its slate). */
export function LeagueView({ league, leagueName, onStarted }: { league: string; leagueName: string; onStarted?: () => void }) {
  const week = useSportsWeek(null, [league]);
  const { start, busy } = useStartSport();
  const now = Date.now();
  const days = (week.data?.days ?? []).map((d) => ({ ...d, games: d.games.filter((g) => g.league === league) })).filter((d) => d.games.length);
  const left = days.flatMap((d) => d.games).filter((g) => !begun(g, now)).length;
  return (
    <div data-league-view={league}>
      <p className="text-[14px] leading-snug text-muted-foreground">A week&rsquo;s games make one episode: pick&rsquo;em on every game, or a season-long league.</p>
      {left > 0 && (
        <PlayPlate
          data="week"
          disabled={busy}
          title="Play this week's games"
          line={`Pick'em on every game still to come · ${left} ${left === 1 ? "game" : "games"} · tells the couch`}
          onClick={() => void start({ league, slate: {}, game: "pickem", only: true }, onStarted)}
        />
      )}
      <MoreAction
        data="league-season"
        title="Play the season, week by week"
        line="A season-long league, or pick'em every week"
        onClick={() => {
          onStarted?.();
          openSports({ kind: "start", target: { kind: "slate", league, leagueName }, back: { kind: "league", league, leagueName } });
        }}
      />
      {week.isLoading && <p className="mt-4 text-[14px] text-muted-foreground">Loading this week&rsquo;s games…</p>}
      {days.map((d) => (
        <div key={d.day}>
          <SportsLabel>{new Date(`${d.day}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</SportsLabel>
          {d.games.map((g) => (
            <WeekRow
              key={g.id}
              g={g}
              onClick={() => {
                onStarted?.();
                openSports({ kind: "team", league, team: g.sides[1].id });
              }}
            />
          ))}
        </div>
      ))}
      {!week.isLoading && !days.length && <p className="mt-4 text-[14px] text-muted-foreground">No {leagueName} games this week.</p>}
    </div>
  );
}
