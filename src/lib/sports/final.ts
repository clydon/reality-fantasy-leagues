// A team game's final as the server keeps it (docs/PLAN-start-a-game-gpt.md track L, L3 part 1): read once from ESPN's summary
// when the game is final, saved with its game (sports_events.lines, migration 0301), and never asked again. Everyone's counts at
// the end (the plays added up with the final's correction: Sport.timeline, so ESPN's own box score whatever the plays missed),
// each one's team and position as the box has them, and the score. Everything a game scored by stats, or a question a sport's game
// settles, reads of a finished game is here: the derived stats are worked out at the read (Sport.full), so a sport's reader
// fixed later scores a kept final the new way. Pure: the server and the tests share it.
import { gameFacts } from "./spec";
import { TeamSport, headerTeams, type EspnSummary, type GameState, type Sport, type Stats } from "./sport";
import type { SportsGameFacts } from "@/lib/game/game-spec";

/** A team game's final as it's kept. */
export interface StoredGame {
  /** ESPN's box score says it's over: the lines are the final's (its correction in them). */
  final: boolean;
  /** Each team's id and score, in ESPN's header's order. */
  sides: { id: string; score: number }[];
  /** Each person's counts (raw: derived stats are the read's, Sport.full), in the sport's keys; a team's own (football's
   *  defense) under its id. */
  lines: Record<string, Stats>;
  /** Each person's team (ESPN's id) and position (the sport's key, or ESPN's abbreviation: a soccer sub's is "SUB"). */
  people: Record<string, { team: string | null; position: string | null }>;
}

/** A team game's summary as it's kept: its counts at the end of its timeline, its people, its score; null without a box score. */
export function storedGame(sport: TeamSport, summary: EspnSummary): StoredGame | null {
  const box = sport.readBox(summary);
  if (!box) return null;
  const state = sport.stateAt(summary);
  const people = Object.fromEntries(Object.values(box.people).map((p) => [p.id, { team: p.team || null, position: p.position }]));
  // The timeline's last score: a final's is the box score's own (its correction carries it).
  const sides = headerTeams(summary).map((t) => ({ id: t.id, score: state.score[t.id] ?? 0 }));
  return { final: box.final, sides, lines: state.lines, people };
}

/** A kept game as the sport's state at its end (the reduce's shape: what statePoints and gameFacts read). */
export function storedState(g: StoredGame): GameState {
  return { plays: 0, last: null, score: Object.fromEntries(g.sides.map((s) => [s.id, s.score])), lines: g.lines };
}

/** A kept game as the game spec's grader reads it (facts.games' one, answers.js sportsVerdict), at `status`: the server's view. */
export function storedFacts(sport: Sport, g: StoredGame, status: SportsGameFacts["status"]): SportsGameFacts {
  return gameFacts(sport, storedState(g), { status, sides: g.sides.map((s) => s.id), people: g.people });
}

/**
 * Someone's position group, for a table by position (byPosition): their roster's position (season_cast.role, ESPN's roster's
 * name for it: "Goalkeeper", or its abbreviation) before the game's (a soccer sub's is "SUB", which isn't one), else null.
 */
export function groupOf(sport: Sport, role: string | null | undefined, position?: string | null): string | null {
  for (const said of [role, position]) {
    const s = (said ?? "").trim();
    if (!s) continue;
    const p = sport.position(sport.positionKey(s) ?? "") ?? sport.positions.find((x) => x.label.toLowerCase() === s.toLowerCase());
    if (p) return p.group;
  }
  return null;
}
