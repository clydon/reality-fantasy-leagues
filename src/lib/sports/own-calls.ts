// Solo (docs/PLAN-sports-couch.md C4; the design: docs/design-round/solo-fan-spec.md (Intent), -first-view.md (PFD), -shape.md
// (Impeccable)). A fan's own games on a team, on no couch (leagues.solo 'own'):
//   - your calls: one standing game a fan a team, Pick'em on the team's games from the first one called to the regular season's end,
//     started by the first call with no setup screen; each later game asks again. Its question is `yourCall` (C2's call is `winner`).
//   - the season call: one game a fan a team a season, one number asked once: how many of the team's games left it wins (the engine's
//     `{ by: 'final', take: 'wins', of }`), right only exactly (`within: 0`). The page frames it as the season's record.
// A game is one of these by its question's id, so nothing new is stored. Pure: the server (src/lib/server/sports/own.ts) and the page
// (src/new/sports/season-call.tsx, fan-call.tsx) share it; tests/sports-own-calls.test.js.

/** Your calls' spec, on a team's season (the span is set where it starts). */
export const OWN_CALLS_SPEC: Record<string, unknown> = {
  spec: 1,
  pool: { of: "cast", where: null },
  get: { by: "none" },
  count: null,
  score: { by: "answers" },
  rank: { by: "total" },
  closes: "start",
  ask: [{ id: "yourCall", ask: "Who wins?", answer: "side", points: 1, settle: { by: "final", take: "winner" }, asked: "each", closes: "start" }],
};

/** The season call's spec for a team: how many of its games left it wins, exactly. */
export function seasonCallSpec(team: string): Record<string, unknown> {
  return {
    spec: 1,
    pool: { of: "cast", where: null },
    get: { by: "none" },
    count: null,
    score: { by: "answers" },
    rank: { by: "total" },
    closes: "start",
    ask: [{ id: "seasonCall", ask: "How many of the rest do they win?", answer: "number", within: 0, points: 1, settle: { by: "final", take: "wins", of: team }, asked: "once", closes: "start" }],
  };
}

/** Which of your own games a spec is: your calls, the season call, or neither. */
export function ownKindOf(spec: unknown): "calls" | "season" | null {
  const ask = (spec as { ask?: unknown } | null)?.ask;
  if (!Array.isArray(ask)) return null;
  const ids = ask.map((q) => (q && typeof q === "object" ? (q as { id?: unknown }).id : null));
  return ids.includes("yourCall") ? "calls" : ids.includes("seasonCall") ? "season" : null;
}

export type Record3 = { w: number; l: number; t: number };

/** A game of a team's season as the season call reads it: its id, when, and how it went for the team once final. */
export interface SeasonGame {
  id: string;
  at: string | null;
  /** W, L or T once final; null before (or called off: `off`). */
  result: "W" | "L" | "T" | null;
  off?: boolean;
}

/** A season call as the read gives it. */
export interface SeasonCall {
  team: string;
  leagueId: string;
  seasonId: string;
  /** Wins called over the games left at the call. */
  wins: number;
  /** The team's games left at the call, oldest first (its span). */
  games: string[];
  /** When it was made. */
  at: string | null;
}

/** "8–2–1", "8–2" with no tie. */
export const recordWords = (r: Record3): string => [r.w, r.l, ...(r.t ? [r.t] : [])].join("–");

/** A team's record over some games (only the finals). */
export function recordOf(games: SeasonGame[]): Record3 {
  const r: Record3 = { w: 0, l: 0, t: 0 };
  for (const g of games) if (g.result === "W") r.w++;
  else if (g.result === "L") r.l++;
  else if (g.result === "T") r.t++;
  return r;
}

/**
 * Where a season call stands, from the team's season (`season`: its regular season, in order): the record it was made at (every game
 * before its first), the record it calls (that plus the wins called, the rest losses), and the games it covers so far: won, lost, tied,
 * left. Settled once none is left: `off` the difference from the wins called (0: spot on).
 */
export function seasonCallState(call: Pick<SeasonCall, "wins" | "games">, season: SeasonGame[]) {
  const first = season.findIndex((g) => g.id === call.games[0]);
  const before = first < 0 ? [] : season.slice(0, first).filter((g) => !g.off);
  const at = recordOf(before);
  const covered = season.filter((g) => call.games.includes(g.id));
  const so = recordOf(covered);
  const left = covered.filter((g) => !g.result && !g.off).length;
  const count = call.games.length - covered.filter((g) => g.off).length;
  const called: Record3 = { w: at.w + call.wins, l: at.l + Math.max(0, count - call.wins), t: at.t };
  const finished: Record3 = { w: at.w + so.w, l: at.l + so.l, t: at.t + so.t };
  return { at, called, so, left, count, settled: left === 0, finished, off: left === 0 ? so.w - call.wins : null };
}

/** The stepper's start: the wins left at the record's pace (ties count half), rounded, held to the games left. */
export function paceWins(record: Record3, left: number): number {
  const played = record.w + record.l + record.t;
  if (!played) return Math.round(left / 2);
  return Math.max(0, Math.min(left, Math.round(((record.w + record.t / 2) / played) * left)));
}
