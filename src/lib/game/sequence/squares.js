// The scoring sequence's pieces for squares (docs/PLAN-start-a-game-gpt.md track L, L4 part 2; the spec's `get: { by: 'squares' }`
// with `score: { by: 'squares', pays }`, game-spec schema.js squaresProblems and squaresParts). A grid of a team game's two scores'
// last digits: the first side's down the rows, the second's across the columns (the game's sides in the data's order: ESPN's
// header, the home side first), 10 by 10 (a digit a row) or 5 by 5 (two a row). Everyone takes squares (picks them, or is dealt
// them at random), then the digits are drawn at random onto the rows and columns, so nobody picks a good number. At each pay the
// spec names (the end of a period, halftime, the final score), the square of the two scores' last digits wins its points for
// whoever holds it. A square nobody holds pays nobody, or rolls its points on to the next pay; a period whose score was never read
// (a game called before it, a kept final from before its periods were kept) pays on the final score, or nobody.
// The draws are pure functions of a seed (the engine's to keep, as DrawLogic keeps a draft's), so every read deals and draws the
// same. Pure and plain CommonJS, like the sequence beside it: the engine's hook, the server, the phone and the tests share it.

/** How many squares a grid has: 100 or 25. */
const cellsOf = (grid) => grid * grid;

/** A seeded random number source (the pairs question's: answers.js pairsFrom), from a string. */
function randomOf(key) {
  let h = 2166136261;
  for (const ch of String(key)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A list shuffled by a seed (Fisher-Yates), the list untouched. */
function shuffled(list, key) {
  const out = list.slice();
  const rand = randomOf(key);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The digits drawn onto a grid's rows and columns from a seed: { rows, cols }, each `grid` groups of digits in order (a 10 by 10's
 * one digit each, a 5 by 5's two), every digit 0 to 9 once on each side. Drawn after everyone has their squares (the engine draws at
 * the lock), so a square is a place on the grid until then.
 */
function digitsOf(seed, grid) {
  const per = 10 / grid;
  const cut = (ds) => Array.from({ length: grid }, (_, i) => ds.slice(i * per, i * per + per));
  const ten = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  return { rows: cut(shuffled(ten, `${seed}|rows`)), cols: cut(shuffled(ten, `${seed}|cols`)) };
}

/** The square (0 to cells - 1, row by row) of two scores on a drawn grid: the row with the first's last digit, the column with the
 *  second's. */
function cellOf(digits, rowScore, colScore) {
  const r = digits.rows.findIndex((g) => g.includes(rowScore % 10));
  const c = digits.cols.findIndex((g) => g.includes(colScore % 10));
  return r * digits.cols.length + c;
}

/**
 * Squares dealt at random (`take: 'deal'`): each seat `each` of them (left out, as many as go round evenly), never more than go
 * round, dealt a square each in turn in the seed's order of seats: { seat: [cells], ascending }. Squares left over are nobody's.
 */
function dealSquares(seed, seats, grid, each) {
  const cells = cellsOf(grid);
  const list = [...new Set(seats)].sort();
  const out = Object.fromEntries(list.map((id) => [id, []]));
  if (!list.length) return out;
  const n = Math.min(Number.isInteger(each) && each > 0 ? each : Infinity, Math.floor(cells / list.length));
  const order = shuffled(list, `${seed}|seats`);
  const deck = shuffled(Array.from({ length: cells }, (_, i) => i), `${seed}|cells`);
  for (let i = 0; i < n * order.length; i++) out[order[i % order.length]].push(deck[i]);
  for (const id of list) out[id].sort((a, b) => a - b);
  return out;
}

/**
 * What's wrong with someone's picked squares (`take: 'pick'`), or null: a list of squares on the grid (0 to cells - 1), each once,
 * at most `each` (left out, as many as anyone likes), none another seat holds (`taken`: a Set of cells). For the engine's check of
 * a move, as answers.js answerProblem is for a question's.
 */
function pickProblem(value, grid, each, taken) {
  const cells = cellsOf(grid);
  if (!Array.isArray(value) || value.some((c) => !Number.isInteger(c) || c < 0 || c >= cells)) return `Squares are numbered 0 to ${cells - 1}`;
  if (new Set(value).size !== value.length) return 'Take each square once';
  if (Number.isInteger(each) && value.length > each) return `Take ${each} at most`;
  if (taken && value.some((c) => taken.has(c))) return 'Someone has that square already';
  return null;
}

/** When a pay comes, for its order: a period's end by its number, halftime half the regulation periods', the final last. */
function payAt(at, regulation) {
  if (at === 'final') return Infinity;
  if (at === 'half') return regulation / 2;
  return at;
}

/**
 * Where one pay's score stands in a game (SportsGameFacts: `status`, `sides`, `periods`, each period's end as each side's score
 * then, in order): { state: 'known', score: [row's, column's] }, 'waiting' (not there yet), 'unread' (the game's over and that
 * period's end was never read) or 'off' (the game wasn't played).
 */
function payScore(game, at, regulation) {
  if (!game || game.status === 'pre') return { state: 'waiting' };
  if (game.status === 'off') return { state: 'off' };
  const sides = Array.isArray(game.sides) ? game.sides : [];
  if (sides.length !== 2) return { state: 'waiting' };
  const final = game.status === 'final';
  if (at === 'final') return final ? { state: 'known', score: [sides[0].score, sides[1].score] } : { state: 'waiting' };
  const n = payAt(at, regulation);
  const end = Array.isArray(game.periods) ? game.periods[n - 1] : undefined;
  if (end && typeof end === 'object') return { state: 'known', score: [end[sides[0].id] || 0, end[sides[1].id] || 0] };
  return final ? { state: 'unread' } : { state: 'waiting' };
}

/**
 * Each pay of a squares game in one game, and what each seat won: { pays, totals }. `parts` the spec's (schema.js squaresParts:
 * { grid, pays: [{ at, points }], empty, unread }); `game` the sport's facts for the game (status, its two sides with their scores,
 * its periods' ends); `o.digits` the grid's drawn digits (digitsOf), `o.holders` { cell: seat }, `o.regulation` the sport's
 * regulation periods (Sport.periods: halftime's). Each pay, in the order they come: { at, points (with any rolled on to it), state:
 * 'paid' | 'empty' (nobody holds it) | 'void' (its period's end unread, the spec paying nobody) | 'waiting' | 'off', score, cell,
 * seat, rolled }. A period's end unread pays on the final score where the spec says so (once the final is known), else nobody (and
 * anything rolled on to it rolls on past it).
 */
function squaresPays(parts, game, o) {
  const regulation = o && Number.isInteger(o.regulation) ? o.regulation : 4;
  const holders = (o && o.holders) || {};
  const pays = parts.pays.slice().sort((a, b) => payAt(a.at, regulation) - payAt(b.at, regulation));
  const totals = {};
  const out = [];
  let carried = 0;
  for (const p of pays) {
    let s = payScore(game, p.at, regulation);
    if (s.state === 'unread' && parts.unread === 'final') s = payScore(game, 'final', regulation);
    // A void pay pays nobody and takes nothing rolled on to it: that rolls on past it.
    if (s.state === 'unread') {
      out.push({ at: p.at, points: p.points, state: 'void', score: null, cell: null, seat: null, rolled: 0 });
      continue;
    }
    const points = p.points + carried;
    const row = { at: p.at, points, state: s.state, score: null, cell: null, seat: null, rolled: carried };
    carried = 0;
    if (s.state === 'known') {
      row.score = s.score;
      row.cell = o && o.digits ? cellOf(o.digits, s.score[0], s.score[1]) : null;
      row.seat = row.cell === null ? null : holders[row.cell] || null;
      if (row.cell === null) row.state = 'waiting';
      else if (row.seat) {
        row.state = 'paid';
        totals[row.seat] = (totals[row.seat] || 0) + points;
      } else {
        row.state = 'empty';
        if (parts.empty === 'next') carried = points;
      }
    }
    out.push(row);
  }
  return { pays: out, totals };
}

/** Each seat's squares as { cell: seat } (a square is one seat's: the first listed keeps it). */
function holdersOf(squares) {
  const out = {};
  for (const [seat, cells] of Object.entries(squares || {})) for (const c of Array.isArray(cells) ? cells : []) if (!(c in out)) out[c] = seat;
  return out;
}

module.exports = { cellsOf, digitsOf, cellOf, dealSquares, pickProblem, payScore, squaresPays, holdersOf };
