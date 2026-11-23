"use client";

import { useCouchTeams, useCurrentCouch, useHome, useMySportsGames, useSportsRecordings, type TeamSchedule, type WeekGame } from "../data";
import { bugStateOf, Scorebug, type Bug, type Fan } from "./scorebug";
import { useHideSports, useShownScores } from "./scores";
import { useLeagueWeek } from "./sheets";
import { eastDay } from "@/lib/sports/team-season";

// One of a team's games as the shared scorebug (docs/PLAN-sports-couch.md B2 and B4; round 1's R3: one game row everywhere): the team's
// page's game on now or next, and a game's sheet. Built from the team's schedule, with the clock, network and line from the league's
// one-day week read when the game is in it; the couch's fans of each side; your game on it and whether its pick is due.

type Game = TeamSchedule["games"][number];

/** A team's game as the shared scorebug (wide): its clock, network and line from the league's week read when it's there. */
export function GameBug({ g, s, now, onAsk }: { g: Game; s: TeamSchedule; now: number; onAsk: (g: WeekGame) => void }) {
  const home = useHome().data;
  const couch = useCurrentCouch(home);
  const couchTeams = useCouchTeams(couch?.id ?? null).data?.teams ?? [];
  const mine = useMySportsGames(true).data?.games;
  const recordings = useSportsRecordings().data?.recordings;
  const hide = useHideSports();
  const shown = useShownScores();
  const day = g.at ? eastDay(g.at) : null;
  const week = useLeagueWeek(s.league, day, day, !!day);
  const fromWeek = week.games.find((x) => x.id === g.id) ?? null;
  const us = { id: s.team.id, name: s.team.name, short: s.team.short, abbreviation: s.team.abbreviation ?? null, color: s.team.color ?? null, home: g.home !== false, score: g.score ? String(g.score[0]) : null, winner: g.result === "W", record: null };
  const them = { id: g.opponent?.id ?? "", name: g.opponent?.name ?? "To be decided", short: g.opponent?.short ?? "To be decided", abbreviation: g.opponent?.abbreviation ?? null, color: g.opponent?.color ?? null, home: g.home === false, score: g.score ? String(g.score[1]) : null, winner: g.result === "L", record: null };
  const wg: WeekGame =
    fromWeek ?? { id: g.id, league: s.league, leagueName: s.leagueName ?? s.league, at: g.at, state: g.state, final: g.final, called: g.calledOff ? "postponed" : null, note: g.note, sides: g.home === false ? [us, them] : [them, us], network: null, line: null, clock: null };
  const fans = new Map(couchTeams.filter((t) => t.league === s.league).map((t) => [t.id, t.followers as Fan[]]));
  const p = (mine ?? []).find((m) => m.league === s.league && m.event === g.id) ?? null;
  const due = !!p && !!home?.moves.some((m) => m.leagueId === p.leagueId && (m.episode == null || m.episode === p.episode));
  const hidden = !!recordings?.some((r) => r.game === g.id) || (hide && !shown.has(g.id));
  const bug: Bug = { g: wg, bucket: bugStateOf(wg, hidden, now), fans: [fans.get(wg.sides[0].id) ?? [], fans.get(wg.sides[1].id) ?? []], played: p, due };
  return <Scorebug bug={bug} meId={home?.user.id ?? ""} now={now} onAsk={() => onAsk(wg)} wide grouped finalsOpen pollOnScreen />;
}
