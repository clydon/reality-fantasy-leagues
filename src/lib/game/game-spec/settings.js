// Today's league settings and the game spec, both ways (docs/PLAN-start-a-game-gpt.md step A1):
//
//   specOf(settings)        the spec a league plays, read as state-logic.js reads its settings today (getLeagueType,
//                           rosterSize, WaiverLogic.config, GhostLogic.joinMode, ...). Every league has one.
//   settingsOf(spec)        the settings fields that spec writes (undefined: the field goes), or null when it has problems
//                           or today's engine has no game that plays it (specProblems, specWaitsFor say why). A2 writes
//                           these while classic still reads them.
//   withSpec(settings, spec) the settings with the parts of the game that change written; the rest keep their stored
//                           form.
//   gameOf(settings)        the spec a league plays: its stored settings.game (the game-specs flag), else specOf. What
//                           state-logic.js reads every game setting through (A2).
//
// A spec owns only its own game's fields: an Outlast league's lineup slots and moment points, a draft's pool points,
// another kind's leftovers that defaultState gives every league, stay as they are (dormant: nothing reads them). OUTSIDE
// lists what isn't the game at all: which show and rules it plays (the spec only refers to them), what it has revealed,
// archiving, setup. Pure CommonJS, like ./schema.js.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./schema.js */
const {
  SPEC_VERSION, TYPE_PRESETS, REPLACE_RULES, WINDOW_SCHEDULES, WAIVER_FEELS, WAIVER_ORDERS, WAIVER_HOURS, DRAFT_TIMERS,
  MAX_BET_POINTS, ORDER_OF, CALLS, fullSpec, typeOf, playsAs, specProblems, waiversFit, sameValue, spanStart, spanPhase,
  finaleQuestions, finaleOf, LATE_HOURS, MAX_SEAT_PEOPLE, seatPeople, NEVER, VOCAB,
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


/** A side bet's points: a whole number from 1 to MAX_BET_POINTS (1 for anything else). */
const clampBet = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(MAX_BET_POINTS, Math.max(1, n)) : 1;
};

/**
 * Where it starts and its last episode (endEpisode: null, or one from the start on). A start at an episode is startEpisode
 * (default 1); a start at a phase of the season's rulebook (A3) is startPhase, with startEpisode null while it waits for
 * that phase ({ phase }) and the episode it plays from once that's settled ({ phase, at }).
 */
function spanOf(st) {
  const n = Number(st.startEpisode);
  const at = Number.isInteger(n) && n >= 1 ? n : null;
  const phase = typeof st.startPhase === 'string' && st.startPhase ? st.startPhase : null;
  const from = phase ? (at === null ? { phase } : { phase, at }) : (at === null ? 1 : at);
  const first = phase ? at : from;
  const to = Number(st.endEpisode);
  return { from, to: Number.isInteger(to) && to >= (first === null ? 1 : first) ? to : null };
}

// How a league's settings say its waivers, on settings alone (R: the roster size). The one definition: state-logic.js's
// WaiverLogic reads the spec, and its legacyConfig and normalizeWindows are these.
/** The pre-v2 add/drop schedule (settings.swapEvery): every Nth episode, default 3. */
function swapEveryOf(st) {
  const n = Number(st.swapEvery);
  return Number.isInteger(n) && n >= 1 ? n : 3;
}
/** A window schedule as WaiverLogic plays it: a known schedule (else manual), every 2 or more, 0 to R swaps. */
function normalizeWindows(R, w) {
  const most = Math.max(1, R || 1);
  let schedule = WINDOW_SCHEDULES.includes(w && w.schedule) ? w.schedule : 'manual';
  const n = Math.floor(Number(w && w.every));
  if (schedule === 'every' && n === 1) schedule = 'everyEpisode';
  const k = Math.floor(Number(w && w.swaps));
  return { schedule, every: Number.isFinite(n) && n >= 2 ? n : 3, swaps: Number.isFinite(k) ? Math.min(Math.max(k, 0), most) : 1 };
}
/** What the pre-v2 switches (replenishEnabled, tradeEnabled, swapEvery) meant, in v2 terms: { replace, windows }. */
function legacyWaivers(st, lineup) {
  const n = swapEveryOf(st);
  const every = Math.max(2, n);
  return {
    replace: st.replenishEnabled === true ? (lineup ? 'whenShort' : 'always') : 'never',
    windows: st.tradeEnabled === true ? { schedule: n === 1 ? 'everyEpisode' : 'every', every, swaps: 1 } : { schedule: 'manual', every, swaps: 0 },
  };
}
/** A draft's waivers, from its settings (lineup: it has starters; R: its team). The spec's extras.waivers. */
function waiversOf(st, lineup, R) {
  const legacy = legacyWaivers(st, lineup);
  const rule = REPLACE_RULES.includes(st.replaceRule) ? st.replaceRule : legacy.replace;
  const hours = Number(st.waiverProcessHours);
  return {
    feel: WAIVER_FEELS.includes(st.waiverFeel) ? st.waiverFeel : 'balanced',
    // Outlast has no lineup to be short of: "only when short" is replace-every-loss there.
    replace: rule === 'whenShort' && !lineup ? 'always' : rule,
    // WaiverLogic.shortAt: never past the team less one, however the team changed since.
    short: Number.isInteger(st.replenishAt) && st.replenishAt >= 0 ? Math.min(st.replenishAt, Math.max(0, (R || 0) - 1)) : null,
    windows: isObj(st.waiverWindows) ? normalizeWindows(R, st.waiverWindows) : legacy.windows,
    order: WAIVER_ORDERS.includes(st.replenishOrderBy) ? st.replenishOrderBy : 'rolling',
    hours: WAIVER_HOURS.includes(hours) ? hours : 24,
    freeAgency: st.freeAgencyEnabled !== false,
    autoFill: st.autoFill !== false,
  };
}

/**
 * A draft's rank, from its settings: by its total, a lineup's stock market by worth (draftRank 'worth', A10 part 3c), or last one
 * standing (draftRank 'standing'), with a race (draftRace) and players knocked out (draftCut, A11 part 1) as the spec says them.
 * Each only when it's set, so a draft that has none reads as it always did. `lineup`: a lineup or best ball (worth is theirs).
 */
function draftRankOf(st, lineup, copy) {
  const cut = Array.isArray(st.draftCut) && st.draftCut.length ? (copy ? clone(st.draftCut) : st.draftCut) : null;
  const by = lineup && st.draftRank === 'worth' ? 'worth' : cut && st.draftRank === 'standing' ? 'standing' : 'total';
  const rank = { by };
  if (isObj(st.draftRace)) rank.race = copy ? clone(st.draftRace) : st.draftRace;
  if (cut) rank.cut = cut;
  // A11 part 2: whether one left ends it (rankOneLeft), beside last one standing.
  if (by === 'standing') endsOf(st, rank, false);
  return rank;
}
/**
 * A11 part 2b: a game of questions' rank, from its settings: by its total, or last one standing once it knocks players out (lives,
 * or players knocked out by their points: questionsCut), with a race (questionsRace) as the spec says it, and last one standing's
 * end (its allOut with lives). Each only when it's set.
 */
function questionsRankOf(st, lives, copy) {
  const cut = Array.isArray(st.questionsCut) && st.questionsCut.length ? (copy ? clone(st.questionsCut) : st.questionsCut) : null;
  const rank = { by: cut || lives ? 'standing' : 'total' };
  if (isObj(st.questionsRace)) rank.race = copy ? clone(st.questionsRace) : st.questionsRace;
  if (cut) rank.cut = cut;
  if (rank.by === 'standing') endsOf(st, rank, lives);
  return rank;
}
/** A11 part 2: last one standing's end as its settings say it (rankOneLeft; a pool's rankAllOut too), each only when it's set. */
function endsOf(st, rank, pool) {
  if (Object.prototype.hasOwnProperty.call(VOCAB['rank.oneLeft'], st.rankOneLeft)) rank.oneLeft = st.rankOneLeft;
  if (pool && Object.prototype.hasOwnProperty.call(VOCAB['rank.allOut'], st.rankAllOut)) rank.allOut = st.rankAllOut;
  return rank;
}

/** Today's league types: the five presets', and a game of questions (A4: no preset, its questions in settings.questions). */
const LEAGUE_TYPES = [...Object.keys(TYPE_PRESETS), 'questions'];

/**
 * The spec a league's settings play: its league type's mechanics, their parameters, its span, its questions and its extras.
 * An unknown or missing league type plays Outlast, as getLeagueType does.
 */
function specOf(settings) {
  return readSpec(isObj(settings) ? settings : {}, true);
}
/**
 * The spec a league plays: its stored settings.game (written while the game-specs flag is on: db/game-specs.js), else
 * specOf(settings). The stored one only while it's a whole spec today's engine plays (a half-written or hand-edited one
 * isn't: the fields are read instead). Handed out as it's stored, and specOf's without copying the points map: read it,
 * never change it (state-logic.js's RosterLogic.setGame writes a league's game). The engine reads every game setting
 * through this.
 */
function gameOf(settings) {
  const st = isObj(settings) ? settings : {};
  return usable(st.game) ? st.game : readSpec(st, false);
}
// Whether a carried spec is one the engine can play from: whole (nothing fullSpec would add), a game plays it, and nothing
// wrong with it as a league's own. Checked once per spec: a league's spec is replaced, never changed in place, whenever
// its game changes (setGame, syncGame), so this costs nothing on the reads in between.
const usableSpecs = new WeakMap();
function usable(g) {
  if (!isObj(g)) return false;
  let ok = usableSpecs.get(g);
  if (ok === undefined) {
    ok = g.spec === SPEC_VERSION && !!playsAs(g) && sameValue(fullSpec(g), g) && !specProblems(g, null, { league: true }).length;
    usableSpecs.set(g, ok);
  }
  return ok;
}
/** specOf's reading; `copy`: the points map copied (specOf), else the stored one (gameOf, read only). */
function readSpec(st, copy) {
  const type = LEAGUE_TYPES.includes(st.leagueTypeId) ? st.leagueTypeId : 'classic-draft';
  const own = st.ownershipMode === 'shared' ? 'shared' : 'exclusive';
  const draft = type === 'classic-draft' || type === 'active-roster';
  const spec = {
    spec: SPEC_VERSION,
    preset: TYPE_PRESETS[type] || null,
    span: spanOf(st),
    pool: { of: 'cast', where: { stillIn: true } },
  };
  let R = 0;
  // A9 part 2: best ball (settings.bestBall: its best activeSlots count, the rest are benchSlots), a lineup's captain
  // (captainTimes), points that multiply by when (pointsTimes), Outlast in reverse (reverseOrder). Each only when it's set, so a
  // league that has none reads as it always did.
  const best = type === 'active-roster' && st.bestBall === true;
  // A10 part 3: a draw (settings.draftDraw) and a draft spread across the cast's groups (draftAcross, as the spec says it); part
  // 3b: an auction (draftAuction) and a draft's prices (draftBudget, as the spec says it). Each only when it's set, so a draft
  // that has none reads as it always did.
  const drafted = (each) => {
    const order = st.draftAuction === true ? 'auction' : st.draftDraw === true ? 'draw' : ORDER_OF[own];
    const get = { by: 'draft', each, order, own };
    if (isObj(st.draftAcross)) get.across = copy ? clone(st.draftAcross) : st.draftAcross;
    if (isObj(st.draftBudget)) get.budget = copy ? clone(st.draftBudget) : st.draftBudget;
    // A10 part 4: keepers from last season's game (draftKeep, as the spec says them).
    if (isObj(st.draftKeep)) get.keep = copy ? clone(st.draftKeep) : st.draftKeep;
    return get;
  };
  if (type === 'classic-draft') {
    R = st.teamSize;
    const score = st.reverseOrder === true ? { by: 'place', reverse: true } : { by: 'place' };
    Object.assign(spec, { get: drafted(st.teamSize), count: { all: true }, score, rank: draftRankOf(st, false, copy) });
  } else if (type === 'active-roster') {
    const start = st.activeSlots || 0;
    R = start + (st.benchSlots || 0);
    const score = { by: 'moments', points: isObj(st.eventPoints) ? (copy ? clone(st.eventPoints) : st.eventPoints) : null };
    if (typeof st.captainTimes === 'number' && Number.isFinite(st.captainTimes) && st.captainTimes > 1) score.captain = { times: st.captainTimes };
    if (Array.isArray(st.pointsTimes) && st.pointsTimes.length) score.times = copy ? clone(st.pointsTimes) : st.pointsTimes;
    // A10 part 1: group slots beside the draft (settings.groupSlots, as the spec says them).
    const get = drafted(R);
    if (isObj(st.groupSlots)) get.groups = copy ? clone(st.groupSlots) : st.groupSlots;
    Object.assign(spec, {
      get,
      count: best ? { best: start } : { start },
      score,
      // A10 part 3c: a stock market ranked by worth (draftRank).
      rank: draftRankOf(st, true, copy),
    });
  } else if (type === 'pickem') {
    // A10 part 2: a pool's lives (poolLives), buyback (poolBuyback, as the spec says it), mulligans (poolMulligans), second pick
    // (poolSecond) and last one standing (poolRank). Each only when it's set, so a pool that has none reads as it always did.
    const score = { by: 'survive', means: st.poolSurvive === 'scores' ? 'scores' : 'staysIn', points: typeof st.pickemCorrectPoints === 'number' ? st.pickemCorrectPoints : 1 };
    if (Number.isInteger(st.poolLives) && st.poolLives >= 1) score.lives = st.poolLives;
    if (isObj(st.poolBuyback)) score.buyback = copy ? clone(st.poolBuyback) : st.poolBuyback;
    if (Number.isInteger(st.poolMulligans) && st.poolMulligans >= 1) score.mulligans = st.poolMulligans;
    // A11 part 2: a pick that never repeats (poolRepeat), its fallback (poolFallback, else the default), and last one standing's
    // end (rankOneLeft, rankAllOut).
    const never = st.poolRepeat === 'never';
    const get = { by: 'pick', each: 1, repeat: never ? 'never' : 'cycle' };
    if (isObj(st.poolSecond)) get.second = copy ? clone(st.poolSecond) : st.poolSecond;
    if (never) get.fallback = st.poolFallback === 'skip' ? 'skip' : NEVER.fallback;
    const rank = { by: st.poolRank === 'standing' ? 'standing' : 'streak' };
    if (rank.by === 'standing') endsOf(st, rank, true);
    Object.assign(spec, {
      get,
      count: { pick: true },
      score,
      rank,
    });
  } else if (type === 'weekly-calls' || type === 'questions') {
    // A game of questions' parlays (A9: settings.parlays, as its spec says them).
    const parlays = type === 'questions' && Array.isArray(st.parlays) && st.parlays.length ? (copy ? clone(st.parlays) : st.parlays) : undefined;
    const score = parlays ? { by: 'answers', parlays } : { by: 'answers' };
    // A11 part 2b: a game of questions' lives (questionsLives, on questionsLivesOn), its race and cuts (questionsRace, questionsCut)
    // and its end (rankOneLeft, rankAllOut); last one standing whenever it knocks players out (lives or cuts: the only way it can
    // rank then). Each only when it's set, so a game of questions that has none reads as it always did.
    const lives = type === 'questions' && Number.isInteger(st.questionsLives) && st.questionsLives >= 1;
    if (lives) {
      score.lives = st.questionsLives;
      if (Array.isArray(st.questionsLivesOn) && st.questionsLivesOn.length) score.livesOn = copy ? clone(st.questionsLivesOn) : st.questionsLivesOn;
    }
    Object.assign(spec, { get: { by: 'none' }, count: null, score, rank: type === 'questions' ? questionsRankOf(st, lives, copy) : { by: 'total' } });
  } else {
    // Points per bingo line (A9: settings.linePoints), 1 when it's left out.
    const points = Number.isInteger(st.linePoints) && st.linePoints >= 1 ? st.linePoints : undefined;
    Object.assign(spec, { get: { by: 'card' }, count: null, score: points === undefined ? { by: 'lines' } : { by: 'lines', points }, rank: { by: 'total' } });
  }
  // The questions (A4): Weekly Calls' is the show's calls; a game of questions keeps its own (settings.questions, as its
  // spec says them); a draft's are its finale predictions while they're on.
  if (type === 'weekly-calls') spec.ask = [clone(CALLS)];
  else if (type === 'questions') spec.ask = Array.isArray(st.questions) ? (copy ? clone(st.questions) : st.questions) : [];
  else if (draft && st.finalePredictionsEnabled === true) {
    spec.ask = finaleQuestions({ top3: st.finaleTop3Points || 0, winner: st.finaleWinnerPoints || 0, from: st.finalePredictionScope === 'ownPicksOnly' ? 'own' : 'any' });
  } else spec.ask = [];
  spec.closes = 'start';

  // Who can join (GhostLogic.joinMode): classic's late-joiner switch off locks it; open only where castaways can be on
  // several teams (else it reads as ask); anything else is the recommendation.
  const sharedJoin = !draft || own === 'shared';
  const join = st.allowLateJoiners === false ? 'locked' : st.joinMode === 'ask' ? 'ask' : st.joinMode === 'open' ? (sharedJoin ? 'open' : 'ask') : null;
  const timer = Number(st.draftTimer);
  spec.extras = {
    // A lineup is short of starters; best ball has none (a loss is replaced right away, as Outlast's).
    waivers: waiversFit(spec) ? waiversOf(st, type === 'active-roster' && !best, R) : null,
    // Side bets only beside a draft, the games that score them (a pool's, Weekly Calls' and Weekly Bingo's never counted:
    // their switch stays as it's stored, and nothing reads it).
    bets: draft && st.bonusEnabled ? { points: clampBet(st.defaultBetPoints) } : null,
    calls: type === 'pickem' && !!st.calls,
    draft: draft ? { at: typeof st.draftScheduledAt === 'string' ? st.draftScheduledAt : null, timer: DRAFT_TIMERS.includes(timer) ? timer : 0, away: st.draftAway === 'queue' ? 'queue' : 'wait' } : null,
    join,
    hideStarters: type === 'active-roster' && !best && st.hideStartersUntilLock === true,
    lockedDown: st.lockedDown === true,
    // A game of questions' late lock (A7): its hours, else none.
    lateLock: type === 'questions' && LATE_HOURS.includes(st.lateLockHours) ? { hours: st.lateLockHours } : null,
  };
  // A10 part 4b: a team two people share (seatPeople), said only where it's on: one a seat is said by leaving it out.
  const people = Number(st.seatPeople);
  if (Number.isInteger(people) && people >= 2 && people <= MAX_SEAT_PEOPLE) spec.extras.seats = { people };
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
  const finale = s.get.by === 'draft' ? finaleOf(s.ask) : null;
  const out = {
    leagueTypeId: type,
    // A phase start (A3): startPhase, with startEpisode null while it waits (spanOf reads both back).
    startEpisode: spanStart(s.span),
    startPhase: spanPhase(s.span) || undefined,
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
      finalePredictionsEnabled: !!finale,
    });
    if (finale) {
      Object.assign(out, { finaleTop3Points: finale.top3, finaleWinnerPoints: finale.winner, finalePredictionScope: finale.from === 'own' ? 'ownPicksOnly' : 'open' });
    }
    if (type === 'classic-draft') out.teamSize = s.get.each;
    else {
      // A lineup's starters, or best ball's best n (A9 part 2), are activeSlots; the rest of the team benchSlots.
      const counts = s.count.start !== undefined ? s.count.start : s.count.best;
      Object.assign(out, {
        activeSlots: counts,
        benchSlots: s.get.each - counts,
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
  // A10 part 2: a pool's lives, buyback, mulligans, second pick and last one standing.
  const pool = type === 'pickem';
  const draft = s.get.by === 'draft';
  out.poolLives = pool && s.score.lives !== undefined ? s.score.lives : undefined;
  out.poolBuyback = pool && isObj(s.score.buyback) ? clone(s.score.buyback) : undefined;
  out.poolMulligans = pool && s.score.mulligans !== undefined ? s.score.mulligans : undefined;
  out.poolSecond = pool && isObj(s.get.second) ? clone(s.get.second) : undefined;
  out.poolRank = pool && s.rank.by === 'standing' ? 'standing' : undefined;
  // A11 part 2: a pick that never repeats and its fallback; last one standing's end (a pool's or a draft's that cuts).
  out.poolRepeat = pool && s.get.repeat === 'never' ? 'never' : undefined;
  out.poolFallback = pool && s.get.repeat === 'never' ? s.get.fallback : undefined;
  out.rankOneLeft = s.rank.by === 'standing' && s.rank.oneLeft !== undefined ? s.rank.oneLeft : undefined;
  // A11 part 2b: a game of questions with lives, as a pool with them.
  const asks = type === 'questions';
  const askLives = asks && s.score.lives !== undefined;
  out.rankAllOut = (pool || askLives) && s.rank.by === 'standing' && s.rank.allOut !== undefined ? s.rank.allOut : undefined;
  // A11 part 2b: a game of questions' lives, race and cuts (last one standing is theirs: the only way it ranks then).
  out.questionsLives = askLives ? s.score.lives : undefined;
  out.questionsLivesOn = askLives && Array.isArray(s.score.livesOn) ? clone(s.score.livesOn) : undefined;
  out.questionsRace = asks && isObj(s.rank.race) ? clone(s.rank.race) : undefined;
  out.questionsCut = asks && Array.isArray(s.rank.cut) ? clone(s.rank.cut) : undefined;
  // A10 part 3c: a lineup's or best ball's stock market ranked by worth; A11 part 1: a draft's last one standing, its race and its
  // cuts.
  out.draftRank = type === 'active-roster' && s.rank.by === 'worth' ? 'worth' : draft && s.rank.by === 'standing' ? 'standing' : undefined;
  out.draftRace = draft && isObj(s.rank.race) ? clone(s.rank.race) : undefined;
  out.draftCut = draft && Array.isArray(s.rank.cut) ? clone(s.rank.cut) : undefined;
  if (type === 'questions') out.questions = clone(s.ask);
  out.lateLockHours = type === 'questions' && e.lateLock ? e.lateLock.hours : undefined;
  // A9: a game of questions' parlays; points per bingo line.
  out.parlays = type === 'questions' && Array.isArray(s.score.parlays) ? clone(s.score.parlays) : undefined;
  out.linePoints = type === 'weekly-bingo' && s.score.points !== undefined ? s.score.points : undefined;
  // A9 part 2: best ball, a lineup's captain, points that multiply by when; Outlast in reverse.
  const lineup = type === 'active-roster';
  out.bestBall = lineup && s.count.best !== undefined ? true : undefined;
  out.captainTimes = lineup && isObj(s.score.captain) ? s.score.captain.times : undefined;
  out.pointsTimes = lineup && Array.isArray(s.score.times) ? clone(s.score.times) : undefined;
  out.reverseOrder = type === 'classic-draft' && s.score.reverse === true ? true : undefined;
  // A10 part 1: a lineup's or best ball's group slots.
  out.groupSlots = lineup && isObj(s.get.groups) ? clone(s.get.groups) : undefined;
  // A10 part 3: a draw, and a draft spread across the cast's groups.
  out.draftDraw = draft && s.get.order === 'draw' ? true : undefined;
  out.draftAcross = draft && isObj(s.get.across) ? clone(s.get.across) : undefined;
  // A10 part 3b: an auction, and a draft's prices.
  out.draftAuction = draft && s.get.order === 'auction' ? true : undefined;
  out.draftBudget = draft && isObj(s.get.budget) ? clone(s.get.budget) : undefined;
  // A10 part 4: keepers from last season's game.
  out.draftKeep = draft && isObj(s.get.keep) ? clone(s.get.keep) : undefined;
  // A10 part 4b: how many accounts can hold one seat.
  out.seatPeople = seatPeople(s) > 1 ? seatPeople(s) : undefined;
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
  // A league carrying its spec (the game-specs flag) carries this one, so gameOf reads the same either way.
  if ('game' in out) out.game = clone(want);
  return out;
}

// The spec's parts and the settings fields each writes (OWNED is all of them).
const WAIVER_FIELDS = ['replaceRule', 'replenishAt', 'waiverWindows', 'waiverFeel', 'autoFill', 'replenishOrderBy', 'waiverProcessHours', 'freeAgencyEnabled', 'replenishEnabled', 'tradeEnabled', 'swapEvery'];
const PARTS = [
  { fields: ['leagueTypeId'], read: (s) => typeOf(s) },
  { fields: ['startEpisode', 'startPhase', 'endEpisode'], read: (s) => s.span },
  { fields: ['ownershipMode', 'teamSize', 'activeSlots', 'benchSlots', 'bestBall', 'groupSlots', 'poolSecond', 'poolRepeat', 'poolFallback', 'draftDraw', 'draftAcross', 'draftAuction', 'draftBudget', 'draftKeep'], read: (s) => [s.get, s.count] },
  { fields: ['eventPoints', 'pickemCorrectPoints', 'poolSurvive', 'parlays', 'linePoints', 'captainTimes', 'pointsTimes', 'reverseOrder', 'poolLives', 'poolBuyback', 'poolMulligans', 'questionsLives', 'questionsLivesOn'], read: (s) => s.score },
  { fields: ['poolRank', 'draftRank', 'draftRace', 'draftCut', 'rankOneLeft', 'rankAllOut', 'questionsRace', 'questionsCut'], read: (s) => s.rank },
  { fields: ['allowLateJoiners', 'joinMode'], read: (s) => s.extras.join },
  { fields: ['lockedDown'], read: (s) => s.extras.lockedDown },
  { fields: ['seatPeople'], read: (s) => seatPeople(s) },
  { fields: ['bonusEnabled', 'defaultBetPoints'], read: (s) => s.extras.bets },
  { fields: ['draftScheduledAt', 'draftTimer', 'draftAway'], read: (s) => s.extras.draft },
  // The questions: a draft's finale predictions in their fields, a game of questions' own in settings.questions (Weekly
  // Calls' is its type's).
  { fields: ['finalePredictionsEnabled', 'finaleTop3Points', 'finaleWinnerPoints', 'finalePredictionScope'], read: (s) => (s.get.by === 'draft' ? finaleOf(s.ask) : null) },
  { fields: ['questions'], read: (s) => (typeOf(s) === 'questions' ? s.ask : null) },
  { fields: ['lateLockHours'], read: (s) => s.extras.lateLock },
  { fields: ['hideStartersUntilLock'], read: (s) => s.extras.hideStarters },
  { fields: ['calls'], read: (s) => s.extras.calls },
  { fields: WAIVER_FIELDS, read: (s) => s.extras.waivers, written: (out) => delete out.waiverFit },
];

/** Every settings field a spec can write. */
const OWNED = PARTS.flatMap((p) => p.fields);

module.exports = {
  OUTSIDE, OWNED, LEAGUE_TYPES, specOf, gameOf, settingsOf, ownedFields, withSpec,
  spanOf, waiversOf, legacyWaivers, normalizeWindows, swapEveryOf, clampBet,
};
