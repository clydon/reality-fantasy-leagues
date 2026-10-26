import { goingHomeEachEpisode } from "./formats/rulebook-fits.js";
import { momentsFor, type Moment } from "./formats/rulebook-moments.js";
import { kindOf, partWord } from "./formats/rulebook-schema.js";
import type { RulebookAliases, RulebookBlocks } from "./formats/rulebook-schema";

// Call it (docs/PLAN-new-design.md step 12 part 2; the mock's watching.js callSheet, show.js predictSheet and rulebook.js's
// talk-show calls): before an episode airs, two one-tap calls about it, the same two for everyone on Game Your Show, made
// from the show's rulebook so any show that's a game gets them. Pure: src/lib/server/calls.ts reads and writes them;
// tests/calls.test.js.
//
//   Who goes home?       a cast pick, on a show where someone goes home every episode (rulebook-fits' Survival Pool rule)
//   Anyone this episode? a yes or no on one of the show's moments ("Played an idol or advantage"); two of them on a show
//                        with nobody going home, and on a talk show ("Tonight? A surprise cameo"), which has no results
//
// The moment changes from episode to episode, round the show's most callable ones (a twist's first: idols, shields, journeys;
// else what the rulebook added for this show; else a segment that doesn't run every episode). Never a moment research can't
// answer (the couch's own), one that gives a secret role away, or a way out (Who goes home? is the way out).
//
// Settled from the season's shared results (the same facts every game scores from): Who goes home? once who went home is in
// (early results are enough; "nobody went home" calls it off), a moment once every result is in (final). A talk show's moments
// have no results: the couch says what happened as it watches (settleSays). A call's grade is never stored.

export interface CallOption {
  key: string;
  label: string;
  photo: string | null;
}

export interface CallQuestion {
  /** "out", or "m:<moment>" (a moment's event id, as the season's results record it; a talk show's moment id). */
  key: string;
  kind: "cast" | "yesno";
  /** "Who goes home?", "Anyone this episode?", "Tonight?" */
  lead: string;
  /** The moment, in the rulebook's words ("Played an idol or advantage"); null for Who goes home? */
  what: string | null;
  options: CallOption[];
  /** Settled by the season's results, or by what the couch says happened (a talk show). */
  by: "results" | "couch";
}

export interface CallBook {
  blocks: RulebookBlocks;
  aliases?: Partial<RulebookAliases> | null;
}

export interface CallFace {
  id: string;
  name: string;
  photo: string | null;
}

/** Two calls an episode. */
export const CALLS_PER_EPISODE = 2;

export const YES_NO: CallOption[] = [
  { key: "yes", label: "Yes", photo: null },
  { key: "no", label: "No", photo: null },
];

/** A moment that gives a secret role away: one of a secret role's own, or one whose name says a role ("As a Traitor, ..."). */
function secretOf(blocks: RulebookBlocks): (m: Moment) => boolean {
  const secret = (blocks.twists ?? []).filter((t) => t.type === "secretRole");
  const ids = new Set(secret.map((t) => t.id));
  const names = secret.flatMap((t) => (t.type === "secretRole" ? t.roles : [])).map((r) => r.replace(/[^\w ]/g, "")).filter(Boolean);
  const says = names.length ? new RegExp(`\\b(${names.join("|")})s?\\b`, "i") : null;
  return (m) => (!!m.from.twist && ids.has(m.from.twist)) || (!!says && says.test(m.label));
}

export interface CallMoment {
  /** The key it's called and settled by: its event id (the season's results), or a talk show's moment id. */
  id: string;
  label: string;
}

/** The moments a show's calls go round, most callable first: the first group with `want` of them, else every group in turn. */
export function callMoments(book: CallBook, want = 1): CallMoment[] {
  const { blocks } = book;
  const talk = kindOf(blocks) === "talk";
  let all: Moment[];
  try {
    all = momentsFor(blocks);
  } catch {
    return [];
  }
  const event = (m: Moment) => (talk ? m.id : (book.aliases?.events?.[m.id] ?? m.id));
  if (talk) return all.filter((m) => m.ask && !m.auto).map((m) => ({ id: event(m), label: m.label }));
  const secret = secretOf(blocks);
  const segments = new Map((blocks.segments ?? []).map((s) => [s.id, s]));
  const callable = all.filter(
    (m) => !m.auto && !m.from.wayOut && !m.from.finale && m.ask && (m.ask.type === "answer" || m.ask.type === "integer") && m.answeredBy !== "league" && !secret(m)
  );
  const groups = [
    callable.filter((m) => m.from.twist),
    callable.filter((m) => !m.from.twist && m.from.custom),
    callable.filter((m) => !m.from.twist && !m.from.custom && m.from.segment && segments.get(m.from.segment)?.often !== "everyEpisode"),
    callable,
  ];
  const unique = (list: Moment[]) => {
    const seen = new Set<string>();
    return list.map((m) => ({ id: event(m), label: m.label })).filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  };
  const enough = groups.map(unique).find((g) => g.length >= want);
  return enough ?? unique(groups.flat());
}

/** "Played an idol or advantage" stays as the rulebook says it; only a trailing full stop goes. */
const tidy = (label: string) => label.replace(/\.\s*$/, "");

/**
 * An episode's calls. `stillIn`: who's still in going into it (the cast pick's faces), or null when it isn't known (no cast,
 * or someone behind, who isn't told). Every caller gets the same questions for the same episode.
 */
export function callQuestions(book: CallBook, episode: number, stillIn: CallFace[] | null): CallQuestion[] {
  const { blocks } = book;
  const talk = kindOf(blocks) === "talk";
  const part = partWord(blocks).singular;
  const out: CallQuestion[] = [];
  if (!talk && goingHomeEachEpisode(blocks) && stillIn && stillIn.length >= 2) {
    out.push({ key: "out", kind: "cast", lead: "Who goes home?", what: null, options: stillIn.map((c) => ({ key: c.id, label: c.name, photo: c.photo })), by: "results" });
  }
  const step = CALLS_PER_EPISODE - out.length;
  const moments = callMoments(book, step);
  const want = Math.min(step, moments.length);
  const start = want ? ((Math.max(1, episode) - 1) * step) % moments.length : 0;
  for (let i = 0; i < want; i++) {
    const m = moments[(start + i) % moments.length];
    out.push({ key: `m:${m.id}`, kind: "yesno", lead: talk ? "Tonight?" : `Anyone this ${part}?`, what: tidy(m.label), options: YES_NO, by: talk ? "couch" : "results" });
  }
  return out;
}

/** The questions' keys alone (a tally doesn't need the faces): what callQuestions gives with a cast pick when `cast`. */
export function callKeys(book: CallBook, episode: number, cast: boolean): string[] {
  const faces: CallFace[] = cast ? [{ id: "a", name: "a", photo: null }, { id: "b", name: "b", photo: null }] : [];
  return callQuestions(book, episode, cast ? faces : null).map((q) => q.key);
}

// ---------- settling ----------

/** What the season's shared results say of one episode, as far as they go. */
export interface EpisodeFacts {
  /** Who went home (season_cast ids; the winner leaving by winning isn't going home), [] when nobody did; null: not in yet. */
  out: string[] | null;
  /** Every result is in: the moments that happened (event ids). null: not final yet. */
  events: Set<string> | null;
}

export type Verdict =
  | { state: "waiting" }
  | { state: "off"; why: string }
  | { state: "known"; right: string[] };

const WAITING: Verdict = { state: "waiting" };

/** How one call stands: still to be settled, called off (nobody went home), or what was right. `said`: the couch's say. */
export function verdictOf(key: string, by: "results" | "couch", facts: EpisodeFacts | null, said: "yes" | "no" | null): Verdict {
  if (key === "out") {
    if (!facts || facts.out === null) return WAITING;
    return facts.out.length ? { state: "known", right: facts.out } : { state: "off", why: "Nobody went home" };
  }
  if (by === "couch") return said ? { state: "known", right: [said] } : WAITING;
  if (!facts || !facts.events) return WAITING;
  return { state: "known", right: [facts.events.has(key.slice(2)) ? "yes" : "no"] };
}

/** Whether a call was right: null until it's settled (or when it's called off). */
export function isRight(v: Verdict | undefined, answer: string | null | undefined): boolean | null {
  if (!v || v.state !== "known" || !answer) return null;
  return v.right.includes(answer);
}

/**
 * What the couch says happened, for a call no results settle (a talk show's moment): two agreeing settle it, more than say
 * otherwise; alone on the show (nobody else on the couch shares it: `says` is then yours alone), your own say does.
 */
export function settleSays(says: boolean[], alone: boolean): "yes" | "no" | null {
  if (!says.length) return null;
  if (alone) return says[0] ? "yes" : "no";
  const yes = says.filter(Boolean).length;
  const no = says.length - yes;
  if (yes >= 2 && yes > no) return "yes";
  if (no >= 2 && no > yes) return "no";
  return null;
}

export interface MadeCall {
  userId: string;
  episode: number;
  key: string;
  answer: string;
}

/** How many calls each person got right, and how many of theirs were settled, over the verdicts given (by episode, then key). */
export function tallyCalls(calls: MadeCall[], verdicts: Map<number, Record<string, Verdict>>, only?: (key: string) => boolean): Map<string, { right: number; settled: number }> {
  const out = new Map<string, { right: number; settled: number }>();
  for (const c of calls) {
    if (only && !only(c.key)) continue;
    const r = isRight(verdicts.get(c.episode)?.[c.key], c.answer);
    if (r === null) continue;
    const t = out.get(c.userId) ?? { right: 0, settled: 0 };
    t.settled++;
    if (r) t.right++;
    out.set(c.userId, t);
  }
  return out;
}
