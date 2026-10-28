// The game spec's schema (docs/PLAN-start-a-game-gpt.md, "The game spec", step A1): what a game *is*, as data. One schema
// for shows and sports. What can happen on the show (the rulebook's moments) or in the sport (the Sport classes of
// docs/PLAN-sports-live.md, on the `sports` branch) it only refers to, by id or stat key.
//
//   { spec: 1, preset, span, pool, get, count, score, rank, ask, closes, extras }
//
//   preset   the preset it started from (its name, Run it back), or null
//   span     { from, to }: episodes of the season; to null = the season's end. from is an episode number, or a phase of
//            the season's rulebook (A3): { phase } while the game waits for it to start, { phase, at } once data says
//            where it does (at: the episode it plays from). The phase stays: its words, Game settings, Run it back
//   pool     { of: 'cast', where }: who can be picked. where { stillIn: true } (today: nobody gone before the start);
//            sports: { teams: [ids] }; later: { group: id }
//   get      how you get yours. { by: 'draft', each, order: snake | blind, own: exclusive | shared } (the order follows
//            the ownership today: exclusive drafts snake, shared drafts blind) | { by: 'pick', each: 1, repeat: 'cycle' }
//            (one an episode, nobody again until everyone still in is used, never twice running) | { by: 'card' }
//            (bingo) | { by: 'none' }; sports: { by: 'squares' }
//   count    what of yours counts each episode: { start: n } (your lineup) | { all: true } | { pick: true } | null
//            (nothing held); sports: { best: n } (best ball)
//   score    { by: 'moments', points } (points: moment id -> points over the rulebook's own; null = its own)
//            | { by: 'place' } (Outlast: 1, plus 1 for every boot outlasted) | { by: 'survive', means: staysIn | scores,
//            points } (Survival Pool) | { by: 'calls' } | { by: 'lines' } (bingo); A4: { by: 'answers' } (the ask's);
//            sports: { by: 'stats', points: { HR: 5 } } (the Sport's stat keys)
//   rank     { by: 'total' } | { by: 'streak' } (longest, ties to the total); sports: matchups | categories | roto
//   ask      A4: questions answered before the lock, each settled by data (QUESTION below)
//   closes   'start': moves lock at each episode's start (today's airtime lock); sports: 'daily' | 'weekly'
//   extras   the details nobody asked about, recommended and out of sight (EXTRAS below)
//
// Who builds each value is in VOCAB: 'now' the engine plays it today (after A2, through the spec; a phase start since A3),
// 'A4' that step, 'sports' the sports branch, 'later' no step yet. specProblems says what's wrong with a spec, specWaitsFor what
// it needs that isn't built. Pure, plain CommonJS like formats/, so state-logic.js can read it (A2).

const SPEC_VERSION = 1;

/** Who builds each value. A value not listed isn't one. */
const VOCAB = {
  'get.by': { draft: 'now', pick: 'now', card: 'now', none: 'now', squares: 'sports' },
  'get.order': { snake: 'now', blind: 'now' },
  'get.own': { exclusive: 'now', shared: 'now' },
  'get.repeat': { cycle: 'now' },
  count: { start: 'now', all: 'now', pick: 'now', best: 'sports' },
  'score.by': { moments: 'now', place: 'now', survive: 'now', calls: 'now', lines: 'now', answers: 'A4', stats: 'sports' },
  'score.means': { staysIn: 'now', scores: 'now' },
  'rank.by': { total: 'now', streak: 'now', matchups: 'sports', categories: 'sports', roto: 'sports' },
  closes: { start: 'now', daily: 'sports', weekly: 'sports' },
  'pool.where': { stillIn: 'now', teams: 'sports', group: 'later' },
  'ask.answer': { person: 'A4', yesNo: 'A4', number: 'A4', overUnder: 'A4', choice: 'A4', side: 'sports' },
  'ask.settle': { results: 'A4', moment: 'A4', final: 'sports', stat: 'sports' },
};

// A question in `ask`:
//   { id, ask: 'Who scores the most points?', answer, points, settle, line?, options? }
//   answer  person | side | yesNo | number (closest wins) | overUnder (with line: a number, or null for the wizard to
//           ask) | choice (with options)
//   settle  shows (A4): { by: 'results', take: winner | out | placed } | { by: 'moment', moment: id, take: happened |
//           count }; sports: { by: 'final', take: winner | total | margin } | { by: 'stat', stat, take: most | least |
//           value }
const TAKES = {
  results: ['winner', 'out', 'placed'],
  moment: ['happened', 'count'],
  final: ['winner', 'total', 'margin'],
  stat: ['most', 'least', 'value'],
};
/** The settles each kind of answer can be graded by ('by:take'). A choice is matched to whatever settles it. */
const NUMBERS = ['moment:count', 'final:total', 'final:margin', 'stat:value'];
const SETTLES_FOR = {
  person: ['results:winner', 'results:out', 'results:placed', 'stat:most', 'stat:least'],
  side: ['final:winner'],
  yesNo: ['moment:happened'],
  number: NUMBERS,
  overUnder: NUMBERS,
  choice: null,
};

// The settings' own vocabularies, as state-logic.js reads them (WaiverLogic, the draft timer, side bets).
const REPLACE_RULES = ['always', 'whenShort', 'windows', 'never'];
const WINDOW_SCHEDULES = ['everyEpisode', 'every', 'manual'];
const WAIVER_FEELS = ['casual', 'balanced', 'competitive'];
const WAIVER_ORDERS = ['rolling', 'leastPoints', 'mostPoints'];
const WAIVER_HOURS = [12, 24, 48];
const DRAFT_TIMERS = [0, 60, 120];
const MAX_BET_POINTS = 3;
const JOINS = ['open', 'ask', 'locked'];

// The extras: { waivers, bets, finale, calls, draft, join, hideStarters, lockedDown }
//   waivers       a draft's mid-season moves, or null (no waivers: shared Outlast, no draft):
//                 { feel, replace, short, windows: { schedule, every, swaps }, order, hours, freeAgency, autoFill }
//                 (replaceRule, replenishAt, waiverWindows, replenishOrderBy, waiverProcessHours, ...: WaiverLogic)
//   bets          side bets ("Predictions", graded by whoever runs the game): { points } (each new one's), or null
//   finale        a draft's finale predictions: { top3, winner, from: any | own } (points each; own = your team only)
//   calls         a Survival Pool's weekly Who goes home? call beside the pick (the public pool): counted, not ranked
//   draft         a draft's room: { at: ISO | null, timer: 0 | 60 | 120 (seconds a pick), away: wait | queue }
//   join          who can join: open (anyone on the couch) | ask | locked (nobody new) | null (recommended: open where
//                 castaways can be on several teams, else ask)
//   hideStarters  a lineup's starters stay hidden until the lock
//   lockedDown    Lock it down: nobody new joins and the rules don't change for the season

/** Waivers off: a draft as Start a game makes one today (nothing replaced, windows only when opened). */
const NO_WAIVERS = {
  feel: 'balanced',
  replace: 'never',
  short: null,
  windows: { schedule: 'manual', every: 3, swaps: 0 },
  order: 'rolling',
  hours: 24,
  freeAgency: true,
  autoFill: true,
};
const DRAFT_ROOM = { at: null, timer: 0, away: 'wait' };
const BETS = { points: 1 };

const extrasOf = (o) => ({ waivers: null, bets: BETS, finale: null, calls: false, draft: null, join: null, hideStarters: false, lockedDown: false, ...o });

/**
 * Today's five games, as Start a game makes them (StateLogic.defaultState, then makeLeague's type): each a spec with
 * defaults. Outlast = draft, all count, place, total. Weekly Lineup = draft, start n, moments, total. Survival Pool = pick,
 * the pick counts, survive, streak. Weekly Calls = no draft, calls. Weekly Bingo = a card, lines.
 */
const PRESETS = {
  outlast: {
    spec: SPEC_VERSION, preset: 'outlast', span: { from: 1, to: null }, pool: { of: 'cast', where: { stillIn: true } },
    get: { by: 'draft', each: 3, order: 'snake', own: 'exclusive' }, count: { all: true }, score: { by: 'place' },
    rank: { by: 'total' }, ask: [], closes: 'start',
    extras: extrasOf({ waivers: NO_WAIVERS, draft: DRAFT_ROOM }),
  },
  'weekly-lineup': {
    spec: SPEC_VERSION, preset: 'weekly-lineup', span: { from: 1, to: null }, pool: { of: 'cast', where: { stillIn: true } },
    get: { by: 'draft', each: 5, order: 'blind', own: 'shared' }, count: { start: 3 }, score: { by: 'moments', points: null },
    rank: { by: 'total' }, ask: [], closes: 'start',
    extras: extrasOf({ waivers: NO_WAIVERS, draft: DRAFT_ROOM }),
  },
  'survival-pool': {
    spec: SPEC_VERSION, preset: 'survival-pool', span: { from: 1, to: null }, pool: { of: 'cast', where: { stillIn: true } },
    get: { by: 'pick', each: 1, repeat: 'cycle' }, count: { pick: true }, score: { by: 'survive', means: 'staysIn', points: 1 },
    rank: { by: 'streak' }, ask: [], closes: 'start',
    extras: extrasOf({}),
  },
  'weekly-calls': {
    spec: SPEC_VERSION, preset: 'weekly-calls', span: { from: 1, to: null }, pool: { of: 'cast', where: { stillIn: true } },
    get: { by: 'none' }, count: null, score: { by: 'calls' }, rank: { by: 'total' }, ask: [], closes: 'start',
    extras: extrasOf({}),
  },
  'weekly-bingo': {
    spec: SPEC_VERSION, preset: 'weekly-bingo', span: { from: 1, to: null }, pool: { of: 'cast', where: { stillIn: true } },
    get: { by: 'card' }, count: null, score: { by: 'lines' }, rank: { by: 'total' }, ask: [], closes: 'start',
    extras: extrasOf({}),
  },
};

// Shared by every caller (and NO_WAIVERS and DRAFT_ROOM by every preset), so nobody can change them in place: fullSpec
// hands out copies.
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};
deepFreeze(PRESETS);

/** The league type (settings.leagueTypeId) each preset plays as, and back. */
const PRESET_TYPES = { outlast: 'classic-draft', 'weekly-lineup': 'active-roster', 'survival-pool': 'pickem', 'weekly-calls': 'weekly-calls', 'weekly-bingo': 'weekly-bingo' };
const TYPE_PRESETS = Object.fromEntries(Object.entries(PRESET_TYPES).map(([p, t]) => [t, p]));
/** What people call each one (rulebook-schema.js GAME_LABELS). */
const PRESET_LABELS = { outlast: 'Outlast', 'weekly-lineup': 'Weekly Lineup', 'survival-pool': 'Survival Pool', 'weekly-calls': 'Weekly Calls', 'weekly-bingo': 'Weekly Bingo' };

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, min) => Number.isInteger(v) && v >= (min === undefined ? 0 : min);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** obj[key] when it's obj's own (never Object.prototype's: a preset called "constructor" is no preset). */
const own = (obj, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined);
/** The preset a spec names, or null. */
const presetOf = (s) => (isObj(s) && own(PRESETS, s.preset)) || null;
/** The one key of a `count` ({ start: 3 } -> 'start'), or null. */
const countKind = (c) => (isObj(c) ? Object.keys(c).find((k) => own(VOCAB.count, k)) || null : null);
/** Two values the same, whatever order their keys are in. */
function sameValue(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (!isObj(a) || !isObj(b)) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]));
}

// The one set of size limits, for every write (Game settings, classic's setup, Start a game, the GPT): an Outlast team of 1
// to 10; a lineup of 1 to 8 starters and a bench of up to 6, so a team of up to 14 (once it's drafted, starters can move to
// the bench). A league's own that's already bigger keeps its size, and can come down (specProblems' opts.was).
const MAX_TEAM = 10;
const MAX_STARTERS = 8;
const MAX_BENCH = 6;
const MAX_LINEUP_TEAM = MAX_STARTERS + MAX_BENCH;

/** The order a draft's ownership makes today, and back: exclusive drafts snake, shared drafts blind. */
const ORDER_OF = { exclusive: 'snake', shared: 'blind' };
const OWN_OF = { snake: 'exclusive', blind: 'shared' };

/** The defaults of a spec with no preset, for the parts that don't depend on its mechanics (fullSpec fills those). */
const DEFAULTS = {
  span: { from: 1, to: null },
  pool: { of: 'cast', where: { stillIn: true } },
  get: { by: 'none' },
  ask: [],
  closes: 'start',
};

/** Waivers fit a draft whose castaways can come free: not a shared Outlast (WaiverLogic.supported). */
function waiversFit(spec) {
  const get = (spec && spec.get) || {};
  return get.by === 'draft' && !(spec.score && spec.score.by === 'place' && get.own === 'shared');
}
/** Finale predictions go with a draft (supportsFinalePredictions: Outlast and Weekly Lineup). */
const finaleFits = (spec) => !!(spec && spec.get && spec.get.by === 'draft');

/**
 * The spec with everything it leaves out filled in: the preset's (when it fits what the spec says) or the defaults for its
 * mechanics. Required parts with no default (score, a draft's size) stay as they are, for specProblems to report. Never
 * changes what the spec does say, and never mutates it.
 */
function fullSpec(spec) {
  const s = isObj(spec) ? clone(spec) : {};
  const p = presetOf(s);
  if (s.spec === undefined) s.spec = SPEC_VERSION;
  if (s.preset === undefined) s.preset = null;
  // The preset's parts while the spec still gets its castaways the preset's way; a spec that changed that (a pick on a
  // Weekly Lineup) has its own game, so only the parts that don't depend on it (span, pool, ...) come from the preset.
  if (s.get === undefined) s.get = p ? clone(p.get) : clone(DEFAULTS.get);
  const fits = !!p && isObj(s.get) && s.get.by === p.get.by;
  for (const k of ['span', 'pool', 'ask', 'closes']) if (s[k] === undefined) s[k] = clone(p ? p[k] : DEFAULTS[k]);
  for (const k of ['count', 'score', 'rank']) if (s[k] === undefined && fits) s[k] = clone(p[k]);
  // A part that says some of itself takes the rest from the preset's, when it's the same kind ("draft 6 each" on a Weekly
  // Lineup is still its shared, blind draft).
  if (p) {
    for (const k of ['span', 'pool', 'get', 'score']) {
      const mine = s[k];
      const theirs = p[k];
      if (!isObj(mine) || !isObj(theirs) || mine.by !== theirs.by) continue;
      // A draft's order and ownership go together: one said is the pair, so only take both.
      const skip = k === 'get' && (mine.own !== undefined || mine.order !== undefined) ? ['own', 'order'] : [];
      for (const f of Object.keys(theirs)) if (mine[f] === undefined && !skip.includes(f)) mine[f] = clone(theirs[f]);
    }
  }
  if (isObj(s.span)) {
    if (s.span.from === undefined) s.span.from = 1;
    if (s.span.to === undefined) s.span.to = null;
  }
  if (isObj(s.pool) && s.pool.where === undefined) s.pool.where = null;
  const by = isObj(s.get) ? s.get.by : undefined;
  if (by === 'draft') {
    if (!s.get.own && s.get.order) s.get.own = own(OWN_OF, s.get.order);
    if (!s.get.order && s.get.own) s.get.order = own(ORDER_OF, s.get.own);
    if (!s.get.own && !s.get.order) Object.assign(s.get, { order: 'snake', own: 'exclusive' });
  }
  if (by === 'pick') {
    if (s.get.each === undefined) s.get.each = 1;
    if (s.get.repeat === undefined) s.get.repeat = 'cycle';
  }
  // The mechanics' own: a pick counts the pick; nothing held counts nothing; a draft says what counts (no default).
  if (s.count === undefined) s.count = by === 'pick' ? { pick: true } : null;
  if (isObj(s.score) && s.score.by === 'moments' && s.score.points === undefined) s.score.points = null;
  if (isObj(s.score) && s.score.by === 'survive') {
    if (s.score.means === undefined) s.score.means = 'staysIn';
    if (s.score.points === undefined) s.score.points = 1;
  }
  if (s.rank === undefined) s.rank = { by: isObj(s.score) && s.score.by === 'survive' ? 'streak' : 'total' };
  const e = isObj(s.extras) ? s.extras : {};
  // Waivers and the draft room follow the mechanics (a preset's are the same where they fit). The rest are the preset's
  // while the spec still gets its castaways the preset's way, else off: a game with no preset starts with no side bets.
  const pe = fits ? p.extras : null;
  const dflt = {
    waivers: waiversFit(s) ? NO_WAIVERS : null,
    bets: pe ? pe.bets : null,
    finale: pe ? pe.finale : null,
    calls: pe ? pe.calls : false,
    draft: isObj(s.get) && s.get.by === 'draft' ? DRAFT_ROOM : null,
    join: pe ? pe.join : null,
    hideStarters: pe ? pe.hideStarters : false,
    lockedDown: pe ? pe.lockedDown : false,
  };
  s.extras = {};
  for (const k of Object.keys(dflt)) s.extras[k] = e[k] !== undefined ? e[k] : clone(dflt[k]);
  for (const k of Object.keys(e)) if (!(k in s.extras)) s.extras[k] = e[k];
  return s;
}

/**
 * The league type today's engine plays this spec as (settings.leagueTypeId), or null when no game plays it yet. Only the
 * mechanics decide, never the preset's name: a spec the GPT writes plays the game its parts make.
 */
function typeOf(spec) {
  return playsAs(fullSpec(spec));
}
/** typeOf on a spec that's already whole (fullSpec's, specOf's, a stored settings.game), without copying it: the engine's
 *  getLeagueType asks this on nearly every read. */
function playsAs(s) {
  if (!isObj(s)) return null;
  const by = (k) => (isObj(s[k]) ? s[k].by : undefined);
  const count = countKind(s.count);
  if (!plainParts(s)) return null;
  if (by('get') === 'draft' && own(ORDER_OF, s.get.own) === s.get.order) {
    if (count === 'all' && by('score') === 'place' && by('rank') === 'total') return 'classic-draft';
    if (count === 'start' && by('score') === 'moments' && by('rank') === 'total') return 'active-roster';
  }
  if (by('get') === 'pick' && s.get.each === 1 && s.get.repeat === 'cycle' && count === 'pick' && by('score') === 'survive' && by('rank') === 'streak') {
    return 'pickem';
  }
  if (by('get') === 'none' && !count && by('score') === 'calls' && by('rank') === 'total') return 'weekly-calls';
  if (by('get') === 'card' && !count && by('score') === 'lines' && by('rank') === 'total') return 'weekly-bingo';
  return null;
}
/** The parts every game today shares: a span (from an episode, or a phase), the cast still in, no questions, moves locking
 *  at the start. */
function plainParts(s) {
  const where = s.pool && s.pool.where;
  return (
    isObj(s.span) && (isInt(s.span.from, 1) || phaseFrom(s.span.from)) &&
    isObj(s.pool) && s.pool.of === 'cast' && (where === null || (isObj(where) && where.stillIn === true && Object.keys(where).length === 1)) &&
    Array.isArray(s.ask) && s.ask.length === 0 &&
    s.closes === 'start'
  );
}

/** A start at a phase, well formed: { phase: an id, at?: the episode it plays from }. */
const phaseFrom = (f) => isObj(f) && typeof f.phase === 'string' && !!f.phase && (f.at === undefined || isInt(f.at, 1));
/**
 * The episode a span plays from: its number, a phase start's `at` once it's settled, or null while it waits for its phase
 * (or isn't a span).
 */
function spanStart(span) {
  const f = isObj(span) ? span.from : undefined;
  if (isInt(f, 1)) return f;
  return isObj(f) && isInt(f.at, 1) ? f.at : null;
}
/** The phase a span starts at (its id), or null for one that starts at an episode. */
const spanPhase = (span) => (isObj(span) && isObj(span.from) && typeof span.from.phase === 'string' && span.from.phase ? span.from.phase : null);

/**
 * The flags state-logic.js's league types carry (hasRoster, supportsReplenish, ...), worked out from a whole spec: a team
 * is a draft, a lineup a draft that starts some of it, a weekly pick a pick; calls and bingo by how it scores; waivers
 * where a draft's castaways can come free (not a shared Outlast), finale predictions with a draft.
 */
function flagsOf(s) {
  const get = isObj(s && s.get) ? s.get : {};
  const score = isObj(s && s.score) ? s.score : {};
  const waivers = waiversFit(s);
  return {
    hasRoster: get.by === 'draft',
    hasActiveRoster: get.by === 'draft' && countKind(s.count) === 'start',
    hasWeeklyPicks: get.by === 'pick',
    hasCalls: score.by === 'calls',
    hasBingo: score.by === 'lines',
    supportsReplenish: waivers,
    supportsTrade: waivers,
    supportsFinalePredictions: finaleFits(s),
  };
}

/** A whole spec's sizes: the team, the starters and the bench (0 where there are none). */
function sizesOf(s) {
  const each = isObj(s && s.get) && s.get.by === 'draft' && isInt(s.get.each, 1) ? s.get.each : 0;
  const start = countKind(s && s.count) === 'start' && isInt(s.count.start, 1) ? s.count.start : 0;
  return { each, start, bench: start ? Math.max(0, each - start) : 0 };
}

/**
 * What's wrong with a spec, as [{ at, problem }] (empty: nothing). Always its shape; with `ctx`, the data-can-settle rule
 * too: everything it scores or asks has to be something our data settles.
 *
 *   ctx.moments  the show's moments ({ id, defaultPoints, answeredBy, auto }, rulebook-moments.js momentsFor): every
 *                moment that scores (the spec's points for it, else the rulebook's) must be one research answers
 *                (answeredBy 'research', or auto: known from other answers), never the couch's word; and a moment the
 *                spec gives points must be the show's. A moment at 0 scores nothing, so nothing needs to settle it.
 *   ctx.stats    the sport's stat keys ({ key }, the Sport's: the sports branch): a stat the spec scores or asks about
 *                must be one. Absent: there are none, so nothing settles a stat.
 *   ctx.results  false when the show's results don't say who goes home or wins (a series, a talk show)
 *   ctx.phases   the season's rulebook's phases, in order ([{ id }], its blocks' season.phases): a start at a phase must
 *                be one of them, and not the first (that's Episode 1)
 *
 * opts.league: the spec is a league's own (every write to a league: RosterLogic.setGame), so what it already plays stays
 * as it is: a couch-answered moment of its rules (Make it ours) and points for moments its rules don't have
 * (defaultState's copy of the default format's points, on a league for another show, or a rulebook that changed its ids:
 * they score nothing). opts.was, with it: the spec it's changing from, so the size limits hold for what grows (a league
 * already bigger keeps its size); without it a league's own has no size limits. The GPT never passes opts.league. Without
 * ctx only the shape is checked.
 */
function specProblems(spec, ctx, opts) {
  const out = [];
  const add = (at, problem) => out.push({ at, problem });
  if (!isObj(spec)) return [{ at: '', problem: 'A game spec is an object' }];
  const s = fullSpec(spec);
  const one = (key, v) => own(VOCAB[key], v) !== undefined;
  if (s.spec !== SPEC_VERSION) add('spec', `Spec version ${SPEC_VERSION} is the only one`);
  if (s.preset !== null && !presetOf(s)) add('preset', `No preset is called "${s.preset}"`);

  // span
  if (!isObj(s.span)) add('span', 'The span says which episodes it plays');
  else {
    const from = s.span.from;
    if (isObj(from)) {
      if (typeof from.phase !== 'string' || !from.phase) add('span.from.phase', 'A start at a phase names the phase');
      if (from.at !== undefined && !isInt(from.at, 1)) add('span.from.at', "Where a phase start plays from is an episode number, 1 or later (left out while it's unknown)");
    } else if (!isInt(from, 1)) add('span.from', 'It starts at an episode number, 1 or later');
    const first = spanStart(s.span);
    if (s.span.to !== null && !(isInt(s.span.to, 1) && (first === null || s.span.to >= first))) add('span.to', 'It ends at an episode from its start on, or null for the season\'s end');
  }

  // pool
  if (!isObj(s.pool) || s.pool.of !== 'cast') add('pool.of', 'The pool is the cast');
  else if (s.pool.where !== null) {
    const w = s.pool.where;
    const keys = isObj(w) ? Object.keys(w) : [];
    if (keys.length !== 1 || !one('pool.where', keys[0])) add('pool.where', 'Who can be picked: { stillIn: true }, { teams: [...] } or { group: id }');
    else if (keys[0] === 'stillIn' && w.stillIn !== true) add('pool.where.stillIn', 'stillIn is true, or leave it out');
    else if (keys[0] === 'teams' && !(Array.isArray(w.teams) && w.teams.length && w.teams.every((t) => typeof t === 'string' && t))) add('pool.where.teams', 'The teams are a list of team ids');
    else if (keys[0] === 'group' && !(typeof w.group === 'string' && w.group)) add('pool.where.group', 'The group is an id');
  }

  // get and count
  const get = isObj(s.get) ? s.get : {};
  const count = countKind(s.count);
  if (!one('get.by', get.by)) add('get.by', 'How you get yours: draft, pick, card, none or squares');
  const league = !!(opts && opts.league);
  // The size limits: always for a new game; for a league's own, only a size that grows past them (opts.was: the spec it's
  // changing from), so one already bigger keeps its size and can come down. Without opts.was a league's own has none.
  const before = league && isObj(opts.was) ? sizesOf(fullSpec(opts.was)) : null;
  const over = (v, max, was) => v > max && (!league || (before !== null && v > was));
  if (get.by === 'draft') {
    const most = isObj(s.score) && s.score.by === 'place' ? MAX_TEAM : MAX_LINEUP_TEAM;
    const capped = !league || before !== null;
    if (!isInt(get.each, 1) || over(get.each, most, before && before.each)) add('get.each', capped ? `A draft is 1 to ${most} each` : 'A draft is 1 or more each');
    else if (count === 'start' && isInt(s.count.start, 1) && s.count.start <= get.each) {
      if (over(s.count.start, MAX_STARTERS, before && before.start)) add('count.start', `A lineup starts 1 to ${MAX_STARTERS}`);
      if (over(get.each - s.count.start, MAX_BENCH, before && before.bench)) add('get.each', `A lineup's bench is 0 to ${MAX_BENCH}`);
    }
    if (!one('get.own', get.own)) add('get.own', 'A draft is exclusive or shared');
    if (!one('get.order', get.order)) add('get.order', 'A draft is snake or blind');
    else if (one('get.own', get.own) && ORDER_OF[get.own] !== get.order) add('get.order', `An ${get.own} draft is ${ORDER_OF[get.own]}: ${get.own === 'exclusive' ? 'everyone takes turns for castaways nobody else can have' : 'everyone picks in private, revealed at once'}`);
    if (!count) add('count', 'A draft says what counts: { start: n }, { all: true } or { best: n }');
  }
  if (get.by === 'pick') {
    if (get.each !== 1) add('get.each', 'A pick is one an episode');
    if (!one('get.repeat', get.repeat)) add('get.repeat', "A pick's repeats: cycle");
    if (count !== 'pick') add('count', 'A pick counts the pick: { pick: true }');
  }
  if ((get.by === 'none' || get.by === 'card') && s.count !== null) add('count', 'Nothing is held, so nothing counts: count is null');
  if (s.count !== null) {
    const drafted = count === 'start' || count === 'all' || count === 'best';
    if (!count || Object.keys(s.count).length !== 1) add('count', 'count is one of { start: n }, { all: true }, { pick: true }, { best: n }');
    else if (drafted && get.by !== 'draft') add('count', `{ ${count} } counts a draft's`);
    else if (count === 'pick' && get.by !== 'pick') add('count', '{ pick } counts a pick');
    else if ((count === 'start' || count === 'best') && !(isInt(s.count[count], 1) && (!isInt(get.each, 1) || s.count[count] <= get.each))) add(`count.${count}`, `It counts 1 to the ${get.each || 'number'} drafted`);
    else if ((count === 'all' || count === 'pick') && s.count[count] !== true) add(`count.${count}`, `${count} is true`);
  }

  // score and rank
  const score = isObj(s.score) ? s.score : {};
  if (!one('score.by', score.by)) add('score.by', 'How it scores: moments, place, survive, calls, lines, answers or stats');
  if (score.by === 'moments' && score.points !== null && !pointsMap(score.points)) add('score.points', 'Points are moment id to a number, or null for the rulebook\'s own');
  if (score.by === 'stats' && !(pointsMap(score.points) && Object.keys(score.points).length)) add('score.points', 'Stats score as stat key to points');
  if (score.by === 'survive') {
    if (!one('score.means', score.means)) add('score.means', 'A pick survives by staying in (staysIn) or by scoring (scores)');
    if (!(isNum(score.points) && score.points >= 0)) add('score.points', 'A right pick is worth 0 or more');
  }
  if ((score.by === 'moments' || score.by === 'stats') && !['draft', 'pick', 'squares'].includes(get.by)) add('score.by', `Scoring ${score.by} needs someone of yours: a draft or a pick`);
  if (score.by === 'place' && !(get.by === 'draft' && count === 'all')) add('score.by', 'Scoring by place counts everyone drafted: a draft, { all: true }');
  if (score.by === 'survive' && get.by !== 'pick') add('score.by', 'Surviving scores a pick');
  if (score.by === 'calls' && get.by !== 'none') add('score.by', 'Calls are made with nothing held: get none');
  if (score.by === 'lines' && get.by !== 'card') add('score.by', 'Lines are a bingo card\'s: get card');
  if (score.by === 'answers' && !(Array.isArray(s.ask) && s.ask.length)) add('ask', 'A game scored by answers asks at least one question');
  const rank = isObj(s.rank) ? s.rank : {};
  if (!one('rank.by', rank.by)) add('rank.by', 'How it ranks: total, streak, matchups, categories or roto');
  if (rank.by === 'streak' && score.by !== 'survive') add('rank.by', 'A streak is a Survival Pool\'s');
  if (!one('closes', s.closes)) add('closes', 'Moves close at the start, daily or weekly');

  // ask
  if (!Array.isArray(s.ask)) add('ask', 'ask is a list of questions');
  else {
    const ids = new Set();
    s.ask.forEach((q, i) => {
      const at = `ask[${i}]`;
      if (!isObj(q)) return add(at, 'A question is an object');
      if (typeof q.id !== 'string' || !q.id) add(`${at}.id`, 'A question has an id');
      else if (ids.has(q.id)) add(`${at}.id`, `Two questions are "${q.id}"`);
      else ids.add(q.id);
      if (typeof q.ask !== 'string' || !q.ask.trim()) add(`${at}.ask`, 'A question asks something');
      if (!one('ask.answer', q.answer)) add(`${at}.answer`, 'The answer is a person, side, yesNo, number, overUnder or choice');
      if (!(isNum(q.points) && q.points >= 0)) add(`${at}.points`, 'A right answer is worth 0 or more');
      if (q.answer === 'overUnder' && q.line !== null && q.line !== undefined && !isNum(q.line)) add(`${at}.line`, 'The line is a number, or null (or left out) for the wizard to ask');
      if (q.answer === 'choice' && !(Array.isArray(q.options) && q.options.length >= 2 && q.options.every((o) => typeof o === 'string' && o))) add(`${at}.options`, 'A choice has two or more options');
      const st = isObj(q.settle) ? q.settle : {};
      if (!one('ask.settle', st.by)) add(`${at}.settle`, 'Data settles every question: results, moment, final or stat');
      else if (!TAKES[st.by].includes(st.take)) add(`${at}.settle.take`, `${st.by} takes ${TAKES[st.by].join(', ')}`);
      else if (one('ask.answer', q.answer) && SETTLES_FOR[q.answer] && !SETTLES_FOR[q.answer].includes(`${st.by}:${st.take}`)) add(`${at}.settle`, `A ${q.answer} answer isn't graded by ${st.by} ${st.take}`);
      if (st.by === 'moment' && (typeof st.moment !== 'string' || !st.moment)) add(`${at}.settle.moment`, 'Which moment settles it');
      if (st.by === 'stat' && (typeof st.stat !== 'string' || !st.stat)) add(`${at}.settle.stat`, 'Which stat settles it');
      if (st.by === 'results' && st.take === 'placed' && !isInt(st.place, 1)) add(`${at}.settle.place`, 'Which place: 1 or more');
    });
  }

  // extras
  const e = s.extras;
  if (!isObj(e)) add('extras', 'extras is an object');
  else {
    if (e.waivers !== null) {
      if (!waiversFit(s)) add('extras.waivers', 'Waivers need a draft whose castaways can come free');
      else waiverProblems(e.waivers, s).forEach(([at, p]) => add(`extras.waivers${at}`, p));
    } else if (waiversFit(s)) {
      // null is "no waivers can happen here"; a draft with free agents says what it does, even if that's nothing.
      add('extras.waivers', "A draft whose castaways can come free has waivers: replace 'never' and manual windows with no swaps for none");
    }
    if (e.bets !== null && !(isObj(e.bets) && isInt(e.bets.points, 1) && e.bets.points <= MAX_BET_POINTS)) add('extras.bets', `Side bets are { points: 1 to ${MAX_BET_POINTS} }, or null`);
    if (e.finale !== null) {
      if (!finaleFits(s)) add('extras.finale', 'Finale predictions go with a draft');
      else if (!(isObj(e.finale) && isNum(e.finale.top3) && isNum(e.finale.winner) && (e.finale.from === 'any' || e.finale.from === 'own'))) add('extras.finale', 'Finale predictions are { top3, winner, from: any | own }');
    }
    if (typeof e.calls !== 'boolean') add('extras.calls', 'calls is true or false');
    else if (e.calls && get.by !== 'pick') add('extras.calls', 'The weekly call goes beside a pick');
    if (e.draft !== null) {
      if (get.by !== 'draft') add('extras.draft', 'Only a draft has a draft room');
      else if (!(isObj(e.draft) && (e.draft.at === null || isInstant(e.draft.at)) && DRAFT_TIMERS.includes(e.draft.timer) && (e.draft.away === 'wait' || e.draft.away === 'queue'))) {
        add('extras.draft', 'The draft room is { at: an ISO time with its zone, or null; timer: 0, 60 or 120; away: wait | queue }');
      }
    } else if (get.by === 'draft') add('extras.draft', 'A draft has a draft room');
    if (e.join !== null && !JOINS.includes(e.join)) add('extras.join', 'Who can join: open, ask, locked or null');
    else if (e.join === 'open' && get.by === 'draft' && get.own === 'exclusive') add('extras.join', "An exclusive draft can't be open: its castaways are one team's each, so newcomers ask");
    if (typeof e.hideStarters !== 'boolean') add('extras.hideStarters', 'hideStarters is true or false');
    else if (e.hideStarters && count !== 'start') add('extras.hideStarters', 'Only a lineup has starters to hide');
    if (typeof e.lockedDown !== 'boolean') add('extras.lockedDown', 'lockedDown is true or false');
  }

  unknownKeys(s).forEach((at) => add(at, `"${at.split('.').pop()}" isn't part of a game spec`));
  if (ctx) settleProblems(s, ctx, opts || {}).forEach(([at, p]) => add(at, p));
  return out;
}

/** An instant with its time zone, as a draft's time is stored (toISOString): "2026-10-28T23:00:00.000Z". */
const isInstant = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v) && !Number.isNaN(Date.parse(v));

// Every key a spec can have, so a misspelled one ("scoring", "sideBets") is reported, not quietly played as the default.
const KEYS = {
  top: ['spec', 'preset', 'span', 'pool', 'get', 'count', 'score', 'rank', 'ask', 'closes', 'extras'],
  span: ['from', 'to'],
  from: ['phase', 'at'],
  pool: ['of', 'where'],
  get: { draft: ['by', 'each', 'order', 'own'], pick: ['by', 'each', 'repeat'], card: ['by'], none: ['by'], squares: ['by'] },
  score: { moments: ['by', 'points'], place: ['by'], survive: ['by', 'means', 'points'], calls: ['by'], lines: ['by'], answers: ['by'], stats: ['by', 'points'] },
  rank: ['by'],
  extras: ['waivers', 'bets', 'finale', 'calls', 'draft', 'join', 'hideStarters', 'lockedDown'],
  waivers: ['feel', 'replace', 'short', 'windows', 'order', 'hours', 'freeAgency', 'autoFill'],
  windows: ['schedule', 'every', 'swaps'],
  draft: ['at', 'timer', 'away'],
  finale: ['top3', 'winner', 'from'],
  bets: ['points'],
  question: ['id', 'ask', 'answer', 'points', 'settle', 'line', 'options'],
  settle: ['by', 'take', 'moment', 'stat', 'place'],
};
/** The paths of keys a spec has that no game spec does. */
function unknownKeys(s) {
  const out = [];
  const check = (o, allowed, at) => {
    if (!isObj(o) || !allowed) return;
    for (const k of Object.keys(o)) if (!allowed.includes(k)) out.push(at ? `${at}.${k}` : k);
  };
  check(s, KEYS.top, '');
  check(s.span, KEYS.span, 'span');
  if (isObj(s.span)) check(s.span.from, KEYS.from, 'span.from');
  check(s.pool, KEYS.pool, 'pool');
  if (isObj(s.get)) check(s.get, own(KEYS.get, s.get.by), 'get');
  if (isObj(s.score)) check(s.score, own(KEYS.score, s.score.by), 'score');
  check(s.rank, KEYS.rank, 'rank');
  (Array.isArray(s.ask) ? s.ask : []).forEach((q, i) => {
    check(q, KEYS.question, `ask[${i}]`);
    if (isObj(q)) check(q.settle, KEYS.settle, `ask[${i}].settle`);
  });
  const e = s.extras;
  check(e, KEYS.extras, 'extras');
  if (isObj(e)) {
    for (const k of ['waivers', 'draft', 'finale', 'bets']) check(e[k], KEYS[k], `extras.${k}`);
    if (isObj(e.waivers)) check(e.waivers.windows, KEYS.windows, 'extras.waivers.windows');
  }
  return out;
}

const pointsMap = (p) => isObj(p) && Object.values(p).every(isNum);

/** A draft's waivers, as WaiverLogic plays them: nothing it would quietly read as something else. */
function waiverProblems(w, s) {
  if (!isObj(w)) return [['', 'Waivers are an object']];
  const out = [];
  const roster = isInt(s.get.each, 1) ? s.get.each : null;
  const lineup = countKind(s.count) === 'start';
  if (!WAIVER_FEELS.includes(w.feel)) out.push(['.feel', `The feel is ${WAIVER_FEELS.join(', ')}`]);
  if (!REPLACE_RULES.includes(w.replace)) out.push(['.replace', `Replacements are ${REPLACE_RULES.join(', ')}`]);
  else if (w.replace === 'whenShort' && !lineup) out.push(['.replace', "Only a lineup is short: with everyone counting, a loss is replaced right away ('always')"]);
  if (w.short !== null && !(isInt(w.short, 0) && (roster === null || w.short <= roster - 1))) out.push(['.short', `Short at 0 to ${roster === null ? 'the team less one' : roster - 1} still in, or null for the recommended`]);
  const win = w.windows;
  if (!(isObj(win) && WINDOW_SCHEDULES.includes(win.schedule) && isInt(win.every, 2) && isInt(win.swaps, 0))) out.push(['.windows', 'Windows are { schedule: everyEpisode | every | manual, every: 2 or more, swaps: 0 or more }']);
  else if (roster !== null && win.swaps > roster) out.push(['.windows.swaps', `A window swaps at most the team: ${roster}`]);
  if (!WAIVER_ORDERS.includes(w.order)) out.push(['.order', `The order is ${WAIVER_ORDERS.join(', ')}`]);
  if (!WAIVER_HOURS.includes(w.hours)) out.push(['.hours', `They run ${WAIVER_HOURS.join(', ')} hours before`]);
  if (typeof w.freeAgency !== 'boolean') out.push(['.freeAgency', 'freeAgency is true or false']);
  if (typeof w.autoFill !== 'boolean') out.push(['.autoFill', 'autoFill is true or false']);
  return out;
}

// The data-can-settle rule (the user's decision, 2026-10-27): only what data can settle. Sports: box scores and
// scoreboards (the Sport's stat keys, finals). Shows: the results research, which counts as data.
function settleProblems(s, ctx, opts) {
  const out = [];
  // A start at a phase: one of the season's, never its first (that one starts with Episode 1).
  const phase = spanPhase(s.span);
  if (phase && Array.isArray(ctx.phases)) {
    const at = ctx.phases.findIndex((p) => (isObj(p) ? p.id : p) === phase);
    if (at < 0) out.push(['span.from.phase', `"${phase}" isn't one of the season's phases`]);
    else if (at === 0) out.push(['span.from.phase', 'The first phase starts with Episode 1: start it there']);
  }
  const moments = Array.isArray(ctx.moments) ? ctx.moments : [];
  const momentById = new Map(moments.map((m) => [m.id, m]));
  const stats = new Set((Array.isArray(ctx.stats) ? ctx.stats : []).map((x) => (isObj(x) ? x.key : x)));
  const byData = (m) => m.answeredBy === 'research' || (!!m.auto && m.answeredBy !== 'league');
  const couchWord = (m) => `${m.label || m.id} is the couch's word: research doesn't answer it, so data can't settle it`;
  const momentProblem = (id) => {
    const m = momentById.get(id);
    if (!m) return `"${id}" isn't one of the show's moments`;
    if (!opts.league && !byData(m)) return couchWord(m);
    return null;
  };
  const score = isObj(s.score) ? s.score : {};
  if (score.by === 'moments') {
    const given = pointsMap(score.points) ? score.points : {};
    const shared = isObj(s.get) && s.get.own === 'shared';
    if (!opts.league) {
      // Every moment that scores, by the spec's points for it or else the rulebook's own (ActiveRosterLogic.pointsFor); one
      // the rulebook switched off scores nothing whatever the points say (it isn't among the rules' events).
      for (const m of moments) {
        const pts = m.off ? 0 : Object.prototype.hasOwnProperty.call(given, m.id) ? given[m.id] : defaultOf(m.defaultPoints, shared);
        if (pts !== 0 && !byData(m)) out.push([`score.points.${m.id}`, `${couchWord(m)}. Score it 0`]);
      }
      // ...and every moment the spec gives points is the show's.
      for (const [id, pts] of Object.entries(given)) {
        if (pts !== 0 && !momentById.has(id)) out.push([`score.points.${id}`, `"${id}" isn't one of the show's moments`]);
      }
    }
  }
  if (score.by === 'stats' && pointsMap(score.points)) {
    for (const key of Object.keys(score.points)) if (!stats.has(key)) out.push([`score.points.${key}`, `Nothing counts "${key}": it isn't one of the sport's stats`]);
  }
  (Array.isArray(s.ask) ? s.ask : []).forEach((q, i) => {
    const st = (q && q.settle) || {};
    if (st.by === 'moment' && typeof st.moment === 'string') {
      const p = momentProblem(st.moment);
      if (p) out.push([`ask[${i}].settle.moment`, p]);
    }
    if (st.by === 'stat' && typeof st.stat === 'string' && !stats.has(st.stat)) out.push([`ask[${i}].settle.stat`, `Nothing counts "${st.stat}": it isn't one of the sport's stats`]);
    if (st.by === 'results' && ctx.results === false) out.push([`ask[${i}].settle`, "The show's results don't say who goes home or wins"]);
  });
  return out;
}
/** A moment's own points for the draft's ownership (a format may give { exclusive, shared }). */
const defaultOf = (d, shared) => (isObj(d) ? d[shared ? 'shared' : 'exclusive'] || 0 : d || 0);

/** "A4", "sports", "later" in the order a spec waits for them. */
const STEP_ORDER = ['A4', 'sports', 'later'];
const STEP_NAMES = {
  A4: 'questions settled by data (step A4)',
  sports: 'the sports branch',
  later: 'no step yet',
};

/**
 * What a well-formed spec needs that isn't built, as [{ at, step, problem }]: a value only a later step builds ('A4',
 * 'sports', 'later'), or, with every value built, a combination no game plays yet (step null). Empty: today's engine plays
 * it (typeOf gives its league type). For the wizard to say what isn't there yet, and G2's sports requests.
 */
function specWaitsFor(spec) {
  const s = fullSpec(spec);
  const out = [];
  const need = (at, step, what) => out.push({ at, step, problem: `${what} comes with ${STEP_NAMES[step]}` });
  const val = (key, at, v, what) => {
    const step = own(VOCAB[key], v);
    if (step && step !== 'now') need(at, step, what);
  };
  const where = isObj(s.pool) && isObj(s.pool.where) ? Object.keys(s.pool.where)[0] : null;
  if (where) val('pool.where', 'pool.where', where, where === 'teams' ? 'Picking from teams' : 'Picking from a group');
  if (isObj(s.get)) val('get.by', 'get.by', s.get.by, 'Squares');
  const count = countKind(s.count);
  if (count) val('count', 'count', count, 'Best ball');
  if (isObj(s.score)) val('score.by', 'score.by', s.score.by, s.score.by === 'stats' ? 'Scoring by stats' : 'Scoring by answers');
  if (isObj(s.rank)) val('rank.by', 'rank.by', s.rank.by, `Ranking by ${s.rank.by}`);
  val('closes', 'closes', s.closes, `Locking ${s.closes}`);
  (Array.isArray(s.ask) ? s.ask : []).forEach((q, i) => {
    const steps = [own(VOCAB['ask.answer'], q && q.answer), own(VOCAB['ask.settle'], q && q.settle && q.settle.by)].filter(Boolean);
    const step = STEP_ORDER.slice().reverse().find((x) => steps.includes(x));
    if (step) need(`ask[${i}]`, step, `"${(q && q.ask) || q.id}"`);
  });
  const seen = new Set();
  const steps = out.filter((x) => !seen.has(`${x.at}|${x.step}`) && seen.add(`${x.at}|${x.step}`));
  steps.sort((a, b) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step));
  if (!steps.length && !typeOf(s)) steps.push({ at: '', step: null, problem: 'No game plays this way yet: it isn\'t one of today\'s five' });
  return steps;
}

module.exports = {
  SPEC_VERSION, VOCAB, TAKES, SETTLES_FOR, PRESETS, PRESET_TYPES, TYPE_PRESETS, PRESET_LABELS, NO_WAIVERS, DRAFT_ROOM,
  REPLACE_RULES, WINDOW_SCHEDULES, WAIVER_FEELS, WAIVER_ORDERS, WAIVER_HOURS, DRAFT_TIMERS, MAX_BET_POINTS, JOINS, ORDER_OF,
  MAX_TEAM, MAX_STARTERS, MAX_BENCH, MAX_LINEUP_TEAM,
  fullSpec, typeOf, playsAs, flagsOf, sizesOf, specProblems, specWaitsFor, waiversFit, finaleFits, countKind, presetOf, sameValue, own,
  spanStart, spanPhase,
};
