import type { PointCount } from "./couch-standings";
import type { LeagueState } from "./types";

// Couch points' moves that live inside a league's state (the user, 2026-10-31; couch-points.ts counts the ones with tables of their
// own: a game's answers, blind draft picks, waiver claims). Counted where couch-hub.ts already reads every game's state; pure, for
// the tests.
//
// - A Survival Pool pick: one an episode (a second pick on the same night is the same move).
// - A draft pick the player made: the draft log's, not one made for them, from the timer's queue, dealt by a draw or filled at an
//   auction's end. A draft from before the log (the live couch's Outlast, 2026-09-27): each castaway a seat drafted, in an
//   exclusive draft only (a shared draft's picks are blind_draft_picks).
// - A lineup: an episode's when it's their first, or it puts someone new in. Carrying a lineup forward only ever drops people (who
//   went home, who left the roster), so an addition is the one sure sign of a change; benching alone isn't told apart from it.
//
// Lineups and picks keep no time, so they count at their episode's airtime; anything with no time of its own at `fallback`.

export interface StateMove {
  /** The seat (state.players' id) that made it. */
  playerId: string;
  at: number;
}

export function stateMoves(state: LeagueState, airAt: (episode: number) => number | null, fallback: number): StateMove[] {
  const out: StateMove[] = [];
  const when = (n: number) => airAt(n) ?? fallback;
  const episodes = [...(state.episodes ?? [])].sort((a, b) => a.number - b.number);
  for (const ep of episodes) for (const p of ep.picks ?? []) out.push({ playerId: p.playerId, at: when(ep.number) });

  const log = state.draftLog ?? [];
  if (log.length) {
    for (const e of log) if (!e.by && !e.auto && !e.drawn && !e.filled) out.push({ playerId: e.playerId, at: Date.parse(e.at) || fallback });
  } else if (state.settings?.ownershipMode !== "shared") {
    for (const c of state.castaways ?? []) if (c.acquiredVia === "draft") for (const p of c.ownerIds ?? []) out.push({ playerId: p, at: fallback });
  }

  const last = new Map<string, Set<string>>();
  for (const ep of episodes) {
    for (const [p, ids] of Object.entries(ep.lineups ?? {})) {
      const before = last.get(p);
      if (before ? ids.some((id) => !before.has(id)) : ids.length > 0) out.push({ playerId: p, at: when(ep.number) });
      last.set(p, new Set(ids));
    }
  }
  return out;
}

/** People's moves as Couch points counts beside the rest (couch-points.ts): all time, since `yearStart` (this calendar year,
 *  Eastern) and the last seven days. */
export function movesCounted(moves: { userId: string; at: number }[], yearStart: number, now = Date.now()): PointCount[] {
  const by = new Map<string, PointCount>();
  for (const m of moves) {
    const c = by.get(m.userId) ?? { userId: m.userId, kind: "move" as const, all: 0, year: 0, week: 0 };
    c.all++;
    if (m.at >= yearStart) c.year++;
    if (m.at > now - 7 * 24 * 3600 * 1000) c.week++;
    by.set(m.userId, c);
  }
  return [...by.values()];
}
