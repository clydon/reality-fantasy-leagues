import { randomFrom, shuffled } from "./seeded";

// Bingo (docs/PLAN-new-design.md step 12 part 3, docs/PLAN-bingo-bank.md; the mock's index.html bingoSheet, show.js's bingo job,
// episode.js "sam got a line first", rulebook.js Weekly Bingo): a card per person and episode, three by three with the centre free,
// its squares dealt from the episode's bank (things a couch shouts at the TV, written by an AI before it airs: db/bingo-research.js),
// a mix of how likely each is to come up. Ticked while watching; a square counts once it happened (two on the couch saying so, or
// alone your word) and you ticked it, and a line counts once its three squares do. Pure: src/lib/server/bingo.ts deals, reads and
// writes the cards; tests/bingo.test.js.
//
// A bank with fewer than eight squares leaves free squares besides the centre, placed so every line still needs one of the bank's;
// one with fewer than four deals no card (a line could be all free).

export interface BingoSquare {
  /**
   * "free"; "b:<id>", a square of the season's bank (bingo_squares); or, on a card dealt before the bank, "m:<moment>": a moment's
   * event id as the season's results record it (a talk show's moment id), as Call it keys it.
   */
  key: string;
  label: string;
}

/** How often a bank's square comes up: in most episodes, about every other one, or now and then. */
export type Likelihood = "likely" | "maybe" | "longshot";
export const LIKELIHOODS: readonly Likelihood[] = ["likely", "maybe", "longshot"];

/** A square of a bank, to deal from. */
export interface BankSquare extends BingoSquare {
  likelihood: Likelihood;
}

/** How many of each likelihood a card is dealt: eight round the centre, mostly ones that come up, one long shot. A show's own one day. */
export type BingoMix = Record<Likelihood, number>;
export const DEFAULT_MIX: BingoMix = { likely: 3, maybe: 4, longshot: 1 };

/** A likelihood a bank is short of is made up from these, nearest first. */
const STAND_IN: Record<Likelihood, Likelihood[]> = { likely: ["maybe", "longshot"], maybe: ["likely", "longshot"], longshot: ["maybe", "likely"] };

/** The seed a person's card for an episode is dealt from: the first deal's, then one per reroll. */
export const seedOf = (userId: string, seasonId: string, n: number, rerolls = 0) => `bingo|${userId}|${seasonId}|${n}${rerolls ? `|r${rerolls}` : ""}`;

export const FREE_KEY = "free";
export const FREE: BingoSquare = { key: FREE_KEY, label: "Free" };
/** Three by three, the centre free. */
export const SQUARES = 9;
export const CENTRE = 4;
/** The fewest squares a card can be dealt from: four, one for each line through the centre. */
export const MIN_MOMENTS = 4;
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** A free square (a card with no squares, a show without bingo, has none, and no lines). */
const isFree = (s: BingoSquare | undefined) => s?.key === FREE_KEY;
const tidy = (label: string) => label.replace(/\.\s*$/, "");

/** Cells in an order whose first four leave no line without one of them (a fallback when a shuffle can't). */
const COVER = [1, 3, 8, 6, 0, 2, 5, 7];

/**
 * Which eight (or as many as there are) of a bank's squares a card gets: `mix` of each likelihood, a likelihood the bank is short of
 * made up from the nearest one (STAND_IN), and a mix short of eight topped up from what's left, maybe first. A square without a
 * likelihood counts as maybe.
 */
function pick(unique: (BingoSquare & { likelihood?: Likelihood })[], mix: BingoMix, next: () => number): BingoSquare[] {
  const left = new Map(LIKELIHOODS.map((l) => [l, shuffled(unique.filter((s) => (s.likelihood ?? "maybe") === l), next)]));
  const take = (l: Likelihood, n: number) => left.get(l)!.splice(0, Math.max(0, n));
  const picked: BingoSquare[] = [];
  const short = new Map<Likelihood, number>();
  for (const l of LIKELIHOODS) {
    const got = take(l, mix[l]);
    picked.push(...got);
    short.set(l, mix[l] - got.length);
  }
  for (const l of LIKELIHOODS) {
    for (const s of STAND_IN[l]) {
      const got = take(s, short.get(l)!);
      picked.push(...got);
      short.set(l, short.get(l)! - got.length);
    }
  }
  for (const l of ["maybe", "likely", "longshot"] as const) picked.push(...take(l, SQUARES - 1 - picked.length));
  return picked.slice(0, SQUARES - 1).map(({ key, label }) => ({ key, label }));
}

/**
 * A card from a bank, dealt the same way for the same seed (seedOf: a person, a season, an episode, a reroll): eight of its squares
 * by likelihood (`mix`) in a random order round the free centre, or (fewer than eight) free squares in the gaps, never a whole line
 * of them. Null under four.
 */
export function dealCard(bank: (BingoSquare & { likelihood?: Likelihood })[], seed: string, mix: BingoMix = DEFAULT_MIX): BingoSquare[] | null {
  const unique = bank.filter((m, i) => !isFree(m) && bank.findIndex((x) => x.key === m.key) === i).map((m) => ({ ...m, label: tidy(m.label) }));
  if (unique.length < MIN_MOMENTS) return null;
  const next = randomFrom(seed);
  const picked = pick(unique, mix, next);
  const cells = [0, 1, 2, 3, 5, 6, 7, 8];
  const lay = (at: number[]) => {
    const card: BingoSquare[] = Array.from({ length: SQUARES }, () => FREE);
    at.forEach((cell, i) => (card[cell] = picked[i]));
    return card;
  };
  for (let tries = 0; tries < 40; tries++) {
    const card = lay(shuffled(cells, next).slice(0, picked.length));
    if (LINES.every((l) => l.some((i) => !isFree(card[i])))) return card;
  }
  return lay(COVER.slice(0, picked.length));
}

export type Truth = "yes" | "no" | null;

export interface LineCount {
  /** Lines whose three squares you ticked (or are free): what the card shows as you play. */
  ticked: number;
  /** The lines that are yours to count: called ones still ticked (docs/PLAN-bingo-bank.md step 3), or on a card from before the
   *  banks, every ticked line. */
  called: number;
  /** Of those, the lines whose squares all happened: what counts. */
  standing: number;
  /** Those still waiting on a square (nothing settled says it didn't happen). */
  waiting: number;
  /** Those that came off: a square in it didn't happen. */
  off: number;
}

/** A line you called BINGO on (bingo_cards.called_lines): its index into LINES, and when (ms). */
export interface CalledLine {
  line: number;
  at: number;
}

/** The lines (indexes into LINES) whose three squares you ticked (or are free). */
export function fullLines(squares: BingoSquare[], marked: ReadonlySet<number>): number[] {
  if (!squares.length) return [];
  return LINES.flatMap((line, i) => (line.every((s) => isFree(squares[s]) || marked.has(s)) ? [i] : []));
}

/** How one line stands, by what's settled of its squares: it counts, it waits on one, or it came off. */
export function lineState(squares: BingoSquare[], line: number, truth: readonly Truth[] | null): "counts" | "waiting" | "off" {
  const real = LINES[line].filter((i) => !isFree(squares[i]));
  if (truth && real.some((i) => truth[i] === "no")) return "off";
  return truth && real.every((i) => truth[i] === "yes") ? "counts" : "waiting";
}

/**
 * How a card's lines stand: `marked` the squares you ticked, `truth` what's settled of each square (null: not yet, or not for you
 * to know), `called` the lines you called BINGO on (null: a card from before the banks, whose ticked lines count by themselves).
 * Only a called line counts, and only while it's still ticked; one with a square that didn't happen comes off; a line you didn't
 * tick all of isn't yours, however it went.
 */
export function countLines(squares: BingoSquare[], marked: ReadonlySet<number>, truth: readonly Truth[] | null, called: readonly number[] | null = null): LineCount {
  const full = fullLines(squares, marked);
  const yours = called ? full.filter((l) => called.includes(l)) : full;
  const out: LineCount = { ticked: full.length, called: yours.length, standing: 0, waiting: 0, off: 0 };
  if (!truth) return out;
  for (const l of yours) {
    const state = lineState(squares, l, truth);
    if (state === "counts") out.standing++;
    else if (state === "waiting") out.waiting++;
    else out.off++;
  }
  return out;
}

/**
 * When a card's first line that still stands (or waits) was made (ms), the earliest over its lines; null with no such line. "sam
 * got a line first". With `called` (a card dealt from a bank), when each called line was called; else its last square's tick.
 */
export function firstLineAt(squares: BingoSquare[], ticks: ReadonlyMap<number, number>, truth: readonly Truth[] | null, called: readonly CalledLine[] | null = null): number | null {
  let best: number | null = null;
  const full = fullLines(squares, new Set(ticks.keys()));
  for (const l of full) {
    if (truth && lineState(squares, l, truth) === "off") continue;
    const call = called ? called.find((c) => c.line === l) : null;
    if (called && !call) continue;
    const at = call ? call.at : Math.max(...LINES[l].filter((i) => !isFree(squares[i])).map((i) => ticks.get(i)!));
    if (best === null || at < best) best = at;
  }
  return best;
}

/** What each square's moment comes to, from how each key settled (`settled`: a key's truth; free squares are always true). */
export function truthOf(squares: BingoSquare[], settled: (key: string) => Truth): Truth[] {
  return squares.map((s) => (isFree(s) ? "yes" : settled(s.key)));
}
