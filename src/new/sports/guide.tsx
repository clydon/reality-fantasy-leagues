"use client";

import { useMemo, useState } from "react";
import { useCouchTeams, useSportsWeek, type CouchTeam, type WeekGame } from "../data";
import { Avatar } from "../ui/bars";
import { Sheet } from "../ui/sheet";
import { openWatching } from "../watching/sheets";
import { TeamMark, WeekRow } from "./parts";
import { clockOf, useGameScore, useHideSports } from "./scores";
import { openSports } from "./sheets";

// The guide's Sports (docs/PLAN-start-a-game-gpt.md U1's sports slice; U0's board "The guide's Sports"): this week's real games,
// a day a column as the guide's reel is, each day leading with the couch's teams' games as cards (its two marks, the faces of who
// follows each under its team, the time, or once begun only what Hide scores lets out), then every other game counted by league,
// a tap away. Nothing picked by hand: the couch's teams are those its people follow and those in its games (team-follows.ts).

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SportsGuide({ couchId }: { couchId: string | null }) {
  const teams = useCouchTeams(couchId).data?.teams ?? [];
  const also = [...new Set(teams.map((t) => t.league))];
  const week = useSportsWeek(null, also);
  const hidden = useHideSports();
  const [league, setLeague] = useState<{ day: string; label: string; league: string; games: WeekGame[] } | null>(null);
  const ours = useMemo(() => new Map(teams.map((t) => [`${t.league}|${t.id}`, t])), [teams]);
  const days = useMemo(
    () =>
      (week.data?.days ?? []).map((d) => {
        const mine = d.games.filter((g) => g.sides.some((s) => ours.has(`${g.league}|${s.id}`)));
        const rest = d.games.filter((g) => !mine.includes(g));
        const byLeague = new Map<string, WeekGame[]>();
        for (const g of rest) byLeague.set(g.league, [...(byLeague.get(g.league) ?? []), g]);
        const date = new Date(`${d.day}T12:00:00`);
        return { day: d.day, label: `${DAY[date.getDay()]} ${date.getDate()}`, mine, leagues: [...byLeague].map(([l, games]) => ({ league: l, name: games[0].leagueName, games })) };
      }),
    [week.data, ours]
  );
  return (
    <div data-sports-guide>
      {hidden && (
        <p className="mb-1 px-4 text-[13px] text-muted-foreground" data-scores-hidden>
          Scores hidden: a game that&rsquo;s begun says only when it started.
        </p>
      )}
      {week.isLoading && <p className="px-4 py-6 text-[14px] text-muted-foreground">Loading this week&rsquo;s games…</p>}
      {week.error && <p className="px-4 py-6 text-[14px] text-muted-foreground">Couldn&rsquo;t load this week&rsquo;s games. Try again in a minute.</p>}
      <div role="list" aria-label="This week's games" className="flex snap-x snap-proximity scroll-pl-4 gap-2.5 overflow-x-auto px-4 pb-2 pt-0.5 [scrollbar-width:none]">
        {days.map((d) => (
          <div key={d.day} role="listitem" className="flex w-[158px] flex-none snap-start flex-col gap-1.5" data-sports-day={d.day}>
            <p className="type-caption mb-0.5 text-[16px]">{d.label}</p>
            {d.mine.map((g) => (
              <GameCard key={g.id} g={g} ours={ours} />
            ))}
            {d.leagues.map((l) => (
              <button
                key={l.league}
                type="button"
                data-sports-league={l.league}
                onClick={() => setLeague({ day: d.label, label: l.name, league: l.league, games: l.games })}
                className="nd-press flex min-h-11 w-full items-center justify-between gap-2 rounded-[4px] border border-border bg-card px-2.5 text-left"
              >
                <span className="min-w-0 text-[13px] font-bold leading-tight">{l.name}</span>
                <span className="flex-none text-[12px] text-muted-foreground">
                  {l.games.length} {l.games.length === 1 ? "game" : "games"}
                </span>
              </button>
            ))}
            {!d.mine.length && !d.leagues.length && !week.isLoading && <p className="text-[12px] text-muted-foreground">No games</p>}
          </div>
        ))}
      </div>
      {!teams.length && !week.isLoading && (
        <p className="px-4 pt-1 text-[13px] leading-snug text-muted-foreground" data-sports-guide-note>
          Your couch&rsquo;s teams lead each day once someone follows one.{" "}
          <button type="button" className="font-bold text-foreground underline underline-offset-[3px]" onClick={() => openWatching({ kind: "add" })}>
            Find a team
          </button>
        </p>
      )}
      <Sheet open={!!league} onOpenChange={(o) => !o && setLeague(null)} title={league?.label ?? ""} subtitle={league?.day}>
        {league && (
          <div data-sports-league-sheet={league.league}>
            {league.games.map((g) => (
              <WeekRow
                key={g.id}
                g={g}
                onClick={() => {
                  setLeague(null);
                  openSports({ kind: "team", league: g.league, team: g.sides[1].id });
                }}
              />
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** A couch team's game: the two marks with the faces of who follows each, the time or what Hide scores lets out, the note. */
function GameCard({ g, ours }: { g: WeekGame; ours: Map<string, CouchTeam> }) {
  const s = useGameScore(g);
  const mineSide = g.sides.find((x) => ours.has(`${g.league}|${x.id}`)) ?? g.sides[1];
  const line = (side: WeekGame["sides"][number]) => {
    const t = ours.get(`${g.league}|${side.id}`);
    return (
      <span className="flex min-h-7 items-center gap-2">
        <TeamMark abbr={side.abbreviation ?? side.short.slice(0, 3)} color={side.color} size="sm" />
        <span className="flex min-w-0">
          {(t?.followers ?? []).slice(0, 3).map((f) => (
            <span key={f.id} className="-mr-1.5 rounded-full shadow-[0_0_0_2px_var(--card)]">
              <Avatar id={f.id} name={f.name} size={22} />
            </span>
          ))}
        </span>
        {s.open && s.started && side.score != null && <span className="ml-auto text-[18px] font-extrabold tabular-nums">{side.score}</span>}
      </span>
    );
  };
  return (
    <button
      type="button"
      data-sports-card={g.id}
      aria-label={`${g.sides[0].short} at ${g.sides[1].short}, ${s.started ? s.when : g.at ? clockOf(g.at) : "time to be set"}`}
      onClick={() => openSports({ kind: "team", league: g.league, team: mineSide.id })}
      className="nd-press flex h-[108px] w-full flex-col gap-1.5 rounded-[4px] border border-border bg-card px-2.5 pb-2 pt-[9px] text-left"
    >
      {line(g.sides[0])}
      {line(g.sides[1])}
      <span className="mt-auto flex items-baseline justify-between gap-2 text-[12px]">
        <span className="flex-none font-bold">{s.started ? s.when : g.at ? clockOf(g.at) : "TBD"}</span>
        <span className="min-w-0 truncate font-semibold text-muted-foreground">{g.leagueName}</span>
      </span>
    </button>
  );
}
