// Which season games a rulebook can feed (docs/PLAN-rulebooks-implementation.md 4.8; the design plan's "Rulebooks and
// game types are separate"; the mock's rulebook.js RB_FITS, RB_NOFIT and rbGameLine). A rulebook says what the show is
// (its cast and its moments); a game says how a couch plays with them, and needs something of the rulebook:
//
//   Weekly Lineup   a cast whose moments score week to week                 competitions, series, sport
//   Outlast         people knocked out one by one, and a winner             competitions
//   Survival Pool   someone going home most episodes, or a result to        most competitions; a sport (a pick survives
//                   survive each event                                       a race by scoring in it)
//   Weekly Bingo,   one show at a time, all season                          talk, variety or awards (step 12's bingo,
//   Weekly Calls                                                             bingo.ts, and Call it, calls.ts)
//
// Start a game offers only what fits, in the kind's order (the first is recommended), and says why the rest don't. Pure,
// plain CommonJS like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./index.js */
const { KINDS, GAME_LABELS, kindOf, partWord } = require('./rulebook-schema.js');
const { momentsFor } = require('./rulebook-moments.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const list = (v) => (Array.isArray(v) ? v : []);

/** The league type each season game plays as (settings.leagueTypeId). */
const GAME_TYPES = { survivalPool: 'pickem', weeklyLineup: 'active-roster', outlast: 'classic-draft', weeklyBingo: 'weekly-bingo', weeklyCalls: 'weekly-calls' };

/** The step that brings a game that can't be started yet (none since step 12 part 3: every game that fits starts). */
const SOON = {};

const NEEDS = {
  weeklyLineup: 'a cast whose moments score week to week',
  outlast: 'people knocked out one by one, and a winner',
  survivalPool: 'someone going home most episodes',
  weeklyBingo: 'one show at a time, all season',
  weeklyCalls: 'one show at a time, all season',
};

/** A segment that runs every episode and sends someone home (or is the cause of a way out). */
function goingHomeEachEpisode(blocks) {
  const b = blocks || {};
  const ways = list(b.waysOut);
  return list(b.segments).some(
    (s) => s.often === 'everyEpisode' && (s.onTheLine === 'goingHome' || ways.some((w) => w.means === 'out' && w.cause && typeof w.cause === 'object' && w.cause.segment === s.id))
  );
}

/** How many moments score: the compiled rules' events when we have them, else what the blocks build. */
function momentCount(b, compiled) {
  if (compiled && Array.isArray(compiled.events)) return compiled.events.length;
  try {
    return momentsFor(b).length;
  } catch {
    return 0;
  }
}

/**
 * The season games for a rulebook, in its kind's order: [{ key, name, type, fits, needs, soon }]. `needs` is what a game
 * that doesn't fit is missing; `soon` the step that brings one that fits but can't be started yet. Every kind lists its
 * own games (KINDS.games) first; a talk show also lists the draft games, which don't fit it, so the sheet can say why.
 */
function gamesFor(blocks, compiled) {
  const b = blocks || {};
  const kind = kindOf(b);
  const ways = list(b.waysOut);
  const moments = momentCount(b, compiled);
  const cast = !!(b.cast && b.cast.unit);
  const fit = {
    weeklyLineup: kind !== 'talk' && cast && moments >= 5,
    outlast:
      kind === 'competition' &&
      ways.some((w) => w.means === 'out') &&
      (ways.some((w) => w.means === 'winner') || !!(compiled && compiled.winnerExitMethod)),
    survivalPool: kind === 'sport' ? cast && moments >= 1 : kind === 'competition' && goingHomeEachEpisode(b),
    weeklyBingo: kind === 'talk',
    weeklyCalls: kind === 'talk',
  };
  const own = KINDS[kind].games;
  const rest = ['survivalPool', 'weeklyLineup', 'outlast'].filter((k) => !own.includes(k));
  return [...own, ...rest].map((key) => ({
    key,
    name: GAME_LABELS[key],
    type: GAME_TYPES[key],
    fits: !!fit[key],
    needs: NEEDS[key],
    soon: fit[key] && SOON[key] ? SOON[key] : null,
  }));
}

/** "Weekly Lineup and Survival Pool", "Outlast". */
function names(keys) {
  const n = keys.map((k) => GAME_LABELS[k]);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : n[0] || '';
}

/**
 * The doesn't-fit line under Start a game's choices (the mock's RB_NOFIT), or null when everything fits. `show` is how
 * people say it ("Formula 1"). Talk drops the draft games, a series the knock-out ones, a sport Outlast; anything else says
 * what's missing.
 */
function noFitLine(games, blocks, show) {
  const kind = kindOf(blocks || {});
  const out = games.filter((g) => !g.fits).map((g) => g.key);
  if (!out.length) return null;
  const name = show || 'this show';
  if (kind === 'talk') return `Drafts need a cast that scores week to week. ${name}'s games are one show at a time, all season.`;
  const knock = out.filter((k) => k === 'survivalPool' || k === 'outlast');
  if (kind === 'series' && knock.length === out.length) {
    return `${names(knock)} ${knock.length > 1 ? 'need' : 'needs'} someone knocked out most episodes. Nobody is, on ${name}.`;
  }
  if (kind === 'sport' && out.length === 1 && out[0] === 'outlast') return `Outlast needs people knocked out one by one. Nobody is, in ${name}.`;
  return out.map((k) => `${GAME_LABELS[k]} needs ${NEEDS[k]}.`).join(' ');
}

const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const say = (n) => NUMBER[n] || String(n);

/**
 * What a season game is on this show, in a line (the mock's rbGameLine): "Draft five drivers, start three each race", "Draft
 * the crew, start three each week, score what they get up to". `slots` is the lineup's shape when a game has one.
 */
function gameLine(key, blocks, slots) {
  const b = blocks || {};
  const kind = kindOf(b);
  const part = partWord(b).singular;
  const one = (b.cast && b.cast.singular) || 'person';
  const many = (b.cast && b.cast.plural) || 'people';
  const start = (slots && slots.active) || 3;
  const team = start + ((slots && slots.bench) || 2);
  if (kind === 'sport') {
    if (key === 'weeklyLineup') return `Draft ${say(team)} ${many}, start ${say(start)} each ${part}`;
    // The pool's cycle rule (StateLogic.PickEmLogic.eligibility): nobody again until you've picked everyone.
    if (key === 'survivalPool') return `Pick one ${one} to score each ${part}. No repeats until you've picked them all`;
  }
  if (kind === 'series' && key === 'weeklyLineup') {
    return b.start === 'scripted'
      ? `Draft the ${many}, start ${say(start)} each week, score what happens to them`
      : `Draft the ${many}, start ${say(start)} each week, score what they get up to`;
  }
  return {
    survivalPool: `No draft · pick one ${one} to survive each ${part} · best for mid-season`,
    weeklyLineup: 'Draft a roster, start your best each week',
    outlast: 'Draft a team, the last one standing carries you',
    weeklyBingo: 'A new card every show. Most lines by the finale wins',
    weeklyCalls: 'Two calls every show. Most right by the finale wins',
  }[key];
}

module.exports = { GAME_TYPES, gamesFor, noFitLine, gameLine, goingHomeEachEpisode };
