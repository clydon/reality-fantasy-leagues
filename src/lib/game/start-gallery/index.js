// Start a game, the gallery (docs/PLAN-start-a-game-redo.md Round 2; the user's direction of 2026-11-17, drawn in
// docs/design-round/wizard-r1b-gallery.md versions 3 to 7): every base game a person would name, by category, then each change
// as its own controls. This is the structure as data: the categories and bases (bases.json, each checked by the engine on the
// season's page), the rows of a base's screen, each row's changes, and each change's controls, every control naming the engine
// values it sets (the schema's VOCAB) so the coverage table (scripts/dev-test/gallery-coverage.js) can prove every value has a
// home and plays from it. Pure, like game-spec: the sheet bundles it with the engine, and node scripts require it as it is.
// CommonJS on purpose (see ../game-spec/schema.js).
//
//   CATS, BASES, SPORT     the gallery: nine categories a person would sort games into, after the community's games
//   ROWS, CHANGES          a base's screen: its rows, and each row's changes (the drill-down's squares), with controls
//   pageFacts(page)        what the changes need to know of the season's page (roll.js pageOf)
//   baseSpec(base, span)   a base's game on a span, its preset's parts expanded so a change adds to them
//   check(spec, pg)        the engine's verdict: { ok, problems, waits, type, short, sentence }
//   galleryFor(page, span) every base on this page: plays, why not, coming, needs
//   changeStates(spec, row, pg)  a row's changes: on, fits (or why not), its controls' values
//   applyChange / setControl / dropChange   a change made, set or taken off, as a new spec (never in place)
//   rowLine(row, spec, pg) what a row says on the base's screen ("Head to head · the top 2 meet in a final")
//   homesOf()              every VOCAB value's home: [{ value, row, change, control }] (the coverage table's)
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ../game-spec/schema.js */
const S = { ...require('../game-spec/schema.js'), ...require('../game-spec/answers.js') };
const { describeSpec } = require('../game-spec/describe.js');
const R = require('../game-spec/roll.js');
/** A waiver feel's name, as Manage this game says it (settings Round 0's names; backstage-games.ts FEEL_NAMES). */
const FEEL_NAMES = { casual: 'Relaxed', balanced: 'Standard', competitive: 'Strict' };
const DATA = require('./bases.json');
/* eslint-enable @typescript-eslint/no-require-imports */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, min = -Infinity) => Number.isInteger(v) && v >= min;
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const asks = (s) => (isObj(s) && Array.isArray(s.ask) ? s.ask : []);
const eachAsks = (s) => asks(s).filter((q) => q.asked === 'each');
const T = Object.fromEntries(R.PIECES.TWISTS.map((t) => [t.id, t]));
const W = Object.fromEntries(R.PIECES.WINS.map((w) => [w.id, w]));

// ---------- what a game is ----------

/** The kind of game a spec is, for which rows its screen has: a draft, a pick, questions, a card, squares, or stages. */
// The catalog's own kinds (kindOf's answers), named so they're never read as league types (tests/pieces.test.js).
const KIND = { questions: 'questions', stages: 'stages' };
function kindOf(s) {
  if (!isObj(s)) return 'questions';
  if (Array.isArray(s.stages)) return 'stages';
  const get = isObj(s.get) ? s.get : isObj(s.preset && S.PRESETS[s.preset]) ? S.PRESETS[s.preset].get : {};
  if (get.by === 'draft') return 'draft';
  if (get.by === 'pick') return 'pick';
  if (get.by === 'card') return 'card';
  if (get.by === 'squares') return 'squares';
  return 'questions';
}
const isDraft = (s) => kindOf(s) === 'draft';
const isPick = (s) => kindOf(s) === 'pick';
const isQuestions = (s) => kindOf(s) === KIND.questions && isObj(s.score) && s.score.by === 'answers';
const isPool = (s) => isPick(s) && isObj(s.score) && s.score.by === 'survive';
const byMoments = (s) => isObj(s.score) && s.score.by === 'moments';
const byPlace = (s) => isObj(s.score) && s.score.by === 'place';
const rankBy = (s) => (isObj(s.rank) ? s.rank.by : 'total');

/** A spec with its preset's parts expanded (get, count, score, rank, extras), its own parts merged over them: fullSpec replaces a
 *  part whole, so a change to one field of a preset's part has to start from the whole part (roll.js presetParts' way). */
function expand(spec) {
  const s = clone(spec) || {};
  const p = s.preset && S.PRESETS[s.preset];
  if (!p) return s;
  for (const k of ['get', 'count', 'score', 'rank']) {
    const mine = s[k];
    if (mine === undefined) s[k] = clone(p[k]);
    else if (isObj(mine) && isObj(p[k]) && k !== 'count') s[k] = { ...clone(p[k]), ...mine };
  }
  // Not the extras: fullSpec fills each of them from the preset when it's left out (a market's own waivers, a draft's side bets),
  // and one written out here would be read as chosen.
  return s;
}

// ---------- the page ----------

/** What the changes need to know of the season's page: roll.js's facts (the moments research answers, the phases still to come,
 *  the couch, results, votes, groups, trivia), the page's ctx for our check, and the show's words. */
function pageFacts(page, extra = {}) {
  const pg = R.pageOf(page);
  const ctx = pg.ctx || {};
  return { ...pg, show: ctx.show || extra.show || 'the show', phases: (Array.isArray(ctx.phases) ? ctx.phases : []).filter(isObj), properties: Array.isArray(ctx.properties) ? ctx.properties : [], ...extra };
}

/** The engine's verdict on a spec: our check (specProblems with the page's ctx), what it waits for, its type in the scoring sequence,
 *  and its words (describeSpec: the short form for a line, the sentence for the rules). */
function check(spec, pg) {
  const ctx = (pg && pg.ctx) || {};
  let problems = [];
  try {
    problems = S.specProblems(spec, ctx).map((p) => p.problem || String(p));
  } catch (e) {
    problems = [String((e && e.message) || e)];
  }
  const waits = problems.length ? [] : S.specWaitsFor(spec).map((w) => w.problem || w.step || String(w));
  const type = !problems.length && !waits.length ? S.typeOf(spec) : null;
  let words = null;
  try {
    words = describeSpec(spec, { ...ctx, show: ctx.show || (pg && pg.show) || 'this show' });
  } catch {
    words = null;
  }
  return { ok: !!type, problems, waits, type, short: words ? words.short : null, sentence: words ? words.sentence : null, rules: words ? words.rules || null : null };
}

// ---------- the gallery ----------

/** The categories a person would sort games into (the user, 2026-11-17), after the community's and your saved games: a collapsed
 *  section of its own, made-for-this-season first (the user, 2026-11-17, Round 2), named for both (the user, 2026-11-18). */
const CATS = [{ id: 'community', short: 'Community & saved', name: 'Community and saved games', says: 'Games you saved, and ready-made ones' }, ...DATA.cats];

/** A base: its id, category (and a second where a person would look there too), name, its square's line, its screen's two sentences,
 *  what it asks of everyone, its length if started now, where it comes from, and its spec (null: coming, or it needs something). */
const BASES = DATA.bases;
const SPORT = DATA.sport;
const baseById = (id) => BASES.find((b) => b.id === id) || SPORT.find((b) => b.id === id) || null;

/** A spec's lists of moments held to the ones this season's research answers (a card's lines, only these): the tracker's games name
 *  Survivor's moments, and a season's rulebook may not have all of them. The engine refuses a moment the season doesn't have. */
function fitMoments(s, pg) {
  if (!pg || !Array.isArray(pg.moments) || !pg.moments.length) return s;
  const have = new Set([...pg.moments.map((m) => m.id), ...((pg.ctx && pg.ctx.moments) || []).map((m) => m.id)]);
  if (isObj(s.card) && Array.isArray(s.card.of)) s.card.of = s.card.of.filter((id) => have.has(id));
  if (isObj(s.score) && Array.isArray(s.score.only)) s.score.only = s.score.only.filter((id) => have.has(id));
  if (Array.isArray(s.stages)) s.stages.forEach((x) => isObj(x.game) && fitMoments(x.game, pg));
  // A question about a moment this show doesn't have (Survivor's immunity on The Traitors) leaves, and a ticket's legs with it; a
  // ticket left with fewer than two legs goes too (B1: a base written for Survivor carries to every show by its own moments).
  if (Array.isArray(s.ask) && s.ask.length) {
    const kept = s.ask.filter((q) => !(isObj(q) && isObj(q.settle) && typeof q.settle.moment === 'string' && !have.has(q.settle.moment)));
    if (kept.length && kept.length < s.ask.length) {
      const ids = new Set(kept.map((q) => q.id));
      s.ask = kept
        .map((q) => (isObj(q.settle) && Array.isArray(q.settle.of) ? { ...q, settle: { ...q.settle, of: q.settle.of.filter((id) => ids.has(id)) } } : q))
        .filter((q) => !(isObj(q.settle) && Array.isArray(q.settle.of) && q.settle.of.length < 2));
    }
  }
  return s;
}
/** The moment a base that leaves it open starts on (the starter picks it first): the one asked for, else the season's first. */
function openMoment(s, moment) {
  if (!moment) return s;
  if (isObj(s.score) && Array.isArray(s.score.only) && s.score.only.length === 1) {
    s.score.only = [moment];
    if (isObj(s.score.points) && Object.keys(s.score.points).length <= 1) s.score.points = { [moment]: 1 };
  }
  for (const q of asks(s)) if (q.settle && q.settle.by === 'moment' && q.settle.take === 'most') q.settle.moment = moment;
  return s;
}

/** A draft where nobody shares a castaway, fitted to who's left: each of you picks as many as the castaways still in allow (two at
 *  least), else it's shared (roll.js's Outlast does the same: exclusiveFits). Said on the base's screen by Your team's line, never
 *  switched after the starter has chosen. */
function fitCouch(s, pg) {
  if (Array.isArray(s.stages)) {
    let fitted = null;
    s.stages.forEach((x) => {
      if (isObj(x.game)) fitted = fitCouch(x.game, pg) || fitted;
    });
    return fitted;
  }
  const g = isObj(s.get) ? s.get : null;
  if (!g || g.by !== 'draft' || g.own === 'shared' || !pg || !isInt(pg.couch, 1) || !isInt(pg.pool, 1)) return null;
  const each = isInt(g.each, 1) ? g.each : 3;
  if (S.covers({ pool: pg.pool, people: pg.couch, each })) return null;
  const most = Math.floor(pg.pool / pg.couch);
  if (most >= 2 && g.order !== 'auction') s.get = { ...g, each: most };
  else s.get = { ...g, own: 'shared', order: g.order === 'auction' ? 'blind' : 'blind', ...(g.order === 'auction' ? { budget: undefined } : {}) };
  if (isObj(s.count)) {
    const n = s.get.each;
    if (isInt(s.count.start, 1) && s.count.start >= n) s.count = { start: Math.max(1, n - 1) };
    if (isInt(s.count.best, 1) && s.count.best > n) s.count = { best: n };
  }
  if (s.get.budget === undefined) delete s.get.budget;
  return { each, to: s.get.own === 'shared' ? 'shared' : s.get.each, pool: pg.pool, people: pg.couch };
}

/** A base's game on a span: its spec expanded, the span set unless it's a game in stages (each stage has its own); its moments held
 *  to the season's; a base that leaves its moment open starts on `moment` (or the season's first); a draft fitted to who's left. */
function baseSpec(base, span, pg, moment) {
  if (!base || !base.spec) return null;
  let s = expand(base.spec);
  if (base.moment) s = openMoment(s, moment || (pg && pg.moments[0] && pg.moments[0].id));
  if (pg) fitMoments(s, pg);
  // How a draft was fitted to who's left: the screen's note (Your team's line), never part of the game.
  const fitted = pg ? fitCouch(s, pg) : null;
  if (fitted) Object.defineProperty(s, '__fitted', { value: fitted, enumerable: false });
  if (Array.isArray(s.stages)) {
    // A game in stages starts its first stage from the span's start.
    const first = s.stages[0];
    if (first && isObj(first.game) && span && isInt(span.from, 1)) first.game.span = { ...(first.game.span || {}), from: span.from };
    s.stages = s.stages.map((st) => ({ ...st, game: expand(st.game) }));
    return s;
  }
  if (span) s.span = { from: span.from, to: span.to === undefined ? null : span.to };
  return s;
}

/** Every base on this page, each as the gallery shows it: plays (its square), why not (left off the page), coming (dashed),
 *  needs (dashed, with what it needs). `span` is the stretch a season game starts on (the rest of the season by default). */
function galleryFor(page, span) {
  const pg = isObj(page) && page.ctx && page.from ? page : pageFacts(page);
  const season = span || { from: pg.from, to: null };
  const next = { from: pg.from, to: pg.from };
  return BASES.map((b) => {
    if (b.coming) return { id: b.id, state: 'coming', why: `Coming: ${b.coming}` };
    if (!b.spec) return { id: b.id, state: 'needs', why: b.needs ? `Needs ${b.needs}` : 'Needs its own setup' };
    const spec = baseSpec(b, b.len === '1 episode' ? next : season, pg);
    const v = check(spec, pg);
    return { id: b.id, state: v.ok ? 'plays' : 'off', why: v.ok ? null : v.problems[0] || v.waits[0] || "Our check doesn't place it", short: v.short, fitted: spec.__fitted || null };
  });
}

// ---------- a base's screen: rows ----------

/** The rows of a base's screen, top to bottom. `headline` rows are always shown; the rest sit under More changes. The play row's
 *  name is the game's own: Your team, Your pick, The questions, Your card. */
const ROWS = [
  { id: 'who', name: "Who's playing", headline: true },
  { id: 'compete', name: 'How you win', headline: true },
  { id: 'bets', name: 'Bets', headline: true },
  { id: 'play', name: 'Your team', headline: false },
  { id: 'scoring', name: 'Scoring', headline: false },
  { id: 'twists', name: 'Twists', headline: false },
  { id: 'season', name: 'Over the season', headline: false },
  { id: 'details', name: 'The details', headline: false },
];
/** The play row's name for this game, and whether it leads (a game of questions leads with its questions). */
function playRow(spec) {
  const k = kindOf(spec);
  if (k === 'draft') return { name: 'Your team', headline: false };
  if (k === 'pick') return { name: 'Your pick', headline: false };
  if (k === 'card') return { name: 'Your card', headline: true };
  if (k === 'squares') return { name: 'Your squares', headline: true };
  if (k === KIND.stages) return { name: 'The stages', headline: true };
  return { name: 'The questions', headline: true };
}

// ---------- controls: small builders ----------

const pathGet = (o, path) => path.split('.').reduce((a, k) => (isObj(a) ? a[k] : undefined), o);
function pathSet(o, path, v) {
  const keys = path.split('.');
  let a = o;
  for (const k of keys.slice(0, -1)) {
    if (!isObj(a[k])) a[k] = {};
    a = a[k];
  }
  if (v === undefined) delete a[keys[keys.length - 1]];
  else a[keys[keys.length - 1]] = v;
  return o;
}
/** A control on one field of the spec: read it (its default when unset), write it (a copy). */
const field = (path, def) => ({ read: (s) => (pathGet(s, path) === undefined ? def : pathGet(s, path)), write: (s, v) => pathSet(clone(s), path, v) });
/** A control on every question asked each episode (or the ones `which` picks): its value is the first one's. */
const onAsks = (key, def, which = (q) => q.asked === 'each' || !q.asked) => ({
  read: (s) => {
    const q = asks(s).find(which);
    return q && q[key] !== undefined ? q[key] : def;
  },
  write: (s, v) => ({ ...clone(s), ask: asks(s).map((q) => (which(q) ? (v === undefined ? Object.fromEntries(Object.entries(q).filter(([k]) => k !== key)) : { ...q, [key]: v }) : q)) }),
});
const segment = (id, label, vocab, options, def, rw, more) => ({ id, label, kind: 'segment', vocab, options, def, more: !!more, ...rw });
const chips = (id, label, options, other, def, rw, more) => ({ id, label, kind: 'chips', options, other, def, more: !!more, ...rw });
const stepper = (id, label, range, def, rw, more) => ({ id, label, kind: 'stepper', range, def, more: !!more, ...rw });
const toggle = (id, label, def, rw, more) => ({ id, label, kind: 'switch', def, more: !!more, ...rw });
const text = (id, label, max, def, rw, more) => ({ id, label, kind: 'text', max, def, more: !!more, ...rw });

/** A control on the draft room, which the engine reads whole ({ at, timer, away, opens? }): the room's defaults filled in. */
const room = (key, def) => ({
  read: (s) => (isObj(s.extras) && isObj(s.extras.draft) && s.extras.draft[key] !== undefined ? s.extras.draft[key] : def),
  write: (s, v) => ({ ...s, extras: { ...(s.extras || {}), draft: { ...S.DRAFT_ROOM, ...(isObj(s.extras && s.extras.draft) ? s.extras.draft : {}), [key]: v } } }),
});

// ---------- the changes ----------

const SEASON_SPAN = (s) => (isObj(s.span) ? s.span : null);
const toEnd = (s) => isObj(s.span) && s.span.to === null;
const lengthOf = (s, pg) => {
  const sp = SEASON_SPAN(s) || {};
  if (!isInt(sp.from, 1)) return null;
  if (isInt(sp.to, 1)) return sp.to - sp.from + 1;
  return sp.to === null && pg && pg.left ? pg.left : null;
};
const couchOf = (pg) => (pg && isInt(pg.couch, 1) ? pg.couch : null);
const needCouch = (n, pg, what) => (couchOf(pg) && couchOf(pg) < n ? `${what} needs ${n} or more of you` : null);
/** A roll twist's fits, as a why-not: null when it fits, else the words. */
const fitsOr = (ok, why) => (ok ? null : why);
const dropRank = (rank, ...keys) => Object.fromEntries(Object.entries(rank || {}).filter(([k]) => !keys.includes(k)));
const plainRank = (s) => dropRank(s.rank, 'by', 'race', 'cut', 'playoffs', 'odd', 'quiet', 'ties', 'oneLeft', 'allOut');

/**
 * Every change. Each: its id, row, name, line (its effect, in plain words), an icon word, whether it fits this game (null, or why
 * not), whether this game has it (on), how it's made (apply, with its controls on their defaults), how it's taken off (off), its
 * controls, the VOCAB values it sets by itself (homes; a control's options name the rest), and `coming` for one the engine doesn't
 * make yet. Controls run in the order people change them; `more` ones sit under More options.
 */
const CHANGES = [
  // ---- Who's playing ----
  {
    id: 'couch', row: 'who', name: 'The couch', line: 'Everyone for themselves', icon: 'couch',
    on: (s) => !(isObj(s.rank) && s.rank.teams) && !(isObj(s.extras) && isObj(s.extras.seats)),
    apply: (s) => ({ ...s, rank: dropRank(s.rank, 'teams'), extras: { ...(s.extras || {}), seats: null } }),
  },
  {
    id: 'teams', row: 'who', name: 'In teams', line: 'The couch splits into teams that score together', icon: 'teams',
    fits: (s, pg) => needCouch(4, pg, 'Playing in teams') || fitsOr(T.teams.fits({ ...s, rank: dropRank(s.rank, 'teams') }, { ...pg, couch: null }), "Teams don't go with this game yet"),
    on: (s) => isObj(s.rank) && isObj(s.rank.teams),
    apply: (s) => ({ ...s, rank: { ...dropRank(s.rank, 'playoffs'), teams: { of: 2 } } }),
    off: (s) => ({ ...s, rank: dropRank(s.rank, 'teams') }),
    controls: [
      stepper('of', 'How many teams', [2, S.MAX_PLAYER_TEAMS], 2, field('rank.teams.of', 2)),
      segment('made', 'Teams are', 'rank.teams.made', [['draw', 'Drawn at the start', 'Seeded at random, said to everyone'], ['choose', 'Chosen', 'Each of you picks a team before it starts']], S.TEAMS.made, field('rank.teams.made', S.TEAMS.made)),
      segment('score', "A team's points", 'rank.teams.score', [['mean', 'Their average', 'Fair whatever the team sizes'], ['sum', 'Added up', 'A bigger team scores more']], S.TEAMS.score, field('rank.teams.score', S.TEAMS.score)),
      segment('unplaced', 'Someone on no team', 'rank.teams.unplaced', [['smallest', 'Onto the smallest team'], ['none', 'Plays for nobody']], S.TEAMS.unplaced, field('rank.teams.unplaced', S.TEAMS.unplaced), true),
      text('names', "Teams' names", S.MAX_TEAM_NAME, null, field('rank.teams.names', null), true),
    ],
  },
  {
    id: 'share', row: 'who', name: 'Share a team', line: 'Two to four of you hold one team', icon: 'pair',
    fits: (s) => fitsOr(isDraft(s) || isQuestions(s) || isPick(s), 'A shared team needs something to share'),
    on: (s) => isObj(s.extras) && isObj(s.extras.seats),
    apply: (s) => ({ ...s, extras: { ...(s.extras || {}), seats: { people: S.SEATS.people } } }),
    off: (s) => ({ ...s, extras: { ...(s.extras || {}), seats: null } }),
    controls: [stepper('people', 'People on a team', [2, S.MAX_SEAT_PEOPLE], S.SEATS.people, field('extras.seats.people', S.SEATS.people))],
  },
  // Just me and Me and the bot are who the game is for, not the spec: Start tells nobody (Just me), or seats the bot (E1).
  { id: 'solo', row: 'who', name: 'Just me', line: 'Only you; see how you do', icon: 'person', start: 'solo', on: () => false },
  // E1a: computer players beside you (how many, how sharp: the sheet's own, outside the spec; Start sends them as `bots`, `level`).
  { id: 'bot', row: 'who', name: 'Computer players', line: 'Seats our bot plays, beside you', icon: 'bot', start: 'bot', fits: (s) => botsFit(s), on: () => false },
  {
    id: 'handicap', row: 'who', name: 'Head start for newcomers', line: 'Points each episode for whoever is new', icon: 'plus',
    fits: (s, pg) => needCouch(2, pg, 'A head start'),
    on: (s) => isObj(s.rank) && isObj(s.rank.handicap),
    apply: (s) => ({ ...s, rank: { ...(s.rank || { by: 'total' }), handicap: { points: 2, who: S.HANDICAP.who, newTo: S.HANDICAP.newTo } } }),
    off: (s) => ({ ...s, rank: dropRank(s.rank, 'handicap') }),
    homes: { 'rank.handicap.who': ['new'] },
    controls: [
      chips('points', 'Points an episode', [[1, '1'], [2, '2'], [3, '3'], [5, '5']], { min: 1, max: S.MAX_HANDICAP }, 2, field('rank.handicap.points', 2)),
      segment('newTo', 'New to', 'rank.handicap.newTo', [['couch', 'This couch', 'No game here on an earlier season'], ['show', 'The show', 'No game on this show here before']], S.HANDICAP.newTo, field('rank.handicap.newTo', S.HANDICAP.newTo)),
    ],
  },

  // ---- How you win ----
  {
    id: 'total', row: 'compete', name: 'Most points', line: 'The most points at the end wins', icon: 'trophy',
    homes: { 'rank.by': ['total'] },
    fits: (s) => fitsOr(!isPool(s) || !(isObj(s.score) && s.score.lives), 'A game with lives ends with the last one standing'),
    on: (s) => rankBy(s) === 'total' && !(isObj(s.rank) && (s.rank.race || s.rank.cut)) && !(isPool(s) && false),
    apply: (s) => ({ ...s, rank: { ...plainRank(s), by: 'total' }, score: isObj(s.score) ? Object.fromEntries(Object.entries(s.score).filter(([k]) => !['lives', 'mulligans', 'buyback', 'saves'].includes(k))) : s.score }),
  },
  {
    id: 'matchups', row: 'compete', name: 'Head to head', line: 'Your points against one of the couch each week', icon: 'versus',
    homes: { 'rank.by': ['matchups'] },
    fits: (s, pg) => needCouch(2, pg, 'Head to head') || fitsOr(isDraft(s) || isPick(s) || isQuestions(s), 'Head to head needs a score each week'),
    on: (s) => rankBy(s) === 'matchups',
    apply: (s, pg) => {
      // A final for a game to the season's end (the head-to-head league's), or one four episodes long or more.
      const len = lengthOf(s, pg);
      const long = toEnd(s) || (len && len >= 4);
      return { ...s, rank: { ...plainRank(s), by: 'matchups', ...(long && (!couchOf(pg) || couchOf(pg) >= 4) ? { playoffs: { teams: 2 } } : {}) } };
    },
    controls: [
      chips('playoffs', 'A final at the end', [[0, 'None'], [2, 'Top 2'], [4, 'Top 4']], { min: 2, max: S.MAX_PLAYOFF_TEAMS }, 0, {
        read: (s) => (isObj(s.rank) && isObj(s.rank.playoffs) ? s.rank.playoffs.teams : 0),
        write: (s, v) => ({ ...s, rank: v ? { ...s.rank, playoffs: { teams: v } } : dropRank(s.rank, 'playoffs') }),
      }),
      segment('odd', 'An odd number of you', 'rank.odd', [['median', 'Play the middle score', "Whoever's left over plays everyone's middle score"], ['bye', 'A bye', 'They sit the week out']], S.MATCHUPS.odd, field('rank.odd', S.MATCHUPS.odd), true),
      segment('quiet', 'A night nobody scores', 'rank.quiet', [['skip', 'Counts for nobody'], ['tie', 'Everyone ties']], S.MATCHUPS.quiet, field('rank.quiet', S.MATCHUPS.quiet), true),
    ],
  },
  {
    id: 'weeks', row: 'compete', name: 'Most weeks won', line: "Each week's top score wins the week", icon: 'calendar',
    homes: { 'rank.by': ['weeks'] },
    fits: (s, pg) => needCouch(2, pg, 'Weeks won') || fitsOr(W.weeks.fits({ id: isDraft(s) ? 'lineup' : isPick(s) ? 'picks' : 'questions' }), "Weeks won don't go with this game"),
    on: (s) => rankBy(s) === 'weeks',
    apply: (s) => ({ ...s, rank: { ...plainRank(s), by: 'weeks' } }),
    controls: [segment('ties', 'A tied week', 'rank.ties', [['all', 'Each of them wins it'], ['split', 'They share it'], ['none', 'Nobody wins it']], S.WEEKS.ties, field('rank.ties', S.WEEKS.ties))],
  },
  {
    id: 'knockouts', row: 'compete', name: 'Knockouts', line: 'The lowest score is out', icon: 'cut',
    homes: { 'rank.by': ['standing'] },
    fits: (s, pg) => needCouch(3, pg, 'Knockouts') || fitsOr(isDraft(s) || isQuestions(s), 'Knockouts need a score that can be lowest'),
    on: (s) => isObj(s.rank) && Array.isArray(s.rank.cut),
    apply: (s, pg) => {
      const len = lengthOf(s, pg) || 8;
      const every = Math.max(1, Math.min(3, Math.floor(len / Math.max(2, (couchOf(pg) || 4) - 1))));
      return { ...s, rank: { ...plainRank(s), by: 'standing', cut: [{ at: { every }, out: 1 }] } };
    },
    off: (s) => ({ ...s, rank: { ...plainRank(s), by: 'total' } }),
    controls: [
      segment('at', 'When', 'rank.cut.at', [['every', 'Every few episodes'], ['episode', 'After an episode'], ['phase', 'When a stage starts']], 'every', {
        read: (s) => {
          const c = isObj(s.rank) && Array.isArray(s.rank.cut) && s.rank.cut[0];
          return c && isObj(c.at) ? Object.keys(c.at)[0] : 'every';
        },
        write: (s, v, pg) => {
          const cut = clone((s.rank && s.rank.cut) || [{ out: 1 }]);
          const later = pg && pg.later && pg.later[0];
          cut[0].at = v === 'phase' && later ? { phase: later.id } : v === 'episode' ? { episode: (SEASON_SPAN(s) && SEASON_SPAN(s).from) || 1 } : { every: 1 };
          return { ...s, rank: { ...s.rank, cut } };
        },
      }),
      stepper('every', 'Every how many episodes', [1, S.MAX_WINDOW], 1, {
        read: (s) => (s.rank && s.rank.cut && s.rank.cut[0] && s.rank.cut[0].at && s.rank.cut[0].at.every) || 1,
        write: (s, v) => ({ ...s, rank: { ...s.rank, cut: s.rank.cut.map((c, i) => (i === 0 ? { ...c, at: { every: v } } : c)) } }),
        when: (s) => !!(s.rank && s.rank.cut && s.rank.cut[0] && s.rank.cut[0].at && s.rank.cut[0].at.every),
      }),
      chips('out', 'How many go', [[1, '1'], [2, '2'], ['half', 'Half']], { min: 1, max: S.MAX_CUT_OUT }, 1, {
        read: (s) => (s.rank && s.rank.cut && s.rank.cut[0] ? s.rank.cut[0].out : 1),
        write: (s, v) => ({ ...s, rank: { ...s.rank, cut: s.rank.cut.map((c, i) => (i === 0 ? { ...c, out: v } : c)) } }),
      }),
      segment('tie', 'A tie at the line', 'rank.cut.tie', [['keep', 'Nobody tied goes'], ['all', 'All of them go']], S.CUT.tie, {
        read: (s) => (s.rank && s.rank.cut && s.rank.cut[0] && s.rank.cut[0].tie) || S.CUT.tie,
        write: (s, v) => ({ ...s, rank: { ...s.rank, cut: s.rank.cut.map((c) => ({ ...c, tie: v })) } }),
      }, true),
      segment('quiet', 'A night nobody goes home', 'rank.cut.quiet', [['cut', 'Cut anyway'], ['skip', 'Skipped']], S.CUT.quiet, {
        read: (s) => (s.rank && s.rank.cut && s.rank.cut[0] && s.rank.cut[0].quiet) || S.CUT.quiet,
        write: (s, v) => ({ ...s, rank: { ...s.rank, cut: s.rank.cut.map((c) => ({ ...c, quiet: v })) } }),
      }, true),
      segment('oneLeft', 'One of you left', 'rank.oneLeft', [['ends', 'It ends there'], ['plays', 'It plays on']], S.DRAFT_END.oneLeft, field('rank.oneLeft', S.DRAFT_END.oneLeft), true),
    ],
  },
  {
    id: 'race', row: 'compete', name: 'Race to a target', line: 'The first to the target wins', icon: 'flag',
    fits: (s) => fitsOr(isDraft(s) || isQuestions(s), 'A race needs points to add up'),
    on: (s) => isObj(s.rank) && isObj(s.rank.race),
    apply: (s, pg) => ({ ...s, rank: { ...plainRank(s), by: 'total', race: { to: Math.max(5, Math.min(S.MAX_RACE, Math.round(((lengthOf(s, pg) || 10) * 6 * 0.6) / 5) * 5)) } } }),
    off: (s) => ({ ...s, rank: { ...plainRank(s), by: 'total' } }),
    controls: [chips('to', 'The target', [[25, '25'], [50, '50'], [100, '100']], { min: 1, max: S.MAX_RACE }, 50, field('rank.race.to', 50))],
  },
  {
    id: 'standing', row: 'compete', name: 'Last one standing', line: 'A wrong pick costs a life', icon: 'heart',
    fits: (s) => fitsOr(isPool(s) || isQuestions(s), 'Lives need a pick or a guess each episode, not a team'),
    on: (s) => rankBy(s) === 'standing' && isObj(s.score) && isInt(s.score.lives, 1),
    apply: (s) => ({ ...s, score: { ...s.score, lives: 2 }, rank: { ...plainRank(s), by: 'standing' } }),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score || {}).filter(([k]) => !['lives', 'mulligans', 'buyback'].includes(k))), rank: { ...plainRank(s), by: isPool(s) ? 'streak' : 'total' } }),
    controls: [
      stepper('lives', 'Lives', [1, S.MAX_LIVES], 2, field('score.lives', 2)),
      stepper('mulligans', 'Wrong picks forgiven', [0, S.MAX_MULLIGANS], 0, { read: (s) => (s.score && s.score.mulligans) || 0, write: (s, v) => pathSet(clone(s), 'score.mulligans', v || undefined) }),
      stepper('buyback', 'Buy back in', [0, S.MAX_BUYBACKS], 0, {
        read: (s) => (s.score && isObj(s.score.buyback) ? s.score.buyback.times : 0),
        write: (s, v) => pathSet(clone(s), 'score.buyback', v ? { ...(isObj(s.score && s.score.buyback) ? s.score.buyback : S.BUYBACK), times: v } : undefined),
      }),
      stepper('cost', 'A buyback costs (points)', [0, S.MAX_BUYBACK_COST], 0, { read: (s) => (s.score && s.score.buyback && s.score.buyback.cost) || 0, write: (s, v) => pathSet(clone(s), 'score.buyback.cost', v), when: (s) => !!(s.score && s.score.buyback) }, true),
      segment('allOut', 'Everyone left goes out together', 'rank.allOut', [['points', 'All out, by their points'], ['share', 'They share the win'], ['back', 'All back in']], S.POOL_END.allOut, field('rank.allOut', S.POOL_END.allOut), true),
    ],
  },
  {
    id: 'coop', row: 'compete', name: 'Together', line: 'All of you against the show, sharing lives', icon: 'hands',
    homes: { 'rank.by': ['coop'] },
    fits: (s) => fitsOr(isQuestions(s), 'Playing together goes with guesses'),
    on: (s) => rankBy(s) === 'coop',
    apply: (s) => ({ ...s, score: { ...s.score, lives: 3 }, rank: { by: 'coop' } }),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score || {}).filter(([k]) => !['lives', 'saves'].includes(k))), rank: { by: 'total' } }),
    controls: [
      stepper('lives', 'Shared lives', [1, S.MAX_LIVES], 3, field('score.lives', 3)),
      segment('saves', 'A night is saved when', 'score.saves', [['one', 'One of you is right'], ['most', 'Most of you are'], ['all', 'All of you are']], S.COOP.saves, field('score.saves', S.COOP.saves)),
    ],
  },
  {
    id: 'streak', row: 'compete', name: 'Longest streak', line: 'Most right picks in a row', icon: 'streak',
    homes: { 'rank.by': ['streak'] },
    fits: (s) => fitsOr(isPool(s), 'A streak goes with a pick each episode'),
    on: (s) => rankBy(s) === 'streak',
    apply: (s) => ({ ...s, rank: { ...plainRank(s), by: 'streak' } }),
  },
  {
    id: 'worth', row: 'compete', name: 'Most worth', line: "Your cash and your team's value", icon: 'chart',
    homes: { 'rank.by': ['worth'] },
    fits: (s) => fitsOr(isDraft(s) && isObj(s.get.budget) && isObj(s.get.budget.trade), 'Worth goes with buying and selling'),
    on: (s) => rankBy(s) === 'worth',
    apply: (s) => ({ ...s, rank: { ...plainRank(s), by: 'worth' } }),
  },
  { id: 'categories', row: 'compete', name: 'Categories', line: 'Win more stats than your opponent', icon: 'grid', sport: true, homes: { 'rank.by': ['categories'] }, fits: (s, pg) => fitsOr(pg && pg.sport, 'Categories are a sport’s'), on: (s) => rankBy(s) === 'categories' },
  { id: 'roto', row: 'compete', name: 'Roto', line: 'Your place in every stat, added up', icon: 'rows', sport: true, homes: { 'rank.by': ['roto'] }, fits: (s, pg) => fitsOr(pg && pg.sport, 'Roto is a sport’s'), on: (s) => rankBy(s) === 'roto' },

  // ---- Bets (points, never money) ----
  {
    id: 'nobets', row: 'bets', name: 'No bets', line: 'Just the game', icon: 'none',
    on: (s) => !betOn(s),
    apply: (s) => offBets(s),
  },
  {
    id: 'side', row: 'bets', name: 'Side bets', line: 'Bet points on your own side guesses', icon: 'chat',
    fits: (s) => fitsOr(S.betsFit(offBets(s)), 'Side bets go beside a draft'),
    on: (s) => isObj(s.extras) && isObj(s.extras.bets),
    apply: (s) => ({ ...s, extras: { ...(s.extras || {}), bets: { points: 1 } } }),
    off: (s) => ({ ...s, extras: { ...(s.extras || {}), bets: null } }),
    controls: [stepper('points', 'Each one is worth', [1, S.MAX_BET_POINTS], 1, field('extras.bets.points', 1))],
  },
  {
    id: 'stake', row: 'bets', name: 'A stake on a guess', line: 'Right wins your stake, wrong loses it', icon: 'coin',
    fits: (s) => fitsOr(isQuestions(s) && eachAsks(offBets(s)).some((q) => S.WAGERS.includes(q.answer)), 'A stake needs a guess each episode to bet on'),
    on: (s) => asks(s).some((q) => isInt(q.wager, 1)),
    apply: (s) => ({ ...offBets(s), ask: asks(s).map((q) => (q.asked === 'each' && S.WAGERS.includes(q.answer) && !q.share ? { ...q, wager: 5 } : q)) }),
    off: offBets,
    controls: [
      chips('most', 'A guess can take', [[3, 'Up to 3'], [5, 'Up to 5'], [10, 'Up to 10']], { min: 1, max: S.MAX_BANK }, 5, onAsks('wager', 5, (q) => isInt(q.wager, 1))),
      segment('odds', 'A right bet pays', 'ask.odds', [['even', 'Even money', 'You win what you staked'], ['pool', "The couch's odds", 'The wrong stakes go to the right ones']], S.ODDS, onAsks('odds', S.ODDS, (q) => q.wager !== undefined)),
    ],
  },
  {
    id: 'double', row: 'bets', name: 'Double or nothing', line: 'Bet any of your points on a guess', icon: 'double',
    fits: (s) => fitsOr(isQuestions(s) && eachAsks(offBets(s)).some((q) => S.WAGERS.includes(q.answer)), 'Double or nothing needs a guess each episode to bet on'),
    on: (s) => asks(s).some((q) => q.wager === S.WAGER_TOTAL) && !(isObj(s.score) && s.score.bank),
    apply: (s) => ({ ...offBets(s), ask: asks(s).map((q, i) => (i === asks(s).findIndex((x) => x.asked === 'each' && S.WAGERS.includes(x.answer)) ? { ...q, wager: S.WAGER_TOTAL } : q)) }),
    off: offBets,
  },
  {
    id: 'bank', row: 'bets', name: 'A bank', line: 'Start with points to bet from', icon: 'bank',
    fits: (s) => fitsOr(T.bank.fits({ ...offBets(s) }), 'A bank needs guesses and most points to win'),
    on: (s) => isObj(s.score) && isObj(s.score.bank),
    apply: (s) => ({ ...offBets(s), score: { ...s.score, bank: { start: 100 } }, ask: asks(s).map((q) => (q.asked === 'each' && !q.beat && !q.share && !q.rollover && q.answer !== 'calls' ? { ...q, wager: S.WAGER_TOTAL } : q)) }),
    off: offBets,
    controls: [
      chips('start', 'Everyone starts with', [[100, '100'], [500, '500'], [1000, '1,000']], { min: 1, max: S.MAX_BANK }, 100, field('score.bank.start', 100)),
      segment('take', 'A guess can take', null, [['total', 'Any of your bank'], ['cap', 'Up to a number']], 'total', {
        read: (s) => (asks(s).some((q) => isInt(q.wager, 1)) ? 'cap' : 'total'),
        write: (s, v) => ({ ...s, ask: asks(s).map((q) => (q.wager !== undefined ? { ...q, wager: v === 'cap' ? 50 : S.WAGER_TOTAL } : q)) }),
      }),
      segment('out', 'At zero', null, [[false, 'Keep playing'], [true, "You're out"]], S.BANK.out, field('score.bank.out', S.BANK.out), true),
    ],
  },
  {
    id: 'pot', row: 'bets', name: 'Split the pot', line: 'Everyone right shares the points', icon: 'pie',
    homes: { 'ask.share': ['split'] },
    fits: (s) => fitsOr(T['split-pot'].fits(offBets(s)), 'A pot needs a guess each episode'),
    on: (s) => asks(s).some((q) => q.share === 'split'),
    apply: (s) => T['split-pot'].apply(offBets(s)),
    off: offBets,
    controls: [chips('pot', 'The pot', [[10, '10'], [20, '20']], { min: 0, max: S.MAX_QUESTION_POINTS }, 10, onAsks('points', 10, (q) => q.share === 'split'))],
  },
  {
    id: 'lone', row: 'bets', name: 'Only a lone right answer', line: "Points only when nobody else is right", icon: 'one',
    homes: { 'ask.share': ['only'] },
    fits: (s) => fitsOr(T['only-right'].fits(offBets(s)), 'This needs a guess about one person each episode'),
    on: (s) => asks(s).some((q) => q.share === 'only'),
    apply: (s) => T['only-right'].apply(offBets(s)),
    off: offBets,
  },
  {
    id: 'parlay', row: 'bets', name: 'Parlay', line: 'All right together pays more', icon: 'link',
    homes: { 'multiply.on': ['legs'] },
    fits: (s) => fitsOr(T.parlay.fits(offBets(s)), 'A parlay needs two guesses each episode'),
    on: (s) => isObj(s.score) && Array.isArray(s.score.parlays),
    apply: (s) => ({ ...s, score: { ...s.score, parlays: [{ of: eachAsks(s).filter((q) => !q.share && q.answer !== 'calls').slice(0, 2).map((q) => q.id), times: 3 }] } }),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score || {}).filter(([k]) => k !== 'parlays')) }),
    controls: [chips('times', 'Pays', [[2, '×2'], [3, '×3'], [5, '×5']], { min: 1.5, max: S.MAX_TIMES, step: 0.5 }, 3, {
      read: (s) => (s.score && s.score.parlays && s.score.parlays[0] ? s.score.parlays[0].times : 3),
      write: (s, v) => ({ ...s, score: { ...s.score, parlays: s.score.parlays.map((p, i) => (i === 0 ? { ...p, times: v } : p)) } }),
    })],
  },
  {
    id: 'ticket', row: 'bets', name: 'Build a ticket', line: 'Put several guesses on one stake', icon: 'ticket',
    homes: { 'ask.answer': ['ticket'], 'ask.settle': ['legs'] },
    fits: (s) => fitsOr(isQuestions(s) && eachAsks(offBets(s)).filter((q) => S.LEGS.includes(q.answer)).length >= 2, 'A ticket needs two guesses each episode'),
    on: (s) => asks(s).some((q) => q.answer === 'ticket'),
    apply: (s) => {
      const of = eachAsks(s).filter((q) => S.LEGS.includes(q.answer) && !q.share).map((q) => q.id).slice(0, S.MAX_TICKET_LEGS);
      return { ...s, score: { ...s.score, bank: (s.score && s.score.bank) || { start: 100 } }, ask: [...asks(s), { id: 'ticket', ask: 'Your ticket', answer: 'ticket', points: 0, asked: 'each', wager: S.WAGER_TOTAL, settle: { by: 'legs', of } }] };
    },
    off: (s) => ({ ...s, ask: asks(s).filter((q) => q.answer !== 'ticket') }),
    controls: [
      stepper('min', 'At least this many guesses', [2, S.MAX_TICKET_LEGS], S.TICKET.min, {
        read: (s) => { const q = asks(s).find((x) => x.answer === 'ticket'); return (q && q.legs && q.legs.min) || S.TICKET.min; },
        write: (s, v) => ({ ...s, ask: asks(s).map((q) => (q.answer === 'ticket' ? { ...q, legs: { ...(q.legs || {}), min: v } } : q)) }),
      }),
      stepper('max', 'At most', [2, S.MAX_TICKET_LEGS], S.MAX_TICKET_LEGS, {
        read: (s) => { const q = asks(s).find((x) => x.answer === 'ticket'); return (q && q.legs && q.legs.max) || Math.min(S.MAX_TICKET_LEGS, ((q && q.settle && q.settle.of) || []).length || S.MAX_TICKET_LEGS); },
        write: (s, v) => ({ ...s, ask: asks(s).map((q) => (q.answer === 'ticket' ? { ...q, legs: { ...(q.legs || {}), max: v } } : q)) }),
      }, true),
    ],
  },
  {
    id: 'jackpot', row: 'bets', name: 'Jackpot', line: 'Nobody right? The points roll over', icon: 'jackpot',
    fits: (s) => fitsOr(T.rollover.fits(offBets(s)), 'A jackpot needs a guess each episode'),
    on: (s) => asks(s).some((q) => q.rollover === true),
    apply: (s) => T.rollover.apply(offBets(s)),
    off: (s) => ({ ...s, ask: asks(s).map((q) => Object.fromEntries(Object.entries(q).filter(([k]) => k !== 'rollover'))) }),
  },

  // ---- Your team (a draft) ----
  {
    id: 'size', row: 'play', kinds: ['draft'], name: 'How many', line: 'Team size, and who plays', icon: 'team',
    homes: { count: ['start', 'best', 'all'] },
    on: () => true,
    controls: [
      stepper('each', 'On a team', [1, S.MAX_LINEUP_TEAM], 3, field('get.each', 3)),
      segment('plays', 'Who scores each week', null, [['start', 'You choose who plays'], ['best', 'Your best count'], ['all', 'Everyone counts']], 'all', {
        read: (s) => (isObj(s.count) ? Object.keys(s.count)[0] : 'all'),
        write: (s, v) => {
          const each = (s.get && s.get.each) || 3;
          const n = Math.max(1, Math.min(S.MAX_STARTERS, each - 1));
          return { ...s, count: v === 'start' ? { start: n } : v === 'best' ? { best: n } : { all: true } };
        },
      }),
      stepper('n', 'How many of them', [1, S.MAX_STARTERS], 3, {
        read: (s) => (isObj(s.count) ? s.count.start || s.count.best || 3 : 3),
        write: (s, v) => ({ ...s, count: s.count && s.count.best ? { best: v } : { start: v } }),
        when: (s) => isObj(s.count) && !!(s.count.start || s.count.best),
      }),
    ],
  },
  {
    id: 'draft', row: 'play', kinds: ['draft'], name: 'How the draft runs', line: 'By turns, in private, out of a hat, or bids', icon: 'order',
    on: () => true,
    controls: [
      segment('own', 'Can two of you have the same castaway?', 'get.own', [['shared', 'Yes', 'Drafted in private; anyone can join later'], ['exclusive', 'No', 'By turns; waivers for whoever is left']], 'shared', {
        read: (s) => (s.get && s.get.own) || 'shared',
        write: (s, v) => ({ ...s, get: { ...s.get, own: v, order: v === 'shared' ? 'blind' : s.get.order === 'blind' ? 'snake' : s.get.order } }),
      }),
      segment('order', 'The draft', 'get.order', [['snake', 'By turns'], ['blind', 'In private'], ['draw', 'Out of a hat'], ['auction', 'Bids']], 'snake', {
        read: (s) => (s.get && s.get.order) || 'snake',
        write: (s, v) => ({ ...s, get: { ...Object.fromEntries(Object.entries(s.get).filter(([k]) => v === 'auction' || k !== 'budget')), order: v, ...(v === 'auction' ? { own: 'exclusive', budget: { total: S.BUDGET.total, floor: S.BUDGET.floor } } : {}), ...(v === 'blind' ? { own: 'shared' } : {}) } }),
      }),
      chips('budget', 'Everyone has to bid', [[100, '100'], [200, '200']], { min: 1, max: S.MAX_BUDGET }, 100, { ...field('get.budget.total', 100), when: (s) => !!(s.get && s.get.budget) }),
      segment('short', "A team its bids didn't fill", 'get.budget.fallback', [['fill', "Filled from who's left"], ['short', 'Left short']], S.AUCTION.fallback, { ...field('get.budget.fallback', S.AUCTION.fallback), when: (s) => !!(s.get && s.get.order === 'auction') }, true),
    ],
  },
  {
    id: 'cap', row: 'play', kinds: ['draft'], name: 'Prices and a cap', line: 'Each castaway has a price; stay under the cap', icon: 'tag',
    fits: (s) => fitsOr(isDraft(s) && s.get.order !== 'auction', 'Prices go with a draft that isn’t bid for'),
    on: (s) => isDraft(s) && isObj(s.get.budget) && s.get.order !== 'auction' && !isObj(s.get.budget.trade),
    apply: (s) => ({ ...s, get: { ...s.get, budget: { total: S.BUDGET.total } } }),
    off: (s) => ({ ...s, get: Object.fromEntries(Object.entries(s.get).filter(([k]) => k !== 'budget')) }),
    controls: [
      chips('total', 'The cap', [[100, '100'], [200, '200']], { min: 1, max: S.MAX_BUDGET }, 100, field('get.budget.total', 100)),
      segment('gone', 'Someone gone home counts', 'get.budget.gone', [['zero', 'Nothing against the cap'], ['last', 'What they cost when they left']], S.CAP.gone, field('get.budget.gone', S.CAP.gone), true),
    ],
  },
  {
    id: 'market', row: 'play', kinds: ['draft'], name: 'Buy and sell', line: 'Trade castaways like shares each week', icon: 'chart',
    fits: (s) => fitsOr(isDraft(s) && s.get.order !== 'auction', 'Trading goes with a priced draft'),
    on: (s) => isDraft(s) && isObj(s.get.budget) && isObj(s.get.budget.trade),
    apply: (s) => ({ ...s, get: { ...s.get, own: 'shared', order: 'blind', budget: { total: S.BUDGET.total, trade: {} } }, rank: { ...plainRank(s), by: 'worth' } }),
    off: (s) => ({ ...s, get: Object.fromEntries(Object.entries(s.get).filter(([k]) => k !== 'budget')), rank: { ...plainRank(s), by: 'total' } }),
    controls: [
      segment('left', 'Money not spent', 'get.budget.left', [['cash', 'Cash to trade with'], ['lost', 'Lost'], ['bids', 'Bids on free agents', 'Coming']], S.MARKET_LEFT, field('get.budget.left', S.MARKET_LEFT)),
      stepper('fee', 'A trade costs', [0, 10], S.TRADE.fee, field('get.budget.trade.fee', S.TRADE.fee), true),
    ],
  },
  {
    id: 'spread', row: 'play', kinds: ['draft'], name: 'One from each', line: 'A team spread across the groups', icon: 'spread',
    homes: { 'get.across.then': ['keep'] },
    fits: (s, pg) => fitsOr(isDraft(s) && (pg.grouped || (pg.properties || []).length > 0), 'This season has no groups to spread across'),
    on: (s) => isDraft(s) && isObj(s.get.across),
    apply: (s, pg) => ({ ...s, get: { ...s.get, across: { of: pg.grouped ? 'group' : 'gender', then: 'keep' } } }),
    off: (s) => ({ ...s, get: Object.fromEntries(Object.entries(s.get).filter(([k]) => k !== 'across')) }),
    controls: [segment('of', 'Across', 'get.across.of', [['group', 'The tribes'], ['gender', 'Men and women']], 'group', field('get.across.of', 'group'))],
  },
  {
    id: 'slots', row: 'play', kinds: ['draft'], name: 'A slot for a pair', line: 'One more slot that holds a pair or team the show forms', icon: 'slot',
    fits: (s, pg) => fitsOr(isDraft(s) && pg.grouped && !s.get.budget && T['group-slot'].fits(s, pg), "This season's groups can't fill a slot"),
    on: (s) => isDraft(s) && isObj(s.get.groups),
    apply: (s) => ({ ...s, get: { ...s.get, groups: { slots: S.GROUP_SLOTS.slots } } }),
    off: (s) => ({ ...s, get: Object.fromEntries(Object.entries(s.get).filter(([k]) => k !== 'groups')) }),
    controls: [
      stepper('slots', 'Slots', [1, S.MAX_GROUP_SLOTS], 1, field('get.groups.slots', 1)),
      segment('own', 'Two of you on the same one', 'get.groups.own', [['shared', 'Fine'], ['exclusive', 'Not allowed']], S.GROUP_SLOTS.own, field('get.groups.own', S.GROUP_SLOTS.own), true),
      segment('fallback', 'Unsure who is in it', 'get.groups.fallback', [['void', "That week doesn't count"], ['carry-on', 'Follow the people'], ['next-stage', 'The next stage starts']], S.GROUP_SLOTS.fallback, field('get.groups.fallback', S.GROUP_SLOTS.fallback), true),
      segment('points', "A pair's points", 'get.groups.points', [['mean', 'Their average'], ['sum', 'Added up']], S.GROUP_SLOTS.points, field('get.groups.points', S.GROUP_SLOTS.points), true),
    ],
  },
  {
    id: 'keepers', row: 'play', kinds: ['draft'], name: 'Keepers', line: "Keep some of last season's team", icon: 'keep',
    needs: 'a game on this couch last season',
    fits: (s, pg) => fitsOr(isDraft(s) && pg.lastSeason, "Keepers need this couch's game on the show's last season"),
    on: (s) => isDraft(s) && isObj(s.get.keep),
    apply: (s, pg) => ({ ...s, get: { ...s.get, own: 'exclusive', order: s.get.order === 'blind' ? 'snake' : s.get.order, keep: { each: S.KEEP.each, from: pg.lastSeason } } }),
    off: (s) => ({ ...s, get: Object.fromEntries(Object.entries(s.get).filter(([k]) => k !== 'keep')) }),
    controls: [
      stepper('each', 'Keep', [1, 3], S.KEEP.each, field('get.keep.each', S.KEEP.each)),
      segment('cost', 'A keeper costs', 'get.keep.cost', [['place', 'A place on your team'], ['round', 'An early pick'], ['price', 'Their price']], 'place', field('get.keep.cost', 'place')),
      segment('fallback', 'Nobody named by the draft', 'get.keep.fallback', [['best', 'Their best who are back'], ['none', 'Nobody']], S.KEEP.fallback, field('get.keep.fallback', S.KEEP.fallback), true),
    ],
  },
  {
    id: 'replacements', row: 'play', kinds: ['draft'], name: 'Replacements', line: 'Pick someone new when one of yours goes home', icon: 'swap',
    fits: (s, pg) => fitsOr(isDraft(s) && S.waiversFit(s) && pg.results, 'Replacements need castaways who come free'),
    on: (s) => isObj(s.extras) && isObj(s.extras.waivers) && s.extras.waivers.replace !== 'never',
    apply: (s) => ({ ...s, extras: { ...(s.extras || {}), waivers: { ...S.NO_WAIVERS, replace: 'always' } } }),
    off: (s) => ({ ...s, extras: { ...(s.extras || {}), waivers: s.get && s.get.own === 'exclusive' ? { ...S.NO_WAIVERS } : null } }),
    controls: [
      segment('replace', 'When', null, [['always', 'Whenever one goes home'], ['whenShort', 'When your team is short'], ['windows', 'In set windows']], 'always', field('extras.waivers.replace', 'always')),
      segment('own', 'From', 'extras.waivers.own', [['exclusive', "Only who's free"], ['shared', 'Anyone still in']], 'exclusive', {
        read: (s) => (s.extras && s.extras.waivers && isObj(s.extras.waivers.own) && s.extras.waivers.own.replace) || (s.get && s.get.own) || 'exclusive',
        write: (s, v) => pathSet(clone(s), 'extras.waivers.own', { replace: v }),
      }, true),
    ],
  },
  {
    id: 'pool', row: 'play', kinds: ['draft', 'pick'], name: "Who's in the pool", line: 'Everyone still in, or only some', icon: 'filter',
    homes: { 'pool.where': ['stillIn'] },
    on: () => true,
    controls: [segment('where', 'Pick from', 'pool.where', [['stillIn', 'Everyone still in'], ['props', 'One kind (a property)'], ['teams', "A team's players", 'A sport'], ['positions', 'A position', 'A sport'], ['group', 'One tribe', 'Coming']], 'stillIn', {
      read: (s) => { const w = s.pool && s.pool.where; return isObj(w) ? Object.keys(w).find((k) => k !== 'stillIn') || 'stillIn' : 'stillIn'; },
      write: (s, v, pg) => {
        const prop = ((pg && pg.properties) || [])[0];
        const where = v === 'props' && prop ? { stillIn: true, props: { [prop.key]: [prop.values[0]] } } : v === 'stillIn' ? { stillIn: true } : { stillIn: true, [v]: [] };
        return { ...s, pool: { of: 'cast', where } };
      },
    })],
  },

  // ---- Your pick (a pick each episode) ----
  {
    id: 'pickmeans', row: 'play', kinds: ['pick'], name: 'What a pick is', line: 'Someone who stays, or someone who scores', icon: 'target',
    homes: { count: ['pick'] },
    on: () => true,
    controls: [
      segment('means', 'Pick', 'score.means', [['staysIn', 'Someone who stays', 'Right when they stay in'], ['scores', 'Someone who scores', 'Right when they score in it'], ['points', 'For their points', 'You get what they score']], 'staysIn', {
        read: (s) => (s.score && s.score.by === 'survive' ? s.score.means || 'staysIn' : 'points'),
        write: (s, v) => (v === 'points'
          ? { ...s, get: { ...s.get, repeat: 'any' }, score: { by: 'moments', points: null }, rank: { ...plainRank(s), by: 'total' } }
          : { ...s, score: { by: 'survive', means: v, points: 1 }, rank: { ...plainRank(s), by: isObj(s.rank) && s.rank.by !== 'total' ? s.rank.by : 'streak' } }),
      }),
      stepper('each', 'Picks an episode', [1, S.MAX_PICKS], 1, { ...field('get.each', 1), when: (s) => !(s.score && s.score.by === 'survive') }),
    ],
  },
  {
    id: 'repeat', row: 'play', kinds: ['pick'], name: 'Picking the same one again', line: 'After everyone, never, or any time', icon: 'repeat',
    on: () => true,
    controls: [
      segment('repeat', 'The same castaway again', 'get.repeat', [['cycle', 'After everyone has been picked'], ['never', 'Never'], ['any', 'Any time']], 'cycle', field('get.repeat', 'cycle')),
      segment('fallback', 'Nobody left you can pick', 'get.fallback', [['miss', 'Counts as a miss'], ['skip', 'You sit that one out']], S.NEVER.fallback, { ...field('get.fallback', S.NEVER.fallback), when: (s) => s.get && s.get.repeat === 'never' }, true),
    ],
  },
  {
    id: 'second', row: 'play', kinds: ['pick'], name: 'A second pick', line: 'Pick two on a night two go home', icon: 'two',
    fits: (s) => fitsOr(isPool(s), 'A second pick goes with a pool'),
    on: (s) => isObj(s.get) && isObj(s.get.second),
    apply: (s) => ({ ...s, get: { ...s.get, second: { fallback: S.SECOND_PICK.fallback } } }),
    off: (s) => ({ ...s, get: Object.fromEntries(Object.entries(s.get).filter(([k]) => k !== 'second')) }),
    controls: [segment('fallback', 'A night only one goes home', 'get.second.fallback', [['void', "The second doesn't count"], ['counts', 'It counts like the first']], S.SECOND_PICK.fallback, field('get.second.fallback', S.SECOND_PICK.fallback))],
  },

  // ---- The questions ----
  { id: 'addq', row: 'play', kinds: ['questions'], name: 'Add a question', line: 'Who goes home, who does a moment, how many, the order…', icon: 'plus', on: () => false, sheet: 'question' },
  {
    id: 'card', row: 'play', kinds: ['questions'], name: 'A new card each episode', line: 'Lines drawn from the show’s moments, or our bot’s pick', icon: 'sheet',
    homes: { 'card.from': ['moments', 'bot'] },
    fits: (s, pg) => fitsOr(isQuestions(s) && pg.moments.length >= 2, 'A sheet needs moments to draw from'),
    on: (s) => isObj(s.card) && s.card.from !== 'host',
    apply: (s, pg) => ({ ...s, card: { from: 'moments', each: Math.min(4, pg.moments.length), of: pg.moments.slice(0, 8).map((m) => m.id) }, ask: [...asks(s).filter((q) => !q.card), { id: 'sheet', ask: 'This episode’s sheet', answer: 'yesNo', points: 1, asked: 'each', card: true, settle: { by: 'moment', take: 'happened' } }] }),
    off: (s) => ({ ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'card')), ask: asks(s).filter((q) => !q.card) }),
    controls: [
      segment('from', 'Who picks the lines', 'card.from', [['moments', 'In turn from the moments'], ['bot', 'Our bot, before each episode']], 'moments', field('card.from', 'moments')),
      stepper('each', 'Lines an episode', [1, S.MAX_CARD], 4, field('card.each', 4)),
      segment('fallback', 'Not ready in time', 'card.fallback', [['spec', 'The next ones in turn'], ['void', 'No sheet that episode']], S.CARD.fallback, field('card.fallback', S.CARD.fallback), true),
    ],
  },

  // ---- Scoring ----
  {
    id: 'what', row: 'scoring', kinds: ['draft'], name: 'What scores', line: 'What they do, or how long they last', icon: 'star',
    homes: { 'score.by': ['moments', 'place'] },
    on: () => true,
    controls: [segment('by', 'Points for', null, [['moments', 'What they do', 'Immunity, idols, surviving a vote'], ['place', 'How long they last', 'A point for everyone out before them']], 'moments', {
      read: (s) => (s.score && s.score.by) || 'moments',
      write: (s, v) => ({ ...s, score: v === 'place' ? { by: 'place' } : { by: 'moments', points: null }, count: v === 'place' ? { all: true } : s.count && s.count.all ? { start: Math.max(1, ((s.get && s.get.each) || 3) - 1) } : s.count }),
    })],
  },
  {
    id: 'shows', row: 'scoring', kinds: ['draft', 'pick'], name: "The show's points", line: 'Every moment at the rulebook’s points', icon: 'book',
    fits: (s) => fitsOr(byMoments(s), 'This game scores by lasting'),
    on: (s) => byMoments(s) && !s.score.only && !s.score.noLoss && !s.score.big,
  },
  {
    id: 'only', row: 'scoring', kinds: ['draft', 'pick'], name: 'Only some moments', line: 'Pick the moments that count', icon: 'check',
    fits: (s, pg) => fitsOr(byMoments(s) && pg.moments.length >= 1, 'This game scores by lasting'),
    on: (s) => byMoments(s) && Array.isArray(s.score.only),
    apply: (s, pg) => ({ ...s, score: { ...s.score, only: pg.moments.slice(0, 3).map((m) => m.id) } }),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score).filter(([k]) => !['only', 'hits'].includes(k))) }),
    controls: [segment('hits', 'Each moment counts', 'score.hits', [['every', 'Every time'], ['pick', 'Once for each of yours'], ['objective', 'Once for you']], 'every', { read: (s) => (s.score && s.score.hits) || 'every', write: (s, v) => pathSet(clone(s), 'score.hits', v === 'every' ? undefined : v) }, true)],
  },
  {
    id: 'captain', row: 'scoring', kinds: ['draft'], name: 'A captain', line: 'One of yours scores double each week', icon: 'crown',
    homes: { 'multiply.on': ['captain'] },
    fits: (s) => fitsOr(T.captain.fits(s), 'A captain goes with choosing who plays'),
    on: (s) => isObj(s.score) && isObj(s.score.captain),
    apply: (s) => ({ ...s, score: { ...s.score, captain: { times: 2 } } }),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score).filter(([k]) => k !== 'captain')) }),
    controls: [chips('times', 'Scores', [[1.5, '×1.5'], [2, '×2'], [3, '×3']], { min: 1.5, max: S.MAX_TIMES, step: 0.5 }, 2, field('score.captain.times', 2))],
  },
  {
    id: 'times', row: 'scoring', kinds: ['draft', 'pick'], name: 'Points multiply', line: 'The finale, an episode or a stage counts more', icon: 'times',
    homes: { 'multiply.on': ['when'] },
    fits: (s, pg) => fitsOr(byMoments(s) && pg.results, 'Multiplied points go with points for what they do'),
    on: (s) => isObj(s.score) && Array.isArray(s.score.times),
    apply: (s) => ({ ...s, score: { ...s.score, times: [{ times: 2, finale: true }] } }),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score).filter(([k]) => k !== 'times')) }),
    controls: [
      segment('when', 'When', 'score.times', [['finale', 'The finale'], ['episode', 'One episode'], ['from', 'From an episode on'], ['phase', 'A stage']], 'finale', {
        read: (s) => { const t = s.score && s.score.times && s.score.times[0]; return t ? (t.finale ? 'finale' : t.phase ? 'phase' : t.from !== undefined ? 'from' : 'episode') : 'finale'; },
        write: (s, v, pg) => {
          const from = (SEASON_SPAN(s) && SEASON_SPAN(s).from) || 1;
          const ph = pg && ((pg.later && pg.later[0]) || (pg.phases || [])[0]);
          const t = v === 'finale' ? { finale: true } : v === 'episode' ? { episode: from } : v === 'from' ? { from } : { phase: ph ? ph.id : 'merged' };
          return { ...s, score: { ...s.score, times: [{ times: (s.score.times && s.score.times[0] && s.score.times[0].times) || 2, ...t }] } };
        },
      }),
      chips('x', 'Counts', [[2, '×2'], [3, '×3'], [0.5, '×½']], { min: 0.5, max: S.MAX_TIMES, step: 0.5 }, 2, {
        read: (s) => (s.score && s.score.times && s.score.times[0] && s.score.times[0].times) || 2,
        write: (s, v) => ({ ...s, score: { ...s.score, times: s.score.times.map((t, i) => (i === 0 ? { ...t, times: v } : t)) } }),
      }),
    ],
  },
  {
    id: 'reverse', row: 'scoring', kinds: ['draft'], name: 'Reverse', line: 'The first out scores most', icon: 'reverse',
    fits: (s) => fitsOr(T.reverse.fits(s), 'Reverse goes with points for lasting'),
    on: (s) => isObj(s.score) && s.score.reverse === true,
    apply: (s) => T.reverse.apply(s),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score).filter(([k]) => k !== 'reverse')) }),
  },
  {
    id: 'joined', row: 'scoring', kinds: ['draft'], name: 'How they joined', line: 'A replacement or a pickup scores less, or more', icon: 'join',
    homes: { 'multiply.on': ['joined'] },
    fits: (s, pg) => fitsOr(T.replacements.fits(s, pg), 'This needs replacements on an all-yours draft scored by lasting'),
    on: (s) => isObj(s.score) && Array.isArray(s.score.multiply),
    apply: (s) => ({ ...s, score: { ...s.score, multiply: [{ joined: 'replacement', times: [0.5] }] }, extras: { ...(s.extras || {}), waivers: { ...S.NO_WAIVERS, replace: 'always', own: { replace: 'shared' } } } }),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score).filter(([k]) => k !== 'multiply')) }),
    controls: [
      segment('joined', 'Who', 'score.multiply.joined', [['replacement', 'A replacement'], ['pickup', 'Any pickup'], ['swap', 'A swap'], ['draft', 'Drafted']], 'replacement', {
        read: (s) => (s.score && s.score.multiply && s.score.multiply[0] && s.score.multiply[0].joined) || 'replacement',
        write: (s, v) => {
          const multiply = s.score.multiply.map((m, i) => (i === 0 ? { ...m, joined: v, times: v === 'draft' ? 1.5 : Array.isArray(m.times) ? m.times : [m.times] } : m));
          const w = isObj(s.extras) && isObj(s.extras.waivers) ? s.extras.waivers : { ...S.NO_WAIVERS, replace: 'always' };
          const waivers = v === 'swap' ? { ...w, windows: { schedule: 'everyEpisode', every: 3, swaps: Math.max(1, (w.windows && w.windows.swaps) || 0) } } : w;
          return { ...s, score: { ...s.score, multiply }, extras: { ...(s.extras || {}), waivers } };
        },
      }),
      segment('per', 'Counted', 'score.multiply.per', [['team', 'By your team’s moves'], ['slot', 'By each spot on it']], S.JOINED.per, {
        read: (s) => (s.score.multiply[0] && s.score.multiply[0].per) || S.JOINED.per,
        write: (s, v) => ({ ...s, score: { ...s.score, multiply: s.score.multiply.map((m, i) => (i === 0 ? { ...m, per: v } : m)) } }),
      }, true),
      segment('then', 'Past the list', 'score.multiply.then', [['repeat', 'The last again'], ['ratio', 'Keep halving']], S.JOINED.then, {
        read: (s) => (s.score.multiply[0] && s.score.multiply[0].then) || S.JOINED.then,
        write: (s, v) => ({ ...s, score: { ...s.score, multiply: s.score.multiply.map((m, i) => (i === 0 ? { ...m, then: v } : m)) } }),
      }, true),
    ],
  },
  {
    id: 'bounty', row: 'scoring', kinds: ['draft'], name: 'Bounties on the vote', line: 'Vote out theirs, take their points', icon: 'target',
    homes: { 'score.bounty.on': ['votedOut'] },
    fits: (s, pg) => fitsOr(T.bounty.fits(s, pg), 'Bounties need votes the show records'),
    on: (s) => isObj(s.score) && isObj(s.score.bounty),
    apply: (s) => ({ ...s, score: { ...s.score, bounty: { points: 2 } } }),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score).filter(([k]) => k !== 'bounty')) }),
    controls: [chips('points', 'A bounty is', [[1, '1'], [2, '2'], [3, '3']], { min: 0.5, max: S.MAX_BOUNTY, step: 0.5 }, 2, field('score.bounty.points', 2))],
  },
  { id: 'streakx', row: 'scoring', kinds: ['pick'], name: 'Worth more on a streak', line: 'Each right pick in a row counts more', icon: 'streak', coming: 'later', homes: { 'multiply.on': ['streak'] }, on: () => false },
  { id: 'pickedx', row: 'scoring', kinds: ['draft'], name: 'Worth more drafted late', line: 'A late pick that scores counts more', icon: 'clock', coming: 'later', homes: { 'multiply.on': ['picked'] }, on: () => false },

  // ---- Twists ----
  {
    id: 'traitors', row: 'twists', kinds: ['draft'], name: 'Secret Traitors', line: 'Some of you secretly score off the rest', icon: 'mask',
    homes: { 'score.roles.deal': ['random'], 'score.roles.reveal': ['end'] },
    fits: (s, pg) => needCouch(3, pg, 'Secret Traitors') || fitsOr(T.roles.fits(s, pg), 'Traitors go with a draft scored by lasting or what they do'),
    on: (s) => isObj(s.score) && isObj(s.score.roles),
    apply: (s, pg) => ({ ...s, score: { ...s.score, roles: { count: couchOf(pg) && couchOf(pg) >= 6 ? 2 : 1, points: 2, on: pg.votes ? 'votedOut' : 'out' } } }),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score).filter(([k]) => k !== 'roles')) }),
    controls: [
      stepper('count', 'How many Traitors', [1, S.MAX_ROLE_SEATS], 1, field('score.roles.count', 1)),
      segment('on', 'They score when', 'score.roles.on', [['out', "Someone else's goes home"], ['votedOut', "Someone else's is voted out"]], S.ROLES.on, field('score.roles.on', S.ROLES.on)),
      chips('points', 'Each time', [[1, '1'], [2, '2'], [3, '3']], { min: 0.5, max: S.MAX_ROLE_POINTS, step: 0.5 }, 2, field('score.roles.points', 2)),
      toggle('mates', 'Traitors know each other', S.ROLES.mates, field('score.roles.mates', S.ROLES.mates), true),
      text('name', 'Their name', S.MAX_ROLE_NAME, S.ROLES.name, field('score.roles.name', S.ROLES.name), true),
    ],
  },
  {
    id: 'host', row: 'twists', kinds: ['questions'], name: 'Rotating host', line: 'Each episode one of you sets the questions', icon: 'mic',
    homes: { 'card.from': ['host'] },
    fits: (s, pg) => needCouch(2, pg, 'A rotating host') || fitsOr(isQuestions(s) && pg.moments.length >= 2, 'A host needs moments to choose from'),
    on: (s) => isObj(s.card) && s.card.from === 'host',
    apply: (s, pg) => ({ ...s, card: { from: 'host', each: 3, of: pg.moments.slice(0, 9).map((m) => m.id) }, ask: [...asks(s).filter((q) => !q.card), { id: 'host', ask: "The host's questions", answer: 'yesNo', points: 1, asked: 'each', card: true, settle: { by: 'moment', take: 'happened' } }] }),
    off: (s) => ({ ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'card')), ask: asks(s).filter((q) => !q.card) }),
    controls: [
      stepper('each', 'Questions a host sets', [1, S.MAX_CARD], 3, field('card.each', 3)),
      stepper('closes', 'Hours before it airs', [1, S.MAX_HOST_HOURS], S.HOST_CARD.closes, field('card.closes', S.HOST_CARD.closes), true),
      toggle('hostAnswers', 'The host plays too', S.HOST_CARD.hostAnswers, field('card.hostAnswers', S.HOST_CARD.hostAnswers), true),
    ],
  },
  {
    id: 'toptwist', row: 'twists', kinds: ['draft', 'pick'], name: 'Twist of the week', line: 'The top scorer picks next week’s twist', icon: 'dice',
    fits: (s, pg) => fitsOr(T['top-twist'].fits(s, pg), 'A weekly twist goes with points for what they do'),
    on: (s) => isObj(s.score) && isObj(s.score.twist),
    apply: (s, pg) => T['top-twist'].apply(s, null, pg),
    off: (s) => ({ ...s, score: Object.fromEntries(Object.entries(s.score).filter(([k]) => k !== 'twist')) }),
    controls: [
      segment('who', 'Who picks', 'score.twist.who', [['top', 'The top scorer'], ['bottom', 'The bottom scorer']], S.TWIST.who, field('score.twist.who', S.TWIST.who)),
      segment('by', 'Top of', 'score.twist.by', [['episode', 'That episode'], ['total', 'The season so far']], S.TWIST.by, field('score.twist.by', S.TWIST.by), true),
      segment('tie', 'A tie for top', 'score.twist.tie', [['total', 'The season breaks it'], ['none', 'Nobody picks']], 'total', field('score.twist.tie', 'total'), true),
      stepper('closes', 'Choose by (hours before)', [0, S.MAX_TWIST_HOURS], S.TWIST.closes, field('score.twist.closes', S.TWIST.closes), true),
    ],
  },
  {
    id: 'majority', row: 'twists', kinds: ['questions'], name: 'Match the majority', line: 'Score for guessing what most of you say', icon: 'crowd',
    homes: { 'ask.settle': ['players'] },
    fits: (s, pg) => needCouch(3, pg, 'Matching the majority') || fitsOr(isQuestions(s) && asks(s).length < S.MAX_QUESTIONS, 'This needs guesses'),
    on: (s) => asks(s).some((q) => q.settle && q.settle.by === 'players'),
    apply: (s) => ({ ...s, ask: [...asks(s), { id: 'most', ask: 'Who will most of you say goes home?', answer: 'person', points: 2, asked: 'each', settle: { by: 'players', take: 'majority' } }] }),
    off: (s) => ({ ...s, ask: asks(s).filter((q) => !(q.settle && q.settle.by === 'players')) }),
    controls: [segment('tie', 'A tie for most', 'ask.settle.tie', [['none', 'Nobody is right'], ['all', 'Each tied answer is']], S.PLAYERS.tie, {
      read: (s) => { const q = asks(s).find((x) => x.settle && x.settle.by === 'players'); return (q && q.settle.tie) || S.PLAYERS.tie; },
      write: (s, v) => ({ ...s, ask: asks(s).map((q) => (q.settle && q.settle.by === 'players' ? { ...q, settle: { ...q.settle, tie: v } } : q)) }),
    })],
  },
  {
    id: 'beatbot', row: 'twists', kinds: ['questions'], name: 'Beat the bot', line: 'Our bot guesses too; you score when it’s wrong', icon: 'bot',
    homes: { 'ask.beat.by': ['bot'] },
    fits: (s) => fitsOr(T['beat-bot'].fits(s), 'This needs a guess the bot can make'),
    on: (s) => asks(s).some((q) => isObj(q.beat)),
    apply: (s) => T['beat-bot'].apply(s),
    off: (s) => ({ ...s, ask: asks(s).map((q) => Object.fromEntries(Object.entries(q).filter(([k]) => k !== 'beat'))) }),
    controls: [segment('none', 'A night the bot made no guess', 'ask.beat.none', [['plays', 'Right answers still score'], ['void', "It doesn't count"]], S.BEAT.none, {
      read: (s) => { const q = asks(s).find((x) => isObj(x.beat)); return (q && q.beat.none) || S.BEAT.none; },
      write: (s, v) => ({ ...s, ask: asks(s).map((q) => (isObj(q.beat) ? { ...q, beat: { ...q.beat, none: v } } : q)) }),
    })],
  },
  {
    id: 'early', row: 'twists', kinds: ['questions'], name: 'Worth more early', line: 'The earlier you guess, the more it’s worth', icon: 'clock',
    fits: (s) => fitsOr(isQuestions(s) && asks(s).some((q) => q.closes === 'finale' || (q.asked === 'once' && q.settle && q.settle.take === 'winner')), 'This goes with a guess open until the finale'),
    on: (s) => asks(s).some((q) => isObj(q.shrink)),
    apply: (s) => ({ ...s, ask: asks(s).map((q) => (q.closes === 'finale' || (q.settle && q.settle.take === 'winner') ? { ...q, asked: 'once', closes: 'finale', shrink: { points: 1, per: 'episode' } } : q)) }),
    off: (s) => ({ ...s, ask: asks(s).map((q) => Object.fromEntries(Object.entries(q).filter(([k]) => k !== 'shrink'))) }),
    controls: [segment('per', 'Worth less for each', 'ask.shrink.per', [['episode', 'Episode that has aired'], ['change', 'Change you make']], 'episode', {
      read: (s) => { const q = asks(s).find((x) => isObj(x.shrink)); return (q && q.shrink.per) || 'episode'; },
      write: (s, v) => ({ ...s, ask: asks(s).map((q) => (isObj(q.shrink) ? { ...q, shrink: { ...q.shrink, per: v } } : q)) }),
    })],
  },
  {
    id: 'bootcall', row: 'twists', kinds: ['draft'], name: 'Guess who goes home too', line: 'A guess each episode beside your team', icon: 'plus',
    fits: (s, pg) => fitsOr(T['boot-call'].fits(s, pg), 'This goes with a draft that runs to its end'),
    on: (s) => isDraft(s) && asks(s).some((q) => q.id === 'boot'),
    apply: (s) => T['boot-call'].apply(s),
    off: (s) => ({ ...s, ask: asks(s).filter((q) => q.id !== 'boot') }),
  },
  {
    id: 'finalepicks', row: 'twists', kinds: ['draft'], name: 'Finale picks', line: 'Guess the final three and the winner', icon: 'trophy',
    homes: { 'ask.closes': ['finale'] },
    fits: (s, pg) => fitsOr(T['finale-picks'].fits(s, pg), 'Finale picks go with a draft that runs to the finale'),
    on: (s) => isDraft(s) && asks(s).some((q) => q.id === 'top3' || (q.settle && q.settle.take === 'winner')),
    apply: (s) => ({ ...s, ask: S.finaleQuestions({ top3: 1, winner: 3, from: 'any' }) }),
    off: (s) => ({ ...s, ask: [] }),
  },

  // ---- Over the season ----
  { id: 'onegame', row: 'season', name: 'One game', line: 'The same game all the way', icon: 'one', on: (s) => !Array.isArray(s.stages), apply: (s) => (Array.isArray(s.stages) ? expand(s.stages[0].game) : s) },
  {
    id: 'redraft', row: 'season', name: 'A new draft at a stage', line: 'Pick again when the show changes stage', icon: 'redraft',
    homes: { 'score.by': ['stages'], 'overall.by': ['points'], 'extras.draft.opens': ['start'] },
    fits: (s, pg) => fitsOr(!Array.isArray(s.stages) && T.redraft.fits(s, pg), 'A new draft needs a draft that runs to the end'),
    on: (s) => Array.isArray(s.stages) && s.stages.length === 2 && s.stages.every((x) => x.game && x.game.get && x.game.get.by === 'draft') && !s.stages[1].on,
    apply: (s, pg) => T.redraft.apply(s, null, pg),
    controls: [segment('overall', 'The overall', 'overall.by', [['points', 'Points added up'], ['wins', 'Stages won'], ['places', 'Points for each place']], S.OVERALL.by, field('overall.by', S.OVERALL.by))],
  },
  {
    id: 'shakeup', row: 'season', name: 'A redraft on a shake-up', line: 'New teams whenever the show shakes things up', icon: 'shuffle',
    fits: (s) => fitsOr(isDraft(s) && toEnd(s), 'A redraft needs a draft that runs to the end'),
    on: (s) => Array.isArray(s.stages) && s.stages.some((x) => isObj(x.on)),
    apply: (s) => {
      const { span, ...game } = s;
      return { stages: [{ id: 'draft', name: 'Draft', game: { ...game, span: { from: span.from } } }, { id: 'redraft', name: 'New draft', on: { again: true }, game: clone(game) }], overall: { by: 'points' } };
    },
    controls: [
      { id: 'kinds', label: 'A new draft when', kind: 'checklist', vocab: 'on.change', def: S.ON_CHANGE.change,
        options: [['teams-formed', 'Teams are formed'], ['pairs-formed', 'Pairs are formed'], ['split-into-individuals', 'Everyone plays alone'], ['merge', 'The merge'], ['swap', 'A swap'], ['swap-all', 'A swap that changes every tribe'], ['newcomer', 'Someone new arrives'], ['new-phase', 'A new stage starts']],
        read: (s) => { const st = Array.isArray(s.stages) && s.stages.find((x) => isObj(x.on)); return st && Array.isArray(st.on.change) ? st.on.change : S.ON_CHANGE.change; },
        write: (s, v) => ({ ...s, stages: s.stages.map((x) => (isObj(x.on) ? { ...x, on: { change: Array.isArray(v) ? v : [v], again: true } } : x)) }) },
      segment('ok', 'A change is taken', 'extras.changes.ok', [['auto', 'By itself, with Undo'], ['maker', 'When I say so'], ['vote', 'When the couch votes']], S.CHANGES.ok, field('extras.changes.ok', S.CHANGES.ok)),
      segment('unanswered', 'Nobody answers in time', 'extras.changes.unanswered', [['start', 'It starts anyway'], ['carry-on', 'The old teams carry on']], S.CHANGES.unanswered, field('extras.changes.unanswered', S.CHANGES.unanswered), true),
    ],
  },
  {
    id: 'halves', row: 'season', name: 'Two halves', line: 'One game to a stage, another after', icon: 'halves',
    homes: { 'overall.by': ['wins'] },
    fits: (s, pg) => fitsOr(pg.later.length > 0 && !Array.isArray(s.stages), 'Two halves need a stage still to come'),
    on: (s) => Array.isArray(s.stages) && isObj(s.overall) && s.overall.by === 'wins',
    apply: (s, pg) => ({ ...T.redraft.apply(s, null, pg), overall: { by: 'wins' } }),
  },
  {
    id: 'minis', row: 'season', name: 'A season of mini-games', line: 'A different game for each stretch', icon: 'stack',
    homes: { 'overall.by': ['places'] },
    fits: (s, pg) => fitsOr(pg.later.length > 0 || (pg.left || 0) >= 4, 'Mini-games need a few stretches left'),
    on: (s) => Array.isArray(s.stages) && s.stages.length >= 3,
    sheet: 'stages',
  },
  {
    id: 'alongside', row: 'season', name: 'Two games at once', line: 'A second game beside this one, like trivia', icon: 'pair',
    fits: (s, pg) => fitsOr(T['trivia-too'].fits(s, pg) || (!Array.isArray(s.stages) && pg.trivia), 'Nothing plays beside this yet'),
    on: (s) => Array.isArray(s.stages) && s.stages.some((x) => x.alongside),
    apply: (s, pg) => (T['trivia-too'].fits(s, pg) ? T['trivia-too'].apply(s) : { stages: [{ id: 'main', name: 'The game', game: { ...s } }, { id: 'trivia', name: 'Trivia', alongside: true, game: { get: { by: 'none' }, score: { by: 'answers' }, rank: { by: 'total' }, span: clone(s.span), ask: [{ id: 'trivia', ask: 'Trivia about the episode before', answer: 'trivia', points: 1, asked: 'each', settle: { by: 'trivia' } }] } }], overall: { by: 'points' } }),
  },
  { id: 'sidegame', row: 'season', name: 'A side game while a pair lasts', line: 'A second game while the show is in pairs', icon: 'link', fits: (s, pg) => fitsOr(pg.grouped, 'This season has no pairs'), on: (s) => Array.isArray(s.stages) && s.stages.some((x) => isObj(x.side)), sheet: 'stages' },
  { id: 'nextshow', row: 'season', name: 'Then another show', line: 'Carry on into another show’s season', icon: 'tv', needs: "the other show's season set up", on: (s) => Array.isArray(s.stages) && s.stages.some((x) => x.season), sheet: 'stages' },

  // ---- The details ----
  {
    id: 'waivers', row: 'details', kinds: ['draft'], name: 'Waivers', line: 'Swaps for someone free during the season', icon: 'swap',
    fits: (s) => fitsOr(S.waiversFit(s), 'Waivers need castaways who come free'),
    on: (s) => isObj(s.extras) && isObj(s.extras.waivers) && !(s.extras.waivers.replace === 'never' && s.extras.waivers.windows && s.extras.waivers.windows.swaps === 0),
    apply: (s) => ({ ...s, extras: { ...(s.extras || {}), waivers: { ...S.NO_WAIVERS, replace: 'whenShort', windows: { ...S.NO_WAIVERS.windows, schedule: 'everyEpisode', swaps: 1 } } } }),
    off: (s) => ({ ...s, extras: { ...(s.extras || {}), waivers: { ...S.NO_WAIVERS } } }),
    controls: [
      // Settings Round 4: Manage this game's names for the feels (the stored values stay casual, balanced, competitive).
      { ...segment('feel', 'How it feels', null, S.WAIVER_FEELS.map((v) => [v, FEEL_NAMES[v] || v]), 'balanced', field('extras.waivers.feel', 'balanced')), rec: 'balanced' },
      segment('order', 'Who goes first', null, [['rolling', 'Rolling'], ['leastPoints', 'Fewest points'], ['mostPoints', 'Most points']], 'rolling', field('extras.waivers.order', 'rolling'), true),
      segment('hours', 'Claims close', null, S.WAIVER_HOURS.map((h) => [h, `${h} h before`]), 24, field('extras.waivers.hours', 24), true),
    ],
  },
  {
    id: 'room', row: 'details', kinds: ['draft'], name: 'The draft’s time', line: 'When it opens, and a clock on each pick', icon: 'clock',
    on: () => true,
    controls: [
      segment('opens', 'The draft opens', 'extras.draft.opens', [['any', 'Any time before it starts'], ['start', 'Once its start is known', "So it drafts from who's still in"]], 'any', room('opens', 'any'), true),
      segment('timer', 'A clock on each pick', null, S.DRAFT_TIMERS.map((t) => [t, t ? `${t / 60} min` : 'None']), 0, room('timer', 0)),
      segment('away', 'Someone away', null, [['wait', 'Wait for them'], ['queue', 'Use their list']], 'wait', room('away', 'wait'), true),
    ],
  },
  {
    id: 'join', row: 'details', name: 'Who can join', line: 'Anyone on the couch, they ask first, or nobody new', icon: 'door',
    on: () => true,
    controls: [segment('join', 'Joining', null, [['open', 'Anyone on the couch'], ['ask', 'They ask first'], ['locked', 'Nobody new']], 'open', field('extras.join', 'open'))],
  },
  // Lineups hidden went in Settings Round 4: the app hides others' lineups until the lock whatever extras.hideStarters says, so the
  // control did nothing (settings rule 2). A game made with it keeps the field.
];

/** Whether a game has a bet on it: a stake, a bank, a pot, a lone right answer, a parlay, a ticket, a rollover, or side bets. */
function betOn(s) {
  return asks(s).some((q) => q.wager !== undefined || q.share || q.rollover || q.answer === 'ticket') || (isObj(s.score) && (isObj(s.score.bank) || Array.isArray(s.score.parlays))) || (isObj(s.extras) && isObj(s.extras.bets));
}
/** Every bet off: stakes, banks, pots, parlays, tickets, rollovers, side bets. A question's points come back to 1 where a pot or a
 *  stake had them at 0 or 10. */
function offBets(s) {
  const out = clone(s);
  out.ask = asks(out).filter((q) => q.answer !== 'ticket').map((q) => {
    const x = { ...q };
    const was = !!(x.share || x.wager !== undefined);
    for (const k of ['wager', 'odds', 'share', 'rollover']) delete x[k];
    if (was && (x.points === 0 || x.points >= 10)) x.points = 2;
    return x;
  });
  if (isObj(out.score)) for (const k of ['bank', 'parlays']) delete out.score[k];
  if (isObj(out.extras) && isObj(out.extras.bets)) out.extras = { ...out.extras, bets: null };
  return out;
}

// ---------- a question's own settings (The questions › a question) ----------

/** The kinds of question Add a question offers, each with how it's asked and settled (the engine's TAKES), plain words first. */
const QUESTION_KINDS = [
  { id: 'out', name: 'Who goes home', answer: 'person', settle: { by: 'results', take: 'out' }, asked: 'each', points: 2, needs: 'results' },
  { id: 'winner', name: 'Who wins', answer: 'person', settle: { by: 'results', take: 'winner' }, asked: 'once', closes: 'finale', points: 5, needs: 'winner' },
  { id: 'who', name: 'Who does a moment', answer: 'person', settle: { by: 'moment', take: 'who' }, asked: 'each', points: 2, moment: true },
  { id: 'happens', name: 'Does it happen', answer: 'yesNo', settle: { by: 'moment', take: 'happened' }, asked: 'each', points: 1, moment: true },
  { id: 'count', name: 'How many', answer: 'number', settle: { by: 'moment', take: 'count' }, asked: 'each', points: 2, moment: true },
  { id: 'ou', name: 'Over or under', answer: 'overUnder', settle: { by: 'moment', take: 'count' }, asked: 'once', points: 2, moment: true, line: 6.5 },
  { id: 'most', name: 'Who does it most', answer: 'person', settle: { by: 'moment', take: 'most' }, asked: 'once', points: 5, moment: true },
  { id: 'first', name: 'Who does it first', answer: 'person', settle: { by: 'moment', take: 'first' }, asked: 'once', points: 3, moment: true },
  { id: 'group', name: 'Which tribe', answer: 'group', settle: { by: 'moment', take: 'who' }, asked: 'each', points: 1, moment: 'group', needs: 'grouped' },
  { id: 'choice', name: 'How many, from a list', answer: 'choice', settle: { by: 'moment', take: 'count' }, asked: 'each', points: 1, moment: true, options: ['0', '1', '2+'] },
  { id: 'order', name: 'The order they go', answer: 'order', settle: { by: 'results', take: 'order' }, asked: 'once', points: 2, pick: 5, within: 2, needs: 'results' },
  { id: 'confidence', name: 'Rank who goes, surest first', answer: 'confidence', settle: { by: 'results', take: 'out' }, asked: 'each', points: 1, pick: 5, needs: 'results', homes: { 'multiply.on': ['rank'] } },
  { id: 'chips', name: 'Spread chips on who wins', answer: 'chips', settle: { by: 'results', take: 'winner' }, asked: 'once', points: 1, chips: 10, needs: 'winner' },
  { id: 'split', name: 'The final vote split', answer: 'split', settle: { by: 'results', take: 'split' }, asked: 'once', points: 5, needs: 'votes' },
  { id: 'pairs', name: 'Who outlasts whom', answer: 'pairs', settle: { by: 'results', take: 'outlast' }, asked: 'once', points: 1, pairs: 5, needs: 'results' },
  { id: 'role', name: 'Who has a secret role', answer: 'person', settle: { by: 'role', take: 'end' }, asked: 'once', points: 3, needs: 'roles' },
  { id: 'phase', name: 'When a stage starts', answer: 'number', settle: { by: 'phase', take: 'starts' }, asked: 'once', points: 3, needs: 'later' },
  { id: 'leader', name: 'Who leads the points', answer: 'person', settle: { by: 'points', take: 'most' }, asked: 'once', points: 3 },
  { id: 'quote', name: 'Who says the title', answer: 'person', settle: { by: 'fact', fact: 'titleQuote', take: 'who' }, asked: 'each', points: 1, needs: 'facts' },
  { id: 'trivia', name: 'Trivia on the last episode', answer: 'trivia', settle: { by: 'trivia' }, asked: 'each', points: 1, needs: 'trivia' },
  { id: 'side', name: 'Who wins the game', answer: 'side', settle: { by: 'final', take: 'winner' }, asked: 'each', points: 1, sport: true },
  { id: 'stat', name: 'Who leads a stat', answer: 'person', settle: { by: 'stat', take: 'most' }, asked: 'each', points: 2, sport: true },
  { id: 'total', name: "The game's total", answer: 'overUnder', settle: { by: 'final', take: 'total' }, asked: 'each', points: 1, sport: true },
  { id: 'bracket', name: 'The bracket', answer: 'bracket', settle: { by: 'final', take: 'bracket' }, asked: 'once', points: 1, sport: true },
];
/** A question's own controls (its sheet under The questions): how it's asked, until when, from whom, about each, its points. */
const QUESTION_CONTROLS = [
  segment('asked', 'Asked', 'ask.asked', [['each', 'Each episode'], ['once', 'Once'], ['every', 'Every few episodes'], ['phase', 'Each stage']], 'each', { read: (q) => q.asked || 'once', write: (q, v) => ({ ...q, asked: v, ...(v === 'every' ? { every: 2 } : {}) }) }),
  segment('closes', 'Open until', 'ask.closes', [['start', 'It starts'], ['finale', 'The finale starts']], 'start', { read: (q) => q.closes || 'start', write: (q, v) => ({ ...q, closes: v }) }, true),
  chips('points', 'Worth', [[1, '1'], [2, '2'], [3, '3'], [5, '5']], { min: 0, max: S.MAX_QUESTION_POINTS }, 2, { read: (q) => q.points, write: (q, v) => ({ ...q, points: v }) }),
  stepper('pick', 'How many to name', [1, S.MAX_PICK], 1, { read: (q) => q.pick || 1, write: (q, v) => ({ ...q, pick: v }) }, true),
  segment('from', 'From', 'ask.from', [['cast', 'Everyone still in'], ['team', 'Your own team']], 'cast', { read: (q) => q.from || 'cast', write: (q, v) => ({ ...q, from: v }) }, true),
  segment('each', 'Ask it about', 'ask.each', [['person', 'Each person still in'], ['game', "Each game of the week"]], null, { read: (q) => q.each || null, write: (q, v) => ({ ...q, each: v || undefined }) }, true),
  segment('fallback', 'Unsure who is in a group', 'ask.fallback', [['void', "That week doesn't count"], ['carry-on', 'Follow the people'], ['next-stage', 'The next stage starts']], 'void', { read: (q) => q.fallback || 'void', write: (q, v) => ({ ...q, fallback: v }) }, true),
  stepper('over', 'Over the next (episodes)', [2, S.MAX_WINDOW], 3, { read: (q) => q.over || 3, write: (q, v) => ({ ...q, over: v }) }, true),
];

// ---------- reading a screen ----------

/** A row's changes for this game: each with whether it's on, whether it fits (null, or why not), and its controls' values. */
function changeStates(spec, row, pg) {
  const kind = kindOf(spec);
  return CHANGES.filter((c) => c.row === row && (!c.kinds || c.kinds.includes(kind)) && (!c.sport || (pg && pg.sport))).map((c) => {
    const on = !!(c.on && c.on(spec));
    let why = c.coming ? (c.coming === 'later' ? 'Coming' : `Coming (${c.coming})`) : null;
    if (!why && !on && c.fits) why = c.fits(spec, pg) || null;
    if (!why && !on && c.apply) {
      const v = check(c.apply(clone(spec), pg), pg);
      if (!v.ok) why = v.problems[0] || v.waits[0] || "Our check doesn't place it";
    }
    if (!why && !on && !c.apply && !c.sheet && !c.start) why = null;
    const controls = (c.controls || []).filter((k) => !k.when || (on && k.when(spec))).map((k) => ({ ...k, value: on ? k.read(spec) : k.def }));
    return { id: c.id, name: c.name, line: c.line, icon: c.icon, on, why, coming: c.coming || null, sheet: c.sheet || null, start: c.start || null, controls };
  });
}
const changeById = (id) => CHANGES.find((c) => c.id === id) || null;
/** Why computer players can't play this game yet, or null (E1a): the engine's one rule (game-spec answers.js botsWhy: a game in stages,
 *  squares, or a question they don't answer), as the tracker, Randomize's bots lock and computer-players.ts botsPlay read it. */
function botsFit(s) {
  return S.botsWhy(s);
}
/** A change made (its apply, on its defaults), as a new spec. */
function applyChange(spec, id, pg) {
  const c = changeById(id);
  if (!c || !c.apply) return spec;
  return c.apply(clone(spec), pg);
}
/** A change taken off, back to how the base had it (its off; else every change in its row back to the row's first). */
function dropChange(spec, id, pg) {
  const c = changeById(id);
  if (!c) return spec;
  if (c.off) return c.off(clone(spec), pg);
  const first = CHANGES.find((x) => x.row === c.row && x.apply);
  return first ? first.apply(clone(spec), pg) : spec;
}
/** One control set on a change that's on. */
function setControl(spec, id, controlId, value, pg) {
  const c = changeById(id);
  const k = c && (c.controls || []).find((x) => x.id === controlId);
  if (!k) return spec;
  return k.write(clone(spec), value, pg);
}
/** What a row says on the base's screen: its changes that are on, each in its own words. */
function rowLine(row, spec, pg) {
  const on = changeStates(spec, row, pg).filter((c) => c.on);
  if (!on.length) return null;
  return on.map((c) => c.name).join(' · ');
}

// ---------- the coverage table's homes ----------

/** Every VOCAB value's homes in the gallery: a change's own (its homes) and its controls' options. */
function homesOf() {
  const out = [];
  const add = (key, value, row, change, control) => out.push({ key, value, row, change, control });
  for (const c of CHANGES) {
    for (const [key, vals] of Object.entries(c.homes || {})) for (const v of vals) add(key, v, c.row, c.id, null);
    for (const k of c.controls || []) if (k.vocab) for (const [v] of k.options) add(k.vocab, String(v), c.row, c.id, k.id);
  }
  for (const k of QUESTION_CONTROLS) if (k.vocab) for (const [v] of k.options) add(k.vocab, String(v), 'play', 'addq', k.id);
  for (const q of QUESTION_KINDS) {
    add('ask.answer', q.answer, 'play', 'addq', q.id);
    add('ask.settle', q.settle.by, 'play', 'addq', q.id);
    for (const [key, vals] of Object.entries(q.homes || {})) for (const v of vals) add(key, v, 'play', 'addq', q.id);
  }
  return out;
}

// ---------- the names people call things (the bold pass's, B1: one name means one thing; docs/design-round/decisions.md 2026-11-18) ----------

/** What people call a change, read by Find a change beside its name and line. */
const CHANGE_AKA = {
  matchups: "h2h versus vs matchup duel",
  captain: "double captain star",
  knockouts: "elimination cut chop guillotine lowest out",
  standing: "lives life second chance",
  race: "first to target",
  coop: "co-op together team up",
  bank: "bankroll betting wager money",
  side: "side bets prop",
  stake: "wager stake bet",
  pot: "split share pot",
  jackpot: "rollover carry over",
  repeat: "never twice same pick again",
  second: "two picks double pick",
  cap: "salary budget price",
  market: "trade buy sell stocks",
  waivers: "pickups free agents add drop",
  keepers: "dynasty keep",
  redraft: "redraft new draft merge",
  shakeup: "redraft swap",
  traitors: "mafia werewolf secret",
  bootcall: "boot who goes home vote",
  reverse: "worst flip upside down",
  only: "big moments only some",
  what: "points scoring place",
  teams: "teams tribes sides",
  solo: "alone single player just me",
  bot: "computer ai bot",
  hidden: "secret lineups hidden",
  room: "draft time when",
  size: "how many each team size roster",
  draft: "snake order auction draft",
};
for (const c of CHANGES) c.aka = CHANGE_AKA[c.id] || '';

/** Search: a base's own words, then what fans call it (each base's `aka`); `aka` in a result is the fan's name that matched, said on
 *  its square. */
function searchKnown(q, bases) {
  const STOP = new Set(["a", "an", "the", "to", "of", "and", "or", "for", "with", "on", "in", "we", "i", "my", "our", "game", "games", "lets", "let's", "play"]);
  const words = (s) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
  const ws = words(q);
  const phrase = q.trim().toLowerCase();
  if (!ws.length) return [];
  const out = [];
  for (const b of bases) {
    const name = words(b.name).join(" ");
    const aka = (b.aka || []).map((a) => a.toLowerCase());
    const hay = [name, b.plain.toLowerCase(), b.about.toLowerCase(), ...aka].join(" ");
    let score = 0;
    let matched = null;
    for (const w of ws) {
      if (name.split(" ").includes(w)) score += 6;
      else if (aka.some((a) => a.split(/\s+/).includes(w))) {
        score += 5;
        matched = matched ?? aka.find((a) => a.split(/\s+/).includes(w)) ?? null;
      } else if (hay.includes(w)) score += 2;
    }
    if (phrase.length > 3 && (name.includes(phrase) || aka.some((a) => a.includes(phrase)))) {
      score += 12;
      if (!name.includes(phrase)) matched = aka.find((a) => a.includes(phrase)) ?? matched;
    }
    if (score) out.push({ base: b, score, aka: name.split(" ").some((w) => ws.includes(w)) ? null : matched });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

module.exports = {
  CATS, BASES, SPORT, ROWS, CHANGES, QUESTION_KINDS, QUESTION_CONTROLS,
  kindOf, expand, pageFacts, check, baseById, baseSpec, galleryFor, playRow, changeStates, changeById, applyChange, dropChange, setControl, rowLine, homesOf, betOn, offBets,
  searchKnown, botsFit,
};
