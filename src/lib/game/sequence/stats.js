// The scoring sequence's step 2 for a game scored by a sport's stats (docs/PLAN-start-a-game-gpt.md track L, L3 part 1; the
// spec's `score.by: 'stats'`, game-spec schema.js statScoreProblems): a holding's line in an episode is its stat line at the
// game's table. Every shape of sport keeps its competitors' numbers as lines in its own keys (a team game's box score, a field's
// with each one's place in it, a card's with each fighter's result), so one table scores all of them: `points` each,
// `byPosition` a stat's points by the player's position group (FPL's goal), `byPlace` a place's by place or range (golf's and
// racing's POS, the tied each the place's), `byFormat` a bout's by the rounds or sets it's scheduled for (tennis's best of five).
// Pure and plain CommonJS, like the sequence beside it: the engine's scorer, the server, the phone (src/lib/sports/spec.ts) and
// the tests share it. What a holding scores here is its moments for the episode (statMoments: momentRaw's shape), so a captain,
// the episode's multiplier, best ball's best n and the rest of the sequence take it from there.
/* eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, as the sequence beside it */
const { placeRange } = require('../game-spec/schema.js');

const cents = (n) => Math.round(n * 100) / 100;
const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

// A table's places read once (a field's every competitor, at every poll).
const RANGES = new WeakMap();
function rangesOf(table) {
  let r = RANGES.get(table);
  if (!r) {
    r = Object.entries(table).flatMap(([k, points]) => {
      const at = placeRange(k);
      return at ? [{ ...at, points }] : [];
    });
    RANGES.set(table, r);
  }
  return r;
}

/** A place's points in a table by place: the place's or its range's; 0 for one it leaves out (or no place: out of the places). */
function placePoints(table, place) {
  if (place == null || !Number.isFinite(place)) return 0;
  const hit = rangesOf(table).find((r) => place >= r.min && place <= r.max);
  return hit ? hit.points : 0;
}

/** What one of a stat scores for someone: their position group's points (byPosition), else their bout's format's (byFormat),
 *  else `points`'; 0 when the table doesn't score it. */
function eachOf(score, stat, group, format) {
  const pos = group != null && score.byPosition ? score.byPosition[stat] : undefined;
  if (pos && has(pos, group)) return pos[group];
  if (format && has(format, stat)) return format[stat];
  return (score.points && score.points[stat]) || 0;
}

const minus = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) - v;
  return out;
};

/**
 * Someone's points from one line (their counts in a game, a field event or a bout, places in it), by a stats score: each stat the
 * table scores times its points (by their position group, by the bout's format), and each place stat by its place, as
 * { points, parts: [{ stat, value, points }] } (counts, then places). A line's missing stat is 0; a place out of the table's
 * places scores nothing. `o.group`: their position group; `o.format`: the bout's rounds or sets. `o.bouts`: on a card scored by
 * its bouts' formats (`byFormat`), the bouts they fought, each `{ id, format, line }` (its own line, scored at its format: a
 * part's `bout` says which); what the card's line has besides (the final's correction) scores at `points`'.
 */
function statLine(score, line, o = {}) {
  const group = o.group == null ? null : o.group;
  if (o.bouts && o.bouts.length && score.byFormat && Object.keys(score.byFormat).length) {
    const parts = [];
    let rest = line;
    for (const b of o.bouts) {
      for (const p of statLine(score, b.line, { group, format: b.format }).parts) parts.push({ ...p, bout: b.id });
      rest = minus(rest, b.line);
    }
    parts.push(...statLine(score, rest, { group }).parts);
    return { points: cents(parts.reduce((n, p) => n + p.points, 0)), parts };
  }
  const format = o.format != null && score.byFormat ? score.byFormat[String(o.format)] : undefined;
  const places = score.byPlace || {};
  const keys = new Set([...Object.keys(score.points || {}), ...Object.keys(format || {})]);
  if (group != null) for (const [k, by] of Object.entries(score.byPosition || {})) if (has(by, group)) keys.add(k);
  const parts = [];
  for (const stat of keys) {
    if (has(places, stat)) continue;
    const value = line[stat] || 0;
    const each = eachOf(score, stat, group, format);
    if (value && each) parts.push({ stat, value, points: cents(value * each) });
  }
  for (const [stat, table] of Object.entries(places)) {
    const points = placePoints(table, line[stat]);
    if (points) parts.push({ stat, value: line[stat], points });
  }
  return { points: cents(parts.reduce((n, p) => n + p.points, 0)), parts };
}

/**
 * One episode's stat lines as its moments at the game's table (momentRaw's events: [{ castawayId, points }], one per holding
 * that scored, in the lines' order): `lines` each holding's line in the episode (castaway id to its counts, derived stats worked
 * out: the server's from its stored final, the phone's from the poller), `groupOf` a holding's position group (its roster's),
 * `boutsOf` the bouts a holding fought on a card (statLine's `bouts`: the server's LeagueGames.bouts), for a table by format.
 */
function statMoments(lines, score, groupOf, boutsOf) {
  const out = [];
  for (const [id, line] of Object.entries(lines || {})) {
    const { points } = statLine(score, line, { group: groupOf ? groupOf(id) : null, bouts: boutsOf ? boutsOf(id) : undefined });
    if (points) out.push({ castawayId: id, points });
  }
  return out;
}

module.exports = { cents, placePoints, statLine, statMoments };
