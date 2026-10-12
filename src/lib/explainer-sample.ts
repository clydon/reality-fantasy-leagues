import StateLogic from "@/lib/game/state-logic.js";
import type { Castaway, LeagueState } from "@/lib/game/types";

// The made-up episode "How this league works" plays (docs/PLAN-league-explainer.md, "Fake results:
// the rules"). Everything here is invented on the client from a seeded random number generator, so
// Back and Next show the same results; nothing is saved or sent anywhere.
//
// It never uses a real outcome: the boot ladder is a shuffle, events are the league's own scoring
// rules handed to random people, and a cast with results never has its real next boot placed first.

export type SampleCastaway = Pick<Castaway, "id" | "name" | "photoUrl">;
export interface SampleEvent {
  label: string;
  points: number;
}

export interface Sample {
  team: SampleCastaway[];
  /** Classic: the made-up boot ladder, first out first. */
  ladder: SampleCastaway[];
  /** Classic: points each of your sample team scores (their place in the made-up ladder). */
  placements: { castaway: SampleCastaway; points: number }[];
  /** Active Roster: a made-up episode's events, starters' first, then one benched. */
  starters: { castaway: SampleCastaway; events: SampleEvent[] }[];
  bench: { castaway: SampleCastaway; event: SampleEvent | null }[];
  /** Active Roster: the one who goes home, and who replaces them. */
  pickup: { out: SampleCastaway; in: SampleCastaway } | null;
  /** Eliminator Pool: three made-up picks, right, right, wrong. */
  picks: SampleCastaway[];
  /** Side bet: the made-up right answer. */
  betAnswer: SampleCastaway;
  /** Other players' made-up totals, for the mini standings. */
  rivals: { name: string; points: number }[];
  total: number;
}

// mulberry32 over a string hash: small, fast and the same on every device for the same seed.
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Points for one event: the league's own value if it set one, else the format's default. */
export function eventPoints(state: LeagueState, def: { id: string; defaultPoints?: unknown }): number {
  const own = state.settings.eventPoints?.[def.id];
  if (typeof own === "number" && Number.isFinite(own)) return own;
  const d = def.defaultPoints as number | { exclusive: number; shared: number } | undefined;
  if (d && typeof d === "object") return state.settings.ownershipMode === "shared" ? d.shared : d.exclusive;
  return typeof d === "number" ? d : 0;
}

/** At most four events to show: the three biggest gains, plus the biggest loss if there is one. Only
 *  what happens in an ordinary episode: implied events (going home, reaching the final) are left out. */
export function topEvents(state: LeagueState): SampleEvent[] {
  const all = (StateLogic.formatOf(state).events as { id: string; label: string; defaultPoints?: unknown; implied?: boolean }[])
    .filter((e) => !e.implied)
    .map((e) => ({ label: e.label, points: eventPoints(state, e) }))
    .filter((e) => e.points !== 0);
  const gains = all.filter((e) => e.points > 0).sort((a, b) => b.points - a.points).slice(0, 3);
  const loss = all.filter((e) => e.points < 0).sort((a, b) => a.points - b.points)[0];
  return loss ? [...gains, loss] : gains;
}

export function buildSample({
  seed,
  pool,
  teamSize,
  activeSlots,
  events,
  rivals,
  nextBootId,
}: {
  seed: string;
  /** Who's in play: the cast as it stood before episode 1 for a late joiner, so nothing spoils. */
  pool: SampleCastaway[];
  teamSize: number;
  activeSlots: number;
  events: SampleEvent[];
  rivals: string[];
  /** The real next boot, if the season has one: never placed first out. */
  nextBootId: string | null;
}): Sample {
  const rand = seededRandom(seed);
  const ladder = shuffle(pool, rand);
  if (nextBootId && ladder[0]?.id === nextBootId && ladder.length > 1) [ladder[0], ladder[1]] = [ladder[1], ladder[0]];

  const size = Math.max(Math.min(teamSize || 3, 6, pool.length - 1), Math.min(2, pool.length));
  const mixed = shuffle(pool, rand);
  const team = mixed.slice(0, size);
  const free = mixed.slice(size);
  const place = (c: SampleCastaway) => ladder.findIndex((x) => x.id === c.id) + 1;
  const placements = team.map((c) => ({ castaway: c, points: place(c) })).sort((a, b) => b.points - a.points);

  const gains = events.filter((e) => e.points > 0);
  const loss = events.find((e) => e.points < 0) ?? null;
  const startersCount = Math.min(activeSlots || team.length, team.length);
  const starters = team.slice(0, startersCount).map((c, i) => ({
    castaway: c,
    events: gains.length ? [gains[i % gains.length]] : [],
  }));
  if (loss && starters.length > 1) starters[starters.length - 1].events.push(loss);
  const bench = team.slice(startersCount).map((c) => ({ castaway: c, event: gains[0] ?? null }));

  const picks = shuffle(pool, rand).slice(0, 3);
  const total =
    activeSlots > 0
      ? StateLogic.roundPoints(starters.reduce((n, s) => n + s.events.reduce((m, e) => m + e.points, 0), 0))
      : placements.reduce((n, p) => n + p.points, 0);
  // Rivals land either side of you, so the standings row has somewhere to put you.
  const spread = Math.max(2, Math.round(Math.abs(total) * 0.4) || 2);
  const rivalRows = rivals.slice(0, 2).map((name) => ({
    name,
    points: StateLogic.roundPoints(total + Math.round((rand() * 2 - 1) * spread)),
  }));

  return {
    team,
    ladder,
    placements,
    starters,
    bench,
    pickup: team.length && free.length ? { out: team[0], in: free[0] } : null,
    picks,
    betAnswer: mixed[mixed.length - 1] ?? team[0],
    rivals: rivalRows,
    total,
  };
}
