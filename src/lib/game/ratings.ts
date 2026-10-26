import type { Accolade, Person } from "./couch-standings";

// Rate it's numbers (docs/PLAN-new-design.md step 12 part 1), pure: a couch verdict, you against the couch on one episode,
// your taste twin (who on the couch rates most like you), how often you agree with the couch, and the couch accolades
// ratings can say (taste twins, the contrarian, never misses a rating). The ratings come in already cut to what the viewer
// may see (ratings.ts: only episodes they've seen, only from people on the couch who share that show), so nothing here is
// past anyone's mark.

/** One person's stars for one episode. */
export interface Rated {
  userId: string;
  seasonId: string;
  episode: number;
  stars: number;
}

/** Two people (or you and the couch) need this many episodes in common before anything is said about them. */
export const MIN_SHARED = 3;

/** An average to one decimal, or null with nothing to average. */
export function average(stars: number[]): number | null {
  if (!stars.length) return null;
  return Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10;
}

/** "4.0": a verdict as it's shown. */
export const verdictText = (avg: number | null) => (avg === null ? "–" : avg.toFixed(1));

/**
 * You against everyone else who rated one episode: first (nobody else has), agree (within a star of their average),
 * contrarian (a star and a half or more off it), or null (in between, nothing worth saying).
 */
export function againstCouch(mine: number | null, others: number[]): "first" | "agree" | "contrarian" | null {
  if (mine === null) return null;
  if (!others.length) return "first";
  const off = Math.abs(mine - others.reduce((a, b) => a + b, 0) / others.length);
  return off < 1 ? "agree" : off >= 1.5 ? "contrarian" : null;
}

/** Each episode's ratings, by person. */
function byEpisode(rated: Rated[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const r of rated) {
    const key = `${r.seasonId}:${r.episode}`;
    if (!out.has(key)) out.set(key, new Map());
    out.get(key)!.set(r.userId, r.stars);
  }
  return out;
}

interface Pair {
  a: string;
  b: string;
  /** Episodes they both rated, how many with the same stars, how many within a star, and the stars between them. */
  n: number;
  same: number;
  within: number;
  diff: number;
}

function pairsOf(eps: Map<string, Map<string, number>>): Pair[] {
  const pairs = new Map<string, Pair>();
  for (const ep of eps.values()) {
    const who = [...ep.keys()].sort();
    for (let i = 0; i < who.length; i++) {
      for (let j = i + 1; j < who.length; j++) {
        const key = `${who[i]}|${who[j]}`;
        const p = pairs.get(key) ?? { a: who[i], b: who[j], n: 0, same: 0, within: 0, diff: 0 };
        const d = Math.abs(ep.get(who[i])! - ep.get(who[j])!);
        p.n++;
        p.diff += d;
        if (d === 0) p.same++;
        if (d <= 1) p.within++;
        pairs.set(key, p);
      }
    }
  }
  return [...pairs.values()];
}

/** Closest first: the fewest stars apart on average, then the most the same, then the most in common. */
const closer = (x: Pair, y: Pair) => x.diff / x.n - y.diff / y.n || y.same / y.n - x.same / x.n || y.n - x.n;

/** "the same stars on 6 of 8 episodes", or, when that's under half, "within a star on 7 of 8 episodes". */
function alikeLine(p: Pair): string {
  return p.same * 2 >= p.n ? `the same stars on ${p.same} of ${p.n} episodes` : `within a star on ${p.within} of ${p.n} episodes`;
}

export interface Twin {
  userId: string;
  name: string;
  /** "The same stars on 6 of 8 episodes". */
  line: string;
}

export interface Taste {
  /** Who on the couch rates most like you: MIN_SHARED episodes in common and a star apart at most, on average. */
  twin: Twin | null;
  /** How often you're within a star of the rest of the couch's average, over the episodes someone else rated too. */
  agree: { pct: number; of: number } | null;
  /** Shows with a rating you can see: the hub's Couch verdicts line. */
  shows: number;
}

/** Your taste on the couch, from the ratings you may see. */
export function tasteOf(rated: Rated[], me: string, people: Person[]): Taste {
  const member = new Map(people.map((p) => [p.userId, p.name]));
  const eps = byEpisode(rated.filter((r) => r.userId === me || member.has(r.userId)));
  const mine = pairsOf(eps)
    .filter((p) => (p.a === me || p.b === me) && p.n >= MIN_SHARED && p.diff / p.n <= 1)
    .sort(closer)[0];
  const other = mine ? (mine.a === me ? mine.b : mine.a) : null;
  const twin = mine && other && member.has(other) ? { userId: other, name: member.get(other)!, line: cap(alikeLine(mine)) } : null;

  let of = 0;
  let agreed = 0;
  for (const ep of eps.values()) {
    const m = ep.get(me);
    const others = [...ep].filter(([id]) => id !== me).map(([, s]) => s);
    if (m === undefined || !others.length) continue;
    of++;
    if (againstCouch(m, others) === "agree") agreed++;
  }
  return {
    twin,
    agree: of >= MIN_SHARED ? { pct: Math.round((100 * agreed) / of), of } : null,
    shows: new Set(rated.map((r) => r.seasonId)).size,
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The couch accolades ratings can say (By the numbers, the mock's hubplus.js): the couch's taste twins (the two who rate
 * most alike), the contrarian (furthest from everyone else, on average), and never misses a rating (the longest run of
 * episodes rated in a row on one show). Each only when it says something. `labelOf` names a season ("Survivor 51").
 */
export function ratingAccolades(rated: Rated[], people: Person[], labelOf: (seasonId: string) => string | null): Accolade[] {
  const member = new Map(people.map((p) => [p.userId, p.name]));
  const eps = byEpisode(rated.filter((r) => member.has(r.userId)));
  const out: Accolade[] = [];
  const byName = (a: string, b: string) => member.get(a)!.localeCompare(member.get(b)!);

  const twins = pairsOf(eps)
    .filter((p) => p.n >= MIN_SHARED && p.diff / p.n <= 0.75)
    .sort((x, y) => closer(x, y) || byName(x.a, y.a))[0];
  if (twins) {
    const [a, b] = [twins.a, twins.b].sort(byName);
    out.push({ key: "twins", stat: "Taste twins", who: `${member.get(a)} and ${member.get(b)}`, userId: a, line: alikeLine(twins) });
  }

  // The contrarian: over episodes at least two others rated, the stars between them and everyone else's average.
  const off = new Map<string, { n: number; sum: number }>();
  for (const ep of eps.values()) {
    if (ep.size < 3) continue;
    for (const [id, s] of ep) {
      const others = [...ep].filter(([o]) => o !== id).map(([, x]) => x);
      const o = off.get(id) ?? { n: 0, sum: 0 };
      o.n++;
      o.sum += Math.abs(s - others.reduce((x, y) => x + y, 0) / others.length);
      off.set(id, o);
    }
  }
  const contrarian = [...off]
    .filter(([, o]) => o.n >= MIN_SHARED && o.sum / o.n >= 1)
    .sort((x, y) => y[1].sum / y[1].n - x[1].sum / x[1].n || byName(x[0], y[0]))[0];
  if (contrarian) {
    const avg = Math.round((contrarian[1].sum / contrarian[1].n) * 10) / 10;
    out.push({ key: "contrarian", stat: "The contrarian", who: member.get(contrarian[0])!, userId: contrarian[0], line: `${avg.toFixed(1)} stars off the couch on average` });
  }

  // Never misses a rating: the longest run of one show's episodes rated one after another.
  let best: { id: string; n: number; seasonId: string } | null = null;
  const runs = new Map<string, number[]>();
  for (const r of rated) {
    if (!member.has(r.userId)) continue;
    const key = `${r.userId}|${r.seasonId}`;
    runs.set(key, [...(runs.get(key) ?? []), r.episode]);
  }
  for (const [key, list] of runs) {
    const [id, seasonId] = key.split("|");
    const sorted = [...new Set(list)].sort((a, b) => a - b);
    let run = 1;
    let longest = 1;
    for (let i = 1; i < sorted.length; i++) {
      run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    if (longest >= 4 && (!best || longest > best.n || (longest === best.n && byName(id, best.id) < 0))) best = { id, n: longest, seasonId };
  }
  if (best) {
    const label = labelOf(best.seasonId);
    out.push({ key: "rates", stat: "Never misses a rating", who: member.get(best.id)!, userId: best.id, line: `${best.n} episodes${label ? ` of ${label}` : ""} in a row` });
  }
  return out;
}
