"use client";

// The couch's sports day, shared by the hub's next thing (sections.tsx UpNext: a game's plate in its teams' colours) and Bands'
// scoreboard (bands.tsx): the couch's teams, their games this week, and a sports season's own game (the design round's step 7).

import { useEffect, useState } from "react";
import { useCouchTeams, useSportsWeek, type HomeShow, type WeekGame } from "../data";

export type Fan = { id: string; name: string };

/** The wall clock, moved on each minute. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/**
 * The couch's teams' week, read only when the couch follows or plays a team (the guide's Sports reads the same): their games today
 * that aren't over (on now first), every game of theirs this week, a sports season's own game (matched by its start), and who on
 * the couch follows a side.
 */
export function useSportsDay(couchId: string | null) {
  const now = useMinuteClock();
  const teams = useCouchTeams(couchId).data?.teams ?? [];
  const leagues = [...new Set(teams.map((t) => t.league))];
  const week = useSportsWeek(null, leagues, teams.length > 0).data;
  const ours = new Map(teams.map((t) => [`${t.league}|${t.id}`, t]));
  const mine = (g: WeekGame) => g.sides.some((x) => ours.has(`${g.league}|${x.id}`));
  const all = (week?.days ?? []).flatMap((d) => d.games).filter(mine);
  const today = new Date(now).toLocaleDateString("en-CA");
  const todays = (week?.days.find((d) => d.day === today)?.games ?? [])
    .filter((g) => mine(g) && g.state !== "post" && !g.final)
    .sort((a, b) => Number(b.state === "in") - Number(a.state === "in"));
  // A sports season's next game: one of its own league's starting then, its own two teams' when the season names them (a team's
  // season). Never a slate's (a week of games is no one matchup), and never by the time alone: an NBA game at the minute an NFL week
  // starts is another league's (the user, 2026-11-23: Clippers at Grizzlies on the NFL's Week 12).
  const gameOf = (s: HomeShow): WeekGame | null => {
    if (s.show.kind !== "sport" || !s.upNext?.airAt || !s.sportsLeague || s.sportsSlate) return null;
    const at = Date.parse(s.upNext.airAt);
    const sides = s.gameNames?.[s.upNext.number]?.sides;
    return (
      (week?.days ?? [])
        .flatMap((d) => d.games)
        .find((g) => g.league === s.sportsLeague && g.at && Math.abs(Date.parse(g.at) - at) < 60_000 && (!sides || g.sides.every((x) => sides.includes(x.id)))) ?? null
    );
  };
  const fansOf = (g: WeekGame, side: number): Fan[] => ours.get(`${g.league}|${g.sides[side].id}`)?.followers ?? [];
  const teamOf = (userId: string) => teams.find((t) => t.followers.some((f) => f.id === userId)) ?? null;
  return { todays, week: all, gameOf, fansOf, teamOf, teams, now };
}
