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
//
// And a line's points (the fourth slice, points by place; src/lib/game/sequence/stats.js statLine), from the rule alone:
//   each stat the table scores, its count times its points to the cent: the points of the holder's position group where the
//     table has them for the stat (byPosition: FPL's goal, 10 a keeper's), else the table's `points`;
//   a place stat (byPlace: golf's and racing's POS, F1's SPR and QUAL) scores its place's points, or its range's ('4-10'), and
//     nothing for a place the table leaves out or no place at all (cut, withdrew, disqualified); a stat the table places is
//     scored by place alone, never as a count too;
//   the line's points, the sum to the cent.
// A field's line has its place in it from the standings (golf: POS, W for the winner, TOP5 to TOP25, CUT for a cut made; racing:
// POS, W, PODIUM, TOP5, TOP10; the tied each the place they share): `placed`.
// And by a match's format (the sixth slice; score.byFormat: tennis's best of five): on a card, each match someone played scores
// its own line at its format's points (a stat's points in the table for that many sets, else the table's own; a group's still
// first), and whatever their day's line has besides their matches' at the table's own points.
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
/** The places a by-place table names: '1' or a range '4-10', each with its points. */
const rangesOf = table => Object.entries(table).flatMap(([k, points]) => { const m = /^(\d+)(?:-(\d+))?$/.exec(k); return m ? [{ lo: Number(m[1]), hi: m[2] === undefined ? Number(m[1]) : Number(m[2]), points }] : []; });
/** A place's points in a by-place table: its place's, or its range's; 0 out of the table, or with no place. */
function placePoints(table, place) {
  if (typeof place !== 'number' || !Number.isFinite(place)) return 0;
  const hit = rangesOf(table).find(r => place >= r.lo && place <= r.hi);
  return hit ? hit.points : 0;
}
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
/**
 * A line's points at a stats table (`score`: points, byPosition, byPlace, byFormat), for a holder of position group `group` (or
 * none). `bouts`: on a card, the matches they played, each { format, line } (its best of, its own line).
 */
function linePoints(score, line, group = null, bouts = null) {
  line = line || {}; // (no line: someone who didn't play scores nothing)
  const formats = score.byFormat || {};
  if (bouts && bouts.length && Object.keys(formats).length) {
    let sum = 0;
    const rest = { ...line };
    for (const b of bouts) {
      sum += atTable(score, b.line, group, own(formats, String(b.format)) ? formats[String(b.format)] : null);
      for (const [k, v] of Object.entries(b.line)) rest[k] = (rest[k] || 0) - v;
    }
    return cents(sum + atTable(score, rest, group, null));
  }
  return atTable(score, line, group, null);
}
/** A line at a table, a match's format's points (`format`, or none) after a group's and before the table's own. */
function atTable(score, line, group, format) {
  const places = score.byPlace || {}, byPos = score.byPosition || {};
  const counted = new Set([...Object.keys(score.points || {}), ...Object.keys(format || {}), ...Object.keys(byPos).filter(k => group != null && own(byPos[k], group))]);
  let sum = 0;
  for (const stat of counted) {
    if (own(places, stat)) continue;
    const each = group != null && own(byPos[stat], group) ? byPos[stat][group] : format && own(format, stat) ? format[stat] : (score.points || {})[stat] || 0;
    sum += cents((line[stat] || 0) * each);
  }
  for (const [stat, table] of Object.entries(places)) sum += placePoints(table, line[stat]);
  return cents(sum);
}
/** A field's line with its place stats from its standing (`sport`: 'golf' or 'racing'): the counts and what the place says. */
function placed(counts, standing, sport) {
  const out = { ...counts }, p = standing ? standing.place : null;
  if (typeof p === 'number') {
    out.POS = p;
    if (p === 1) out.W = 1;
    const tops = sport === 'golf' ? [5, 10, 20, 25] : [5, 10];
    for (const k of tops) if (p <= k) out['TOP' + k] = 1;
    if (sport === 'racing' && p <= 3) out.PODIUM = 1;
  }
  if (sport === 'golf' && standing && standing.madeCut) out.CUT = 1;
  return out;
}
module.exports = { total, totals, better, week, quiet, roto, cents, placePoints, linePoints, placed };
