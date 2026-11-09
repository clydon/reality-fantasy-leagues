// Our check (docs/PLAN-start-a-game-gpt.md step G1, "Our check"): the bot's draft to a game spec. The draft is never trusted: the
// validator (game-spec specProblems, specWaitsFor) decides what's a game, ids come only from the context pack, a number only from
// their words (or listed as assumed), and defaults are ours. Whatever doesn't hold becomes a question for the wizard (with the
// nearest choice that plays) or a can't-yet, never a silent fix: every change our check makes is listed, in `fixed`, `dropped`
// and the questions. So the same words make the same game, and the bot's mistakes become questions, not games. Pure.
//
//   checkDraft(draft, { ctx, pack, words, kind, carry }) -> { state, spec, describe, said, assumed, ask, cantYet, newMoments, fixed,
//                                                    dropped, offers, problems, waits }
//   withMoments(result, ratings, { bar })         -> the result with the reliability ask's answers folded in
//   numbersIn(text)                               -> the numbers some words say (digits, number words, double, half, ...)
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ../game-spec/schema.js */
const schema = require('../game-spec/schema.js');
const { describeSpec } = require('../game-spec/describe.js');
const { WORDS, plays } = require('./manual.js');
const { SPEC_PARTS } = require('./read.js');
const { statKeyIn } = require('./pack.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const { VOCAB, PRESETS, PRESET_LABELS, fullSpec, specProblems, specWaitsFor } = schema;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// ---- paths: "get.each", "ask[0].settle.by", "score.points.votedOut", "stages[1].game.get" ----

/** A game in stages' part of a spec (a path's first step), never a league type. */
const STAGES_PART = 'stages';

/** A path's steps: names and array indices. */
function stepsOf(path) {
  const out = [];
  for (const part of String(path || '').split('.')) {
    const m = part.match(/^([^[\]]*)((?:\[\d+\])*)$/);
    if (!m) return null;
    if (m[1]) out.push(m[1]);
    for (const i of m[2].match(/\d+/g) || []) out.push(Number(i));
  }
  return out;
}

const pathOf = (steps) => steps.reduce((p, s) => (typeof s === 'number' ? `${p}[${s}]` : p ? `${p}.${s}` : s), '');

function getAt(obj, path) {
  let v = obj;
  for (const s of stepsOf(path) || []) {
    if (v === null || typeof v !== 'object') return undefined;
    v = v[s];
  }
  return v;
}

/** The spec with `path` set to `value` (undefined: taken out; an array element is spliced out). A copy. */
function withAt(obj, path, value) {
  const steps = stepsOf(path);
  const out = clone(obj);
  if (!steps || !steps.length) return out;
  let v = out;
  for (let i = 0; i < steps.length - 1; i++) {
    if (v[steps[i]] === null || typeof v[steps[i]] !== 'object') {
      if (value === undefined) return out;
      v[steps[i]] = typeof steps[i + 1] === 'number' ? [] : {};
    }
    v = v[steps[i]];
  }
  const last = steps[steps.length - 1];
  if (value !== undefined) v[last] = value;
  else if (Array.isArray(v) && typeof last === 'number') v.splice(last, 1);
  else if (v && typeof v === 'object') delete v[last];
  return out;
}

/** Whether a said or assumed part covers a path: the same, or a part of it. */
const covers = (part, path) => !!part && (path === part || path.startsWith(`${part}.`) || path.startsWith(`${part}[`));

/** The VOCAB key a path is a value of: "stages[1].game.ask[0].settle.by" -> "ask.settle", "get.order" -> "get.order". */
function vocabKeyOf(path) {
  const steps = stepsOf(path);
  if (!steps) return null;
  let names = steps.filter((s) => typeof s === 'string');
  while (names[0] === STAGES_PART && names[1] === 'game') names = names.slice(2);
  const key = names.join('.');
  if (VOCAB[key]) return key;
  if (key.endsWith('.by') && VOCAB[key.slice(0, -3)]) return key.slice(0, -3);
  return null;
}

/** Every number in a spec, with its path. */
function numbersOf(v, path = '', out = []) {
  if (typeof v === 'number') out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => numbersOf(x, `${path}[${i}]`, out));
  else if (isObj(v)) for (const [k, x] of Object.entries(v)) numbersOf(x, path ? `${path}.${k}` : k, out);
  return out;
}

// ---- their words ----

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, twice: 2, double: 2, three: 3, triple: 3, thrice: 3, four: 4, quadruple: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, half: 0.5,
  quarter: 0.25,
  // As a verb or a plural ("count as quartered", "points halves", "doubled"): the user's typed games, 2026-11-08.
  halve: 0.5, halves: 0.5, halved: 0.5, quarters: 0.25, quartered: 0.25, doubles: 2, doubled: 2, triples: 3, tripled: 3,
  quadruples: 4, quadrupled: 4,
};
/** "a point", "an extra life", "every week": a one only where the words count something (never "a" or "each" alone). */
const ONE_PHRASE = /\b(an?|one)\s+(extra\s+)?(point|life|pick|castaway|player|person|question|line|slot|mulligan|buyback|captain|stage|week|episode|round|bonus)\b|\b(each|every)\s+(single\s+)?(week|episode|night|round)\b/;

/** "no negative points", "never lose points", "no minus points": a 0 (the points a moment that would cost them now scores). */
const ZERO_PHRASE = /\bno\s+(negative\s+|minus\s+)?(points?|negatives|minus(es)?|penalt(y|ies))\b|\bnever\s+(lose|loses|losing)\s+(any\s+)?points\b/;

/** A sport's own nouns that are number words on a show's page: a baseball double or triple, a tennis doubles match, a game's
 *  quarters and halves say no number there. */
const SPORT_NOUNS = new Set(['doubles', 'triples', 'quarters', 'halves']);

/** The numbers some words say: digits ("5", "2.5", "$100", "3x", "-1"), number words (halved, quartered, doubled...), and a one that
 *  counts something ("a point", "every week"); each as said and negated (a "minus 1" is -1, but a quote of "1" can back either).
 *  `kind` 'sport': a sport's nouns (SPORT_NOUNS) aren't numbers. */
function numbersIn(text, { kind = 'show' } = {}) {
  const out = new Set();
  const s = String(text || '').toLowerCase();
  for (const m of s.matchAll(/-?\d+(?:\.\d+)?/g)) out.add(Math.abs(Number(m[0])));
  for (const w of s.split(/[^a-z]+/)) {
    if (kind === 'sport' && SPORT_NOUNS.has(w)) continue;
    if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, w)) out.add(NUMBER_WORDS[w]);
  }
  if (ONE_PHRASE.test(s)) out.add(1);
  return out;
}

/** Whether a quote backs the number `n` at `path`: a number it says, or (a phrase about losing no points) a 0 on a moment's points. */
const backs = (quote, path, n, kind) => numbersIn(quote, { kind }).has(Math.abs(n)) || (n === 0 && /(^|\.)score\.points\./.test(path) && ZERO_PHRASE.test(String(quote).toLowerCase()));

/** Words as compared: lower case, letters, digits (a decimal point kept) and single spaces, a space at each end, so a quote is
 *  found only on word boundaries ("3" isn't in "30"). */
const plain = (s) =>
  ` ${String(s || '')
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/(\d)\.(?=\d)/g, '$1\u0001')
    .replace(/[^a-z0-9\u0001]+/g, ' ')
    .replace(/\u0001/g, '.')
    .trim()} `;

// ---- the questions our check asks ----

/** A question for a number they didn't say, in plain words: the field's, else its path. */
const NUMBER_ASKS = [
  [/(^|\.)get\.each$/, 'How many does each of you get?'],
  [/(^|\.)count\.(start|best)$/, 'How many count each episode?'],
  [/(^|\.)points(\.|$)/, 'How many points?'],
  [/(^|\.)times(\.|$|\[)/, 'How many times the points?'],
  [/(^|\.)span\.from$/, 'Which episode does it start with?'],
  [/(^|\.)span\.to$/, 'Which episode does it end with?'],
  [/(^|\.)lives$/, 'How many lives?'],
  [/(^|\.)budget\.total$/, "How much does each of you have to spend?"],
  [/(^|\.)race\.to$/, 'First to how many points?'],
];
const numberAsk = (path) => (NUMBER_ASKS.find(([re]) => re.test(path)) || [null, `What number for ${path}? They didn't say.`])[1];

/** The words for a VOCAB value: "blind (everyone picks in private, revealed at once)". */
const valueWords = (key, v) => (WORDS[key] && WORDS[key].values[v] ? `${v} (${WORDS[key].values[v]})` : String(v));

// ---- the validator, part by part ----

const MOMENT_PROBLEM = /isn't one of the show's moments|is the couch's word/;
/** The parts our check never takes out to make a spec play: they'd change what the game is. */
const CORE = new Set(['preset', 'get', 'count', 'score', 'rank', 'stages']);

/** The smallest part to take out for a problem at `at`: a question whole, a stage's own part, else the field. Longest first. */
function removals(at) {
  const steps = stepsOf(at) || [];
  const out = [];
  for (let n = steps.length; n >= 1; n--) {
    const prefix = steps.slice(0, n);
    const top = prefix[0];
    if (n === 1 && CORE.has(top)) break;
    // Inside a stage, never its game whole or the stage itself.
    if (top === STAGES_PART && n <= 3) break;
    out.push(pathOf(prefix));
  }
  return out;
}

/** The moment a problem names, as words for the reliability ask: a question's own words when it's a question's, else the last
 *  step of a points map, or the moment a list names. */
function momentOf(spec, at) {
  const steps = stepsOf(at) || [];
  const q = steps.lastIndexOf('ask');
  if (q >= 0 && typeof steps[q + 1] === 'number') {
    const question = getAt(spec, pathOf(steps.slice(0, q + 2)));
    if (isObj(question) && typeof question.ask === 'string' && question.ask.trim()) return question.ask.trim();
  }
  const last = steps[steps.length - 1];
  const v = getAt(spec, at);
  if (typeof v === 'string') return v;
  if (typeof last === 'string' && last !== 'moment') return last;
  return null;
}

const count = (spec, ctx) => specProblems(spec, ctx).length;

/** The show's own values a path can take: its phases' ids for a phase, its roles for a role. */
function ownValues(at, ctx) {
  const last = (stepsOf(at) || []).slice(-1)[0];
  if (last === 'phase' && ctx && Array.isArray(ctx.phases)) return ctx.phases.map((x) => x.id);
  if (last === 'role' && ctx && Array.isArray(ctx.roles)) return ctx.roles.slice();
  return null;
}

/**
 * The validator's problems, each made into a change our check names: a moment the show doesn't have taken out (a new moment
 * to rate), a value replaced by the nearest that plays (one change, or two together, as a snake that's shared needs), else the
 * smallest part taken out. What none of those fix is left as a problem.
 */
function fixProblems(start, ctx, kind) {
  let spec = clone(start);
  const fixed = [];
  const removed = [];
  const moments = [];
  for (let guard = 0; guard < 40; guard++) {
    const problems = specProblems(spec, ctx);
    if (!problems.length) return { spec, fixed, removed, moments, problems: [] };
    let done = false;
    for (const p of problems) {
      // A moment the show doesn't have, or one only the couch can answer: out, and rated by the reliability ask.
      if (MOMENT_PROBLEM.test(p.problem)) {
        const id = momentOf(spec, p.at);
        for (const r of removals(p.at)) {
          const next = withAt(spec, r, undefined);
          if (count(next, ctx) < problems.length) {
            moments.push({ id, part: r, problem: p.problem });
            spec = next;
            done = true;
            break;
          }
        }
        // A moment of the rulebook's that only the couch answers scores 0 (our check's offer: the validator says "Score it 0"),
        // asked; one the draft named itself is a new moment to rate too.
        if (!done && /Score it 0/.test(p.problem) && getAt(spec, p.at) !== 0) {
          const next = withAt(spec, p.at, 0);
          if (count(next, ctx) < problems.length) {
            fixed.push({ part: p.at, problem: p.problem, from: getAt(spec, p.at), to: { [p.at]: 0 }, options: ['0'] });
            if (getAt(start, p.at) !== undefined) moments.push({ id, part: p.at, problem: p.problem, kept: true });
            spec = next;
            done = true;
          }
        }
        if (done) break;
      }
      // A part the game needs that the draft left out: our default, a preset's (the one that leaves the fewest problems).
      if (getAt(spec, p.at) === undefined) {
        const tries = [];
        for (const id of Object.keys(PRESETS)) {
          const v = getAt(fullSpec({ preset: id }), p.at);
          if (v === undefined || tries.some((t) => JSON.stringify(t.v) === JSON.stringify(v))) continue;
          const next = withAt(spec, p.at, clone(v));
          const left = specProblems(next, ctx);
          if (left.length < problems.length && !left.some((q) => q.at === p.at)) tries.push({ v, next, left: left.length + (left.length ? 0 : specWaitsFor(next).length) });
        }
        if (tries.length) {
          tries.sort((a, b) => a.left - b.left);
          spec = tries[0].next;
          fixed.push({ part: p.at, problem: p.problem, from: undefined, to: { [p.at]: tries[0].v }, options: tries.map((t) => JSON.stringify(t.v)) });
          done = true;
          break;
        }
      }
      // A value of the vocabulary, or a phase or role of the show's: the nearest that plays (alone, or with a second value the
      // first one calls for).
      const key = vocabKeyOf(p.at);
      const own = ownValues(p.at, ctx);
      const at = (key || own) && typeof getAt(spec, p.at) === 'string' ? p.at : null;
      if (at) {
        const from = getAt(spec, at);
        const good = [];
        for (const v of key ? Object.keys(VOCAB[key]) : own) {
          if (v === from || (key && !plays(key, v, kind))) continue;
          const one = withAt(spec, at, v);
          const left = specProblems(one, ctx);
          if (left.length < problems.length && !left.some((q) => q.at === at)) {
            good.push({ to: [[at, v]], left: left.length });
            continue;
          }
          for (const q of left) {
            const k2 = vocabKeyOf(q.at);
            if (!k2 || q.at === at || typeof getAt(one, q.at) !== 'string') continue;
            for (const v2 of Object.keys(VOCAB[k2])) {
              if (!plays(k2, v2, kind)) continue;
              const two = withAt(one, q.at, v2);
              const n = count(two, ctx);
              if (n < problems.length) good.push({ to: [[at, v], [q.at, v2]], left: n });
            }
          }
        }
        if (good.length) {
          good.sort((a, b) => a.left - b.left || a.to.length - b.to.length);
          const best = good[0];
          for (const [path, v] of best.to) spec = withAt(spec, path, v);
          const options = [...new Set(good.filter((g) => g.left === best.left).map((g) => g.to[0][1]))];
          fixed.push({ part: at, problem: p.problem, from, to: Object.fromEntries(best.to), options: options.map((v) => (key ? valueWords(key, v) : v)) });
          done = true;
          break;
        }
      }
      // The smallest part that takes the problem with it.
      for (const r of removals(p.at)) {
        const next = withAt(spec, r, undefined);
        const left = specProblems(next, ctx);
        if (left.length < problems.length && !left.some((q) => q.at === p.at)) {
          removed.push({ part: r, value: getAt(spec, r), problem: p.problem });
          spec = next;
          done = true;
          break;
        }
      }
      if (done) break;
    }
    if (!done) return { spec, fixed, removed, moments, problems };
  }
  return { spec, fixed, removed, moments, problems: specProblems(spec, ctx) };
}

/** What waits for a step: each taken out where that leaves a game, else left as waiting. */
function fixWaits(start, ctx) {
  let spec = clone(start);
  const out = [];
  for (let guard = 0; guard < 12; guard++) {
    const waits = specWaitsFor(spec);
    if (!waits.length) return { spec, out, waits: [] };
    const w = waits[0];
    let done = false;
    for (const r of removals(w.at)) {
      const next = withAt(spec, r, undefined);
      if (!specProblems(next, ctx).length && specWaitsFor(next).length < waits.length) {
        out.push({ part: r, value: getAt(spec, r), why: w.problem, step: w.step });
        spec = next;
        done = true;
        break;
      }
    }
    if (!done) return { spec, out, waits };
  }
  return { spec, out, waits: specWaitsFor(spec) };
}

/** A draft scored by moments counting the whole team (`count: { all: true }`) waits ("best ball with all of it"): the same game
 *  is best ball of everyone drafted, `count: { best: each }`. The repaired spec and why, or null when it doesn't apply or doesn't
 *  clear the wait: the team's size still asked (`sizeAsked`: the best would stay at what we guessed while their answer changed
 *  the team), or a team that holds more than its draft (group slots: the best of them would bench one). */
function countAllRepair(spec, { sizeAsked = false } = {}) {
  if (sizeAsked || !isObj(spec.count) || spec.count.all !== true) return null;
  const waits = specWaitsFor(spec);
  if (!waits.some((w) => w.at === 'count')) return null;
  let full;
  try {
    full = fullSpec(spec);
  } catch {
    return null;
  }
  const each = isObj(full.get) && full.get.by === 'draft' ? full.get.each : null;
  if (!Number.isInteger(each) || each < 1 || isObj(full.get.groups)) return null;
  const to = { best: each };
  const next = { ...clone(spec), count: to };
  if (specWaitsFor(next).some((w) => w.at === 'count')) return null;
  return { spec: next, from: clone(spec.count), to, why: `Everyone on your team counts: best ball of all ${each}, so every one of them scores` };
}

/** The default our check fills an extra's detail with (fixProblems' way): the draft's own preset's, else the one value every
 *  preset that has one agrees on; undefined where they differ or none has one. */
function oursAt(spec, path) {
  const own = spec.preset && PRESETS[spec.preset] ? getAt(fullSpec({ preset: spec.preset }), path) : undefined;
  if (own !== undefined) return own;
  const all = new Set(Object.keys(PRESETS).map((id) => getAt(fullSpec({ preset: id }), path)).filter((v) => v !== undefined).map((v) => JSON.stringify(v)));
  return all.size === 1 ? JSON.parse([...all][0]) : undefined;
}

// ---- a sport's page (G3) ----

/** The wizard's words for a sport's standard games (sports/page.ts sportGames' ids), for "Which game?". */
const SPORT_GAME_LABELS = {
  season: 'Season-long league',
  short: 'Draft a few players',
  pickem: "Pick'em",
  pickAFew: "Pick the game's top players",
  categories: 'Categories, head to head',
  roto: 'Roto',
  bestBall: 'Best ball',
  squares: 'Squares',
  bracket: 'Bracket',
};
const sportGameLabel = (g) => SPORT_GAME_LABELS[g.id] || g.id;

/** A stats score's own tables. */
const STAT_TABLES = ['points', 'byPosition', 'byPlace', 'byFormat'];

/**
 * What a sport's page changes in a draft before the validator, each named (`fixes`: part, why, from, to; `asks`: a question for the
 * wizard): a show's preset off (a sport plays the sport's own games), a show's way of scoring the standard table, a stat named by
 * its words its key ("home_run" or "home runs" is HR), a stats score with no table the sport's standard one, an over/under on a
 * game's total ESPN's own line where they didn't say one ("line": "game"), and a team named by its name its id (one the page
 * doesn't have, out and asked). `games`: the sport's standard games (sports/page.ts sportGames: their specs hold the tables).
 */
function sportFixes(spec, { pack, said, games, positions = [] }) {
  const fixes = [];
  const asks = [];
  /** [old path, new path]: a stat's key read from its words moves what was said or assumed of it. */
  const renames = [];
  const stats = (pack && pack.stats) || [];
  const teams = (pack && pack.teams) || [];
  const table = (games || []).map((g) => g.spec && g.spec.score).find((sc) => isObj(sc) && sc.by === 'stats') || null;
  const standard = table ? Object.fromEntries(STAT_TABLES.filter((k) => table[k] !== undefined).map((k) => [k, clone(table[k])])) : null;
  const fix = (part, why, from, to) => fixes.push({ part, why, from, to });
  if (spec.preset) {
    // A show's game: the sport's own most like it (a draft with a lineup, a draft, a pick, questions), its parts the draft left out.
    const label = PRESET_LABELS[spec.preset] || spec.preset;
    const like = PRESETS[spec.preset] ? fullSpec({ preset: spec.preset }) : null;
    const by = like && isObj(like.get) ? like.get.by : null;
    const lineup = !!(like && isObj(like.count) && like.count.start);
    const list = (games || []).filter((g) => isObj(g.spec) && isObj(g.spec.get));
    const std = list.find((g) => g.spec.get.by === by && !!(isObj(g.spec.count) && g.spec.count.start) === lineup) || list.find((g) => g.spec.get.by === by) || null;
    fixes.push({ part: 'preset', why: `${label} is a show's game: a sport plays its own${std ? ` (${sportGameLabel(std)})` : ''}`, from: spec.preset, to: undefined });
    delete spec.preset;
    // The parts the draft left out, the sport's game's own (each assumed: its numbers ours, and "Which game?" asks it).
    if (std)
      for (const k of ['get', 'count', 'score', 'rank', 'closes', 'ask'])
        if (spec[k] === undefined && std.spec[k] !== undefined) {
          spec[k] = clone(std.spec[k]);
          fix(k, `From the sport's ${sportGameLabel(std)}, in place of ${label}`, undefined, clone(std.spec[k]));
        }
    asks.push({ part: 'preset', question: 'Which game?', options: [std, ...list.filter((g) => g !== std)].filter(Boolean).map(sportGameLabel) });
  }
  if (isObj(spec.score) && ['moments', 'place', 'lines'].includes(spec.score.by) && standard) {
    fixes.push({ part: 'score', why: "A sport's people score by their stats, not a show's moments: the sport's standard table", from: clone(spec.score), to: { by: 'stats', ...clone(standard) }, ask: true });
    spec.score = { by: 'stats', ...clone(standard) };
    asks.push({ part: 'score', question: 'Players score by their stats. Use the standard points?', options: ['Standard points'] });
  }
  // A pool on a sport: nobody goes home, so a right pick is one who scores (Start a game's sport rule, start-game.ts).
  if (isObj(spec.score) && spec.score.by === 'survive' && spec.score.means !== 'scores') {
    fix('score.means', "Nobody goes home in a sport: a right pick is one who scores", spec.score.means, 'scores');
    spec.score.means = 'scores';
  }
  if (isObj(spec.score) && spec.score.by === 'stats') {
    if (isObj(spec.score.points))
      for (const k of Object.keys(spec.score.points)) {
        if (stats.some((x) => x.key === k)) continue;
        const key = statKeyIn(stats, k.replace(/_/g, ' '));
        if (!key || spec.score.points[key] !== undefined) continue;
        fix(`score.points.${key}`, `"${k}" is the stat ${key}`, undefined, spec.score.points[k]);
        renames.push([`score.points.${k}`, `score.points.${key}`]);
        spec.score.points = Object.fromEntries(Object.entries(spec.score.points).map(([x, v]) => [x === k ? key : x, v]));
      }
    if (!STAT_TABLES.some((k) => spec.score[k] !== undefined) && standard) {
      // The table alone (a stat's points), or with its tables by position, place or format (soccer's, golf's, tennis's).
      const why = `No points named: the sport's standard table${table.source ? ` (${table.source})` : ''}`;
      if (Object.keys(standard).length === 1 && standard.points) fix('score.points', why, undefined, clone(standard.points));
      else fix('score', why, undefined, { ...clone(spec.score), ...clone(standard) });
      Object.assign(spec.score, clone(standard));
    }
  }
  (Array.isArray(spec.ask) ? spec.ask : []).forEach((q, i) => {
    if (!isObj(q) || !isObj(q.settle)) return;
    const st = q.settle;
    if (st.by === 'stat' && typeof st.stat === 'string' && !stats.some((x) => x.key === st.stat)) {
      const key = statKeyIn(stats, st.stat.replace(/_/g, ' '));
      if (key) {
        fix(`ask[${i}].settle.stat`, `"${st.stat}" is the stat ${key}`, st.stat, key);
        st.stat = key;
      }
    }
    // An over/under on a game's total: ESPN's line unless they said one (a number of theirs stays, as said).
    if (q.answer === 'overUnder' && st.by === 'final' && st.take === 'total' && q.line !== 'game') {
      const theirs = typeof q.line === 'number' && said(`ask[${i}].line`, q.line);
      if (!theirs) {
        fix(`ask[${i}].line`, "ESPN's line for the game, kept when the question opens", q.line === undefined || q.line === null ? undefined : q.line, 'game');
        q.line = 'game';
      }
    }
    if (typeof st.of === 'string' && st.of && st.of !== 'main' && teams.length) {
      const byName = teamNamed(teams, st.of);
      if (byName && byName.id !== st.of) {
        fix(`ask[${i}].settle.of`, `"${st.of}" is the team ${byName.name}`, st.of, byName.id);
        st.of = byName.id;
      } else if (!byName) {
        fix(`ask[${i}].settle.of`, `"${st.of}" isn't one of the page's teams (a player's own stat isn't asked yet: one team's, or the game's)`, st.of, undefined);
        delete st.of;
        asks.push({ part: `ask[${i}].settle.of`, question: 'Count it for one team, or the whole game?', options: ['The whole game', ...teams.map((t) => t.name)].slice(0, 4) });
      }
    }
  });
  // G3 part 3b: a pool of some teams' players, each team by its id (its name read as one, as a question's "of" is; one the page
  // hasn't got out and asked), and of some positions', each the sport's position group (its label, singular or plural, read as its key).
  const where = isObj(spec.pool) && isObj(spec.pool.where) ? spec.pool.where : null;
  // Each list one fix, the whole list before and after (its paths are the list's, so nothing points at an entry that moved).
  const readList = (key, list, find, word) => {
    const out = [];
    const why = [];
    let lost = false;
    for (const x of list) {
      const hit = typeof x === 'string' ? find(x) : null;
      if (!hit) { why.push(`"${x}" isn't one of the ${word}`); lost = true; }
      else if (hit.id !== x) why.push(`"${x}" is ${hit.says}`);
      if (hit && !out.includes(hit.id)) out.push(hit.id);
    }
    if (why.length) fix(`pool.where.${key}`, why.join('; '), clone(list), out.length ? clone(out) : undefined);
    if (out.length) where[key] = out;
    else delete where[key];
    return lost;
  };
  if (where && Array.isArray(where.teams) && teams.length) {
    const lost = readList('teams', where.teams, (t) => { const team = teamNamed(teams, t); return team && { id: team.id, says: `the team ${team.name}` }; }, "page's teams");
    if (lost) asks.push({ part: 'pool.where.teams', question: "Which team's players?", options: ['Any team', ...teams.map((t) => t.name)].slice(0, 4) });
  }
  if (where && Array.isArray(where.positions) && positions.length) {
    const named = (p) => {
      const said = plain(p).trim();
      const g = positions.find((x) => x.key === p) || positions.find((x) => plain(x.key).trim() === said || [plain(x.label || '').trim(), plain(x.label || '').trim().replace(/s$/, '')].includes(said));
      return g && { id: g.key, says: `${g.label || g.key} (${g.key})` };
    };
    const lost = readList('positions', where.positions, named, "sport's positions");
    if (lost) asks.push({ part: 'pool.where.positions', question: 'Which positions?', options: ['Any position', ...positions.map((g) => g.label || g.key)].slice(0, 5) });
  }
  if (where && !Object.keys(where).length) spec.pool.where = { stillIn: true };
  return { fixes, asks, standard, renames };
}

/** A team by its id, its whole name, else the one team whose name ends with the words ("Yankees"); two that fit name neither. */
function teamNamed(teams, said) {
  const named = teams.filter((t) => plain(t.name) === plain(said));
  const ends = teams.filter((t) => plain(t.name).endsWith(` ${plain(said)}`) || plain(t.name) === plain(said));
  return teams.find((t) => t.id === said) || (named.length === 1 ? named[0] : null) || (ends.length === 1 ? ends[0] : null);
}

// ---- the check ----

/** Whether the show (and the season, when the bot names one) is the page's: the pack's show and season, else its label ("Survivor
 *  51" is Survivor, and Survivor 51; never Survivor 50, nor "Big"). */
function sameShow(pack, about) {
  if (pack.show) return plain(pack.show) === plain(about.show) && (!about.season || !pack.season || about.season === pack.season);
  const label = plain(pack.page);
  if (label === plain(`${about.show}${about.season ? ` ${about.season}` : ''}`)) return true;
  const show = plain(about.show).trimEnd();
  return !about.season && label.startsWith(`${show} `) && /^ \d+ $/.test(label.slice(show.length));
}

/** Whether a quote is in their words: as it is, or (G3 part 2: the local bot quotes "points ... all count 1") each piece around an
 *  ellipsis in them, in order. */
function quoted(wordsPlain, quote) {
  const pieces = String(quote).split(/\s*(?:\.{3}|\u2026)\s*/).map(plain).filter(Boolean);
  if (!pieces.length) return false;
  let at = 0;
  for (const p of pieces) {
    const i = wordsPlain.indexOf(p, at);
    if (i < 0) return false;
    // Each piece is padded with a space (plain's): the next one may start at this one's last.
    at = i + p.length - 1;
  }
  return true;
}

/**
 * The draft to a game. `ctx`: what the page's show can settle (game-spec SpecContext); `pack`: the context pack the bot was given
 * (pack.js packOf); `words`: what they typed (said quotes are checked against it); `kind`: 'show' or 'sport'.
 */
function checkDraft(draft, { ctx = null, pack = null, words = '', kind, carry = null, games = [] } = {}) {
  const d = isObj(draft) ? draft : {};
  const pageKind = kind || (pack && pack.kind) || 'show';
  // G3 part 3b: a sport's page's teams, so a pool's teams are checked against them and named by them.
  if (pageKind === 'sport' && isObj(ctx) && !ctx.teamList && pack && Array.isArray(pack.teams) && pack.teams.length) ctx = { ...ctx, teamList: pack.teams.map((t) => ({ id: t.id, name: t.name })) };
  const wordsPlain = plain(words);
  const result = {
    state: 'game',
    spec: null,
    describe: null,
    said: [],
    assumed: [],
    ask: [],
    cantYet: [],
    newMoments: [],
    fixed: [],
    dropped: [],
    offers: {},
    problems: [],
    waits: [],
  };
  // Their words, quoted: only a quote that's in them is said. A typed change carries what the ask it changes had said and
  // assumed (`carry`), so what the change doesn't touch stays backed.
  for (const s of [...(Array.isArray(d.said) ? d.said : []), ...((carry && carry.said) || [])]) {
    if (s && s.quote && quoted(wordsPlain, s.quote)) result.said.push({ part: s.part || null, quote: s.quote });
    else if (s && s.quote) result.dropped.push({ part: s.part || null, value: s.quote, why: "said, but it isn't in their words" });
  }
  result.assumed = [...(Array.isArray(d.assumed) ? d.assumed : []), ...((carry && carry.assumed) || [])]
    .filter((a) => a && a.part)
    .map((a) => ({ part: a.part, value: a.value, why: a.why || '', by: a.by === 'check' ? 'check' : 'bot' }));
  for (const c of Array.isArray(d.cantYet) ? d.cantYet : []) if (c && c.what) result.cantYet.push({ what: c.what, why: c.why || '', nearest: c.nearest || null, ...(c.newMoment ? { newMoment: c.newMoment } : {}) });
  if (isObj(d.about) && d.about.show && pack && pack.page && !sameShow(pack, d.about)) {
    const other = `${d.about.show}${d.about.season ? ` ${d.about.season}` : ''}`;
    result.offers.otherShow = { show: d.about.show, ...(d.about.season ? { season: d.about.season } : {}) };
    result.ask.push({ part: 'about', question: `Make this for ${other} instead?`, options: [`Yes, ${other}`, `No, ${pack.page}`], by: 'check' });
  }
  if (d.also) result.offers.second = { summary: d.also };

  if (!isObj(d.game)) {
    result.state = 'none';
    if (!result.cantYet.length) result.cantYet.push({ what: words ? String(words).slice(0, 120) : 'the request', why: 'The bot found no game in it', nearest: null });
    // A request that's only a moment the show doesn't have ("will there be a blindside?") is still rated.
    collectMoments(result);
    return result;
  }

  // The game's own parts only.
  let spec = {};
  for (const [k, v] of Object.entries(d.game)) {
    if (SPEC_PARTS.includes(k)) spec[k] = clone(v);
    else result.dropped.push({ part: k, value: v, why: "isn't part of a game spec" });
  }
  if (spec.spec !== undefined && spec.spec !== schema.SPEC_VERSION) spec.spec = schema.SPEC_VERSION;

  // G3: a sport's page: its stats by key, its standard table, ESPN's line, its teams (each a named change, before the numbers).
  if (pageKind === 'sport') {
    const saidNumber = (path, n) => result.said.some((s) => (!s.part || covers(s.part, path) || covers(path, s.part)) && backs(s.quote, path, n, pageKind));
    const sport = sportFixes(spec, { pack, said: saidNumber, games, positions: isObj(ctx) && Array.isArray(ctx.positions) ? ctx.positions.filter((g) => isObj(g) && g.key) : [] });
    const moved = (part) => {
      if (!part) return part;
      const r = sport.renames.find(([from]) => covers(from, part));
      return r ? r[1] + part.slice(r[0].length) : part;
    };
    for (const s of result.said) s.part = moved(s.part);
    for (const a of result.assumed) a.part = moved(a.part);
    // What's taken out is dropped (and asked where it matters); a reading of their words (a stat's key, ESPN's line, the standard
    // table, a team's id) is our check's, shown as assumed (`quiet`: the same thing they said, so never a question); the rest asked.
    for (const f of sport.fixes) {
      if (f.to === undefined) {
        result.dropped.push({ part: f.part, value: f.from, why: f.why });
        continue;
      }
      result.fixed.push({ part: f.part, problem: f.why, from: f.from, to: { [f.part]: f.to }, options: [], ...(f.ask ? {} : { quiet: true }) });
      result.assumed.push({ part: f.part, value: f.to, why: f.why, by: 'check' });
    }
    for (const a of sport.asks) result.ask.push({ ...a, by: 'check' });
  }

  // Numbers as said: each in a said quote for its part, listed as assumed, or our own default; any other is dropped and asked.
  const next = pack && pack.episodes && pack.episodes.next ? pack.episodes.next.number : null;
  const sportGames = pageKind === 'sport' && pack && Array.isArray(pack.games) && pack.games.length && !pack.gamesMore ? pack.games : null;
  const lastGame = sportGames ? Math.max(...sportGames.map((g) => g.episode)) : null;
  // Last first: taking a number out of a list moves the ones after it, never the ones before.
  for (const [path, n] of numbersOf(spec).reverse()) {
    if (path === 'spec') continue;
    const said = result.said.some((s) => (!s.part || covers(s.part, path) || covers(path, s.part)) && backs(s.quote, path, n, pageKind));
    const assumed = result.assumed.some((a) => covers(a.part, path));
    if (said || assumed) continue;
    const without = withAt(spec, path, undefined);
    const dflt = getAt(fullSpec(without), path);
    if (dflt === n) continue;
    if (path === 'span.from' && n === next) continue;
    // An extra's detail the draft wrote as our own default (a waiver's hours, its window's every: a worked example copied whole)
    // is ours, a chip and never a question, as fixProblems fills it when it's left out.
    if (/^extras\./.test(path) && oursAt(spec, path) === n) continue;
    // G3: a sport's page whose games the pack lists whole: its last game is the season's end (a one-game matchup's 1 to 1).
    if (path === 'span.to' && pageKind === 'sport' && n === lastGame) continue;
    // Without it the game wouldn't play (a budget needs its total): keep it, but as the bot's choice, asked.
    if (count(without, ctx) > count(spec, ctx)) {
      result.assumed.push({ part: path, value: n, why: "they didn't say: the bot's choice", by: 'check' });
      result.ask.push({ part: path, question: numberAsk(path), options: [String(n)], by: 'check' });
      continue;
    }
    spec = without;
    result.dropped.push({ part: path, value: n, why: "a number they didn't say", ...(dflt !== undefined ? { ours: dflt } : {}) });
    result.ask.push({ part: path, question: numberAsk(path), options: dflt !== undefined && dflt !== null && typeof dflt !== 'object' ? [String(dflt)] : [], by: 'check' });
  }

  // A draft scored by moments that counts everyone drafted: best ball of all of them, the same game in the engine's terms
  // (the validator's own hint), said in what our check filled in.
  const all = countAllRepair(spec, { sizeAsked: result.ask.some((q) => q.part === 'get.each') });
  if (all) {
    spec = all.spec;
    result.fixed.push({ part: 'count', problem: all.why, from: all.from, to: { count: all.to }, options: [], quiet: true });
    result.assumed.push({ part: 'count', value: all.to, why: all.why, by: 'check' });
  }

  // The validator: each problem a named change, or left.
  const fix = fixProblems(spec, ctx, pageKind);
  spec = fix.spec;
  for (const f of fix.fixed) {
    result.fixed.push(f);
    result.assumed.push({ part: f.part, value: f.to[f.part], why: f.problem, by: 'check' });
    // A detail nobody set (an extra's field left out: a waiver's feel, its hours) is our default, a chip the wizard shows, never
    // a question (the Decisions table's "The wizard": details they don't care about stay out of sight). Anything else is asked.
    if (!(f.from === undefined && /^extras\./.test(f.part))) result.ask.push({ part: f.part, question: f.problem, options: f.options, by: 'check' });
  }
  for (const r of fix.removed) {
    result.dropped.push({ part: r.part, value: r.value, why: r.problem });
    const said = result.said.some((s) => s.part && (covers(s.part, r.part) || covers(r.part, s.part)));
    if (said) result.cantYet.push({ what: r.part, why: r.problem, nearest: null });
  }
  for (const m of fix.moments) {
    if (!m.kept) result.dropped.push({ part: m.part, value: m.id, why: m.problem });
    const known = result.cantYet.find((c) => c.newMoment && plain(c.newMoment).includes(plain(m.id || '')));
    if (!known) result.cantYet.push({ what: m.id || m.part, why: m.problem, nearest: null, newMoment: m.id || m.part });
  }
  // What waits for a later step: out where the rest still plays.
  if (!fix.problems.length) {
    const wait = fixWaits(spec, ctx);
    spec = wait.spec;
    for (const w of wait.out) {
      result.dropped.push({ part: w.part, value: w.value, why: w.why });
      result.cantYet.push({ what: w.part, why: w.why, nearest: null, step: w.step });
    }
    result.waits = wait.waits;
  }
  result.problems = fix.problems;
  result.spec = spec;

  // The draft's own questions, on parts that are still in the game (or about it whole).
  for (const a of Array.isArray(d.ask) ? d.ask : []) {
    if (!a || !a.question) continue;
    const top = a.part ? (stepsOf(a.part) || [])[0] : null;
    if (a.part && top && !SPEC_PARTS.includes(top) && top !== 'about') continue;
    if (result.ask.some((q) => q.part && a.part && q.part === a.part)) continue;
    result.ask.push({ part: a.part || null, question: a.question, options: a.options || [], by: 'bot' });
  }
  // Nothing in their words said which game: which game is a question, the one drafted first.
  const kindSaid = result.said.some((s) => s.part && ['preset', 'get', 'score', 'count', 'rank', 'stages', 'ask'].some((k) => covers(k, s.part) || s.part === k));
  if (!kindSaid && !result.ask.some((q) => q.part === 'preset' || q.part === 'get' || q.part === 'get.by')) {
    if (pageKind === 'sport') {
      // A sport's own games (its standard ones), the one most like the draft first.
      const like = (games || []).find((g) => isObj(g.spec) && isObj(g.spec.get) && isObj(spec.get) && g.spec.get.by === spec.get.by);
      const list = [like, ...(games || []).filter((g) => g !== like)].filter(Boolean);
      if (list.length) result.ask.push({ part: 'get', question: 'Which game?', options: list.map(sportGameLabel), by: 'check' });
    } else {
      const first = spec.preset && PRESETS[spec.preset] ? spec.preset : null;
      const ids = [first, ...Object.keys(PRESETS).filter((p) => p !== first)].filter(Boolean);
      result.ask.push({ part: 'preset', question: 'Which game?', options: ids.map((p) => PRESET_LABELS[p]), by: 'check' });
    }
  }

  // New moments, each once, for the reliability ask.
  const seen = collectMoments(result);

  if (result.problems.length || result.waits.length) {
    result.state = 'cantYet';
    for (const p of result.problems) {
      // A moment the show doesn't have that the game can't do without (a question on it alone): still a new moment to rate.
      const moment = MOMENT_PROBLEM.test(p.problem) ? momentOf(spec, p.at) : null;
      result.cantYet.push({ what: p.at, why: p.problem, nearest: null, ...(moment ? { newMoment: moment } : {}) });
      if (moment && !seen.has(plain(moment))) {
        seen.add(plain(moment));
        result.newMoments.push({ label: moment, what: p.at });
      }
    }
    for (const w of result.waits) result.cantYet.push({ what: w.at, why: w.problem, nearest: null, step: w.step });
    return result;
  }
  try {
    result.describe = describeSpec(spec, ctx);
  } catch {
    result.describe = null;
  }
  // A game that plays: 'game' when there's nothing to ask or say, else 'ask' (the wizard's questions, or what it couldn't do).
  result.state = result.ask.length || result.cantYet.length ? 'ask' : 'game';
  return result;
}

/** The result's new moments, each once, from its can't-yets (for the reliability ask): the labels seen, for more to join. */
function collectMoments(result) {
  const seen = new Set(result.newMoments.map((m) => plain(m.label)));
  for (const c of result.cantYet) {
    if (!c.newMoment || seen.has(plain(c.newMoment))) continue;
    seen.add(plain(c.newMoment));
    result.newMoments.push({ label: c.newMoment, what: c.what });
  }
  return seen;
}

const BARS = { high: 2, medium: 1, low: 0 };

/**
 * The reliability ask's answers folded in (`ratings`: { [label]: { reliable, why, question, label, nearest } }): a moment rated at
 * or over the bar (`bar`, 'medium' by default: the user leans that way, the Decisions table's "Custom moments" still open) is an
 * offer to add it as a question research answers each episode; under it, it stays a can't-yet, with the nearest moments that are
 * settled (the pack's own, by id). G1 part 4: a season's added moment is asked about each person (who cried?), so one about the
 * episode itself (did it rain?) stays a can't-yet whatever its rating, with why.
 */
function withMoments(result, ratings, { bar = 'medium', pack = null } = {}) {
  const out = clone(result);
  const ids = new Map(((pack && pack.moments) || []).map((m) => [m.id, m.says]));
  out.offers.moments = [];
  for (const m of out.newMoments) {
    const r = ratings && ratings[m.label];
    if (!r) continue;
    const c = out.cantYet.find((x) => x.newMoment === m.label);
    const nearest = (Array.isArray(r.nearest) ? r.nearest : []).filter((id) => ids.has(id)).slice(0, 3);
    if (r.about === 'episode') {
      if (c) {
        c.why = `${c.why}${c.why ? ' ' : ''}It's about the episode, not someone in it: research answers added moments about people for now.`.trim();
        c.nearest = nearest.length ? nearest.map((id) => ids.get(id)).join('; ') : c.nearest;
      }
    } else if (BARS[r.reliable] >= BARS[bar]) {
      out.offers.moments.push({ label: r.label || m.label, question: r.question, reliable: r.reliable, why: r.why });
      out.ask.push({ part: 'newMoment', question: `Add "${r.label || m.label}" as a question research answers each episode?`, options: ['Yes, add it', 'No'], by: 'check', moment: { label: r.label || m.label, question: r.question, reliable: r.reliable, why: r.why } });
      if (c) c.offered = true;
    } else if (c) {
      c.why = `${c.why}${c.why ? ' ' : ''}Research can't answer it reliably: ${r.why}`.trim();
      c.nearest = nearest.length ? nearest.map((id) => ids.get(id)).join('; ') : c.nearest;
    }
  }
  if (out.state === 'game' && out.ask.length) out.state = 'ask';
  return out;
}

module.exports = { sportFixes, SPORT_GAME_LABELS, checkDraft, withMoments, numbersIn, stepsOf, getAt, withAt, vocabKeyOf, fixProblems };
