// The scoring sequence (docs/PLAN-start-a-game-gpt.md track C, step C2; the study is under C1's As built there). Every game
// scores as one sequence of six steps, for each seat and each episode (or window) it plays:
//   1. Hold: what of yours counts for that episode (heldAt).
//   2. Score each line: a line is one holding's points in one episode, from one source: its place (placed, stillIn), its moments
//      (momentLines), a group slot's group (groupRaw), a side bet (betLines), a bounty (bountyLines), an answer's right ones at what its window is worth
//      (windowLines: a rollover's jackpot in it, jackpot and carry; a shrinking call's less, shrink), a right call or a bingo line
//      (tally); a finale prediction and a handicap are lines of their own, worked out where they're settled.
//   3. Multipliers: each line times whatever applies to it, in order (multiply: a captain, then the episode's own multiplier; a
//      parlay's legs on what each of its windows gave an answer; a line's points on a count of bingo lines, counted).
//   4. Combine: the lines into the seat's total for the episode (all of them, or your best n: best, episodeTotal), a holding's
//      values into what it stands at (sum), and a window's answers across the seats (a pot split, only the only one right: split,
//      only, onlyEach).
//   5. The week's result: what each episode's totals make: a running total (add; a count's, through); a pool's streak, life or
//      buyback (poolTally, poolPick, poolNight, poolEmptied, poolSpare); a race won, a cut, a life lost, one left (raceWon, cut,
//      cutsAfter, knockouts, livesNight, lastLeft, allOut); a matchup won, the standings and the playoffs (roundRobin, median,
//      bracket, matchups, on each episode's growth: grown); a team's points (teamStep); co-op's night and its walk (saved, coop).
//   6. Rank: the table in its order (byTotal, byKey, compareKeys, standingKey, recordKey), and a seat's row from its parts (total).
// Pure and plain CommonJS, like game-spec beside it (state-logic.js and the server both read it): state-logic.js reads a league
// (who held whom when, the episode's moments at the game's points, the results, the extras) and hands each step its data;
// nothing here reads a league. C2 part 1 has the drafts score through it (Outlast, a lineup, best ball, group slots, side bets,
// finale predictions, a handicap, a stock market's worth, under ScoringLogic.compute); part 2 the week's results (a pool's walk,
// knockouts, head to head, teams of players and co-op's night), on a draft's one walk (ScoringLogic.walk: the series at each
// episode's final results and the table at now); part 3 what the server scores outside the state, as lines it hands the sequence
// (a game of questions' windows, graded by game-spec answers.js, and its walk; Weekly Calls' right calls and bingo's lines, counted
// by calls.ts and bingo.ts; a game in stages' overall from its stages' tables); part 4 has a spec play by each piece's place here
// instead of by one of seven shapes (game-spec schema.js unplaced), and opens the combinations the sequence's order settles (part
// 4a: a shrinking call that's shared, each answer at its own worth in split, only and onlyEach; a parlay's legs that roll over,
// shrink or pay only the only one right; 4b, a pool's series of totals and a team's knocked out or racing; 4c, a draft's own
// questions, graded as a game of questions' and handed to its walk as a line of their own beside its team's).
//
// Rounding is part of the sequence, exactly where each game has always done it and nowhere else (the study's "What C2 has to
// keep exactly"; tests/sequence-agree.test.js holds every draft's reads to the scorers' before it):
//   - an Outlast's places are whole numbers, never rounded; its row's total isn't either (its side bets and finale points are
//     whole too) unless its own questions are in it (C2 part 4c: their points can be a pot's share, cents) or it has a multiplier on
//     how a holding joined (C3: each line, what a holding earns while held times its factor, rounds as it's multiplied, and so do
//     their sum and the total); a handicap on it rounds the total it's added to;
//   - a plain lineup (no captain, best ball, multiplier or group slots) rounds its running total after each moment, with no line
//     of its own (each moment is its line);
//   - a lineup that combines rounds each holding's raw points as its moments add up, each line (raw × captain × the episode's
//     multiplier), each group slot's line, each episode's total and the running total after it;
//   - a lineup's row rounds its total (its points, side bets and finale predictions); a market's worth rounds the team's prices,
//     then cash plus them;
//   - a game of questions rounds only a split pot's shares inside a window (split), each line a parlay multiplies, and its sum
//     (add, window by window); its walk's totals through each episode add a handicap rounded, as its sum is; a draft's own questions
//     (C2 part 4c) are graded the same way, their sum a line of the draft's, added into its rounded totals;
//   - a count of right calls or bingo lines is whole, never rounded, and so is a count times a line's points (a whole number);
//   - a game in stages' overall rounds its stages' points added up (sum), and their places' points.

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
/**
 * How each of a seat's holdings joined it (C3, for a multiplier on how a holding joined: factorOf's 'joined'), from the same log
 * heldAt reads: [{ id, from, to, ended, kind, nth, line }], one a stint (a holding held without a break), oldest first. The team
 * before any move (`now` with every one of its moves taken back) is the draft's (keepers included): kind 'draft', from null. Each
 * move's add is a stint of its own, from the move's episode (null: a move from before the game, which stands): kind 'replacement'
 * (a pickup for someone gone: the log's 'replenish') or 'swap' (for someone still in: 'trade'); a move's drop ends the stint it
 * let go (`to` its episode, `ended`). `nth`: the stint's place among the seat's moves of its kind, and among all its pickups
 * (Map-like { replacement, swap, pickup }: 1 the first); `line`: the same counted along the roster slot it fills (the stint it
 * dropped's, plus this move), so a replacement's replacement is the second on that slot. Held at mark n (heldAt's): from < n
 * (or from null) and, once ended, n <= to.
 */
function stints(now, log, playerId) {
  const mine = (log || []).filter((tx) => tx.playerId === playerId);
  const first = new Set(now);
  for (let i = mine.length - 1; i >= 0; i--) {
    if (mine[i].addedCastawayId) first.delete(mine[i].addedCastawayId);
    if (mine[i].droppedCastawayId) first.add(mine[i].droppedCastawayId);
  }
  const zero = () => ({ replacement: 0, swap: 0, pickup: 0 });
  const out = [];
  const open = new Map();
  for (const id of first) {
    const s = { id, from: null, to: null, ended: false, kind: "draft", nth: zero(), line: zero() };
    out.push(s);
    open.set(id, s);
  }
  const count = zero();
  for (const tx of mine) {
    const at = Number.isInteger(tx.episode) ? tx.episode : null;
    const kind = tx.type === "trade" ? "swap" : "replacement";
    const gone = tx.droppedCastawayId ? open.get(tx.droppedCastawayId) : null;
    if (gone) {
      gone.to = at;
      gone.ended = true;
      open.delete(gone.id);
    }
    // Only a move that brought someone in counts toward the Nth.
    if (!tx.addedCastawayId) continue;
    count[kind]++;
    count.pickup++;
    const base = gone ? gone.line : zero();
    const nth = zero();
    nth[kind] = count[kind];
    nth.pickup = count.pickup;
    const line = { ...base, [kind]: base[kind] + 1, pickup: base.pickup + 1 };
    const s = { id: tx.addedCastawayId, from: at, to: null, ended: false, kind, nth, line };
    out.push(s);
    open.set(s.id, s);
  }
  return out;
}
/** Whether a stint counts at mark n (an episode's number, or Infinity: now), as heldAt has it. */
function heldIn(s, n) {
  if (s.from !== null && n <= s.from) return false;
  return !s.ended || (s.to !== null && n <= s.to);
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
 * C3: an Outlast's line as what a holding earns while it's yours, in a game with a multiplier on how a holding joined (the user's
 * decision, the plan's Decisions table, "A replacement's multiplier"): a stint's (stints) place as a value where it ended (let go,
 * or mark n, whichever is first) less its value at the mark it joined (a stint from before the game: from nothing), never below 0.
 * `valueAt(m)`: the castaway's place as a value at mark m (placed, stillIn, or 0 out with no place recorded). So one drafted and
 * held all along earns its whole place, as without a multiplier; a pickup, the boots it outlasts while yours; someone let go keeps
 * for you what they earned until then. Whole, until its multiplier (multiply).
 */
function earnedWhileHeld(s, n, valueAt) {
  // Not joined by mark n, or let go before the game.
  if ((s.from !== null && n <= s.from) || (s.ended && s.to === null)) return 0;
  const end = s.ended ? Math.min(n, s.to) : n;
  return Math.max(0, valueAt(end) - (s.from === null ? 0 : valueAt(s.from)));
}

/**
 * Each holding's moments in one episode (score.by 'moments'): `ids` the holdings that count, in order; `events` the episode's
 * moments in order, each { castawayId, points } (its points by the game's rules, a count's units in them). Map id -> raw: each
 * holding's points added up moment by moment, each sum rounded.
 * C5: hits counted (score.hits), each moment then an objective hit, worth its `worth` (1, or 0 for one that isn't an objective): 'every'
 * counts every hit (its points, as without hits); 'pick' each objective once for each holding that hit it, however often; and
 * 'objective' each objective once for you, however many of your holdings hit it, on the first of `ids` (in order) that did, so
 * the lines still add up to the total. A moment worth nothing (one the game doesn't count: score.only) is no hit.
 */
function momentRaw(ids, events, hits) {
  const raw = new Map(ids.map((id) => [id, 0]));
  if (hits === "pick" || hits === "objective") {
    const order = new Map(ids.map((id, i) => [id, i]));
    // Each objective's hit: per holding, or (objective) the holding first in `ids` that did it.
    const got = new Map();
    events.forEach((ev) => {
      if (!raw.has(ev.castawayId) || !ev.worth) return;
      const key = hits === "pick" ? ev.castawayId + "\u0000" + ev.type : ev.type;
      const was = got.get(key);
      if (!was || order.get(ev.castawayId) < order.get(was.castawayId)) got.set(key, ev);
    });
    got.forEach((ev) => raw.set(ev.castawayId, round(raw.get(ev.castawayId) + ev.worth)));
    return raw;
  }
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
/**
 * One episode's bounties as lines (A14 part 3, score.bounty): points that move between seats by what the results say. `votes`:
 * [[voterId, votedForId]], each a vote for someone the episode's results say went home by it (the state's to find); `holdersOf(id)`:
 * the seats that castaway counts for that episode (step 1's holdings, a shared draft's several). Each vote moves `points` from each
 * seat holding who went home to each other seat holding who voted them out: [{ playerId, points, vote }], a seat's gain and the
 * other's loss, so the lines always add up to nothing. A seat holding both takes nothing from itself. Not multiplied (a factor on
 * one side alone would make points from nothing) and added beside the episode's total, outside best ball's best n.
 */
function bountyLines(votes, holdersOf, points) {
  const out = [];
  (votes || []).forEach((vote) => {
    const hunters = holdersOf(vote[0]) || [];
    const marks = holdersOf(vote[1]) || [];
    hunters.forEach((h) => {
      marks.forEach((t) => {
        if (h === t) return;
        out.push({ playerId: h, points, vote });
        out.push({ playerId: t, points: -points, vote });
      });
    });
  });
  return out;
}

/** The answers with anything right in a window's units (Map playerId -> units), in their order: [[playerId, units]]. */
function rightOf(units) {
  return [...units].filter(([, u]) => u > 0);
}
/**
 * A game of questions' lines in one window (C2 part 3): each answer's right ones at a point each (`units`, Map playerId -> units: the
 * grading's, game-spec answers.js pointsFor at one point, or against the bot's call the right ones it didn't name), each at what the
 * window is worth to that answer (`worthOf(playerId)`: its points, a rollover's jackpot in them, a shrinking call's less). Map
 * playerId -> points, in the units' order; an answer with nothing right, or worth nothing, has no line. Not rounded: a window's
 * points are whole, or a pot's share (split), or a parlay's (multiply).
 */
function windowLines(units, worthOf) {
  const out = new Map();
  for (const [pid, u] of rightOf(units)) {
    const n = u * worthOf(pid);
    if (n) out.set(pid, n);
  }
  return out;
}
/** A shrinking call's worth (A9's shrink): `worth` less `per` for each of `n` (the game's episodes started when it was made, or the
 *  changes made once it had), never below 0. */
function shrink(worth, per, n) {
  return Math.max(0, worth - per * n);
}
/** A window that rolls over (A9's rollover): its points with what the windows before it left unclaimed (`carried`). */
function jackpot(points, carried) {
  return points + carried;
}
/** What a window that rolls over leaves the next (`got`, Map playerId -> what each answer earned there): nothing once anyone scored,
 *  else the window's whole worth. */
function carry(worth, got) {
  return [...got.values()].some((n) => n > 0) ? 0 : worth;
}
/**
 * Right calls and bingo lines as lines (C2 part 3: calls.ts callRights, bingo.ts bingoLines): each { id, episode, n } (an account's;
 * n how many: 1 a call, a card's lines that count), added up for each one in the order they come, and each episode's too into
 * `byEpisode` when it's given (Map episode -> Map id -> n: what a stage's table reads at each episode). Whole numbers, never
 * rounded. Map id -> n.
 */
function tally(lines, byEpisode) {
  const out = new Map();
  for (const l of lines) {
    if (!l.n) continue;
    out.set(l.id, (out.get(l.id) || 0) + l.n);
    if (byEpisode) {
      const at = byEpisode.get(l.episode) || new Map();
      at.set(l.id, (at.get(l.id) || 0) + l.n);
      byEpisode.set(l.episode, at);
    }
  }
  return out;
}

// ---- 3. Multipliers ----

/** A count's points (C2 part 3): n right calls or bingo lines at a line's points each (a call's 1). Whole, as both are; never rounded,
 *  as the tables have always shown it. */
function counted(n, points) {
  return n * points;
}

/**
 * C3: one multiplier piece keyed by a condition. Every multiplier a game has is a factor { on, times, ...its condition } (game-spec
 * schema.js multipliersOf: a captain's on 'captain', each of score.times on 'when', each of score.multiply on 'joined', each parlay
 * on 'legs'; a confidence ranking's weights are on 'rank', its answer's own), and a line's `facts` say which hold:
 *   captain  facts.captain, the line is the captain's;
 *   when     facts.episode in its window (inWindow): an episode, a run (from, to), a phase (facts.phase(id)), the finale (facts.finale());
 *   joined   facts.stint, how the holding joined (stints), is of the kind it names (joinedTimes);
 *   legs     facts.legs, every leg of the parlay right;
 *   rank     facts.rank, the weight itself (a confidence ranking's place from the bottom).
 * The factor's times when its condition holds, else 1 (a factor of 1 changes no line: x × 1 is x exactly).
 */
function factorOf(f, facts) {
  switch (f.on) {
    case "captain": return facts.captain ? f.times : 1;
    case "when": return inWindow(f, facts) ? f.times : 1;
    case "joined": return joinedTimes(f, facts.stint);
    case "legs": return facts.legs ? f.times : 1;
    case "rank": return Number.isFinite(facts.rank) ? facts.rank : 1;
    default: return 1;
  }
}
/** Whether an episode (facts.episode) is in a 'when' factor's window: its episode, its run (to null or left out: the season's end),
 *  its phase (facts.phase(id), as the data has it), or the finale (facts.finale(): the episode that ended the season, or null). */
function inWindow(t, facts) {
  const n = facts.episode;
  if (Number.isInteger(t.episode)) return n === t.episode;
  if (Number.isInteger(t.from)) return n >= t.from && (t.to === undefined || t.to === null || n <= t.to);
  if (typeof t.phase === "string") return !!facts.phase && facts.phase(t.phase);
  if (t.finale === true) return !!facts.finale && n === facts.finale();
  return false;
}
/**
 * A 'joined' factor's times for a stint (stints): 1 unless the stint joined the way it names (draft: drafted or kept; pickup: any
 * move; replacement: a pickup for someone gone; swap: for someone still in). Its `times` a number, or a list for the Nth of its
 * kind: per team (the stint's nth, the seat's Nth such move) or per slot (its line, the Nth along the roster slot it fills); past
 * the list, the last again (then 'repeat', the default) or on by the list's last step (then 'ratio': [0.5, 0.25] goes on 0.125).
 */
function joinedTimes(f, s) {
  if (!s) return 1;
  const k = f.joined;
  if (k === "draft" ? s.kind !== "draft" : k === "pickup" ? s.kind === "draft" : s.kind !== k) return 1;
  if (!Array.isArray(f.times)) return f.times;
  const n = (f.per === "slot" ? s.line : s.nth)[k] || 1;
  const list = f.times;
  if (n <= list.length) return list[n - 1];
  const last = list[list.length - 1];
  if (f.then !== "ratio") return last;
  const step = list.length > 1 ? last / list[list.length - 2] : last;
  return last * Math.pow(step, n - list.length);
}

/** A line times each factor that applies to it, left to right (a captain's, then the episode's, then how it joined), rounded. */
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
/** Values added up, in order, rounded (a team's prices; a game in stages' points across its stages, and its places' points). */
function sum(values) {
  return round(values.reduce((n, v) => n + v, 0));
}
// The three shares below take the window's `worth` (a number), or each answer's (C2 part 4: a function of its playerId, a shrinking
// call's worth when it was made): the lines at their worth (step 2) come before the share (step 4), so a shrinking call that's shared
// is each right call at its own worth, shared.
const worthFn = (worth) => (typeof worth === "function" ? worth : () => worth);
/** A pot split (a question's share 'split'): the window's `worth` between everyone right, by their units (windowLines' `units`),
 *  each share rounded to the cent (a pot of 10 three ways is 3.33 each). With each answer's own worth (a shrinking call), each one's
 *  units at its own worth, divided between everyone right with a call worth something, by their units: one right alone keeps what
 *  its call is worth, calls worth the same split it as a pot, and a call that's shrunk to nothing takes no share. A window worth
 *  nothing to anyone right: nothing each. */
function split(worth, units) {
  const out = new Map();
  const at = worthFn(worth);
  const right = rightOf(units);
  const total = right.reduce((n, [pid, u]) => n + (at(pid) > 0 ? u : 0), 0);
  for (const [pid, u] of right) out.set(pid, total ? round((at(pid) * u) / total) : 0);
  return out;
}
/** Only the only one right (share 'only'): their units at `worth` (or at their own) when exactly one answer has anything right,
 *  else nobody. */
function only(worth, units) {
  const out = new Map();
  const right = rightOf(units);
  if (right.length === 1) out.set(right[0][0], right[0][1] * worthFn(worth)(right[0][0]));
  return out;
}
/** Only the only one right on a person or group answer (A9 part 2): each right pick (`by`: Map pick -> [playerId] who named it, in
 *  the answers' order) named by one alone scores `worth` (or their own) for them, so two each alone on a different right one both do. */
function onlyEach(worth, by) {
  const out = new Map();
  const at = worthFn(worth);
  for (const [, pids] of by) if (pids.length === 1) out.set(pids[0], (out.get(pids[0]) || 0) + at(pids[0]));
  return out;
}
/**
 * C6, money: a window's stakes as lines, apart from the question's points (a stake is never shared, rolled over or shrunk: it's the
 * answer's own). `bets`: [{ playerId, stake, right }] (each stake more than 0, right true or false; one that didn't count either way,
 * a void pick, isn't in it). Even money (`odds` 'even', A8's wager): right wins the stake, wrong loses it. The pool ('pool', the
 * couch's own odds: a tote): the wrong stakes are a pot split between the right ones by their stakes, to the cent, the shares adding up
 * to the pot exactly (each its cents rounded down, the cents left over one each to the largest remainders, the first first), wrong
 * loses the stake; nobody right, every stake comes back (nothing either way). Map playerId -> points, in the bets' order; a
 * stake that comes to nothing (the pool when everyone's right) has no line.
 */
function stakes(bets, odds) {
  const out = new Map();
  const put = (pid, n) => {
    if (n) out.set(pid, round((out.get(pid) || 0) + n));
  };
  if (odds === "pool") {
    const on = bets.reduce((n, b) => n + (b.right ? b.stake : 0), 0);
    if (!on) return out;
    const cents = Math.round(bets.reduce((n, b) => n + (b.right ? 0 : b.stake), 0) * 100);
    const right = bets.map((b, i) => ({ b, i, exact: b.right ? (cents * b.stake) / on : 0 })).filter((x) => x.b.right);
    const share = new Map(right.map((x) => [x.i, Math.floor(x.exact)]));
    let left = cents - [...share.values()].reduce((n, c) => n + c, 0);
    const rest = (x) => x.exact - Math.floor(x.exact);
    for (const x of [...right].sort((p, q) => rest(q) - rest(p) || p.i - q.i)) {
      if (left <= 0) break;
      share.set(x.i, share.get(x.i) + 1);
      left--;
    }
    bets.forEach((b, i) => put(b.playerId, b.right ? share.get(i) / 100 : -b.stake));
    return out;
  }
  for (const b of bets) put(b.playerId, b.right ? b.stake : -b.stake);
  return out;
}
/** C6: a window's lines from two sources added up for each seat (a wagered question's points and its stakes), in the order they come
 *  (the first's, then any only the second has), each to the cent. */
function plus(a, b) {
  const out = new Map(a);
  for (const [pid, n] of b) out.set(pid, round((out.get(pid) || 0) + n));
  return out;
}

// ---- 5. The week's result ----
// What each episode's totals make, for each seat (or each side: a team of players): a running total; a pool's streak, life or
// buyback; a race won, a cut, one left; a matchup won, the standings and the playoffs; a team's points; co-op's night. Each reads a
// game's series, its totals through each episode it has played with its final results (state-logic.js ScoringLogic.walk for a
// draft, AnswerLogic.walk for a game of questions), or a pool's nights; none reads a league.

/** A running total after one more line or episode: rounded at every step. */
function add(running, x) {
  return round(running + x);
}
/** A count's running total through each episode from `from` to `to` (C2 part 3: Weekly Calls' and bingo's, for a stage's table
 *  at each episode): Map episode -> Map id -> the count through it, from `byEpisode` (tally's). Whole, never rounded. */
function through(byEpisode, from, to) {
  const out = new Map();
  const run = new Map();
  for (let e = from; e <= to; e++) {
    for (const [id, n] of byEpisode.get(e) || []) run.set(id, (run.get(id) || 0) + n);
    out.set(e, new Map(run));
  }
  return out;
}
/** What one episode added to a side's points: its total through it (`totals`, a Map) less its total through the one before
 *  (`before`, a Map, or null for none), rounded. */
function grown(totals, before, id) {
  return round((totals.get(id) || 0) - (before ? before.get(id) || 0 : 0));
}

// A pool (score.by 'survive'): each seat's tally, a night at a time.

/**
 * A seat's tally in a pool: its streak now and its longest, its points, its lives (null: none, nobody's out), its mulligans and
 * buybacks left, what buybacks have cost, the episode it went out in for good (null while in), whether it shares the win (the night
 * everyone left went out). `parts`: the pool's lives, mulligans and buyback (PickEmLogic.parts), or null for a plain pool.
 */
function poolTally(parts) {
  return {
    current: 0, longest: 0, total: 0, lives: parts ? parts.lives : null, mulligans: parts ? parts.mulligans : 0,
    buybacks: parts && parts.buyback ? parts.buyback.times : 0, cost: 0, out: null, shared: false,
  };
}
/**
 * One pick's outcome on a tally: right, the streak grows and it scores `points`; wrong, a mulligan forgives it, else the streak
 * resets and, with lives left, it costs one. { correct, points, forgiven?, lifeLost? }.
 */
function poolPick(t, right, points) {
  if (right) {
    t.current++;
    t.total += points;
    t.longest = Math.max(t.longest, t.current);
    return { correct: true, points };
  }
  if (t.mulligans > 0) {
    t.mulligans--;
    return { correct: false, points: 0, forgiven: true };
  }
  t.current = 0;
  if (t.lives === null || t.lives === 0) return { correct: false, points: 0 };
  t.lives--;
  return { correct: false, points: 0, lifeLost: true };
}
/**
 * A night's picks (`judged`: [[key, right]], its first pick and a second that counted): its right ones first, then its wrong ones,
 * so a night with a wrong pick ends the streak whichever pick it was. Each key's outcome (poolPick).
 */
function poolNight(t, judged, points) {
  const outcome = {};
  judged.filter(([, right]) => right).forEach(([k]) => { outcome[k] = poolPick(t, true, points); });
  judged.filter(([, right]) => !right).forEach(([k]) => { outcome[k] = poolPick(t, false, points); });
  return outcome;
}
/**
 * A night (episode n) that emptied a seat's lives: bought back, with a buyback left and `can(n)` (its deadline not passed): one
 * life again from the next episode, the buyback's cost off its points; returns { back: cost }. Else out for good: { out: n }. Null
 * while it has lives left, or has none to lose.
 */
function poolEmptied(t, n, buyback, can) {
  if (t.lives !== 0) return null;
  if (t.buybacks > 0 && can(n)) {
    t.buybacks--;
    t.lives = 1;
    t.cost += buyback.cost;
    t.total -= buyback.cost;
    return { back: buyback.cost };
  }
  t.out = n;
  return { out: n };
}
/**
 * The night that sent a seat out taken back (allOut 'back', episode n): in again with the lives, mulligans and streak it had before
 * it (`was`), a right second pick's points kept. False when it didn't go out that night.
 */
function poolSpare(t, n, was) {
  if (t.out !== n) return false;
  t.out = null;
  t.lives = was.lives;
  t.mulligans = was.mulligans;
  t.current = was.current;
  return true;
}
/** Everyone left going out the same night (`went` of the `left` still in at its start, two or more): a pool's allOut night, and a
 *  game of questions' with lives. */
function allOut(went, left) {
  return went >= 2 && went === left;
}
/** One or none left of everyone (`everyone`, two or more to start with; `isIn(id)`): where oneLeft 'ends' ends the game. */
function lastLeft(everyone, isIn) {
  return everyone.length >= 2 && everyone.filter(isIn).length <= 1;
}

// Knockouts (rank.race, rank.cut): on a series of totals.

/** A race won after an episode: anyone who can finish it (`ids`) on `to` points or more (`total(id)`, through that episode). */
function raceWon(ids, total, to) {
  return ids.some((id) => total(id) >= to);
}
/**
 * Who a cut sends home (`c`: { out, tie }): the bottom `out` (or half, rounded down) of those left (`left`, ids) by `key(id)`
 * (lowest first, compared from its first number on), never everyone; a tie at the line keeps them all, or sends them all (tie
 * 'all') unless that's everyone left.
 */
function cut(left, key, c) {
  const n = left.length;
  const count = Math.min(c.out === "half" ? Math.floor(n / 2) : c.out, n - 1);
  if (!(count >= 1)) return [];
  const ranked = left.map((id) => ({ id, key: key(id) })).sort((a, b) => compareKeys(a.key, b.key));
  const line = ranked[count - 1].key;
  const below = ranked.filter((r) => compareKeys(r.key, line) < 0);
  const at = ranked.filter((r) => compareKeys(r.key, line) === 0);
  if (below.length + at.length <= count) return [...below, ...at].map((r) => r.id);
  if (c.tie === "all" && below.length + at.length < n) return [...below, ...at].map((r) => r.id);
  return below.map((r) => r.id);
}
/**
 * The cuts after episode k, each in turn on who's left then: every n episodes of the game by the points over them (`before(n)`:
 * the totals through the last episode walked at or before n), ties to the total (the guillotine); after an episode, or the episode
 * before a phase starts (`phaseStarts`, as data has them), by the total. A night nobody goes home (`quiet`) has no cut where the cut
 * skips it. Who goes is set in `out` (id -> k).
 *   o: { k, start, quiet, inAt(k) (ids who can be cut), total(id) (through k), before(n), out (Map), phaseStarts }
 */
function cutsAfter(cuts, o) {
  cuts.forEach((c) => {
    const left = o.inAt(o.k);
    if (left.length < 2) return;
    const skip = o.quiet && c.quiet === "skip";
    let key = null;
    if (Number.isInteger(c.at.every)) {
      if ((o.k - o.start + 1) % c.at.every !== 0 || skip) return;
      const before = o.before(o.k - c.at.every);
      key = (id) => [o.total(id) - (before ? before.get(id) || 0 : 0), o.total(id)];
    } else if (Number.isInteger(c.at.episode)) {
      if (o.k !== c.at.episode || skip) return;
      key = (id) => [o.total(id)];
    } else if (typeof c.at.phase === "string") {
      const from = o.phaseStarts && o.phaseStarts[c.at.phase];
      if (!Number.isInteger(from) || o.k !== from - 1 || skip) return;
      key = (id) => [o.total(id)];
    }
    if (key) cut(left, key, c).forEach((id) => o.out.set(id, o.k));
  });
}
/**
 * A night's lives lost (C2 part 3: a game of questions with lives, score.lives): `lost` (Map id -> the lives the night cost each who
 * could lose one, o.ids) on `lives` (Map id -> lives left). Whoever has none left goes out at k; everyone left (o.left, two or more)
 * going out the same night (allOut) all come back with the lives they had ('back'), go out sharing it ('share', into o.shared), or go
 * out as anyone does ('points').
 *   o: { k, ids, left, out (Map), shared (Set), allOut }
 */
function livesNight(lives, lost, o) {
  const gone = o.ids.filter((id) => lives.get(id) - (lost.get(id) || 0) <= 0);
  const all = allOut(gone.length, o.left.length);
  if (all && o.allOut === "back") return;
  lost.forEach((n, id) => lives.set(id, Math.max(0, lives.get(id) - n)));
  gone.forEach((id) => {
    o.out.set(id, o.k);
    if (all && o.allOut === "share") o.shared.add(id);
  });
}
/**
 * The knockouts walked over a series (each episode's totals: [{ number, quiet, totals }]): after each, a race won ends the game there
 * (the most points then win); else its lives lost (o.lives), then its cuts; then one left (oneLeft 'ends', with lives or cuts) ends
 * it. Who can be cut, lose a life or finish a race after episode k: in, started by then and caught up. A draft's series is its totals
 * (KnockoutLogic.walk); a game of questions' (C2 part 3: AnswerLogic.walk) is worked out as the walk goes, since someone out takes no
 * share of anyone's points from then on: an episode's `totals` can be a function of who's out so far (Map id -> episode), and its
 * `lives(ids, out)` says what the night cost each of those who could lose one (once no race has ended it), both read before anything
 * that night moves anyone.
 *   o: { start, everyone: [id] (in it: whatever their start), catching: Set (still catching up), startOf: Map id -> their start (null:
 *   the game's), race: { to } | null, cuts, oneLeft, phaseStarts, lives: { of (each one's at the start), allOut } | null, broke?: true
 *   (C6: a bank that runs out, whoever's on 0 or less after a night out), playing?:
 *   (id, k) => whether a side plays episode k (C2 part 4b: a team someone still in the game is on then; left out, every side does):
 *   one that doesn't can't be cut or finish a race then, and isn't left when one left ends it }
 * Returns { out: Map id -> the last episode that counts for them, ends: the episode the game ended at, or null, lives: Map id -> left
 * (null without lives), shared: Set (out together, sharing it), walked: [{ number, quiet, totals }] (each episode walked, its
 * totals a Map) }.
 */
function knockouts(series, o) {
  const out = new Map();
  const plays = (id, k) => !o.playing || o.playing(id, k);
  const inAt = (k) => o.everyone.filter((id) => !out.has(id) && !o.catching.has(id) && (o.startOf.get(id) || o.start) <= k && plays(id, k));
  const lives = o.lives ? new Map(o.everyone.map((id) => [id, o.lives.of])) : null;
  const shared = new Set();
  const walked = [];
  let ends = null;
  for (let i = 0; i < series.length && ends === null; i++) {
    const night = series[i];
    const k = night.number;
    const totals = typeof night.totals === "function" ? night.totals(out) : night.totals;
    walked.push({ number: k, quiet: night.quiet, totals });
    const total = (id) => totals.get(id) || 0;
    if (o.race && raceWon(inAt(k), total, o.race.to)) {
      ends = k;
      break;
    }
    const lost = lives && night.lives ? night.lives(inAt(k), out) : null;
    if (lost && lost.size) livesNight(lives, lost, { k, ids: inAt(k), left: o.everyone.filter((id) => !out.has(id)), out, shared, allOut: o.lives.allOut });
    // C6: a bank that runs out (o.broke): whoever's in with nothing left after the night goes out at k, before its cuts.
    if (o.broke) inAt(k).filter((id) => total(id) <= 0).forEach((id) => out.set(id, k));
    const before = (n) => {
      const x = walked.slice(0, i).filter((y) => y.number <= n).pop();
      return x ? x.totals : null;
    };
    cutsAfter(o.cuts, { k, start: o.start, quiet: night.quiet, inAt, total, before, out, phaseStarts: o.phaseStarts });
    if ((lives || o.cuts.length || o.broke) && o.oneLeft === "ends" && lastLeft(o.everyone, (id) => !out.has(id) && plays(id, k))) ends = k;
  }
  return { out, ends, lives, shared, walked };
}

// Head to head (rank.by 'matchups'): on the sides' series.

/**
 * Round r of a round robin over `ids` (the circle method: the first stays put, the rest turn a place each round), as pairs [a, b], b
 * null for whoever an odd list leaves out that round. One alone plays nobody.
 */
function roundRobin(ids, r) {
  if (ids.length < 2) return [];
  const list = ids.length % 2 ? [...ids, null] : ids.slice();
  const n = list.length;
  const turn = ((r % (n - 1)) + (n - 1)) % (n - 1);
  const rest = list.slice(1);
  const circle = [list[0], ...rest.slice(rest.length - turn), ...rest.slice(0, rest.length - turn)];
  const pairs = [];
  for (let i = 0; i < n / 2; i++) {
    const a = circle[i];
    const b = circle[n - 1 - i];
    pairs.push(a === null ? [b, null] : [a, b]);
  }
  return pairs;
}
/** The middle of some points (the mean of the middle two of an even count, rounded); 0 for none. */
function median(values) {
  const v = values.slice().sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : round((v[m - 1] + v[m]) / 2);
}
/** A bracket's first-round order of seeds for `size` places (a power of two): the best against the lowest, the top two meeting only
 *  in the final ([1, 4, 2, 3]). Consecutive places play each other. */
function bracket(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}
/**
 * Head to head walked over the sides' series ([{ number, totals }]: each side's points through each episode played): each
 * regular-season episode a round robin of the sides playing then, on what that episode added (grown); more wins it, the same is a
 * tie; whoever an odd list leaves out plays the median of everyone else (odd 'median') or sits out ('bye'); a night nobody scores
 * counts for nobody (quiet 'skip') or ties everyone ('tie'). The standings: wins (a tie half), then the regular season's points.
 * The playoffs from `from`: the top `teams` seeded once every episode before them has been played (or the season ended first), a
 * bracket a round an episode, a tie or a quiet night to the better seed, a seed past the field a bye; nothing after the season's
 * finale plays (a season over with rounds still to play: the best seed still in wins).
 *   o: { parts: { odd, quiet, playoffs: { teams, rounds } | null }, start, from (null: no playoffs, or not placed yet), finale (the
 *   season's finale's number once it's over, else null), ended (the season over), sides: [id], seatsAt(k): [id] (the sides in it at
 *   k, in the order they joined) }
 * Returns { weeks, records, from, seeds, rounds, alive, champion, tiers } (MatchupLogic.walk's, state-logic.js).
 */
function matchups(series, o) {
  const { parts, start, from, finale } = o;
  const records = new Map();
  const rec = (id) => {
    if (!records.has(id)) records.set(id, { wins: 0, losses: 0, ties: 0, for: 0, against: 0 });
    return records.get(id);
  };
  const tally = (id, theirs, result) => {
    const r = rec(id);
    r.against = round(r.against + theirs);
    if (result === "win") r.wins++;
    else if (result === "loss") r.losses++;
    else r.ties++;
  };
  const weeks = [];
  const playoff = new Map();
  let before = null;
  for (const x of series) {
    const k = x.number;
    const pts = new Map(o.sides.map((id) => [id, grown(x.totals, before ? before.totals : null, id)]));
    before = x;
    if (from !== null && k >= from) {
      playoff.set(k, pts);
      continue;
    }
    if (finale !== null && k > finale) continue;
    const seats = o.seatsAt(k);
    seats.forEach((id) => {
      const r = rec(id);
      r.for = round(r.for + (pts.get(id) || 0));
    });
    const quiet = seats.length > 0 && seats.every((id) => !pts.get(id));
    const games = roundRobin(seats, k - start).map(([a, b]) => {
      const aPoints = pts.get(a) || 0;
      if (b === null && parts.odd === "bye") return { a, b: null, aPoints, bPoints: null, result: null };
      const bPoints = b === null ? median(seats.filter((id) => id !== a).map((id) => pts.get(id) || 0)) : pts.get(b) || 0;
      const result = quiet ? (parts.quiet === "tie" ? "tie" : null) : aPoints > bPoints ? "a" : bPoints > aPoints ? "b" : "tie";
      if (result !== null) {
        tally(a, bPoints, result === "a" ? "win" : result === "b" ? "loss" : "tie");
        if (b !== null) tally(b, aPoints, result === "b" ? "win" : result === "a" ? "loss" : "tie");
      }
      return { a, b, aPoints, bPoints, result };
    });
    weeks.push({ number: k, quiet, games });
  }
  const out = { weeks, records, from, seeds: null, rounds: [], alive: new Set(), champion: null, tiers: new Map() };
  // Seeded once every episode before the playoffs has been played (the series reached the one before their first), or once the
  // season ended first: the standings as they are.
  const reached = series.length ? series[series.length - 1].number : null;
  if (from === null || !((reached !== null && reached >= from - 1) || o.ended)) return out;
  const key = (id) => {
    const r = records.get(id);
    return r ? [r.wins * 2 + r.ties, r.for] : [0, 0];
  };
  const ranked = o.seatsAt(from).map((id, i) => ({ id, i, key: key(id) })).sort((a, b) => compareKeys(b.key, a.key) || a.i - b.i);
  const n = Math.min(parts.playoffs.teams, ranked.length);
  if (n < 2) return out;
  const seeds = ranked.slice(0, n).map((r) => r.id);
  out.seeds = seeds;
  seeds.forEach((id) => out.tiers.set(id, 1));
  // A bracket of the spec's size; a seed past the field's is a bye.
  let alive = bracket(2 ** parts.playoffs.rounds).map((s) => (s <= n ? s : null));
  for (let j = 0; j < parts.playoffs.rounds; j++) {
    const number = from + j;
    const pts = finale !== null && number > finale ? null : playoff.get(number) || null;
    const games = [];
    const next = [];
    for (let g = 0; g < alive.length; g += 2) {
      const a = alive[g];
      const b = alive[g + 1];
      const game = { a: a === null ? null : seeds[a - 1], b: b === null ? null : seeds[b - 1], aSeed: a, bSeed: b, aPoints: null, bPoints: null, winner: null };
      let w;
      if (a === null || b === null) {
        // A bye: the seed there goes through.
        w = a === null ? b : a;
      } else if (pts) {
        game.aPoints = pts.get(game.a) || 0;
        game.bPoints = pts.get(game.b) || 0;
        // A tie, or a night nobody scores, goes to the better seed.
        w = game.aPoints > game.bPoints ? a : game.bPoints > game.aPoints ? b : Math.min(a, b);
      }
      if (Number.isInteger(w) && (pts || a === null || b === null)) game.winner = seeds[w - 1];
      next.push(pts ? (Number.isInteger(w) ? w : null) : undefined);
      games.push(game);
    }
    out.rounds.push({ number, played: !!pts, games });
    if (!pts) break;
    next.forEach((s) => { if (Number.isInteger(s)) out.tiers.set(seeds[s - 1], j + 2); });
    alive = next;
  }
  const still = alive.filter((s) => Number.isInteger(s));
  still.forEach((s) => out.alive.add(seeds[s - 1]));
  const last = out.rounds[out.rounds.length - 1];
  if (out.rounds.length === parts.playoffs.rounds && last.played) out.champion = last.games[0].winner;
  // The season over with rounds still to play: the best seed still in.
  else if (o.ended && still.length) out.champion = seeds[Math.min(...still) - 1];
  if (out.champion) {
    out.tiers.set(out.champion, parts.playoffs.rounds + 1);
    out.alive = new Set([out.champion]);
  }
  return out;
}

/**
 * A week's winner (C5: rank.by 'weeks'), each episode on the sides' series of totals (`series`, as matchups reads it): whoever of
 * those in it then (`o.seatsAt(k)`) added the most that episode wins the week (less lost, where points can be lost); ties as `o.ties` says (all: each tied wins it; split:
 * a share of one each; none: nobody does); a week nobody in it scored anything is won by nobody; nothing after the season's finale
 * (`o.finale`) counts. Returns { weeks: [{ number, winners, top }], won: Map id -> weeks won (a split's shares rounded), points: Map
 * id -> what they scored in the weeks they were in it }.
 */
function weeks(series, o) {
  const won = new Map();
  const points = new Map();
  const out = [];
  let before = null;
  for (const x of series) {
    const k = x.number;
    const was = before;
    before = x;
    if (o.finale !== null && o.finale !== undefined && k > o.finale) continue;
    const seats = o.seatsAt(k);
    const pts = new Map(seats.map((id) => [id, grown(x.totals, was ? was.totals : null, id)]));
    seats.forEach((id) => points.set(id, round((points.get(id) || 0) + pts.get(id))));
    const top = seats.length ? Math.max(...seats.map((id) => pts.get(id))) : 0;
    let winners = seats.some((id) => pts.get(id)) ? seats.filter((id) => pts.get(id) === top) : [];
    if (winners.length > 1 && o.ties === "none") winners = [];
    const share = o.ties === "split" && winners.length ? 1 / winners.length : 1;
    // A split's shares add up unrounded (three thirds make a whole week), rounded once at the end.
    winners.forEach((id) => won.set(id, (won.get(id) || 0) + share));
    out.push({ number: k, winners, top });
  }
  won.forEach((n, id) => won.set(id, round(n)));
  return { weeks: out, won, points };
}

// Teams of players (rank.teams) and co-op (rank.by 'coop').

/** One episode added to each team's points (`run`, Map team -> points): its members' growth then (`grown`, Map team -> [points],
 *  each member on it that episode), summed (how 'sum') or their mean, rounded. A team with nobody on it that episode adds nothing. */
function teamStep(run, grown, how) {
  grown.forEach((gs, t) => {
    const s = gs.reduce((a, b) => a + b, 0);
    run.set(t, round(run.get(t) + (how === "sum" ? s : s / gs.length)));
  });
}
/** Co-op's night: saved (no life lost) when enough of those who answered (`said`) saw it coming (`right`): one of them (saves
 *  'one'), more than half ('most') or every one ('all'). */
function saved(said, right, saves) {
  return saves === "all" ? said > 0 && right === said : saves === "most" ? right * 2 > said : right > 0;
}
/**
 * Co-op walked over its series (C2 part 3: rank.by 'coop', a game of questions'): the couch's lives together (o.lives), nobody
 * knocked out; each episode costs one for each question it lost (its `missed(out)`: the questions a life rode on that not enough of
 * the couch saw coming, saved), and at none left the game ends there. Its totals and its missed as knockouts' (nobody's out here).
 * Returns { lives: left, lost: [{ episode, question }], ends: the episode the last went, or null, walked: [{ number, quiet, totals }] }.
 */
function coop(series, o) {
  let left = o.lives;
  const lost = [];
  const walked = [];
  let ends = null;
  const nobody = new Map();
  for (const night of series) {
    const k = night.number;
    const missed = night.missed(nobody);
    const totals = typeof night.totals === "function" ? night.totals(nobody) : night.totals;
    walked.push({ number: k, quiet: night.quiet, totals });
    missed.forEach((question) => lost.push({ episode: k, question }));
    left = Math.max(0, left - missed.length);
    if (left === 0) {
      ends = k;
      break;
    }
  }
  return { lives: left, lost, ends, walked };
}

// ---- 6. Rank, and a seat's row ----

/**
 * A seat's row total from its parts: what its holdings scored (`locked`), its side bets while they count (`bets`), its finale
 * predictions, and (C2 part 4c) a draft's own questions' points (`questions`, where the game has them); `rounded` where its game
 * rounds (a lineup, or an Outlast once its own questions are in it: a pot's share is cents), not where it doesn't (an Outlast's
 * whole places).
 */
function total(row, bets, rounded) {
  const t = row.locked + (bets ? row.bonus : 0) + row.finale + (row.questions || 0) + (row.bounty || 0);
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
/**
 * Last one standing's order as a key (higher first): whoever's still in before whoever's out; those in by their points, then lives
 * left; those out by the episode they went out in (later first), then their points; those who share the win (`shared`: out the
 * night everyone left went out) tie, whatever their points. A row: { out (null while in), total, lives?, shared? }.
 */
function standingKey(r) {
  const out = Number.isInteger(r.out) ? r.out : null;
  return out === null ? [1, r.total, r.lives || 0] : [0, out, r.shared ? 0 : r.total];
}
/** Head to head's order as a key (higher first): how far in the playoffs (tier), wins (a tie half), the regular season's points,
 *  then the better seed. A record: { tier, wins, ties, for, seed (null or 0: none) }. */
function recordKey(m) {
  return [m.tier, m.wins * 2 + m.ties, m.for, m.seed ? -m.seed : 0];
}

const api = {
  round,
  heldAt,
  stints,
  heldIn,
  placed,
  stillIn,
  earnedWhileHeld,
  momentRaw,
  groupRaw,
  betLines,
  bountyLines,
  windowLines,
  shrink,
  jackpot,
  carry,
  tally,
  counted,
  factorOf,
  inWindow,
  joinedTimes,
  multiply,
  best,
  episodeTotal,
  sum,
  split,
  only,
  onlyEach,
  stakes,
  plus,
  add,
  through,
  grown,
  poolTally,
  poolPick,
  poolNight,
  poolEmptied,
  poolSpare,
  allOut,
  lastLeft,
  raceWon,
  cut,
  cutsAfter,
  livesNight,
  knockouts,
  roundRobin,
  median,
  bracket,
  matchups,
  weeks,
  teamStep,
  saved,
  coop,
  total,
  compareKeys,
  byTotal,
  byKey,
  standingKey,
  recordKey,
};
// CommonJS (state-logic.js, the server, the tests); a plain script defines GameSequence, as state-logic.js's wrapper reads it.
if (typeof module === "object" && module.exports) module.exports = api;
else if (typeof self !== "undefined") self.GameSequence = api;
