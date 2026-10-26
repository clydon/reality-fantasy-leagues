import { randomFrom, shuffled } from "./seeded";

// Trivia (docs/PLAN-new-design.md step 12 part 3; the mock's index.html triviaSheet, gamestab.js and couchpages.js's "Survivor 49
// trivia · 3 questions from the real season"): three questions a week about a show's seasons, from their facts as the stats count
// them (cast-stats.ts, through the viewer's mark): who won, who left first, who scored the most, who did a moment most, who lasted
// longer, who scored more. Only about a season finished and seen to the end, or the one you're on as far as you've seen it (who
// left first, who lasted longer of two who've both left). The same seed (a show and a week) deals the same round to everyone who's
// seen the same. Pure: src/lib/server/trivia.ts gathers the facts and keeps the scores; tests/trivia.test.js.

export interface TriviaPerson {
  name: string;
  photo: string | null;
  /** The episode they left in (within what's counted), and how. */
  out: number | null;
  how: string | null;
  points: number;
  counts: Record<string, number>;
}

export interface TriviaSeason {
  seasonId: string;
  /** "Survivor 49". */
  label: string;
  /** Over and seen to the end: every kind of question. Otherwise only who left first and who lasted longer. */
  finished: boolean;
  cast: TriviaPerson[];
  /** The moments the stats count (not points), by their full names. */
  stats: { key: string; name: string }[];
  /** Exit methods that mean winning (Sole Survivor), and reaching the end without winning (Finalist). */
  winners: string[];
  finalists: string[];
}

export interface TriviaOption {
  key: string;
  label: string;
  photo: string | null;
}

export interface TriviaQuestion {
  /** Stable for a round: what it asks, about which season (the server grades by it). */
  id: string;
  /** "Who won Survivor 49?" */
  lead: string;
  /** A moment, for "Who did this most?"; else null. */
  what: string | null;
  options: TriviaOption[];
  answer: string;
}

/** Three questions a round. */
export const ROUND = 3;

type Kind = "winner" | "first" | "points" | "most" | "longer" | "more";
interface Candidate {
  kind: Kind;
  id: string;
  lead: string;
  what: string | null;
  answer: TriviaPerson;
  /** Two named (A or B?), or everyone else to draw three from. */
  pair?: TriviaPerson;
  pool: TriviaPerson[];
}

const opt = (p: TriviaPerson): TriviaOption => ({ key: p.name, label: p.name, photo: p.photo });
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The one person with the most of `of`, when nobody ties them and they have at least `least`. */
function leader(cast: TriviaPerson[], of: (p: TriviaPerson) => number, least: number): TriviaPerson | null {
  const sorted = [...cast].sort((a, b) => of(b) - of(a));
  if (!sorted.length || of(sorted[0]) < least) return null;
  if (sorted.length > 1 && of(sorted[1]) === of(sorted[0])) return null;
  return sorted[0];
}

/** Everything a season's facts can ask, before the round's few are dealt. */
function candidates(s: TriviaSeason, next: () => number): Candidate[] {
  const out: Candidate[] = [];
  const winners = new Set(s.winners);
  const stayed = new Set([...s.winners, ...s.finalists]);
  const others = (p: TriviaPerson) => s.cast.filter((c) => c !== p);
  if (s.finished) {
    const won = s.cast.filter((c) => c.how && winners.has(c.how));
    if (won.length === 1) out.push({ kind: "winner", id: `winner:${s.seasonId}`, lead: `Who won ${s.label}?`, what: null, answer: won[0], pool: others(won[0]) });
    const top = leader(s.cast, (c) => c.points, 1);
    if (top) out.push({ kind: "points", id: `points:${s.seasonId}`, lead: `Who scored the most points in ${s.label}?`, what: null, answer: top, pool: others(top) });
    for (const stat of s.stats) {
      const most = leader(s.cast, (c) => c.counts[stat.key] ?? 0, 2);
      if (most) out.push({ kind: "most", id: `most:${s.seasonId}:${keyOf(stat.key)}`, lead: `Who did this most in ${s.label}?`, what: stat.name, answer: most, pool: others(most) });
    }
  }
  // Who left first: the one person out in the earliest episode anyone left (never by reaching the end).
  const gone = s.cast.filter((c) => c.out != null && !(c.how && stayed.has(c.how)));
  const firstEp = Math.min(...gone.map((c) => c.out!));
  const firsts = gone.filter((c) => c.out === firstEp);
  if (firsts.length === 1) out.push({ kind: "first", id: `first:${s.seasonId}`, lead: `Who left ${s.label} first?`, what: null, answer: firsts[0], pool: others(firsts[0]) });
  // Two who've both left, in different episodes: who lasted longer.
  const pairs = shuffled(gone, next);
  for (let i = 0; i + 1 < pairs.length && out.filter((c) => c.kind === "longer").length < 2; i += 2) {
    const [a, b] = [pairs[i], pairs[i + 1]];
    if (a.out === b.out) continue;
    const [later, earlier] = a.out! > b.out! ? [a, b] : [b, a];
    out.push({ kind: "longer", id: `longer:${s.seasonId}:${keyOf(later.name)}:${keyOf(earlier.name)}`, lead: `Who lasted longer in ${s.label}?`, what: null, answer: later, pair: earlier, pool: [] });
  }
  if (s.finished) {
    const scored = shuffled(s.cast, next);
    for (let i = 0; i + 1 < scored.length && !out.some((c) => c.kind === "more"); i += 2) {
      const [a, b] = [scored[i], scored[i + 1]];
      if (a.points === b.points) continue;
      const [more, less] = a.points > b.points ? [a, b] : [b, a];
      out.push({ kind: "more", id: `more:${s.seasonId}:${keyOf(more.name)}:${keyOf(less.name)}`, lead: `Who scored more in ${s.label}?`, what: null, answer: more, pair: less, pool: [] });
    }
  }
  return out;
}

/**
 * A round: up to ROUND questions from these seasons' facts (the first is the round's own season), dealt by `seed`. At most one of
 * each kind (two of "who did this most"), the round's own season first; four faces a question (two for "A or B?").
 */
export function triviaRound(seasons: TriviaSeason[], seed: string, size = ROUND): TriviaQuestion[] {
  const next = randomFrom(seed);
  const all = seasons.flatMap((s, i) => shuffled(candidates(s, next), next).map((c) => ({ c, i })));
  const taken: { c: Candidate; i: number }[] = [];
  const room = (k: Kind) => taken.filter((t) => t.c.kind === k).length < (k === "most" ? 2 : 1);
  for (const pass of [0, 1]) {
    for (const t of all) {
      if (taken.length >= size) break;
      if (taken.includes(t) || (pass === 0 && t.i > 0) || !room(t.c.kind)) continue;
      taken.push(t);
    }
  }
  return shuffled(taken, next).map(({ c }) => {
    const people = c.pair ? [c.answer, c.pair] : [c.answer, ...shuffled(c.pool, next).slice(0, 3)];
    return { id: c.id, lead: c.lead, what: c.what, options: shuffled(people, next).map(opt), answer: c.answer.name };
  });
}

/** How many of a round's questions these answers got right (only questions in the round count). */
export function scoreRound(round: TriviaQuestion[], answers: Record<string, unknown>): number {
  return round.filter((q) => answers[q.id] === q.answer).length;
}

/** The Monday a moment's week starts on (UTC), "2026-10-26": a round's week. */
export function weekOf(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
