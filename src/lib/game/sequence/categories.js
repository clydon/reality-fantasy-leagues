// The scoring sequence's pieces for a game ranked by a sport's categories (docs/PLAN-start-a-game-gpt.md track L, L4 part 1b; the
// spec's `score: { by: 'stats', categories }` with `rank.by` 'categories', 'matchups' or 'roto', game-spec schema.js
// categoryProblems). A categories game never turns a line into points: each seat's counted holdings' lines over a window (a week
// of matchups, the season so far) add up into a total for each category, and the totals are compared, head to head (each
// category won, lost or tied: Yahoo's "each category"; whoever wins more of them: "most categories") or across everyone (roto:
// each category ranks the table, points by rank, the tied sharing theirs).
// A count adds; a derived stat (total bases, a quality start) is each game's, added up; a rate (FG%, ERA) is worked out from the
// window's counts added, never an average of each game's: its parts are data (the Sport's StatDef.parts, rateOf), so the engine
// works one out without the sport's code. Pure and plain CommonJS, like the sequence beside it: the engine's hook, the server,
// the phone and the tests share it.
/* eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, as the sequence beside it */
const { roundRobin } = require('./index.js');

const cents = (n) => Math.round(n * 100) / 100;
// A window's counts added: whole numbers add exactly, a derived stat's thirds (innings pitched) pick up float noise, kept off here.
const tidy = (n) => Math.round(n * 1e6) / 1e6;

/** Counts weighted and added ({ PH: 3, PBB: 3 } of a line: three times the hits and walks allowed). */
function weigh(counts, weights) {
  let n = 0;
  for (const [k, w] of Object.entries(weights)) n += (counts[k] || 0) * w;
  return n;
}

/**
 * A rate from its parts ({ top, bottom }: weighted counts over weighted counts; ERA's { ER: 27 } over { OUTS: 1 }) and someone's
 * counts: null when there's nothing to divide by (an AVG with no at-bats). The parts are whole numbers times whole weights, so two
 * windows with the same rate (10 of 20, 5 of 10) are exactly equal, and a tie is a tie.
 */
function rateOf(parts, counts) {
  const bottom = weigh(counts, parts.bottom);
  return bottom > 0 ? weigh(counts, parts.top) / bottom : null;
}

/** The stat groups a line has numbers in (a goalie's goaltending, a two-way player's batting and pitching), as Sport.full reads
 *  them: a rate adds only the lines in its own group (a skater's time on ice is no goalie's). */
function groupsOf(line, defs) {
  const out = new Set();
  for (const k of Object.keys(line)) if (defs[k]) out.add(defs[k].group);
  return out;
}

/**
 * Each category's total over some lines (`lines`: each one holding's line in one game, derived stats worked out: a seat's counted
 * holdings over a window, or one holding's), as { [stat]: value | null }: a count or a derived stat added up; a rate from the
 * lines' parts added (only the lines in its group), null with nothing to divide by. `defs`: the sport's stats (its
 * categoryDefs: { [key]: { better, group, parts? } }).
 */
function categoryTotals(lines, cats, defs) {
  const out = {};
  const groups = lines.map((l) => groupsOf(l, defs));
  for (const k of cats) {
    const d = defs[k];
    if (d && d.parts) {
      // Each count once, though it's in both (FO%: faceoffs won over won and lost).
      const keys = new Set([...Object.keys(d.parts.top), ...Object.keys(d.parts.bottom)]);
      const sum = {};
      lines.forEach((l, i) => {
        if (!groups[i].has(d.group)) return;
        for (const p of keys) sum[p] = (sum[p] || 0) + (l[p] || 0);
      });
      out[k] = rateOf(d.parts, sum);
    } else out[k] = tidy(lines.reduce((n, l) => n + (l[k] || 0), 0));
  }
  return out;
}

/**
 * A window's lines (`byEpisode`: { [episode]: { [holding]: line } }, the server's LeagueGames.lines) for the holdings that count
 * in each of its episodes (`heldAt(episode)`: ids, a lineup's starters then, best ball's or a whole team's), from `from` to `to`.
 */
function windowLines(byEpisode, from, to, heldAt) {
  const out = [];
  for (let ep = from; ep <= to; ep++) {
    const lines = byEpisode && byEpisode[ep];
    if (!lines) continue;
    for (const id of heldAt(ep) || []) if (lines[id]) out.push(lines[id]);
  }
  return out;
}

/** Which of two values is better in a category: 1 a's, -1 b's, 0 the same. Nothing to say (a rate with nothing to divide by:
 *  no shots, no innings) loses to anything, and ties nothing. */
function compareCategory(a, b, better) {
  if (a == null || b == null) return a == null && b == null ? 0 : a == null ? -1 : 1;
  if (a === b) return 0;
  return (better === 'lower' ? a < b : a > b) ? 1 : -1;
}

/**
 * Two seats' totals head to head, category by category: { cats: [{ stat, a, b, won: 'a' | 'b' | null }], a: { wins, losses,
 * ties }, b: { ... }, result: 'a' | 'b' | 'tie' } (each category won, lost or tied: the week's record; the result, whoever won
 * more of them).
 */
function categoryMatchup(a, b, cats, defs) {
  const rec = () => ({ wins: 0, losses: 0, ties: 0 });
  const out = { cats: [], a: rec(), b: rec(), result: 'tie' };
  for (const k of cats) {
    const c = compareCategory(a[k], b[k], defs[k] ? defs[k].better : 'higher');
    out.cats.push({ stat: k, a: a[k], b: b[k], won: c > 0 ? 'a' : c < 0 ? 'b' : null });
    if (c > 0) { out.a.wins++; out.b.losses++; } else if (c < 0) { out.b.wins++; out.a.losses++; } else { out.a.ties++; out.b.ties++; }
  }
  out.result = out.a.wins > out.b.wins ? 'a' : out.b.wins > out.a.wins ? 'b' : 'tie';
  return out;
}

/** The middle of some values, unrounded (a rate's); null for none. */
function middle(values) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * One week of head to head by categories: round r of the round robin over `seats` (the sequence's roundRobin, so the same pairs
 * as a game by points), each pair's categoryMatchup on their totals (`totals`: Map seat -> categoryTotals over the week). Whoever
 * an odd list leaves out plays everyone else's middle in each category (odd 'median') or sits it out ('bye'); a week nobody has
 * anything in any category (every count 0, every rate unsaid) counts for nobody (quiet 'skip') or ties every category ('tie').
 * Returns { quiet, games: [{ a, b, matchup | null }] } (a bye's matchup is null; a quiet week skipped, every game's).
 */
function categoryWeek(totals, seats, r, cats, defs, o = {}) {
  const odd = o.odd || 'median';
  const quiet = seats.length > 0 && seats.every((id) => cats.every((k) => { const v = (totals.get(id) || {})[k]; return v == null || v === 0; }));
  const games = roundRobin(seats, r).map(([a, b]) => {
    if (b === null && odd === 'bye') return { a, b: null, matchup: null };
    if (quiet && o.quiet !== 'tie') return { a, b, matchup: null };
    const theirs = b === null ? Object.fromEntries(cats.map((k) => [k, middle(seats.filter((id) => id !== a).map((id) => (totals.get(id) || {})[k]))])) : totals.get(b) || {};
    return { a, b, matchup: categoryMatchup(totals.get(a) || {}, theirs, cats, defs) };
  });
  return { quiet, games };
}

/**
 * Weeks of head to head as standings: by each category (rank.by 'categories': every category won a win, lost a loss, tied a tie)
 * or by each matchup (rank.by 'matchups': whoever won more categories wins the week). Map seat -> { wins, losses, ties }; the
 * median's side of a game is nobody's.
 */
function categoryRecords(weeks, by) {
  const out = new Map();
  const rec = (id) => {
    if (!out.has(id)) out.set(id, { wins: 0, losses: 0, ties: 0 });
    return out.get(id);
  };
  const add = (id, w, l, t) => {
    const r = rec(id);
    r.wins += w;
    r.losses += l;
    r.ties += t;
  };
  for (const week of weeks) {
    for (const g of week.games) {
      if (!g.matchup) continue;
      const m = g.matchup;
      const sides = g.b === null ? [['a', g.a]] : [['a', g.a], ['b', g.b]];
      for (const [side, id] of sides) {
        if (by === 'categories') add(id, m[side].wins, m[side].losses, m[side].ties);
        else add(id, m.result === side ? 1 : 0, m.result !== 'tie' && m.result !== side ? 1 : 0, m.result === 'tie' ? 1 : 0);
      }
    }
  }
  return out;
}

/**
 * Roto: each category ranks everyone on their totals (`totals`: Map seat -> categoryTotals over the game so far), the best the
 * most points (as many as there are seats) down to 1 for the worst; seats tied share their places' points (two tied for first of
 * ten: 9.5 each). Returns rows [{ id, points: { [stat]: points }, total }], the most first (a tie keeps the seats' order).
 */
function roto(totals, cats, defs) {
  const ids = [...totals.keys()];
  const n = ids.length;
  const rows = ids.map((id, i) => ({ id, i, points: {}, total: 0 }));
  for (const k of cats) {
    const better = defs[k] ? defs[k].better : 'higher';
    const order = rows.slice().sort((x, y) => compareCategory(totals.get(y.id)[k], totals.get(x.id)[k], better) || x.i - y.i);
    for (let i = 0; i < n; ) {
      let j = i;
      while (j + 1 < n && compareCategory(totals.get(order[j + 1].id)[k], totals.get(order[i].id)[k], better) === 0) j++;
      // Places i..j (0 the best) share their points: n - i down to n - j.
      const share = cents(((n - i) + (n - j)) / 2);
      for (let x = i; x <= j; x++) order[x].points[k] = share;
      i = j + 1;
    }
  }
  for (const r of rows) r.total = cents(cats.reduce((t, k) => t + r.points[k], 0));
  return rows.sort((x, y) => y.total - x.total || x.i - y.i).map(({ id, points, total }) => ({ id, points, total }));
}

module.exports = { weigh, rateOf, categoryTotals, windowLines, compareCategory, categoryMatchup, categoryWeek, categoryRecords, roto };
