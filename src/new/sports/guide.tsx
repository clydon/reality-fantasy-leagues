"use client";

import { useMemo, useState } from "react";
import { useCouchTeams, useSportsWeek, type CouchTeam, type WeekGame } from "../data";
import { Avatar } from "../ui/bars";
import { Sheet } from "../ui/sheet";
import { openWatching } from "../watching/sheets";
import { TeamMark, WeekRow } from "./parts";
import { clockOf, useGameScore, useHideSports } from "./scores";
import { openSports } from "./sheets";
import { teamKeyOf } from "@/lib/sports/team-badge";

// The guide's Sports (docs/PLAN-start-a-game-gpt.md U1's sports slice; U0's board "The guide's Sports"): this week's real games,
// a day a column as the guide's reel is, each day leading with the couch's teams' games as cards (its two marks, the faces of who
// follows each under its team, the time, or once begun only what Hide scores lets out), then every other game counted by league,
// a tap away. Nothing picked by hand: the couch's teams are those its people follow and those in its games (team-follows.ts).

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SportsGuide({ couchId }: { couchId: string | null }) {
  const listed = useCouchTeams(couchId).data?.teams;
  const teams = useMemo(() => listed ?? [], [listed]);
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
        return {
          day: d.day,
          label: `${DAY[date.getDay()]} ${date.getDate()}`,
          long: date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }),
          mine,
          leagues: [...byLeague].map(([l, games]) => ({ league: l, name: games[0].leagueName, games })),
        };
      }),
    [week.data, ours]
  );
  const [sel, setSel] = useState(0);
  const day = days[Math.min(sel, days.length - 1)] ?? null;
  return (
    <div data-sports-guide>
      {hidden && (
        <p className="mb-1 px-4 text-[13px] text-muted-foreground" data-scores-hidden>
          Scores hidden: a game that&rsquo;s begun says only when it started.
        </p>
      )}
      {week.isLoading && <p className="px-4 py-6 text-[14px] text-muted-foreground">Loading this week&rsquo;s games…</p>}
      {week.error && <p className="px-4 py-6 text-[14px] text-muted-foreground">Couldn&rsquo;t load this week&rsquo;s games. Try again in a minute.</p>}
      {/* The guide's week (the design round's step 7): the same seven cells as the TV guide's, then the chosen day full width. */}
      {days.length > 0 && (
        <div role="tablist" aria-label="This week's games" className="mx-4 mt-3 grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const on = i === sel;
            const live = d.mine.some((g) => g.state === "in");
            const date = new Date(`${d.day}T12:00:00`);
            return (
              <button
                key={d.day}
                type="button"
                role="tab"
                aria-selected={on}
                data-sports-cell={d.day}
                aria-label={`${i === 0 ? "Today" : DAY[date.getDay()]} ${date.getDate()}, ${d.mine.length} of the couch's games${live ? ", one on now" : ""}`}
                onClick={() => setSel(i)}
                className={`nd-press flex min-h-[74px] flex-col items-center gap-1 rounded-[3px] pb-1.5 pt-2 ${on ? "bg-foreground text-background" : "bg-card"}`}
              >
                <span className={`type-caption text-[13px] tracking-[0.04em] ${on ? "" : i === 0 ? "text-chyron-line" : "text-muted-foreground"}`}>{i === 0 ? "Today" : DAY[date.getDay()]}</span>
                <span className="type-num text-[19px] leading-none">{date.getDate()}</span>
                <span className="flex h-3 items-center gap-[2px]" aria-hidden>
                  {live && <i className="mr-[2px] size-1.5 animate-pulse rounded-full bg-live motion-reduce:animate-none" />}
                  {d.mine.slice(0, 3).map((g) => {
                    const side = g.sides.find((x) => ours.has(`${g.league}|${x.id}`)) ?? g.sides[1];
                    return <i key={g.id} className="size-3 rounded-[2px]" style={{ background: side.color ? `#${side.color}` : "var(--secondary)" }} />;
                  })}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {day && (
        <div role="tabpanel" className="mt-5 flex flex-col gap-2 px-4" data-sports-day={day.day}>
          <h2 className="type-caption mb-1 text-[24px]">{sel === 0 ? "Today" : day.long}</h2>
          {day.mine.map((g) => (
            <GameCard key={g.id} g={g} ours={ours} />
          ))}
          {day.leagues.map((l) => (
            <button
              key={l.league}
              type="button"
              data-sports-league={l.league}
              onClick={() => setLeague({ day: day.label, label: l.name, league: l.league, games: l.games })}
              className="nd-press flex min-h-12 w-full items-center justify-between gap-2 rounded-[4px] border border-border bg-card px-3 text-left"
            >
              <span className="min-w-0 text-[15px] font-bold leading-tight">{l.name}</span>
              <span className="flex-none text-[13px] text-muted-foreground">
                {l.games.length} {l.games.length === 1 ? "game" : "games"}
              </span>
            </button>
          ))}
          {!day.mine.length && !day.leagues.length && !week.isLoading && <p className="text-[15px] text-muted-foreground">No games</p>}
        </div>
      )}
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
        <TeamMark abbr={side.abbreviation ?? side.short.slice(0, 3)} color={side.color} size="sm" team={teamKeyOf(g.league, side.id)} />
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
