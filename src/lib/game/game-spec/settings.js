// Today's league settings and the game spec, both ways (docs/PLAN-start-a-game-gpt.md step A1):
//
//   specOf(settings)        the spec a league plays, read as state-logic.js reads its settings today (getLeagueType,
//                           rosterSize, WaiverLogic.config, GhostLogic.joinMode, ...). Every league has one.
//   settingsOf(spec)        the settings fields that spec writes (undefined: the field goes), or null when it has problems
//                           or today's engine has no game that plays it (specProblems, specWaitsFor say why). A2 writes
//                           these while classic still reads them.
//   withSpec(settings, spec) the settings with the parts of the game that change written; the rest keep their stored
//                           form.
//
// A spec owns only its own game's fields: an Outlast league's lineup slots and moment points, a draft's pool points,
// another kind's leftovers that defaultState gives every league, stay as they are (dormant: nothing reads them). OUTSIDE
// lists what isn't the game at all: which show and rules it plays (the spec only refers to them), what it has revealed,
// archiving, setup. Pure CommonJS, like ./schema.js.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./schema.js */
const {
  SPEC_VERSION, TYPE_PRESETS, REPLACE_RULES, WINDOW_SCHEDULES, WAIVER_FEELS, WAIVER_ORDERS, WAIVER_HOURS, DRAFT_TIMERS,
  MAX_BET_POINTS, ORDER_OF, fullSpec, typeOf, specProblems, waiversFit, sameValue,
} = require('./schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Settings fields that aren't the game: what it's about and how it's run, never what it is. */
const OUTSIDE = [
  'showId', 'showFormat', 'showFormatData', 'leagueRulesetData', 'rulebook', // the show and the rules it refers to
  'seasonRuleChanges', 'adoptedRuleChanges', 'declinedRuleChanges', 'wikiSeason',
  'revealedThroughEpisode', 'setupComplete', 'archivedAt', 'archivedBy', // what it's seen, setting it up, archiving it
  'expectedTeams', 'waiverFit', // the waiver recommendation's own bookkeeping (WaiverLogic.recommendFor, refit)
  'bonusCategories', // pre-bets predictions, removed by migrateLeagueState
  'shadowOf', 'shadowFrom', // a local shadow league's source (scripts/dev-test/shadow-leagues.js)
  'game', // the spec itself, once A2 stores it
];


const clampBet = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(MAX_BET_POINTS, Math.max(1, n)) : 1;
};

/** The episode it starts at (startEpisode, default 1) and its last (endEpisode: null, or one from the start on). */
function spanOf(st) {
  const from = Number(st.startEpisode);
  const start = Number.isInteger(from) && from >= 1 ? from : 1;
  const to = Number(st.endEpisode);
  return { from: start, to: Number.isInteger(to) && to >= start ? to : null };
}

// WaiverLogic.legacyConfig, normalizeWindows and config, on settings alone (R: the roster size). These readers, and the
// vocabularies in ./schema.js, are a second copy of state-logic.js's until A2, when the engine reads its settings through
// specOf and takes the vocabularies from here: one definition. Until then tests/game-spec.test.js holds the two together.
function swapEveryOf(st) {
  const n = Number(st.swapEvery);
  return Number.isInteger(n) && n >= 1 ? n : 3;
}
function normalizeWindows(R, w) {
  const most = Math.max(1, R || 1);
  let schedule = WINDOW_SCHEDULES.includes(w && w.schedule) ? w.schedule : 'manual';
  const n = Math.floor(Number(w && w.every));
  if (schedule === 'every' && n === 1) schedule = 'everyEpisode';
  const k = Math.floor(Number(w && w.swaps));
  return { schedule, every: Number.isFinite(n) && n >= 2 ? n : 3, swaps: Number.isFinite(k) ? Math.min(Math.max(k, 0), most) : 1 };
}
function waiversOf(st, lineup, R) {
  const n = swapEveryOf(st);
  const every = Math.max(2, n);
  const legacyReplace = st.replenishEnabled === true ? (lineup ? 'whenShort' : 'always') : 'never';
  const legacyWindows = st.tradeEnabled === true ? { schedule: n === 1 ? 'everyEpisode' : 'every', every, swaps: 1 } : { schedule: 'manual', every, swaps: 0 };
  const rule = REPLACE_RULES.includes(st.replaceRule) ? st.replaceRule : legacyReplace;
  const hours = Number(st.waiverProcessHours);
  return {
    feel: WAIVER_FEELS.includes(st.waiverFeel) ? st.waiverFeel : 'balanced',
    // Outlast has no lineup to be short of: "only when short" is replace-every-loss there.
    replace: rule === 'whenShort' && !lineup ? 'always' : rule,
    // WaiverLogic.shortAt: never past the team less one, however the team changed since.
    short: Number.isInteger(st.replenishAt) && st.replenishAt >= 0 ? Math.min(st.replenishAt, Math.max(0, (R || 0) - 1)) : null,
    windows: isObj(st.waiverWindows) ? normalizeWindows(R, st.waiverWindows) : legacyWindows,
    order: WAIVER_ORDERS.includes(st.replenishOrderBy) ? st.replenishOrderBy : 'rolling',
    hours: WAIVER_HOURS.includes(hours) ? hours : 24,
    freeAgency: st.freeAgencyEnabled !== false,
    autoFill: st.autoFill !== false,
  };
}

/**
 * The spec a league's settings play: its league type's mechanics, their parameters, its span and its extras. An unknown or
 * missing league type plays Outlast, as getLeagueType does.
 */
function specOf(settings) {
  const st = isObj(settings) ? settings : {};
  const type = Object.prototype.hasOwnProperty.call(TYPE_PRESETS, st.leagueTypeId) ? st.leagueTypeId : 'classic-draft';
  const own = st.ownershipMode === 'shared' ? 'shared' : 'exclusive';
  const draft = type === 'classic-draft' || type === 'active-roster';
  const spec = {
    spec: SPEC_VERSION,
    preset: TYPE_PRESETS[type],
    span: spanOf(st),
    pool: { of: 'cast', where: { stillIn: true } },
  };
  let R = 0;
  if (type === 'classic-draft') {
    R = st.teamSize;
    Object.assign(spec, { get: { by: 'draft', each: st.teamSize, order: ORDER_OF[own], own }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' } });
  } else if (type === 'active-roster') {
    const start = st.activeSlots || 0;
    R = start + (st.benchSlots || 0);
    Object.assign(spec, {
      get: { by: 'draft', each: R, order: ORDER_OF[own], own },
      count: { start },
      score: { by: 'moments', points: isObj(st.eventPoints) ? clone(st.eventPoints) : null },
      rank: { by: 'total' },
    });
  } else if (type === 'pickem') {
    Object.assign(spec, {
      get: { by: 'pick', each: 1, repeat: 'cycle' },
      count: { pick: true },
      score: { by: 'survive', means: st.poolSurvive === 'scores' ? 'scores' : 'staysIn', points: typeof st.pickemCorrectPoints === 'number' ? st.pickemCorrectPoints : 1 },
      rank: { by: 'streak' },
    });
  } else if (type === 'weekly-calls') {
    Object.assign(spec, { get: { by: 'none' }, count: null, score: { by: 'calls' }, rank: { by: 'total' } });
  } else {
    Object.assign(spec, { get: { by: 'card' }, count: null, score: { by: 'lines' }, rank: { by: 'total' } });
  }
  spec.ask = [];
  spec.closes = 'start';

  // Who can join (GhostLogic.joinMode): classic's late-joiner switch off locks it; open only where castaways can be on
  // several teams (else it reads as ask); anything else is the recommendation.
  const sharedJoin = !draft || own === 'shared';
  const join = st.allowLateJoiners === false ? 'locked' : st.joinMode === 'ask' ? 'ask' : st.joinMode === 'open' ? (sharedJoin ? 'open' : 'ask') : null;
  const timer = Number(st.draftTimer);
  spec.extras = {
    waivers: waiversFit(spec) ? waiversOf(st, type === 'active-roster', R) : null,
    bets: st.bonusEnabled ? { points: clampBet(st.defaultBetPoints) } : null,
    finale: draft && st.finalePredictionsEnabled === true
      ? { top3: st.finaleTop3Points || 0, winner: st.finaleWinnerPoints || 0, from: st.finalePredictionScope === 'ownPicksOnly' ? 'own' : 'any' }
      : null,
    calls: type === 'pickem' && !!st.calls,
    draft: draft ? { at: typeof st.draftScheduledAt === 'string' ? st.draftScheduledAt : null, timer: DRAFT_TIMERS.includes(timer) ? timer : 0, away: st.draftAway === 'queue' ? 'queue' : 'wait' } : null,
    join,
    hideStarters: type === 'active-roster' && st.hideStartersUntilLock === true,
    lockedDown: st.lockedDown === true,
  };
  return spec;
}

/**
 * The settings fields a spec writes, as { field: value } (undefined: the field goes), or null when it has problems
 * (specProblems: nothing invalid is ever written) or no game plays it today. Only its own game's fields: see the top of
 * this file. Its points are written as it says them: a spec read from a league (specOf) carries the league's points map,
 * defaults and all, so a writer that changes the draft's ownership moves the old ownership's defaults to the new one's
 * first, as updateSettings('ownershipMode') does (A2).
 */
function settingsOf(spec) {
  const s = fullSpec(spec);
  const type = typeOf(s);
  // A league's own rules hold (a team bigger than a new game's): what the engine can't play is never written.
  if (!type || specProblems(s, null, { league: true }).length) return null;
  const e = s.extras;
  const out = {
    leagueTypeId: type,
    startEpisode: s.span.from,
    endEpisode: s.span.to,
    allowLateJoiners: e.join !== 'locked',
    joinMode: e.join === null ? undefined : e.join,
    lockedDown: e.lockedDown === true,
    bonusEnabled: !!e.bets,
  };
  if (e.bets) out.defaultBetPoints = e.bets.points;
  if (s.get.by === 'draft') {
    Object.assign(out, {
      ownershipMode: s.get.own,
      draftScheduledAt: e.draft ? e.draft.at : null,
      draftTimer: e.draft ? e.draft.timer : 0,
      draftAway: e.draft ? e.draft.away : 'wait',
      finalePredictionsEnabled: !!e.finale,
    });
    if (e.finale) {
      Object.assign(out, { finaleTop3Points: e.finale.top3, finaleWinnerPoints: e.finale.winner, finalePredictionScope: e.finale.from === 'own' ? 'ownPicksOnly' : 'open' });
    }
    if (type === 'classic-draft') out.teamSize = s.get.each;
    else {
      Object.assign(out, {
        activeSlots: s.count.start,
        benchSlots: s.get.each - s.count.start,
        eventPoints: s.score.points === null ? undefined : clone(s.score.points),
        hideStartersUntilLock: e.hideStarters === true,
      });
    }
    const w = e.waivers;
    if (w) {
      Object.assign(out, {
        replaceRule: w.replace,
        replenishAt: w.short,
        waiverWindows: clone(w.windows),
        waiverFeel: w.feel,
        autoFill: w.autoFill,
        replenishOrderBy: w.order,
        waiverProcessHours: w.hours,
        freeAgencyEnabled: w.freeAgency,
        // The pre-v2 switches, kept in step for whatever still reads them (WaiverLogic.mirrorLegacy).
        replenishEnabled: w.replace !== 'never',
        tradeEnabled: w.windows.schedule !== 'manual' && w.windows.swaps > 0,
        swapEvery: w.windows.schedule === 'everyEpisode' ? 1 : w.windows.every,
      });
    }
  }
  if (type === 'pickem') {
    Object.assign(out, { pickemCorrectPoints: s.score.points, poolSurvive: s.score.means === 'scores' ? 'scores' : undefined, calls: e.calls === true });
  }
  return out;
}

/** The settings fields this spec owns (what settingsOf writes or takes away), or null when settingsOf has none. */
function ownedFields(spec) {
  const fields = settingsOf(spec);
  return fields ? Object.keys(fields) : null;
}

/**
 * `settings` with what the spec says written into a copy, or null when settingsOf has none. Only the parts of the game
 * that change are written: a part the settings already play as the spec says keeps its stored form (a Who can join choice
 * classic's late-joiner switch is overriding, a replenishAt beyond today's team, the waiver suggestion still to be fitted
 * at the draft: waiverFit goes only when the waivers change, as updateSettings drops it). So writing a league's own spec
 * back changes nothing, and the result always reads as the spec. What updateSettings does to the rest of the state (a
 * start episode's place in the schedule, ownership's points) is the writer's (A2).
 */
function withSpec(settings, spec) {
  const fields = settingsOf(spec);
  if (!fields) return null;
  const want = fullSpec(spec);
  const out = clone(isObj(settings) ? settings : {});
  const write = (part) => {
    for (const k of part.fields) {
      if (!(k in fields)) continue;
      if (fields[k] === undefined) delete out[k];
      else out[k] = clone(fields[k]);
    }
    if (part.written) part.written(out);
  };
  // The parts that change, then any a stored value shows through once another part has changed (a dormant finale switch on
  // a pool becoming a draft, a joinMode an exclusive draft read as ask going shared).
  for (const pass of [0, 1]) {
    const now = specOf(out);
    for (const part of PARTS) if (!sameValue(part.read(now), part.read(want))) write(part);
    if (pass === 1 && !sameValue(specOf(out), want)) for (const part of PARTS) write(part);
  }
  return out;
}

// The spec's parts and the settings fields each writes (OWNED is all of them).
const WAIVER_FIELDS = ['replaceRule', 'replenishAt', 'waiverWindows', 'waiverFeel', 'autoFill', 'replenishOrderBy', 'waiverProcessHours', 'freeAgencyEnabled', 'replenishEnabled', 'tradeEnabled', 'swapEvery'];
const PARTS = [
  { fields: ['leagueTypeId'], read: (s) => typeOf(s) },
  { fields: ['startEpisode', 'endEpisode'], read: (s) => s.span },
  { fields: ['ownershipMode', 'teamSize', 'activeSlots', 'benchSlots'], read: (s) => [s.get, s.count] },
  { fields: ['eventPoints', 'pickemCorrectPoints', 'poolSurvive'], read: (s) => s.score },
  { fields: ['allowLateJoiners', 'joinMode'], read: (s) => s.extras.join },
  { fields: ['lockedDown'], read: (s) => s.extras.lockedDown },
  { fields: ['bonusEnabled', 'defaultBetPoints'], read: (s) => s.extras.bets },
  { fields: ['draftScheduledAt', 'draftTimer', 'draftAway'], read: (s) => s.extras.draft },
  { fields: ['finalePredictionsEnabled', 'finaleTop3Points', 'finaleWinnerPoints', 'finalePredictionScope'], read: (s) => s.extras.finale },
  { fields: ['hideStartersUntilLock'], read: (s) => s.extras.hideStarters },
  { fields: ['calls'], read: (s) => s.extras.calls },
  { fields: WAIVER_FIELDS, read: (s) => s.extras.waivers, written: (out) => delete out.waiverFit },
];

/** Every settings field a spec can write. */
const OWNED = PARTS.flatMap((p) => p.fields);

module.exports = { OUTSIDE, OWNED, specOf, settingsOf, ownedFields, withSpec };
