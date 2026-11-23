// A rivalry's game (docs/PLAN-sports-couch.md C1; the design: docs/design-round/rivalry-spec.md, -first-view.md, -shape.md). When
// two couch members' teams meet, the couch plays one game on that meeting, started by whoever acts first on This week's rivalry
// card: Winner and margin (the gallery's sp-margin), its winner shown as it's picked (the public sides: `shown: 'picked'`), its
// margin hidden until kickoff. The two fans make calls (both); anyone else picks a side (the winner; a margin if they like). Pure:
// the server (src/lib/server/sports/rivalry.ts) and the card (src/new/sports/rivalry.tsx) share it; tests/sports-rivalry.test.js.

import { pickedKindOf } from "./fan-call";

/** The rivalry game's spec, on one game (the span is set where it starts, as the rail's games are). */
export const RIVALRY_SPEC: Record<string, unknown> = {
  spec: 1,
  pool: { of: "cast", where: null },
  get: { by: "none" },
  count: null,
  score: { by: "answers" },
  rank: { by: "total" },
  closes: "start",
  ask: [
    { id: "winner", ask: "Who wins?", answer: "side", shown: "picked", points: 1, settle: { by: "final", take: "winner" }, asked: "each", closes: "start" },
    { id: "margin", ask: "By how many?", answer: "number", points: 1, settle: { by: "final", take: "margin" }, asked: "each", closes: "start" },
  ],
};

/** Whether a game's spec is a rivalry's: its winner shown as it's picked, with a margin (C2's fan's call asks the winner alone). */
export function isRivalrySpec(spec: unknown): boolean {
  return pickedKindOf(spec) === "rivalry";
}

/** The margin a call starts at: a sport's usual one (a field goal; a basket and a bit; a run, a goal). */
export function typicalMargin(league: string): number {
  const sport = league.split("/")[0];
  return sport === "football" ? 3 : sport === "basketball" ? 5 : 1;
}

export const MARGIN_MIN = 1;
export const MARGIN_MAX = 50;

/** One person's pick on the rivalry: the side (a team's id), the margin (null: none, or hidden from you till kickoff). */
export interface RivalryPick {
  userId: string;
  name: string;
  side: string | null;
  margin: number | null;
  /** A margin was called, even when it's hidden from you (before kickoff, someone else's). */
  called: boolean;
}

/** How a pick did once the game is final: the winner right, how far off the margin was (null: no margin called). */
export interface PickResult {
  userId: string;
  right: boolean;
  off: number | null;
}

/** The final's winner (a team id, or null for a tie) and its margin. */
export function finalOf(score: [number, number] | null, away: string, home: string): { winner: string | null; margin: number } | null {
  if (!score) return null;
  const [a, h] = score;
  return { winner: a > h ? away : h > a ? home : null, margin: Math.abs(a - h) };
}

export function pickResult(p: RivalryPick, f: { winner: string | null; margin: number }): PickResult {
  return { userId: p.userId, right: !!p.side && p.side === f.winner, off: p.margin == null ? null : Math.abs(p.margin - f.margin) };
}

/**
 * The duel between the two fans, as the game scores it: a point for the winner, a point for the closest margin among everyone who
 * called one (ties all score). `who`: the fan with more points, null for a tie or when neither made a call.
 */
export function duelOf(
  fans: [string, string],
  picks: RivalryPick[],
  f: { winner: string | null; margin: number }
): { who: string | null; points: Record<string, number>; results: Record<string, PickResult> } {
  const results: Record<string, PickResult> = {};
  for (const p of picks) results[p.userId] = pickResult(p, f);
  const offs = Object.values(results)
    .map((r) => r.off)
    .filter((x): x is number => x !== null);
  const best = offs.length ? Math.min(...offs) : null;
  const points: Record<string, number> = {};
  for (const id of fans) {
    const r = results[id];
    points[id] = r ? Number(r.right) + Number(best !== null && r.off === best) : 0;
  }
  const [a, b] = fans;
  const made = fans.some((id) => picks.some((p) => p.userId === id && p.side));
  return { who: !made || points[a] === points[b] ? null : points[a] > points[b] ? a : b, points, results };
}

/** The sides as two lists (away's, home's), in the order picked; the two fans first on their own side. */
export function sidesOf(picks: RivalryPick[], away: string, home: string, fans: [string, string]): [RivalryPick[], RivalryPick[]] {
  const on = (side: string, fan: string) => {
    const xs = picks.filter((p) => p.side === side);
    return [...xs.filter((p) => p.userId === fan), ...xs.filter((p) => p.userId !== fan)];
  };
  return [on(away, fans[0]), on(home, fans[1])];
}
