// A sport's categories and roto, worked out apart from the engine (src/lib/game/sequence/categories.js, state-logic.js StatsLogic,
// RotoLogic, MatchupLogic): what the campaign's invariants and the unit tests hold the engine's tables to. From the rule alone:
//   a count, or a stat derived game by game (total bases), adds up over a window's lines;
//   a rate (FG%, ERA) is worked out from the window's counts added up, never an average of each game's, and only from the lines of
//     its own stat group (a skater's line is no goalie's); with nothing to divide by it has no value;
//   two values in a category: the better wins (lower for ERA, turnovers); no value loses to any value; the same, or neither, ties;
//   head to head, a week is the two seats category by category: each category won, lost or tied, and the week to whoever won more;
//   roto: each category ranks everyone, the best as many points as there are seats down to 1, the tied sharing their places' points
//     to the cent; a seat's total, their points across the categories.
// The sport's stat definitions (which is better, a rate's parts, each stat's group) are data: the app's own Sport.categoryDefs.
// No app code is loaded here.
const cents = n => Math.round(n * 100) / 100, tidy = n => Math.round(n * 1e6) / 1e6;
const groupsOf = (line, defs) => new Set(Object.keys(line).map(k => defs[k] && defs[k].group).filter(g => g !== undefined && g !== null));
/** One category's total over some lines (each a holding's line in one game, its derived stats worked out). */
function total(lines, stat, defs) {
  const d = defs[stat];
  if (!d || !d.parts) return tidy(lines.reduce((n, l) => n + (l[stat] || 0), 0));
  const own = lines.filter(l => groupsOf(l, defs).has(d.group)), sum = k => own.reduce((n, l) => n + (l[k] || 0), 0);
  const weigh = part => Object.entries(part).reduce((n, [k, w]) => n + sum(k) * w, 0), bottom = weigh(d.parts.bottom);
  return bottom > 0 ? weigh(d.parts.top) / bottom : null;
}
const totals = (lines, cats, defs) => Object.fromEntries(cats.map(k => [k, total(lines, k, defs)]));
/** 1 when a is better, -1 when b is, 0 the same. */
function better(a, b, defs, stat) {
  if (a == null || b == null) return a == null && b == null ? 0 : a == null ? -1 : 1;
  if (a === b) return 0;
  return ((defs[stat] && defs[stat].better) === 'lower' ? a < b : a > b) ? 1 : -1;
}
/** A week between two seats' totals: the categories each won and tied, and the week's result for a ('win', 'loss', 'tie'). */
function week(a, b, cats, defs) {
  let won = 0, lost = 0, tied = 0;
  for (const k of cats) { const c = better(a[k], b[k], defs, k); if (c > 0) won++; else if (c < 0) lost++; else tied++; }
  return { won, lost, tied, result: won > lost ? 'win' : lost > won ? 'loss' : 'tie' };
}
/** Whether a week is quiet: nobody has anything in any category (every count 0, every rate without a value). */
const quiet = (all, cats) => all.length > 0 && all.every(t => cats.every(k => t[k] == null || t[k] === 0));
/** Roto points: { [seat]: total } from { [seat]: totals }. */
function roto(bySeat, cats, defs) {
  const ids = Object.keys(bySeat), n = ids.length, out = Object.fromEntries(ids.map(id => [id, 0]));
  for (const k of cats) {
    for (const id of ids) {
      // A seat's place in this category: how many are strictly better, and how many it's level with (itself among them).
      const ahead = ids.filter(o => better(bySeat[o][k], bySeat[id][k], defs, k) > 0).length, level = ids.filter(o => better(bySeat[o][k], bySeat[id][k], defs, k) === 0).length;
      // Places ahead .. ahead + level - 1 (0 the best) are worth n - place: the level seats share them.
      out[id] += cents(((n - ahead) + (n - (ahead + level - 1))) / 2);
    }
  }
  return Object.fromEntries(ids.map(id => [id, cents(out[id])]));
}
module.exports = { total, totals, better, week, quiet, roto, cents };
