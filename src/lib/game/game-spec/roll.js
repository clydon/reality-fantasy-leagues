// Randomize (docs/PLAN-start-a-game-gpt.md step G4, "Randomize, the other door"): a game rolled from a seed, within what a page's
// show can settle, with the parts someone locked held as they are. No bot: a roll is instant, free and works when the bot is away.
// Pure, like the rest of game-spec: the same page, locks and seed make the same game on every server.
//
//   rollSpec(page, locks, seed, opts) -> { ok, seed, tries, spec, base, win, twists, length, describe, problems, waits, why }
//   weightsFrom(rows, ctxOf)          -> { bases, twists, wins }: how often the tracker's games that play use each piece
//   ROLL                              -> the bases, wins, twists and lengths a lock can name (the wizard's chips, U0)
//
// A roll is a base game (an Outlast, a lineup, best ball, a pool, a pick scored by what they do, a game of questions, bingo, the
// show's calls), a way to win, a length that fits what's left of the season and one or two twists, within a budget (each piece
// weighed: a game stays easy to read at a glance). Our check is the gate: a roll that doesn't pass `specProblems`, waits for a later
// step (`specWaitsFor`) or has no place in the scoring sequence (`typeOf`) is rolled again from the next seed, up to MAX_TRIES
// times, and then the nearest one found comes back with why (`ok: false`). Weights lean toward what the capability tracker's games
// use (`opts.weights`, from weightsFrom): pieces people ask for come up more often.
//
// `page` is { ctx, pack } (G1's: the SpecContext our check reads and the context pack, for the episodes left, the cast and the
// couch), or a SpecContext alone. `locks` (all optional): `length` ('one', 'few', 'half', 'rest', a number of episodes, 'phase' from
// the next phase, 'until-phase' to it, or a span), `play` (draft, pick, questions or card), `base` (an id of ROLL.bases), `win` (an id
// of ROLL.wins), `twists` (ids of ROLL.twists, up to two; [] for none) and `keep` (part of a spec, held over whatever's rolled: what
// someone typed, the doors mixed).
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./schema.js */
const schema = require('./schema.js');
const { describeSpec, shortSpec, lowerFirst } = require('./describe.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const { PRESETS, fullSpec, specProblems, specWaitsFor, typeOf, covers, finaleQuestions } = schema;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, min = -Infinity) => Number.isInteger(v) && v >= min;
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** How many seeds a roll tries before it gives the nearest it found. */
const MAX_TRIES = 24;
/** A roll's weight of twists and its way to win together: one or two twists, a game still easy to read at a glance. */
const BUDGET = 3;

// ---------- a seeded roll ----------

/** FNV-1a then mulberry32, as src/lib/game/seeded.ts (the same numbers from the same seed): numbers in [0, 1). */
function randomFrom(seed) {
  let a = 2166136261;
  const text = String(seed);
  for (let i = 0; i < text.length; i++) {
    a ^= text.charCodeAt(i);
    a = Math.imul(a, 16777619);
  }
  a >>>= 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The dice for one try: one of a list, one by weight, a whole number in a range, a few of a list. */
function diceOf(seed) {
  const next = randomFrom(`roll:${seed}`);
  const one = (list) => list[Math.floor(next() * list.length)];
  const weighed = (items, w) => {
    const ws = items.map((x) => Math.max(0, w(x)));
    const sum = ws.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) return null;
    let r = next() * sum;
    for (let i = 0; i < items.length; i++) {
      r -= ws[i];
      if (r < 0 && ws[i] > 0) return items[i];
    }
    return items.filter((_, i) => ws[i] > 0).pop() || null;
  };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const some = (list, n) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, Math.max(0, n));
  };
  return { next, one, weighed, int, some, chance: (p) => next() < p };
}

/** A seed's i-th try: the seed itself, then "<seed>.1", "<seed>.2", ... (never the next seed's own, so Roll again on the next
 *  number is a game of its own, not this one's retry). */
const nextSeed = (seed, i) => (i ? `${seed}.${i}` : seed);

// ---------- the page ----------

/** What a roll needs to know of the page: where a game can start, how many episodes are left, the couch, the moments research
 *  answers, the phases still to come, the groups. */
function pageOf(page) {
  const p = isObj(page) ? page : {};
  const ctx = isObj(p.ctx) ? p.ctx : isObj(p) && !p.pack ? p : {};
  const pack = isObj(p.pack) ? p.pack : null;
  const eps = pack && isObj(pack.episodes) ? pack.episodes : {};
  const total = isInt(eps.total, 1) ? eps.total : null;
  const aired = isInt(eps.aired, 0) ? eps.aired : 0;
  // A season that's aired (nothing next) plays from its start at your own pace; else from the next episode to air.
  const from = isObj(eps.next) && isInt(eps.next.number, 1) ? eps.next.number : total && aired < total ? aired + 1 : 1;
  const left = total ? Math.max(1, total - from + 1) : null;
  const starts = new Map(((pack && pack.phases) || []).filter(isObj).map((x) => [x.id, x.starts]));
  const phases = (Array.isArray(ctx.phases) ? ctx.phases : []).filter((x) => isObj(x) && x.id);
  // A phase a game can start at or end before: not the first, and not started by the episode the game starts with.
  const later = phases.slice(1).filter((x) => !(isInt(starts.get(x.id), 1) && starts.get(x.id) <= from)).map((x) => ({ id: x.id, name: x.name || x.id }));
  const all = (Array.isArray(ctx.moments) ? ctx.moments : []).filter((m) => isObj(m) && m.id && !m.off);
  const moments = all.filter((m) => !m.auto && m.answeredBy !== 'league');
  // The couch's word (research doesn't answer it): a game scored by the rulebook's points scores it 0, by our check's rule.
  const couchWord = all.filter((m) => m.answeredBy === 'league').map((m) => m.id);
  const couch = isInt(ctx.couch, 1) ? ctx.couch : pack && isObj(pack.couch) && isInt(pack.couch.people, 1) ? pack.couch.people : null;
  const pool = isInt(ctx.pool, 1) ? ctx.pool : pack && isInt(pack.stillIn, 1) ? pack.stillIn : null;
  return {
    ctx: { ...ctx, ...(couch && !isInt(ctx.couch, 1) ? { couch } : {}), ...(pool && !isInt(ctx.pool, 1) ? { pool } : {}) },
    from,
    left,
    later,
    moments,
    couchWord,
    couch,
    pool,
    results: ctx.results !== false,
    winner: ctx.winner !== false && ctx.results !== false,
    grouped: ctx.grouped !== false && !!ctx.grouped,
    votes: ctx.votes === true,
    trivia: ctx.trivia !== false,
    calls: ctx.calls === 'results' || ctx.calls === 'couch',
    sport: Array.isArray(ctx.stats) && ctx.stats.length > 0,
  };
}

// ---------- the pieces a roll is made of ----------

/** A preset's parts, whole (its get, count, score and rank, so a twist adds to them), with `over` on top. */
function presetParts(id, over = {}) {
  const p = PRESETS[id];
  const out = { preset: id, get: clone(p.get), count: clone(p.count), score: clone(p.score), rank: clone(p.rank) };
  for (const [k, v] of Object.entries(over)) out[k] = (k === 'get' || k === 'score') && isObj(v) && isObj(out[k]) ? { ...out[k], ...v } : v;
  return out;
}
/** A game scored by moments' points on the page: the rulebook's, with the couch's-word moments at 0. */
const momentPoints = (pg) => (pg.couchWord.length ? Object.fromEntries(pg.couchWord.map((id) => [id, 0])) : null);

const exclusiveFits = (pg, each) => !pg.couch || !pg.pool || covers({ pool: pg.pool, people: pg.couch, each });
const toEnd = (spec) => isObj(spec.span) && spec.span.to === null;
const draftOf = (spec) => (isObj(spec.get) && spec.get.by === 'draft' ? spec.get : null);
const byMoments = (spec) => isObj(spec.score) && spec.score.by === 'moments';
const askList = (spec) => (Array.isArray(spec.ask) ? spec.ask : []);
const eachAsks = (spec) => askList(spec).filter((q) => q.asked === 'each');
const lengthOf = (spec, pg) => {
  const sp = spec.span || {};
  if (!isInt(sp.from, 1)) return null;
  if (isInt(sp.to, 1)) return sp.to - sp.from + 1;
  return sp.to === null && pg.left ? pg.left : null;
};


/** The questions a game of questions can roll on the page: who goes home, who does one of the show's moments, whether one
 *  happens, how often one happens this season, who wins, when a phase starts. Each settled by data the show has. */
function questionBank(pg, d, spec) {
  const out = [];
  if (pg.results) out.push({ id: 'boot', ask: 'Who goes home?', answer: 'person', points: 2, asked: 'each', settle: { by: 'results', take: 'out' } });
  const ms = d.some(pg.moments, 3);
  // A moment's label inside a question: "Won the Immunity challenge" -> "won the Immunity challenge".
  if (ms[0]) out.push({ id: 'who', ask: `Who'll be the one: ${lowerFirst(ms[0].label || ms[0].id)}?`, answer: 'person', points: 2, asked: 'each', settle: { by: 'moment', moment: ms[0].id, take: 'who' } });
  if (ms[1]) out.push({ id: 'happens', ask: `Will anyone: ${lowerFirst(ms[1].label || ms[1].id)}?`, answer: 'yesNo', points: 1, asked: 'each', settle: { by: 'moment', moment: ms[1].id, take: 'happened' } });
  if (toEnd(spec) && pg.winner) out.push({ id: 'winner', ask: 'Who wins?', answer: 'person', points: 5, asked: 'once', closes: 'finale', settle: { by: 'results', take: 'winner' } });
  if (pg.later[0] && toEnd(spec)) out.push({ id: 'phase', ask: `Which episode does ${pg.later[0].name} start?`, answer: 'number', points: 3, asked: 'once', settle: { by: 'phase', phase: pg.later[0].id, take: 'starts' } });
  return out;
}

/**
 * The base games. Each: its id, what `play` it is, a prior weight (taste), whether it fits the page, how it's made (the dice and
 * the page), and how to tell it in a spec (the tracker's weights).
 */
const BASES = [
  {
    id: 'outlast', play: 'draft', weight: 3, least: 4,
    fits: (pg) => pg.results && !pg.sport,
    make: (d, pg) => {
      const each = d.one([2, 3, 3, 4]);
      const own = exclusiveFits(pg, each) && d.chance(0.7);
      return presetParts('outlast', { get: { by: 'draft', each, order: own ? 'snake' : 'blind', own: own ? 'exclusive' : 'shared' } });
    },
    seen: (s) => isObj(s.get) && s.get.by === 'draft' && isObj(s.score) && s.score.by === 'place',
  },
  {
    id: 'lineup', play: 'draft', weight: 3,
    fits: (pg) => pg.moments.length > 0,
    make: (d, pg) => {
      const each = d.int(4, 6);
      return presetParts('weekly-lineup', { get: { by: 'draft', each, order: 'blind', own: 'shared' }, count: { start: d.int(2, Math.min(3, each - 1)) }, score: { by: 'moments', points: momentPoints(pg) } });
    },
    seen: (s) => isObj(s.count) && isInt(s.count.start, 1),
  },
  {
    id: 'best-ball', play: 'draft', weight: 1.5,
    fits: (pg) => pg.moments.length > 0,
    make: (d, pg) => {
      const each = d.int(4, 6);
      return presetParts('weekly-lineup', { get: { by: 'draft', each, order: 'blind', own: 'shared' }, count: { best: d.int(2, Math.min(3, each - 1)) }, score: { by: 'moments', points: momentPoints(pg) } });
    },
    seen: (s) => isObj(s.count) && isInt(s.count.best, 1),
  },
  {
    id: 'pool', play: 'pick', weight: 2.5, least: 3,
    fits: (pg) => pg.results && !pg.sport,
    make: () => presetParts('survival-pool'),
    seen: (s) => isObj(s.score) && s.score.by === 'survive',
  },
  {
    id: 'picks', play: 'pick', weight: 1.5,
    fits: (pg) => pg.moments.length > 0,
    make: (d, pg) => ({ get: { by: 'pick', each: d.int(1, 3) }, count: { pick: true }, score: { by: 'moments', points: momentPoints(pg) }, rank: { by: 'total' } }),
    seen: (s) => isObj(s.get) && s.get.by === 'pick' && isObj(s.score) && s.score.by === 'moments',
  },
  {
    id: 'questions', play: 'questions', weight: 2.5,
    fits: (pg) => pg.results || pg.moments.length > 0,
    make: (d, pg, spec) => {
      const bank = questionBank(pg, d, spec);
      const each = bank.filter((q) => q.asked === 'each');
      const once = bank.filter((q) => q.asked === 'once');
      const n = Math.min(each.length, d.weighed([1, 2, 3], (k) => ({ 1: 2, 2: 3, 3: 1 })[k]));
      const ask = [...d.some(each, n), ...(once.length && d.chance(0.35) ? [d.one(once)] : [])];
      return { get: { by: 'none' }, score: { by: 'answers' }, rank: { by: 'total' }, ask: ask.length ? ask : bank.slice(0, 1) };
    },
    seen: (s) => isObj(s.get) && s.get.by === 'none' && isObj(s.score) && s.score.by === 'answers' && !askList(s).some((q) => q.answer === 'calls'),
  },
  {
    id: 'bingo', play: 'card', weight: 1,
    fits: (pg) => !pg.sport,
    make: () => presetParts('weekly-bingo'),
    seen: (s) => isObj(s.get) && s.get.by === 'card',
  },
  {
    id: 'calls', play: 'questions', weight: 0.75,
    fits: (pg) => pg.calls && !pg.sport,
    make: () => presetParts('weekly-calls', { ask: clone(PRESETS['weekly-calls'].ask) }),
    seen: (s) => askList(s).some((q) => q.answer === 'calls'),
  },
];

/** The ways to win. Each: its id, its weight in the budget, the bases it goes with, how it's applied. */
const WINS = [
  { id: 'total', cost: 0, weight: 6, fits: (b) => b.id !== 'pool' && b.id !== 'calls' && b.id !== 'bingo', apply: (s) => ({ ...s, rank: { ...(s.rank || {}), by: 'total' } }), seen: (s) => isObj(s.rank) && s.rank.by === 'total' && !s.rank.race && !(isObj(s.score) && s.score.by === 'survive') },
  // A base whose own way to win is its preset's (a pool's streak, bingo's and the calls' most).
  { id: 'own', cost: 0, weight: 6, fits: (b) => b.id === 'pool' || b.id === 'calls' || b.id === 'bingo', apply: (s) => s, seen: () => false },
  { id: 'points', cost: 0, weight: 1.5, fits: (b) => b.id === 'pool', apply: (s) => ({ ...s, rank: { by: 'total' } }), seen: (s) => isObj(s.score) && s.score.by === 'survive' && isObj(s.rank) && s.rank.by === 'total' },
  {
    id: 'standing', cost: 1, weight: 2,
    fits: (b, pg) => ['outlast', 'lineup', 'best-ball', 'pool', 'questions'].includes(b.id) && (b.id === 'pool' || !pg.couch || pg.couch >= 3),
    apply: (s, d, pg) => {
      if (s.score && s.score.by === 'survive') return { ...s, score: { ...(s.score || { by: 'survive' }), lives: d.int(1, 3) }, rank: { by: 'standing' } };
      if (s.score && s.score.by === 'answers') return { ...s, score: { ...s.score, lives: d.int(2, 3) }, rank: { by: 'standing' } };
      const len = lengthOf(s, pg) || 8;
      const every = Math.max(1, Math.min(3, Math.floor(len / Math.max(2, (pg.couch || 4) - 1))));
      return { ...s, rank: { by: 'standing', cut: [{ at: { every }, out: 1 }] } };
    },
    seen: (s) => isObj(s.rank) && s.rank.by === 'standing',
  },
  {
    id: 'matchups', cost: 1, weight: 2,
    fits: (b, pg) => ['outlast', 'lineup', 'best-ball', 'picks', 'questions', 'pool'].includes(b.id) && (!pg.couch || pg.couch >= 2),
    apply: (s, d, pg) => {
      const len = lengthOf(s, pg);
      const playoffs = len && len >= 6 && (!pg.couch || pg.couch >= 4) && d.chance(0.5) ? { teams: pg.couch && pg.couch < 6 ? 2 : 4 } : null;
      return { ...s, rank: { by: 'matchups', ...(playoffs ? { playoffs } : {}) } };
    },
    seen: (s) => isObj(s.rank) && s.rank.by === 'matchups',
  },
  {
    id: 'weeks', cost: 1, weight: 1.5,
    fits: (b) => ['lineup', 'best-ball', 'picks', 'questions', 'pool'].includes(b.id),
    apply: (s) => ({ ...s, rank: { by: 'weeks' } }),
    seen: (s) => isObj(s.rank) && s.rank.by === 'weeks',
  },
  {
    id: 'coop', cost: 1, weight: 0.75,
    fits: (b) => b.id === 'questions',
    apply: (s, d) => ({ ...s, score: { ...s.score, lives: d.int(3, 5) }, rank: { by: 'coop' } }),
    seen: (s) => isObj(s.rank) && s.rank.by === 'coop',
  },
  {
    id: 'race', cost: 1, weight: 1,
    fits: (b) => ['lineup', 'best-ball', 'questions'].includes(b.id),
    apply: (s, d, pg) => {
      // About halfway through what a good player scores over the game: a lineup's starters score a few points an episode, a
      // game of questions its right answers' points.
      const len = lengthOf(s, pg) || 10;
      const per = s.score && s.score.by === 'answers' ? Math.max(1, askList(s).filter((q) => q.asked === 'each').reduce((a, q) => a + (q.points || 1), 0) / 2) : 3 * ((s.count && (s.count.start || s.count.best)) || 3);
      const to = Math.max(5, Math.min(1000, Math.round((per * len * 0.6) / 5) * 5));
      return { ...s, rank: { by: 'total', race: { to } } };
    },
    seen: (s) => isObj(s.rank) && isObj(s.rank.race),
  },
];

const inParlay = (s, q) => isObj(s.score) && Array.isArray(s.score.parlays) && s.score.parlays.some((p) => Array.isArray(p.of) && p.of.includes(q.id));
const cutsOrRace = (s) => isObj(s.rank) && (Array.isArray(s.rank.cut) || isObj(s.rank.race));
const winIs = (s, ...by) => isObj(s.rank) && by.includes(s.rank.by);
const hasStages = (s) => Array.isArray(s.stages);

/**
 * The twists. Each: its id, its weight in the budget, a prior weight (taste), whether it goes on this spec on this page, how it's
 * applied (a copy) and how to tell it in a spec (the tracker's weights). `stage: false`: it can't go in a stage.
 */
const TWISTS = [
  // ---- a draft's ----
  { id: 'captain', cost: 1, weight: 3, fits: (s) => !!(s.count && s.count.start), apply: (s, d) => ({ ...s, score: { ...s.score, captain: { times: d.one([2, 2, 3]) } } }), seen: (s) => isObj(s.score) && isObj(s.score.captain) },
  { id: 'finale-double', cost: 1, weight: 2, family: 'times', fits: (s, pg) => byMoments(s) && toEnd(s) && pg.results, apply: (s, d) => ({ ...s, score: { ...s.score, times: [...((s.score && s.score.times) || []), { times: d.one([2, 2, 3]), finale: true }] } }), seen: (s) => isObj(s.score) && Array.isArray(s.score.times) && s.score.times.some((t) => t && t.finale) },
  { id: 'first-double', cost: 1, weight: 1, family: 'times', fits: (s, pg) => byMoments(s) && (lengthOf(s, pg) || 0) >= 3, apply: (s) => ({ ...s, score: { ...s.score, times: [...((s.score && s.score.times) || []), { times: 2, episode: s.span.from }] } }), seen: (s) => isObj(s.score) && Array.isArray(s.score.times) && s.score.times.some((t) => t && isInt(t.episode)) },
  { id: 'reverse', cost: 1, weight: 1.5, fits: (s) => isObj(s.score) && s.score.by === 'place' && !s.score.multiply, apply: (s) => ({ ...s, score: { ...s.score, reverse: true } }), seen: (s) => isObj(s.score) && s.score.reverse === true },
  { id: 'draw', cost: 1, weight: 1, family: 'order', fits: (s) => !!draftOf(s) && !draftOf(s).budget, apply: (s) => ({ ...s, get: { ...s.get, order: 'draw' } }), seen: (s) => isObj(s.get) && s.get.order === 'draw' },
  {
    id: 'auction', cost: 2, weight: 1, family: 'order',
    fits: (s, pg) => !!draftOf(s) && s.get.own === 'exclusive' && isObj(s.score) && s.score.by === 'place' && exclusiveFits(pg, s.get.each),
    apply: (s) => ({ ...s, get: { ...s.get, order: 'auction', budget: { total: 100, floor: 1 } } }),
    seen: (s) => isObj(s.get) && s.get.order === 'auction',
  },
  {
    id: 'finale-picks', cost: 1, weight: 2,
    fits: (s, pg) => !!draftOf(s) && toEnd(s) && pg.winner && !cutsOrRace(s) && !askList(s).length,
    apply: (s, d) => ({ ...s, ask: finaleQuestions({ top3: 1, winner: d.one([3, 3, 5]), from: 'any' }) }),
    seen: (s) => askList(s).some((q) => q.id === 'top3' || (q.settle && q.settle.take === 'winner')) && !!draftOf(s),
  },
  {
    id: 'boot-call', cost: 1, weight: 1.5,
    fits: (s, pg) => !!draftOf(s) && pg.results && !cutsOrRace(s) && !askList(s).some((q) => q.id === 'boot'),
    apply: (s) => ({ ...s, ask: [...askList(s), { id: 'boot', ask: 'Who goes home?', answer: 'person', points: 2, asked: 'each', settle: { by: 'results', take: 'out' } }] }),
    seen: (s) => !!draftOf(s) && askList(s).some((q) => q.asked === 'each'),
  },
  {
    id: 'bounty', cost: 2, weight: 1.5,
    fits: (s, pg) => !!draftOf(s) && pg.votes && isObj(s.score) && ['place', 'moments'].includes(s.score.by) && !(isObj(s.rank) && Array.isArray(s.rank.cut)) && !draftOf(s).budget,
    apply: (s, d) => ({ ...s, score: { ...s.score, bounty: { points: d.one([1, 2, 2, 3]) } } }),
    seen: (s) => isObj(s.score) && isObj(s.score.bounty),
  },
  {
    id: 'roles', cost: 2, weight: 1, stage: false,
    fits: (s, pg) => !!draftOf(s) && pg.results && isObj(s.score) && ['place', 'moments'].includes(s.score.by) && !cutsOrRace(s) && !winIs(s, 'matchups', 'weeks') && (!pg.couch || pg.couch >= 3) && !draftOf(s).budget,
    apply: (s, d, pg) => ({ ...s, score: { ...s.score, roles: { count: pg.couch && pg.couch >= 6 && d.chance(0.5) ? 2 : 1, points: d.one([1, 2, 2]), on: pg.votes && d.chance(0.5) ? 'votedOut' : 'out' } } }),
    seen: (s) => isObj(s.score) && isObj(s.score.roles),
  },
  {
    id: 'top-twist', cost: 2, weight: 1, stage: false,
    fits: (s, pg) => byMoments(s) && !cutsOrRace(s) && (!pg.couch || pg.couch >= 2) && (lengthOf(s, pg) || 2) >= 2,
    apply: (s) => ({ ...s, score: { ...s.score, twist: { of: [{ id: 'double', name: 'Double points', times: 2 }, { id: 'half', name: 'Half points', times: 0.5 }] } } }),
    seen: (s) => isObj(s.score) && isObj(s.score.twist),
  },
  {
    id: 'only', cost: 1, weight: 1.5, family: 'only',
    fits: (s, pg) => byMoments(s) && pg.moments.length >= 3 && !s.card,
    apply: (s, d, pg) => ({ ...s, score: { ...s.score, only: d.some(pg.moments, d.int(3, Math.min(6, pg.moments.length))).map((m) => m.id), ...(d.chance(0.4) && !(s.get && s.get.groups) ? { hits: 'pick' } : {}) } }),
    seen: (s) => isObj(s.score) && Array.isArray(s.score.only),
  },
  {
    id: 'objectives', cost: 2, weight: 1.5, family: 'only',
    fits: (s, pg) => isObj(s.get) && s.get.by === 'pick' && byMoments(s) && pg.moments.length >= 4 && !(s.score && s.score.only),
    apply: (s, d, pg) => {
      const of = d.some(pg.moments, Math.min(10, pg.moments.length)).map((m) => m.id);
      return { ...s, score: { ...s.score, only: 'card', hits: 'pick' }, card: { from: 'moments', each: Math.min(of.length, d.int(3, 5)), of } };
    },
    seen: (s) => isObj(s.score) && s.score.only === 'card',
  },
  {
    id: 'group-slot', cost: 2, weight: 1,
    fits: (s, pg) => !!draftOf(s) && byMoments(s) && pg.grouped && !draftOf(s).budget && !(s.score && s.score.hits),
    apply: (s) => ({ ...s, get: { ...s.get, groups: { slots: 1 } } }),
    seen: (s) => isObj(s.get) && isObj(s.get.groups),
  },
  {
    id: 'spread', cost: 1, weight: 1,
    fits: (s, pg) => !!draftOf(s) && pg.grouped && !draftOf(s).budget && s.get.order !== 'auction',
    apply: (s) => ({ ...s, get: { ...s.get, across: { of: 'group', then: 'keep' } } }),
    seen: (s) => isObj(s.get) && isObj(s.get.across),
  },
  {
    id: 'replacements', cost: 2, weight: 1,
    fits: (s, pg) => !!draftOf(s) && s.get.own === 'exclusive' && isObj(s.score) && s.score.by === 'place' && !s.score.reverse && !draftOf(s).budget && pg.results,
    apply: (s, d) => ({
      ...s,
      score: { ...s.score, multiply: [{ joined: 'replacement', times: d.one([[0.5], [0.5, 0.25]]) }] },
      extras: { ...(s.extras || {}), waivers: { feel: 'balanced', replace: 'always', short: null, windows: { schedule: 'manual', every: 3, swaps: 0 }, order: 'rolling', hours: 24, freeAgency: true, autoFill: true, own: { replace: 'shared' } } },
    }),
    seen: (s) => isObj(s.score) && Array.isArray(s.score.multiply),
  },
  // ---- a pool's ----
  { id: 'mulligan', cost: 1, weight: 1.5, fits: (s) => isObj(s.score) && s.score.by === 'survive' && !s.score.mulligans && !winIs(s, 'total', 'matchups', 'weeks'), apply: (s) => ({ ...s, score: { ...s.score, mulligans: 1 } }), seen: (s) => isObj(s.score) && isInt(s.score.mulligans, 1) },
  { id: 'second-pick', cost: 1, weight: 1, fits: (s) => isObj(s.score) && s.score.by === 'survive', apply: (s, d) => ({ ...s, get: { ...(s.get || { by: 'pick', each: 1, repeat: 'cycle' }), second: { fallback: d.one(['void', 'counts']) } } }), seen: (s) => isObj(s.get) && isObj(s.get.second) },
  {
    id: 'never-twice', cost: 1, weight: 1,
    fits: (s) => isObj(s.score) && s.score.by === 'survive' && !(s.get && s.get.second),
    apply: (s, d) => ({ ...s, get: { ...(s.get || { by: 'pick', each: 1 }), repeat: 'never', fallback: d.one(['miss', 'skip']) } }),
    seen: (s) => isObj(s.get) && s.get.repeat === 'never',
  },
  {
    id: 'buyback', cost: 1, weight: 1,
    fits: (s) => isObj(s.score) && s.score.by === 'survive' && isInt(s.score.lives, 1),
    apply: (s, d) => ({ ...s, score: { ...s.score, buyback: { times: 1, before: null, cost: d.one([0, 2, 3]) } } }),
    seen: (s) => isObj(s.score) && isObj(s.score.buyback),
  },
  // ---- a game of questions' ----
  {
    id: 'split-pot', cost: 1, weight: 1.5, family: 'share',
    fits: (s) => s.score && s.score.by === 'answers' && eachAsks(s).some((q) => !q.share && !q.wager && q.answer !== 'calls' && !inParlay(s, q)),
    apply: (s) => {
      const i = askList(s).findIndex((q) => q.asked === 'each' && !q.share && !q.wager && !inParlay(s, q));
      return { ...s, ask: askList(s).map((q, j) => (j === i ? { ...q, points: 10, share: 'split' } : q)) };
    },
    seen: (s) => askList(s).some((q) => q.share === 'split'),
  },
  {
    id: 'only-right', cost: 1, weight: 1, family: 'share',
    fits: (s) => s.score && s.score.by === 'answers' && eachAsks(s).some((q) => q.answer === 'person' && !q.share && !q.wager),
    apply: (s) => {
      const i = askList(s).findIndex((q) => q.asked === 'each' && q.answer === 'person' && !q.share && !q.wager);
      return { ...s, ask: askList(s).map((q, j) => (j === i ? { ...q, points: 5, share: 'only' } : q)) };
    },
    seen: (s) => askList(s).some((q) => q.share === 'only'),
  },
  {
    id: 'rollover', cost: 1, weight: 1,
    fits: (s) => s.score && s.score.by === 'answers' && eachAsks(s).some((q) => !q.rollover && !q.share && q.answer !== 'calls'),
    apply: (s) => {
      const i = askList(s).findIndex((q) => q.asked === 'each' && !q.rollover && !q.share);
      return { ...s, ask: askList(s).map((q, j) => (j === i ? { ...q, points: Math.max(3, q.points || 1), rollover: true } : q)) };
    },
    seen: (s) => askList(s).some((q) => q.rollover === true),
  },
  {
    id: 'double-or-nothing', cost: 1, weight: 1.5, family: 'stake',
    fits: (s) => s.score && s.score.by === 'answers' && !s.score.bank && eachAsks(s).some((q) => q.answer === 'yesNo' && !q.wager && !q.beat),
    apply: (s, d) => {
      const i = askList(s).findIndex((q) => q.asked === 'each' && q.answer === 'yesNo' && !q.wager && !q.beat);
      return { ...s, ask: askList(s).map((q, j) => (j === i ? { ...q, wager: d.one([3, 5, 5, 10]) } : q)) };
    },
    seen: (s) => askList(s).some((q) => isInt(q.wager, 1)),
  },
  {
    id: 'bank', cost: 2, weight: 1, family: 'stake',
    fits: (s) => s.score && s.score.by === 'answers' && !s.score.lives && winIs(s, 'total') && !isObj(s.rank && s.rank.race) && eachAsks(s).some((q) => !q.beat && !q.share && !q.rollover && q.answer !== 'calls'),
    apply: (s, d) => ({ ...s, score: { ...s.score, bank: { start: d.one([100, 100, 500]) } }, ask: askList(s).map((q) => (q.asked === 'each' && !q.beat && !q.share && !q.rollover ? { ...q, wager: 'total' } : q)) }),
    seen: (s) => isObj(s.score) && isObj(s.score.bank),
  },
  {
    id: 'parlay', cost: 2, weight: 1,
    fits: (s) => s.score && s.score.by === 'answers' && eachAsks(s).filter((q) => !q.share && q.answer !== 'calls').length >= 2,
    apply: (s, d) => ({ ...s, score: { ...s.score, parlays: [{ of: eachAsks(s).filter((q) => !q.share).slice(0, 2).map((q) => q.id), times: d.one([2, 3]) }] } }),
    seen: (s) => isObj(s.score) && Array.isArray(s.score.parlays),
  },
  {
    id: 'beat-bot', cost: 1, weight: 1,
    fits: (s) => s.score && s.score.by === 'answers' && eachAsks(s).some((q) => !q.wager && ['person', 'yesNo', 'number'].includes(q.answer) && q.settle && q.settle.by !== 'players'),
    apply: (s) => {
      const i = askList(s).findIndex((q) => q.asked === 'each' && !q.wager && ['person', 'yesNo', 'number'].includes(q.answer) && q.settle && q.settle.by !== 'players');
      return { ...s, ask: askList(s).map((q, j) => (j === i ? { ...q, beat: { by: 'bot' } } : q)) };
    },
    seen: (s) => askList(s).some((q) => isObj(q.beat)),
  },
  {
    id: 'majority', cost: 1, weight: 1,
    fits: (s) => s.score && s.score.by === 'answers' && askList(s).some((q) => q.id === 'boot') && askList(s).length < 4,
    apply: (s) => ({ ...s, ask: [...askList(s), { id: 'most', ask: 'Who will most of us say goes home?', answer: 'person', points: 2, asked: 'each', settle: { by: 'players', take: 'majority', of: 'boot' } }] }),
    seen: (s) => askList(s).some((q) => q.settle && q.settle.by === 'players'),
  },
  // ---- anyone's ----
  {
    id: 'teams', cost: 1, weight: 0.5,
    fits: (s, pg) => (!pg.couch || pg.couch >= 4) && !askList(s).some((q) => q.answer === 'calls') && ((!!draftOf(s) && winIs(s, 'total', 'matchups')) || (s.score && s.score.by === 'answers' && winIs(s, 'total', 'matchups') && !s.score.bank) || (s.score && s.score.by === 'survive' && winIs(s, 'total'))) && !(s.rank && s.rank.race),
    apply: (s) => {
      // Two teams of players can't fill a bracket of four: head to head between them is the whole game.
      const rank = { ...(s.rank || {}), teams: { of: 2 } };
      delete rank.playoffs;
      return { ...s, rank };
    },
    seen: (s) => isObj(s.rank) && isObj(s.rank.teams),
  },
  // ---- one game becoming two ----
  {
    id: 'redraft', cost: 2, weight: 1, wraps: true,
    fits: (s, pg) => !!draftOf(s) && toEnd(s) && isInt(s.span.from, 1) && !askList(s).some((q) => q.asked === 'once') && (pg.later.length > 0 || pg.grouped),
    apply: (s, d, pg) => {
      const { span, ...game } = s;
      if (pg.later.length) {
        const ph = pg.later[0];
        return { stages: [{ id: 'before', name: `Before ${ph.name}`.slice(0, 40), game: { ...game, span: { from: span.from } } }, { id: 'after', name: ph.name.slice(0, 40), game: { ...clone(game), span: { from: { phase: ph.id } } } }], overall: { by: 'points' } };
      }
      return { stages: [{ id: 'draft', name: 'Draft', game: { ...game, span: { from: span.from } } }, { id: 'redraft', name: 'New draft', on: { again: true }, game: clone(game) }] };
    },
    seen: (s) => hasStages(s) && s.stages.length === 2 && s.stages.every((x) => x && x.game && x.game.get && x.game.get.by === 'draft'),
  },
  {
    id: 'trivia-too', cost: 1, weight: 0.75, wraps: true,
    fits: (s, pg) => pg.trivia && isObj(s.get) && s.get.by === 'card',
    apply: (s) => {
      const { span, ...game } = s;
      return { stages: [{ id: 'bingo', name: 'Bingo', game: { ...game, span: { from: span.from, to: span.to } } }, { id: 'trivia', name: 'Trivia', alongside: true, game: { get: { by: 'none' }, score: { by: 'answers' }, rank: { by: 'total' }, span: { from: span.from, to: span.to }, ask: [{ id: 'trivia', ask: 'Trivia about the episode before', answer: 'trivia', points: 1, asked: 'each', settle: { by: 'trivia' } }] } }], overall: { by: 'points' } };
    },
    seen: (s) => hasStages(s) && s.stages.some((x) => x && x.alongside),
  },
];

/** The lengths a game can roll: one episode, a few, half what's left, the rest of the season, from a phase or until it. */
const LENGTHS = [
  { id: 'rest', weight: 5, fits: () => true, span: (pg) => ({ from: pg.from, to: null }) },
  { id: 'one', weight: 1, fits: (pg) => !pg.left || pg.left >= 1, span: (pg) => ({ from: pg.from, to: pg.from }) },
  { id: 'few', weight: 2, fits: (pg) => !pg.left || pg.left >= 3, span: (pg, d) => ({ from: pg.from, to: pg.from + d.int(2, Math.min(4, (pg.left || 5) - 1)) - 1 }) },
  { id: 'half', weight: 1.5, fits: (pg) => !!pg.left && pg.left >= 6, span: (pg) => ({ from: pg.from, to: pg.from + Math.ceil(pg.left / 2) - 1 }) },
  { id: 'phase', weight: 1, fits: (pg) => pg.later.length > 0, span: (pg) => ({ from: { phase: pg.later[0].id }, to: null }) },
  { id: 'until-phase', weight: 0.75, fits: (pg) => pg.later.length > 0, span: (pg) => ({ from: pg.from, to: { phase: pg.later[0].id } }) },
];

/** A length a lock names, as a span on the page: a LENGTHS id, a number of episodes, or a span itself. */
function lockedSpan(lock, pg, d) {
  if (isObj(lock)) return clone(lock);
  if (isInt(lock, 1)) return { from: pg.from, to: lock === 1 ? pg.from : pg.from + Math.min(lock, pg.left || lock) - 1 };
  // A length the page can't have (from a phase on a show with none still to come, half of a season whose length isn't known) is
  // nothing to roll: the locks fit nothing.
  const l = LENGTHS.find((x) => x.id === lock);
  return l && l.fits(pg) ? l.span(pg, d) : null;
}

// ---------- the tracker's weights ----------

/**
 * How often the tracker's games that play use each base, way to win and twist: { bases, twists, wins }, each id -> a count. `rows`:
 * capabilities.js rowsOf(tracker); `ctxOf(row)`: the row's page's ctx (capability-rows.ts pageCtx), so a row counts only where it
 * plays. A roll's weight for a piece is its taste times (1 + the square root of its count): what people ask for comes up more, and
 * nothing is shut out.
 */
function weightsFrom(rows, ctxOf) {
  const out = { bases: {}, twists: {}, wins: {} };
  const bump = (o, id) => (o[id] = (o[id] || 0) + 1);
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !isObj(r.spec)) continue;
    const ctx = typeof ctxOf === 'function' ? ctxOf(r) : null;
    if (specProblems(r.spec, ctx).length || specWaitsFor(r.spec).length) continue;
    // Each piece once a row, wherever in it (a game in stages: the whole, or any of its stages).
    const whole = fullSpec(r.spec);
    const parts = [whole, ...(hasStages(r.spec) ? r.spec.stages.map((x) => x && x.game).filter(isObj).map(fullSpec) : [])];
    for (const b of BASES) if (parts.some((s) => b.seen(s))) bump(out.bases, b.id);
    for (const w of WINS) if (parts.some((s) => w.seen(s))) bump(out.wins, w.id);
    for (const t of TWISTS) if (parts.some((s) => t.seen(s))) bump(out.twists, t.id);
  }
  return out;
}

const tasteTimes = (count) => 1 + Math.sqrt(Math.max(0, count || 0));

// ---------- the roll ----------

/** A deep merge of `keep` over `spec`: what someone said wins, arrays as they said them. */
function kept(spec, keep) {
  if (!isObj(keep)) return spec;
  const out = clone(spec);
  for (const [k, v] of Object.entries(keep)) out[k] = isObj(v) && isObj(out[k]) ? kept(out[k], v) : clone(v);
  return out;
}

/** The verdict our check gives a spec on the page: what's wrong, what waits, and whether it plays; and, once it plays, whether its
 *  short form shows every piece (taste: a roll is easy to read at a glance, so one whose line leaves a piece out is
 *  rolled again, though it's nearer than one that doesn't play). */
function verdictOf(spec, ctx) {
  const problems = specProblems(spec, ctx);
  const waits = problems.length ? [] : specWaitsFor(spec);
  const plays = !problems.length && !waits.length && !!typeOf(spec);
  const busy = plays && shortSpec(spec, ctx).more > 0;
  return { problems, waits, plays, busy, misses: plays ? (busy ? 0.5 : 0) : problems.length + waits.length + (problems.length || waits.length ? 0 : 1) };
}

/** Whether the locked twists can go on a base, as far as its game alone says (before a way to win or another twist): so a lock of a
 *  captain rolls a lineup, not a pool. A probe with dice of its own, so the roll's dice stay as they were. */
function twistsGoOn(b, locked, pg, d, span) {
  if (!locked || !locked.length) return true;
  const probe = { ...b.make(diceOf('probe'), pg, { span: span || { from: pg.from, to: null } }), span: span || { from: pg.from, to: null } };
  return locked.every((t) => t.fits(probe, pg));
}

/** Whether a way to win is the one a lock names: a pool's own is its streak, bingo's and the calls' their most; a pool by its
 *  points is its total. */
function winMatches(id, lock, base) {
  if (id === lock) return true;
  if (id === 'own') return lock === (base.id === 'pool' ? 'streak' : 'total');
  return id === 'points' && lock === 'total';
}

/** One try at a game from one seed: the pieces chosen, the spec made, nothing checked. Null when the locks leave nothing to roll. */
function tryRoll(pg, locks, seed, weights, most = 2) {
  const d = diceOf(seed);
  const w = isObj(weights) ? weights : {};
  // A length someone locked rules out a base that needs longer (an Outlast of one episode is one boot), unless the base is locked too.
  const lockedLen = locks.length !== undefined ? lockedSpan(locks.length, pg, d) : null;
  if (locks.length !== undefined && !lockedLen) return null;
  const short = lockedLen ? lengthOf({ span: lockedLen }, pg) : null;
  const locked = Array.isArray(locks.twists) ? locks.twists.map((id) => TWISTS.find((t) => t.id === id)).filter(Boolean) : null;
  const room = short || pg.left;
  const bases = BASES.filter((b) => b.fits(pg) && (!locks.base || b.id === locks.base) && (!locks.play || b.play === locks.play) && (locks.base || !room || !b.least || room >= b.least) && (!locks.win || WINS.some((x) => x.fits(b, pg) && winMatches(x.id, locks.win, b))) && (locks.base || twistsGoOn(b, locked, pg, d, lockedLen)));
  const base = d.weighed(bases, (b) => b.weight * tasteTimes((w.bases || {})[b.id]));
  if (!base) return null;
  // The length next: some pieces need a game that runs to the end, or a few episodes; a base its least.
  const lengths = LENGTHS.filter((l) => l.fits(pg) && !(base.least && (l.id === 'one' || (l.id === 'few' && pg.left !== null && pg.left < base.least))));
  let chosenLength = null;
  const span = lockedLen || (() => {
    const l = d.weighed(lengths, (x) => x.weight);
    chosenLength = l ? l.id : null;
    const sp = l ? l.span(pg, d) : null;
    // A few episodes, at least the base's least.
    if (sp && l.id === 'few' && base.least && isInt(sp.to, 1) && sp.to - sp.from + 1 < base.least) sp.to = sp.from + base.least - 1;
    return sp;
  })();
  if (!span) return null;
  // The length as a lock names it: a LENGTHS id, a number of episodes, or a span someone gave.
  const length = locks.length !== undefined ? (isObj(locks.length) ? 'span' : locks.length) : chosenLength;
  let spec = { ...base.make(d, pg, { span }), span };
  // How you win, within the budget.
  const wins = WINS.filter((x) => x.fits(base, pg) && (!locks.win || winMatches(x.id, locks.win, base)));
  const win = d.weighed(wins, (x) => x.weight * tasteTimes((w.wins || {})[x.id]));
  if (!win) return null;
  spec = win.apply(spec, d, pg);
  // The twists: the locked ones, then one or two in all, as the budget allows.
  let budget = BUDGET - win.cost;
  const chosen = [];
  const add = (t) => {
    spec = t.apply(spec, d, pg);
    budget -= t.cost;
    chosen.push(t.id);
  };
  // A twist that makes stages goes last: the rest are the game's own, inside each stage.
  for (const t of (locked || []).filter((x) => !x.wraps)) add(t);
  if (!locked) {
    const want = Math.min(most, d.weighed([1, 2], (k) => (k === 1 ? 3 : 2)));
    while (chosen.length < want) {
      const families = chosen.map((id) => TWISTS.find((x) => x.id === id).family).filter(Boolean);
      const open = TWISTS.filter((t) => !chosen.includes(t.id) && !(t.family && families.includes(t.family)) && t.cost <= budget && t.fits(spec, pg) && !(t.wraps && chosen.some((id) => TWISTS.find((x) => x.id === id).stage === false)));
      const t = d.weighed(open, (x) => x.weight * tasteTimes((w.twists || {})[x.id]));
      if (!t) break;
      add(t);
      if (t.wraps) break;
    }
  }
  for (const t of (locked || []).filter((x) => x.wraps)) add(t);
  spec = kept(spec, locks.keep);
  return { spec, base: base.id, win: win.id, twists: chosen, length };
}

/**
 * A game rolled from `seed` on `page`, `locks` held. Tries the seed, then its next tries ("<seed>.1", "<seed>.2", ...), up to
 * MAX_TRIES, and gives the first that our check passes, with the seed it came from (so a shared roll is
 * that seed, and Back is the last one). None passing: the nearest found (fewest problems), `ok: false`, with why.
 * `opts.weights`: weightsFrom's, toward what the tracker's games use.
 */
function rollSpec(page, locks, seed, opts = {}) {
  const pg = pageOf(page);
  const l = isObj(locks) ? locks : {};
  const start = seed === undefined || seed === null ? 1 : seed;
  const tries = isInt(opts.tries, 1) ? opts.tries : MAX_TRIES;
  let nearest = null;
  for (let i = 0; i < tries; i++) {
    const s = nextSeed(start, i);
    // A roll whose short form can't show every piece goes again with a twist fewer (the same dice), before the next try.
    for (let most = 2; most >= 0; most--) {
      const r = tryRoll(pg, l, s, opts.weights, most);
      if (!r) break;
      const v = verdictOf(r.spec, pg.ctx);
      if (v.plays && !v.busy) return { ok: true, seed: s, tries: i + 1, ...r, describe: describeSpec(r.spec, pg.ctx), problems: [], waits: [], why: null };
      if (!nearest || v.misses < nearest.v.misses) nearest = { s, i, r, v };
      if (!v.busy || Array.isArray(l.twists) || r.twists.length < most) break;
    }
  }
  // Every try played but said too much at a glance: the nearest of them plays, so it's a game. Its seed is the one rolled (the same
  // tries again give it), not its try's, whose own next tries would find another.
  if (nearest && nearest.v.plays) return { ok: true, seed: start, tries, ...nearest.r, describe: describeSpec(nearest.r.spec, pg.ctx), problems: [], waits: [], why: null };
  if (!nearest) return { ok: false, seed: start, tries, spec: null, base: null, win: null, twists: [], length: null, describe: null, problems: [], waits: [], why: 'Nothing fits those locks on this show: unlock one and roll again' };
  const { s, r, v } = nearest;
  const first = v.problems[0] || v.waits[0];
  return { ok: false, seed: s, tries, ...r, describe: null, problems: v.problems, waits: v.waits, why: first ? first.problem : 'No game plays this way yet' };
}

/** The pieces a lock can name: the wizard's chips (U0). */
const ROLL = {
  bases: BASES.map((b) => ({ id: b.id, play: b.play })),
  wins: ['total', 'streak', 'standing', 'matchups', 'weeks', 'coop', 'race'],
  twists: TWISTS.map((t) => ({ id: t.id, cost: t.cost })),
  lengths: LENGTHS.map((x) => x.id),
  plays: ['draft', 'pick', 'questions', 'card'],
  budget: BUDGET,
  tries: MAX_TRIES,
};

module.exports = { rollSpec, weightsFrom, ROLL, MAX_TRIES, ROLL_BUDGET: BUDGET };
