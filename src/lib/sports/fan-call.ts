// A fan's call (docs/PLAN-sports-couch.md C2; the design: docs/design-round/lone-fan-spec.md, -first-view.md, -shape.md). When a couch
// member's team plays and it isn't a rivalry, the fan calls it in a tap and anyone else backs or fades the call in a tap: one game a
// meeting, Pick'em on that one game with its winner shown as it's picked (C1's `shown: 'picked'`), started by the fan's call. A call
// stands once anyone backs or fades it (the backs are stored as sides: a call that moved would turn them over). Pure: the server
// (src/lib/server/sports/calls.ts) and the page (src/new/sports/fan-call.tsx) share it; tests/sports-fan-call.test.js.

/** The fan's call game's spec, on one game (the span is set where it starts). */
export const CALL_SPEC: Record<string, unknown> = {
  spec: 1,
  pool: { of: "cast", where: null },
  get: { by: "none" },
  count: null,
  score: { by: "answers" },
  rank: { by: "total" },
  closes: "start",
  ask: [{ id: "winner", ask: "Who wins?", answer: "side", shown: "picked", points: 1, settle: { by: "final", take: "winner" }, asked: "each", closes: "start" }],
};

/** A game with public picks: a rivalry (with its margin) or a fan's call (the winner alone); null for any other game. */
export function pickedKindOf(spec: unknown): "rivalry" | "call" | null {
  const ask = (spec as { ask?: unknown } | null)?.ask;
  if (!Array.isArray(ask)) return null;
  const qs = ask.filter((q): q is Record<string, unknown> => !!q && typeof q === "object");
  if (!qs.some((q) => q.shown === "picked")) return null;
  return qs.some((q) => q.id === "margin") ? "rivalry" : "call";
}

/** One person's pick on a call or rivalry game: the side, a team's id. */
export interface CallPick {
  userId: string;
  name: string;
  side: string;
}

/** A call or rivalry game on the couch, as the read gives it: its picks in the order made, and its final's winner once final. */
export interface CallGame {
  event: string;
  kind: "call" | "rivalry";
  leagueId: string;
  seasonId: string;
  at: string | null;
  /** Its game has begun (picks closed). */
  begun: boolean;
  picks: CallPick[];
  /** Final: the winning team's id, or "tie"; null until final. */
  winner: string | null;
  /** Its two teams, away then home (null when the schedules asked didn't have it). */
  teams: [string, string] | null;
}

/** The call on a game: the first pick by a fan of either of its teams (`fansOf`: who follows a team on the couch). */
export function callOf(g: Pick<CallGame, "picks">, fansOf: (side: string) => string[], teams: [string, string]): CallPick | null {
  const fans = new Set([...fansOf(teams[0]), ...fansOf(teams[1])]);
  return g.picks.find((p) => fans.has(p.userId)) ?? null;
}

/** The couch's answer to a call: who backed it, who faded it (everyone but the caller and the call's fellow fans' own calls). */
export function backingOf(g: Pick<CallGame, "picks">, call: CallPick): { back: CallPick[]; fade: CallPick[] } {
  const rest = g.picks.filter((p) => p.userId !== call.userId);
  return { back: rest.filter((p) => p.side === call.side), fade: rest.filter((p) => p.side !== call.side) };
}

export type Record3 = { w: number; l: number; t: number };

/** How a pick did: right, wrong, or neither (a tie, or not final). */
export const verdictOf = (side: string, winner: string | null): "right" | "wrong" | null => (!winner || winner === "tie" ? null : side === winner ? "right" : "wrong");

/**
 * A fan's calls this season: every pick of theirs on a game their team plays (a fan's call or a rivalry), right or wrong once final;
 * `t` counts a tie. `teamOf(event)`: the two teams of a game (null when unknown: left out).
 */
export function callsRecord(fan: string, team: string, games: CallGame[], teamsOf: (event: string) => [string, string] | null): Record3 {
  const r: Record3 = { w: 0, l: 0, t: 0 };
  for (const g of games) {
    const ts = teamsOf(g.event);
    if (!ts || !ts.includes(team) || !g.winner) continue;
    const p = g.picks.find((x) => x.userId === fan);
    if (!p) continue;
    if (g.winner === "tie") r.t++;
    else if (p.side === g.winner) r.w++;
    else r.l++;
  }
  return r;
}

/**
 * The couch on a fan's calls: how backing and fading him has gone, over his fan's calls (not rivalries: there the others pick a side
 * between two fans). Each back or fade right or wrong once final.
 */
export function couchOnCalls(fan: string, games: CallGame[]): { back: Record3; fade: Record3 } {
  const back: Record3 = { w: 0, l: 0, t: 0 };
  const fade: Record3 = { w: 0, l: 0, t: 0 };
  for (const g of games) {
    if (g.kind !== "call" || !g.winner) continue;
    const call = g.picks[0];
    if (!call || call.userId !== fan) continue;
    for (const p of g.picks.slice(1)) {
      const r = p.side === call.side ? back : fade;
      if (g.winner === "tie") r.t++;
      else if (p.side === g.winner) r.w++;
      else r.l++;
    }
  }
  return { back, fade };
}

/** "7–1", "5–3–1" with a tie; null with nothing settled. */
export const record3Words = (r: Record3): string | null => (r.w + r.l + r.t ? [r.w, r.l, ...(r.t ? [r.t] : [])].join("–") : null);

/** One tick a game of a team's season, oldest first: the fan's call on it and how it went. */
export type CallTick = { id: string; at: string | null; kind: "right" | "wrong" | "tie" | "open" | "none" };

/** The fan card's ticks: each game of the team's season (in order) with the fan's pick on it, if any. */
export function callTicks(fan: string, season: { id: string; at: string | null }[], games: CallGame[]): CallTick[] {
  const byEvent = new Map(games.map((g) => [g.event, g]));
  return season.map((s) => {
    const g = byEvent.get(s.id);
    const p = g?.picks.find((x) => x.userId === fan);
    if (!g || !p) return { id: s.id, at: s.at, kind: "none" };
    if (!g.winner) return { id: s.id, at: s.at, kind: "open" };
    return { id: s.id, at: s.at, kind: g.winner === "tie" ? "tie" : p.side === g.winner ? "right" : "wrong" };
  });
}
