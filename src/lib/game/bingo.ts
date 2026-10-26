import { callMoments, type CallBook } from "./calls";
import { randomFrom, shuffled } from "./seeded";

// Bingo (docs/PLAN-new-design.md step 12 part 3; the mock's index.html bingoSheet, show.js's bingo job, episode.js "sam got a line
// first", rulebook.js Weekly Bingo): a card per person and episode, three by three with the centre free, its squares drawn from
// the show's moments, the same ones Call it goes round (calls.ts callMoments: what research or, on a talk show, the couch can say
// happened). Ticked while watching; a square counts once it happened (the season's results, or a talk show's couch saying so) and
// you ticked it, and a line counts once its three squares do. Pure: src/lib/server/bingo.ts deals, reads and writes the cards;
// tests/bingo.test.js.
//
// A show with fewer than eight moments to draw from has free squares besides the centre, placed so every line still needs one of
// the show's; one with fewer than four has no bingo yet (a line could be all free).

export interface BingoSquare {
  /** "free", or "m:<moment>": a moment's event id as the season's results record it (a talk show's moment id), as Call it keys it. */
  key: string;
  label: string;
}

export const FREE_KEY = "free";
export const FREE: BingoSquare = { key: FREE_KEY, label: "Free" };
/** Three by three, the centre free. */
export const SQUARES = 9;
export const CENTRE = 4;
/** The fewest moments a card can be dealt from: four, one for each line through the centre. */
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

/** Every moment a show's cards draw from, most callable first (calls.ts callMoments, all of them). */
export function bingoMoments(book: CallBook): BingoSquare[] {
  return callMoments(book, Number.POSITIVE_INFINITY).map((m) => ({ key: `m:${m.id}`, label: tidy(m.label) }));
}

/** Cells in an order whose first four leave no line without one of them (a fallback when a shuffle can't). */
const COVER = [1, 3, 8, 6, 0, 2, 5, 7];

/**
 * A card from a show's moments, dealt the same way for the same seed (a person, a season, an episode): eight of them in a random
 * order round the free centre, or (fewer than eight) free squares in the gaps, never a whole line of them. Null under four.
 */
export function dealCard(moments: BingoSquare[], seed: string): BingoSquare[] | null {
  const unique = moments.filter((m, i) => !isFree(m) && moments.findIndex((x) => x.key === m.key) === i);
  if (unique.length < MIN_MOMENTS) return null;
  const next = randomFrom(seed);
  const picked = shuffled(unique, next).slice(0, SQUARES - 1);
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
  /** Ticked lines whose squares all happened: what counts. */
  standing: number;
  /** Ticked lines still waiting on a square (nothing settled says it didn't happen). */
  waiting: number;
}

/**
 * How a card's lines stand: `marked` the squares you ticked, `truth` what's settled of each square (null: not yet, or not for you
 * to know). A line with a square that didn't happen counts for nothing; one you didn't tick all of isn't yours, however it went.
 */
export function countLines(squares: BingoSquare[], marked: ReadonlySet<number>, truth: readonly Truth[] | null): LineCount {
  const out: LineCount = { ticked: 0, standing: 0, waiting: 0 };
  for (const line of LINES) {
    if (!line.every((i) => isFree(squares[i]) || marked.has(i))) continue;
    out.ticked++;
    const real = line.filter((i) => !isFree(squares[i]));
    if (!truth) continue;
    if (real.some((i) => truth[i] === "no")) continue;
    if (real.every((i) => truth[i] === "yes")) out.standing++;
    else out.waiting++;
  }
  return out;
}

/**
 * When a card's first line that still stands (or waits) was finished: its last square's tick (ms), the earliest over its lines;
 * null with no such line. "sam got a line first".
 */
export function firstLineAt(squares: BingoSquare[], ticks: ReadonlyMap<number, number>, truth: readonly Truth[] | null): number | null {
  let best: number | null = null;
  for (const line of LINES) {
    const real = line.filter((i) => !isFree(squares[i]));
    if (!real.every((i) => ticks.has(i))) continue;
    if (truth && real.some((i) => truth[i] === "no")) continue;
    const at = Math.max(...real.map((i) => ticks.get(i)!));
    if (best === null || at < best) best = at;
  }
  return best;
}

/** What each square's moment comes to, from how each key settled (`settled`: a key's truth; free squares are always true). */
export function truthOf(squares: BingoSquare[], settled: (key: string) => Truth): Truth[] {
  return squares.map((s) => (isFree(s) ? "yes" : settled(s.key)));
}
