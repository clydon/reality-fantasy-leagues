// The scoring sequence (docs/PLAN-start-a-game-gpt.md track C, step C2; the study is under C1's As built there). Every game
// scores as one sequence of six steps, for each seat and each episode (or window) it plays:
//   1. Hold: what of yours counts for that episode (heldAt).
//   2. Score each line: a line is one holding's points in one episode, from one source: its place (placed, stillIn), its moments
//      (momentLines), a group slot's group (groupRaw), a side bet (betLines); a finale prediction and a handicap are lines of
//      their own, worked out where they're settled.
//   3. Multipliers: each line times whatever applies to it, in order (multiply: a captain, then the episode's own multiplier).
//   4. Combine: the lines into the seat's total for the episode (all of them, or your best n: best, episodeTotal), and a holding's
//      values into what it stands at (sum).
//   5. The week's result: what each episode's totals make. Here, a running total (add); a game's own walk (a streak, a life, a
//      matchup, a cut) is C2 part 2's.
//   6. Rank: the table in its order (byTotal, byKey, compareKeys), and a seat's row from its parts (total).
// Pure and plain CommonJS, like game-spec beside it (state-logic.js and the server both read it): state-logic.js reads a league
// (who held whom when, the episode's moments at the game's points, the results, the extras) and hands each step its data;
// nothing here reads a league. C2 part 1 has the drafts score through it (Outlast, a lineup, best ball, group slots, side bets,
// finale predictions, a handicap, a stock market's worth, under ScoringLogic.compute, and the knockouts' series episode by
// episode); part 2 the week's results (a pool's walk, knockouts, head to head, teams, co-op); part 3 what the server scores
// outside the state (a game of questions, Weekly Calls, bingo, a stage's table); part 4 has a spec play by each piece's place
// here instead of by one of seven shapes.
//
// Rounding is part of the sequence, exactly where each game has always done it and nowhere else (the study's "What C2 has to
// keep exactly"; tests/sequence-agree.test.js holds every draft's reads to the scorers' before it):
//   - an Outlast's places are whole numbers, never rounded; its row's total isn't either (its side bets and finale points are
//     whole too); a handicap on it rounds the total it's added to;
//   - a plain lineup (no captain, best ball, multiplier or group slots) rounds its running total after each moment, with no line
//     of its own (each moment is its line);
//   - a lineup that combines rounds each holding's raw points as its moments add up, each line (raw × captain × the episode's
//     multiplier), each group slot's line, each episode's total and the running total after it;
//   - a lineup's row rounds its total (its points, side bets and finale predictions); a market's worth rounds the team's prices,
//     then cash plus them.

/** To the cent: points are decimals (0.5 steps, a count's units: 3 × 1.1), and sums of them pick up float noise. */
function round(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// ---- 1. Hold ----

/**
 * What a seat held for episode n: what it holds now (`now`, ids in order) with each of its moves from episode n on taken back,
 * newest first. `log`: the mid-season log, oldest first, every seat's ({ playerId, episode, addedCastawayId, droppedCastawayId }).
 * A move is logged at the episode whose results came before it, so one made after episode k counts from k + 1; a move with no
 * episode is from before the game (it stands). A Set: the holdings now, less what came since, plus what went since (each added
 * back in the order it's taken back). n: Infinity is now (no move taken back).
 */
function heldAt(now, log, playerId, n) {
  const held = new Set(now);
  for (let i = (log || []).length - 1; i >= 0; i--) {
    const tx = log[i];
    if (tx.playerId !== playerId || !Number.isInteger(tx.episode) || tx.episode < n) continue;
    if (tx.addedCastawayId) held.delete(tx.addedCastawayId);
    if (tx.droppedCastawayId) held.add(tx.droppedCastawayId);
  }
  return held;
}

// ---- 2. Score each line ----

/**
 * An Outlast's line (score.by 'place'): a holding's place is a value, not points earned while it's held, so whoever holds someone
 * now has their whole place and someone let go counts for nobody. `mark`: the season as a mark sees it, { size (the cast), out
 * (the boots by then), reverse }; a place reads only its size and reverse. Someone out at `placement` (1 plus the boots before
 * theirs) has it for good; in reverse, the cast's size + 1 less it (the first one out of 18 has 18).
 */
function placed(placement, mark) {
  return mark.reverse ? mark.size + 1 - placement : placement;
}
/** Everyone still in has 1 plus the boots so far; in reverse, the cast less them (what they'd have going home next). */
function stillIn(mark) {
  return mark.reverse ? mark.size - mark.out : mark.out + 1;
}

/**
 * Each holding's moments in one episode (score.by 'moments'): `ids` the holdings that count, in order; `events` the episode's
 * moments in order, each { castawayId, points } (its points by the game's rules, a count's units in them). Map id -> raw: each
 * holding's points added up moment by moment, each sum rounded.
 */
function momentRaw(ids, events) {
  const raw = new Map(ids.map((id) => [id, 0]));
  events.forEach((ev) => {
    if (raw.has(ev.castawayId)) raw.set(ev.castawayId, round(raw.get(ev.castawayId) + ev.points));
  });
  return raw;
}
/**
 * A group slot's raw points in one episode (A10 part 1): its members' moments (`events` as momentRaw has them), their `sum`, or
 * their mean over the group as research has it (`size`: someone not on the league's cast scores nothing here and still counts in
 * the mean). Not rounded: its multiplier rounds it (multiply).
 */
function groupRaw(members, size, events, how) {
  const mine = new Set(members);
  const sum = events.filter((ev) => mine.has(ev.castawayId)).reduce((t, ev) => t + ev.points, 0);
  return how === "sum" ? sum : sum / Math.max(size, members.length);
}
/**
 * One episode's side bets as lines (extras.bets): [{ playerId, points, bet }], each right guess on a bet with company (one guessed
 * alone pays nothing: it needs two), in the order they were made, with the bet it's on.
 */
function betLines(bets) {
  const out = [];
  (bets || []).forEach((bet) => {
    if ((bet.predictions || []).length < 2) return;
    bet.predictions.forEach((pred) => {
      if (pred.correct === true) out.push({ playerId: pred.playerId, points: bet.points || 0, bet });
    });
  });
  return out;
}

// ---- 3. Multipliers ----

/** A line times each factor that applies to it, left to right (a captain's, then the episode's), rounded. */
function multiply(raw, factors) {
  let x = raw;
  for (const f of factors) x = x * f;
  return round(x);
}

// ---- 4. Combine ----

/**
 * Best ball's best n (count.best): the n lines with the most points count, a tie going to the earlier line; with n 0, every line
 * counts. Sets each line's `counted`; returns the lines.
 */
function best(lines, n) {
  lines.forEach((l) => { l.counted = !n; });
  if (n) [...lines].sort((a, b) => b.points - a.points).slice(0, n).forEach((l) => { l.counted = true; });
  return lines;
}
/** A seat's total for an episode: its counted lines, and its group slots' lines (each counts), rounded. */
function episodeTotal(lines, slots) {
  return round(lines.reduce((t, l) => t + (l.counted ? l.points : 0), 0) + (slots || []).reduce((t, l) => t + l.points, 0));
}
/** Values added up, in order, rounded (a team's prices). */
function sum(values) {
  return round(values.reduce((n, v) => n + v, 0));
}

// ---- 5. The week's result ----

/** A running total after one more line or episode: rounded at every step. */
function add(running, x) {
  return round(running + x);
}

// ---- 6. Rank, and a seat's row ----

/**
 * A seat's row total from its parts: what its holdings scored (`locked`), its side bets while they count (`bets`), its finale
 * predictions; `rounded` where its game rounds (a lineup), not where it doesn't (an Outlast's whole places).
 */
function total(row, bets, rounded) {
  const t = row.locked + (bets ? row.bonus : 0) + row.finale;
  return rounded ? round(t) : t;
}
/** Two keys compared from their first number on (positive when `a` is higher): sort with compareKeys(key(b), key(a)). */
function compareKeys(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}
/** Rows by their total, the most first (a tie keeps their order). Sorts in place. */
function byTotal(rows) {
  return rows.sort((a, b) => b.total - a.total);
}
/** Rows by a key (compareKeys), the highest first (a tie keeps their order). Sorts in place. */
function byKey(rows, key) {
  return rows.sort((a, b) => compareKeys(key(b), key(a)));
}

const api = {
  round,
  heldAt,
  placed,
  stillIn,
  momentRaw,
  groupRaw,
  betLines,
  multiply,
  best,
  episodeTotal,
  sum,
  add,
  total,
  compareKeys,
  byTotal,
  byKey,
};
// CommonJS (state-logic.js, the server, the tests); a plain script defines GameSequence, as state-logic.js's wrapper reads it.
if (typeof module === "object" && module.exports) module.exports = api;
else if (typeof self !== "undefined") self.GameSequence = api;
