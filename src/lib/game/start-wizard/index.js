// Start a game's wizard, the logic (docs/PLAN-start-a-game-gpt.md U1; U0's settled board "B, settled", canvas v33, ported from its
// script: the logic, not the HTML). Pure, like game-spec: the same page and choices make the same games on a phone and in a test.
// CommonJS on purpose (see ../game-spec/schema.js): the sheet bundles it with the engine, tests require it as it is.
//
// The sheet holds a span (When it runs) and a choice (the game picked and what was changed on it); everything else is worked out
// here from the page (G1's { ctx, pack }) by the engine itself: rollSpec makes every game, our check passes it, describeSpec words it.
//
//   timing(input)                     -> When it runs: its modes, the default, the stages and the episodes, each as a span
//   sayRange(span, input), nOf(...)   -> "The season, after the premiere", how many episodes
//   createWizard(input)               -> a wizard on one page, memoized: games(span) (Start from's rail and Every game), build(span,
//                                        choice) (the game as chosen), options (what fits from here, each checked), steps(spec) (the
//                                        game's three steps), changes, quick(span, choice) and applyQuick (the four quick changes),
//                                        shuffle (Surprise me), scoring (What scores) and nextLine (the footer)
//
// A choice: { sel: a rail game's id, 'shuffle' or 'typed'; row: the shuffled or typed game; win; tws: twist ids (two at most);
// bet: a MONEY id; cnt: { each, play }; scoring: 'standard' | 'no-loss' | 'big'; edits: { momentId: points }; off: momentIds;
// qedits: { questionId: points }; added: [{ id, says, pts }] (moments added to the season for this game) }. Picks only flow down:
// a game picked again starts its changes over (fresh()).
/* eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see ../game-spec/schema.js */
const G = require('../game-spec/index.js');

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const low = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// ---------- the pieces, in the sheet's words ----------

/** Every kind of game: the sheet's id, its name, what you do (in the show's word for an episode), roll's base. */
const KINDS = [
  { id: 'lineup', name: 'Weekly Lineup', says: (p) => `A team; play some each ${p}`, base: 'lineup' },
  { id: 'bestball', name: 'Best Ball', says: () => 'A team; your best ones count', base: 'best-ball' },
  { id: 'outlast', name: 'Outlast', says: () => 'A team; then just watch', base: 'outlast' },
  { id: 'predictions', name: 'Prediction Sheet', says: () => 'Answer a few questions', base: 'questions' },
  { id: 'picks', name: 'Weekly Picks', says: (p) => `Pick who scores each ${p}`, base: 'picks' },
  { id: 'pool', name: 'Survival Pool', says: () => 'Pick one who stays in', base: 'pool' },
  { id: 'calls', name: 'Weekly Calls', says: (p) => `Make two calls a ${p}`, base: 'calls' },
  { id: 'bingo', name: 'Weekly Bingo', says: () => 'Tick a card while you watch', base: 'bingo' },
];
const KIND_OF_BASE = Object.fromEntries(KINDS.map((k) => [k.base, k.id]));
const TEAM = ['lineup', 'bestball', 'outlast'];

/** The ways to win: the sheet's id, roll's, its words. */
const WINS = [
  { id: 'points', roll: 'total', label: 'Most points', says: () => 'The most points at the end wins' },
  { id: 'h2h', roll: 'matchups', label: 'Head to head', says: (p) => `One of the others each ${p}; with an odd couch, one plays the middle score` },
  { id: 'last', roll: 'standing', label: 'Last one standing', says: (p) => `Lowest each ${p} is out` },
  { id: 'weeks', roll: 'weeks', label: 'Most weeks won', says: (p) => `Win the ${p}, win a week` },
  { id: 'streak', roll: 'streak', label: 'Longest streak', says: () => 'Most right in a row' },
  { id: 'race', roll: 'race', label: 'First to a target', says: () => 'First past the line wins' },
  { id: 'coop', roll: 'coop', label: 'Together', says: () => 'The couch against the show' },
];
const WIN_OF_RANK = { total: 'points', matchups: 'h2h', standing: 'last', weeks: 'weeks', streak: 'streak', coop: 'coop' };
/** A game's way to win, from its spec. */
const winOfSpec = (spec) => {
  const r = (spec && spec.rank) || {};
  return r.race ? 'race' : WIN_OF_RANK[r.by] || 'points';
};
/** Roll's id for a way to win on a base: a pool ranked by its points is roll's 'points', every other game's 'total'. */
const rollWin = (w, base) => (w === 'points' && base === 'pool' ? 'points' : (WINS.find((x) => x.id === w) || {}).roll);

/** The twists the sheet offers, by the step they change, each with what it does. Not the two that make a game in stages (redraft,
 *  trivia too): Start from a spec doesn't make stages yet. */
const TWISTS = {};
const tw = (step, group, list) => {
  for (const [id, label, says] of list) TWISTS[id] = { id, step, group, label, says };
};
tw('before', 'Your team', [
  ['draw', 'Draft order by draw', 'Who picks first is drawn, not snaked'],
  ['auction', 'Bid for your team', 'Everyone has 100 to bid with'],
  ['replacements', 'A replacement when yours go home', 'Pick someone new when one of yours leaves'],
  ['group-slot', 'One from each group', 'Your team has someone from every group'],
  ['second-pick', 'A second pick', 'Pick again later in the season'],
  ['spread', 'Spread your picks', 'Nobody holds too many of the same group'],
]);
tw('each', 'Each episode', [
  ['captain', 'A captain', 'One starter scores double'],
  ['boot-call', 'Call the boot too', 'Also say who goes home'],
  ['first-double', 'First episode counts double', ''],
  ['finale-double', 'Finale counts double', ''],
  ['top-twist', 'Top scorer picks a twist', "The top scorer picks the next one's twist"],
  ['objectives', 'Secret objectives', 'Each of you gets a private goal'],
  ['only', 'Only some moments count', 'See What scores'],
  ['mulligan', 'One wrong pick forgiven', ''],
  ['buyback', 'Buy back in', 'Out? Pay points to come back'],
  ['never-twice', 'Never the same pick twice', ''],
  ['majority', 'Match the majority', 'Score for siding with the couch'],
  ['beat-bot', 'Beat the bot', 'Our bot plays too; beat its call'],
  ['split-pot', 'Split the points', 'Everyone right shares the points'],
  ['only-right', 'Only a lone right answer scores', ''],
  ['rollover', 'Rollover jackpot', 'Nobody right? The points roll over'],
]);
tw('win', 'With friends', [
  ['roles', 'A secret Traitor', 'One of you secretly scores off the others'],
  ['bounty', 'Bounties on the vote', 'Points move when your people vote someone out'],
  ['teams', 'Play in 2 teams', 'The couch splits into two sides'],
  ['finale-picks', 'Finale picks', 'Call the final three and the winner'],
  ['reverse', 'Reverse', 'The first out scores most'],
]);
const TWIST_GROUPS = ['Your team', 'Each episode', 'With friends'];

/** The bets: points, never money. Each is made as a spec the engine checks (moneyOf), not a roll's twist (round F's ask). */
const MONEY = {
  'm-stake': ['Double or nothing', 'Stake up to 5 points on a call'],
  'm-bank': ['A bank of 100 to bet from', 'Stake any of it on each call'],
  'm-pool': ['Winners split the pot', 'The wrong stakes go to the right ones'],
  'm-parlay': ['A parlay', 'All right together: triple'],
  'm-ticket': ['Build a ticket', 'Put your calls on one stake'],
  'm-side': ['Side bet on who goes home', 'Stake up to 5 points each episode'],
};

/** What scores, before G5's themes (the user, 2026-11-09: engine-made ways from the season's own rulebook, no AI). */
const SCORINGS = {
  standard: { name: 'Standard points', says: (show) => `${show}'s standard points` },
  'no-loss': { name: 'No points lost', says: () => 'No points lost: moments that cost points score 0' },
  big: { name: 'Big moments only', says: () => 'Only the big moments count' },
};

/** The competitive twists More casual can take off, each with what it says when it does. */
const COMPETITIVE = { captain: 'no captain', 'only-right': 'every right answer scores', 'boot-call': 'no boot call', 'never-twice': 'the same pick again is fine', bounty: 'no bounties' };
/** Ways to win, least to most at stake: More competitive only climbs, More casual only comes down. */
const RANK = { coop: 0, points: 1, weeks: 1, race: 1, streak: 2, h2h: 3, last: 4 };

const fresh = () => ({ win: '', tws: [], bet: '', cnt: {}, scoring: 'standard', edits: {}, off: [], qedits: {}, added: [] });
/** Whether a choice changes its game's counts or scoring (not its way to win, twists or bet). */
const changed = (c) =>
  !!((c.cnt && (c.cnt.each || c.cnt.play)) || (c.scoring && c.scoring !== 'standard') || Object.keys(c.edits || {}).length || (c.off || []).length || Object.keys(c.qedits || {}).length || (c.added || []).length);

// ---------- When it runs ----------

/**
 * The span choices for the season as the page stands. `input`: { page, first (the next episode to air), last (the season's last,
 * or null), phases (the rulebook's, in order: { id, name, starts }), part: { singular, plural }, label, short (how many episodes
 * make "a very short season", 6) }.
 */
function timing(input) {
  const first = input.first;
  const last = input.last || null;
  const pre = first === 1;
  // Season games start after the premiere, which introduces the cast (Decisions, 2026-11-07), unless the season is very short.
  const afterPremiere = pre && !(last && last <= (input.short || 6)) && (!last || last > 1);
  const season = { from: afterPremiere ? 2 : first, to: null };
  const tonight = { from: first, to: first };
  // The default follows where the season is: before the premiere or until Episode 2 has aired, the season; mid-season, tonight.
  const mode = first <= 2 && !(last && last <= first) ? 'season' : 'tonight';
  return { first, last, pre, season, tonight, mode, stages: stagesOf(input), episodes: episodesOf(input) };
}

/** The season's stages still to come, each a span: the premiere, the rulebook's phases, the finale. A phase whose start nobody can
 *  date yet is "≈": its edge is the phase itself. */
function stagesOf(input) {
  const { first } = input;
  const last = input.last || null;
  const out = [];
  if (first === 1 && (!last || last > 1)) out.push({ id: 'premiere', label: 'Premiere', span: { from: 1, to: 1 }, exact: true });
  const phases = (input.phases || []).filter((p) => p && p.id);
  if (phases.length >= 2) {
    phases.forEach((p, i) => {
      const next = phases[i + 1];
      let from = i === 0 ? 1 : Number.isInteger(p.starts) ? p.starts : { phase: p.id };
      if (from === 1 && out.length) from = 2;
      let to = next ? (Number.isInteger(next.starts) ? next.starts - 1 : { phase: next.id }) : last ? last - 1 : null;
      if (typeof from === 'number' && typeof to === 'number' && to < from) return;
      if (typeof to === 'number' && to < first) return;
      if (typeof from === 'number' && from < first) from = first;
      out.push({ id: `phase:${p.id}`, label: p.name || p.id, span: { from, to }, exact: typeof from === 'number' && (typeof to === 'number' || to === null) });
    });
  }
  if (last && last >= first && last > 1) out.push({ id: 'finale', label: 'Finale', span: { from: last, to: last }, exact: true });
  return out.length >= 3 || (out.length >= 2 && phases.length >= 2) ? out : [];
}

/** The episodes a custom stretch can be picked from: the next to air to the season's last (or the listing's last). */
function episodesOf(input) {
  const last = input.last || Math.max(input.first, ...(input.listed || []));
  const out = [];
  for (let n = input.first; n <= last; n++) out.push(n);
  return out;
}

/** A span as the engine takes it: the season's last episode is "to the end" (null), so a finale that moves still ends it. */
function normalSpan(span, input) {
  const s = clone(span);
  if (input.last && s.to === input.last && s.from !== input.last) s.to = null;
  return s;
}

/** How many episodes a span runs, when that's known. */
function nOf(span, input) {
  const last = input.last || null;
  const at = (x, edge) => {
    if (typeof x === 'number') return x;
    if (x === null) return edge === 'to' ? last : null;
    const ph = (input.phases || []).find((p) => isObj(x) && p.id === x.phase);
    if (!ph || !Number.isInteger(ph.starts)) return null;
    return edge === 'to' ? ph.starts - 1 : ph.starts;
  };
  const a = at(span.from, 'from');
  const b = at(span.to, 'to');
  return a !== null && b !== null && b >= a ? b - a + 1 : null;
}

const phaseName = (input, x) => ((input.phases || []).find((p) => isObj(x) && p.id === x.phase) || {}).name || 'the next stage';

/** A span in words: "Just tonight", "The season, after the premiere", "Episode 6 until Merged". `tonight`: the next episode's own word
 *  ("tonight", "Wednesday"), when it isn't simply its number. */
function sayRange(span, input) {
  const { first } = input;
  const last = input.last || null;
  const pre = first === 1;
  const P = cap(input.part.singular);
  const s = span.from;
  const e = span.to;
  if (isObj(s)) return e === null ? `When ${phaseName(input, s)} starts, to the end` : `When ${phaseName(input, s)} starts, to ${P} ${e}`;
  const startWords = s === 1 && pre ? 'The premiere' : `${P} ${s}`;
  if (isObj(e)) return `${startWords} until ${phaseName(input, e)}`;
  const end = e === null ? last : e;
  if (e === null || end === last) {
    if (s === first) return pre ? 'The whole season, premiere included' : 'The rest of the season';
    if (pre && s === 2) return 'The season, after the premiere';
    return `${P} ${s} to the end`;
  }
  if (s === e) return s === first ? (pre ? 'Just the premiere' : input.tonight ? `Just ${input.tonight}` : `Just ${P} ${s}`) : s === last ? 'Just the finale' : `Just ${P} ${s}`;
  return `${P}s ${s} to ${e}`;
}

/** The readout's tag: "1 ep", "12 eps", "≈5 eps", "To the end". */
function nTag(span, input) {
  const n = nOf(span, input);
  const rough = isObj(span.from) || isObj(span.to);
  if (n === null) return rough ? '≈' : 'To the end';
  return `${rough ? '≈' : ''}${n} ${n === 1 ? 'ep' : 'eps'}`;
}

// ---------- the game's steps, from its spec ----------

/** The three steps in plain words (before it starts, each episode, to win), with what each draws. */
function partsOf(spec, input) {
  const p = input.part.singular;
  const g = spec.get || {};
  const c = spec.count || {};
  const sc = spec.score || {};
  const r = spec.rank || {};
  const out = {};
  if (g.by === 'draft') Object.assign(out, { a: `A team of ${g.each}${g.own === 'exclusive' ? ', all yours' : ''}`, ag: 'draft', an: g.each });
  else if (g.by === 'card' || sc.by === 'lines') Object.assign(out, { a: 'A bingo card', ag: 'card', an: 0 });
  else if (sc.bank) Object.assign(out, { a: `A bank of ${sc.bank.start}`, ag: 'bank', an: 0 });
  else Object.assign(out, { a: 'No team', ag: 'none', an: 0 });
  const asks = Array.isArray(spec.ask) ? spec.ask : [];
  if (sc.by === 'lines') Object.assign(out, { b: 'Tick squares live', bg: 'card' });
  else if (sc.by === 'survive') Object.assign(out, { b: `Pick 1 who stays${sc.lives > 1 ? `, ${sc.lives} lives` : ''}`, bg: 'pool' });
  else if (sc.by === 'place') Object.assign(out, { b: 'Just watch: they score by lasting', bg: 'last' });
  else if (c.start) Object.assign(out, { b: `Play ${c.start} each ${p}`, bg: 'start', bn: c.start });
  else if (c.best) Object.assign(out, { b: `Your best ${c.best} count`, bg: 'best', bn: c.best });
  else if (g.by === 'pick') Object.assign(out, { b: `Pick ${g.each} to score`, bg: 'pick', bn: g.each });
  else if (spec.card && asks.some((q) => q.card)) {
    const cq = asks.find((q) => q.card);
    Object.assign(out, { b: `${cq.answer === 'person' ? 'Name who does ' : 'Call '}${spec.card.each} moments`, bg: 'q' });
  } else if (asks.some((q) => q.answer === 'calls')) Object.assign(out, { b: 'Make 2 calls', bg: 'calls' });
  else if (asks.length) {
    const q = asks.filter((x) => x.answer !== 'ticket').length;
    Object.assign(out, { b: `Answer ${q} ${q === 1 ? 'question' : 'questions'}`, bg: 'q' });
  } else Object.assign(out, { b: 'Score their moments', bg: 'start', bn: 0 });
  const w = r.race ? 'race' : WIN_OF_RANK[r.by] || 'points';
  out.cg = w;
  out.c = r.race
    ? `First to ${r.race.to}`
    : w === 'points'
      ? sc.by === 'lines'
        ? 'Most lines'
        : sc.by === 'survive'
          ? 'Most right picks'
          : 'Most points'
      : `${WINS.find((x) => x.id === w).label}${r.playoffs ? ', playoffs' : ''}`;
  return out;
}

/** The game's steps: each its key, label, words and drawing ({ kind, n, k }: the sheet draws it). */
function steps(spec, input) {
  const p = partsOf(spec, input);
  const team = spec.get && spec.get.by === 'draft' ? spec.get.each : 0;
  return [
    { key: 'before', label: 'Before it starts', words: p.a, draw: { kind: p.ag, n: p.an, k: p.an } },
    { key: 'each', label: `Each ${input.part.singular}`, words: p.b, draw: { kind: p.bg, n: team || p.bn || 0, k: p.bn || 0 } },
    { key: 'win', label: 'To win', words: p.c, draw: { kind: p.cg, n: 0, k: 0 } },
  ];
}

/** A standard game's line, from its steps: "A team of 5 · play 3 each episode · most points". */
function plainLine(spec, input) {
  const p = partsOf(spec, input);
  return `${p.a} · ${low(p.b)} · ${p.c.toLowerCase()}`;
}

/** A game's twist on the spec in words ("Captain scores double"). */
function twistLabel(id, times) {
  const t = TWISTS[id];
  if (!t) return (MONEY[id] || [id])[0];
  return id === 'captain' ? `Captain scores ${times === 3 ? 'triple' : 'double'}` : t.label;
}

/** Which way a game scores, for What scores. */
function scoreKind(spec) {
  const sc = spec.score || {};
  if (Array.isArray(spec.ask) && spec.ask.length && sc.by === 'answers') return 'asks';
  if (sc.by === 'survive') return 'survive';
  if (sc.by === 'place') return 'place';
  if (sc.by === 'lines') return 'card';
  if (sc.by === 'moments') return 'moments';
  return 'other';
}

/** The bets a game can take, each as the spec it makes (points, never money; round F: built as specs the engine checks). */
function moneyOf(keep0) {
  const k = clone(keep0);
  const out = {};
  const ask = Array.isArray(k.ask) ? k.ask : [];
  const sc = k.score || {};
  const elig = (x) => ['person', 'yesNo', 'choice', 'group', 'overUnder'].includes(x.answer);
  const el = ask.filter(elig);
  if (sc.by === 'answers' && el.length) {
    if (el.some((x) => x.wager == null)) out['m-stake'] = { ...k, ask: ask.map((x) => (elig(x) && x.wager == null ? { ...x, wager: 5 } : x)) };
    if (!sc.bank) out['m-bank'] = { ...k, score: { ...sc, bank: { start: 100 } }, ask: ask.map((x) => (elig(x) ? { ...x, wager: 'total' } : x)) };
    if (el.some((x) => x.odds !== 'pool')) out['m-pool'] = { ...k, ask: ask.map((x) => (elig(x) ? { ...x, wager: x.wager != null ? x.wager : 5, odds: 'pool' } : x)) };
    const groups = {};
    for (const x of el) (groups[x.asked || 'each'] = groups[x.asked || 'each'] || []).push(x);
    const legs = Object.values(groups).sort((a, b) => b.length - a.length)[0] || [];
    if (legs.length >= 2 && !sc.parlays) out['m-parlay'] = { ...k, score: { ...sc, parlays: [{ of: legs.slice(0, 4).map((x) => x.id), times: 3 }] } };
    if (legs.length >= 2)
      out['m-ticket'] = {
        ...k,
        score: { ...sc, bank: sc.bank || { start: 100 } },
        ask: ask.concat([{ id: 'ticket', ask: 'Your ticket', answer: 'ticket', points: 0, asked: legs[0].asked || 'each', wager: 'total', settle: { by: 'legs', of: legs.slice(0, 6).map((x) => x.id) } }]),
      };
  } else if (!ask.length && (sc.by === 'moments' || sc.by === 'place'))
    out['m-side'] = { ...k, ask: [{ id: 'sidebet', ask: 'Who goes home?', answer: 'person', points: 1, asked: 'each', closes: 'start', wager: 5, settle: { by: 'results', take: 'out' } }] };
  return out;
}

/** A spec less what the sheet sets itself (where it runs, how it ranks): the parts a change keeps over a roll. */
function keepOf(spec) {
  const k = clone(spec || {});
  delete k.spec;
  delete k.span;
  delete k.rank;
  return k;
}

// ---------- the wizard on one page ----------

function createWizard(input) {
  const page = input.page;
  const ctx = (page && page.ctx) || {};
  const part = input.part.singular;
  const show = input.label;
  const cache = new Map();
  const memo = (key, f) => {
    if (cache.has(key)) return cache.get(key);
    const v = f();
    if (cache.size > 4000) cache.clear();
    cache.set(key, v);
    return v;
  };
  const roll = (locks, seed) => {
    try {
      return G.rollSpec(page, locks, seed);
    } catch (e) {
      return { ok: false, why: String((e && e.message) || e) };
    }
  };
  const spanKey = (span) => JSON.stringify(span);

  /** The season's moments research answers, with their points here (shared or exclusive), for What scores. */
  const moments = (choice) =>
    (Array.isArray(ctx.moments) ? ctx.moments : [])
      .filter((m) => m && m.id && !m.off && !m.auto && m.answeredBy !== 'league' && !((choice && choice.added) || []).some((a) => a.id === m.id))
      .map((m) => ({ id: m.id, says: m.label || m.id, pts: m.defaultPoints }));
  const ptsOf = (m, spec) => {
    const own = spec && spec.get && spec.get.own === 'exclusive';
    return isObj(m.pts) ? (own ? m.pts.exclusive : m.pts.shared) : typeof m.pts === 'number' ? m.pts : 0;
  };
  /** A moment's points in a spec: the game's own, 0 when it doesn't count, else the rulebook's. */
  const momentPts = (spec, m) => {
    const sc = (spec && spec.score) || {};
    if (sc.points && sc.points[m.id] != null) return sc.points[m.id];
    if (Array.isArray(sc.only) && !sc.only.includes(m.id)) return 0;
    return ptsOf(m, spec);
  };

  /** Every game that fits a span, as the engine plays it here, in the rail's order, with its role. */
  function games(span) {
    return memo(`games|${spanKey(span)}`, () => {
      const n = nOf(span, input);
      const out = [];
      for (const k of KINDS) {
        if (k.id === 'outlast' && n !== null && n < 4) continue;
        if (k.id === 'pool' && n !== null && n < 3) continue;
        if (input.only && !input.only.includes(k.id)) continue;
        const pref = [k.id === 'lineup' && n !== null && n >= 6 ? 'h2h' : null, 'points', 'h2h', 'last', 'weeks', 'streak', 'race', 'coop'].filter((w, i, a) => w && a.indexOf(w) === i);
        let row = null;
        for (const w of pref) {
          const win = WINS.find((x) => x.id === w);
          const r = roll({ length: span, base: k.base, win: win.roll, twists: [] }, `g-${k.id}-${w}`);
          if (r.ok) {
            row = { id: k.id, kind: 'standard', game: k.id, name: k.name, win: winOfSpec(r.spec), spec: r.spec, describe: r.describe };
            break;
          }
        }
        if (row) out.push(row);
      }
      const has = (id) => out.some((x) => x.id === id);
      const classic = (n === 1 ? ['predictions', 'picks'] : ['lineup', 'picks', 'predictions']).find(has) || (out[0] && out[0].id) || null;
      const easy = (n === 1 ? ['bingo', 'calls'] : ['pool', 'calls', 'bingo']).find((id) => has(id) && id !== classic) || null;
      const rank = (x) => (x.id === classic ? 0 : x.id === easy ? 1 : 2 + KINDS.findIndex((k) => k.id === x.id));
      out.sort((a, b) => rank(a) - rank(b));
      for (const x of out) x.role = x.id === classic ? 'The classic' : x.id === easy ? (x.game === 'bingo' ? 'Play along live' : 'Least effort') : '';
      // G5's made-for games of this stretch's length, after the classic and the easy one (U0's settled rail), each on these episodes.
      const made = madeFor(span, n);
      const at = out.findIndex((x) => x.id !== classic && x.id !== easy);
      out.splice(at < 0 ? out.length : at, 0, ...made);
      return { list: out, classic, easy, n };
    });
  }

  /** The season's made-for games (input.made, G5) whose length fits a stretch of `n` episodes, each as the engine plays it there. */
  function madeFor(span, n) {
    const length = n === 1 ? 'one' : n !== null && n <= 5 ? 'few' : 'season';
    const says = (page && page.pack && page.pack.show) || show;
    const out = [];
    (input.made || []).forEach((m, i) => {
      if (!m || m.length !== length || !isObj(m.spec)) return;
      const s = clone(m.spec);
      s.span = span;
      const game = kindOfSpec(s);
      if (input.only && !input.only.includes(game)) return;
      if (G.specProblems(s, ctx).length) return;
      out.push({ id: `made-${i}`, kind: 'made', game, name: m.name, role: `Made for ${says}`, hook: m.hook, win: winOfSpec(s), spec: s, describe: G.describeSpec(s, ctx) });
    });
    return out;
  }

  const rowOf = (span, choice) => {
    if ((choice.sel === 'shuffle' || choice.sel === 'typed') && choice.row) return choice.row;
    const g = games(span);
    return g.list.find((x) => x.id === choice.sel) || g.list[0] || null;
  };

  /** The scoring a choice asks for, as score parts over the kept score (null: none to change). */
  function scoringParts(choice, spec) {
    if (!choice.scoring || choice.scoring === 'standard') return null;
    const ms = moments();
    if (choice.scoring === 'no-loss') {
      const neg = ms.filter((m) => ptsOf(m, spec) < 0);
      return neg.length ? { points: Object.fromEntries(neg.map((m) => [m.id, 0])) } : null;
    }
    if (choice.scoring === 'big') {
      const pos = ms.filter((m) => ptsOf(m, spec) > 0).sort((a, b) => ptsOf(b, spec) - ptsOf(a, spec));
      if (pos.length < 4) return null;
      const want = Math.max(3, Math.min(8, Math.ceil(pos.length / 3)));
      const bar = ptsOf(pos[want - 1], spec);
      const only = pos.filter((m) => ptsOf(m, spec) >= bar).slice(0, 8).map((m) => m.id);
      return { only };
    }
    return null;
  }

  /** The game as chosen: the rail game's spec here, with its team size, what scores, a bet, a way to win and up to two twists. */
  function build(span, choice) {
    return memo(`build|${spanKey(span)}|${choiceKey(choice)}`, () => {
      const row = rowOf(span, choice);
      if (!row) return null;
      let keep = keepOf(row.spec);
      if (choice.cnt && choice.cnt.each && keep.get && keep.get.by === 'draft') keep.get = { ...keep.get, each: choice.cnt.each };
      if (choice.cnt && choice.cnt.play && keep.count) keep.count = keep.count.start ? { ...keep.count, start: choice.cnt.play } : keep.count.best ? { ...keep.count, best: choice.cnt.play } : keep.count;
      if (keep.score && keep.score.by === 'moments') {
        const sp = scoringParts(choice, row.spec);
        if (sp) {
          keep.score = { ...keep.score, points: { ...(keep.score.points || {}), ...(sp.points || {}) } };
          if (sp.only) keep.score.only = sp.only;
        }
        const added = (choice.added || []).filter((a) => a && a.id);
        if (Object.keys(choice.edits || {}).length || (choice.off || []).length || added.length) {
          const all = moments().map((m) => m.id);
          const base = Array.isArray(keep.score.only) ? keep.score.only : all;
          const on = [...new Set(base.concat(Object.keys(choice.edits || {}), added.map((a) => a.id)))].filter((id) => !(choice.off || []).includes(id));
          const pts = { ...(keep.score.points || {}), ...(choice.edits || {}) };
          for (const a of added) if (pts[a.id] == null) pts[a.id] = a.pts || 1;
          keep.score = { ...keep.score, points: Object.keys(pts).length ? pts : null };
          if (on.length < all.length || added.length) keep.score.only = on;
          else delete keep.score.only;
        }
        if (keep.score.points && !Object.keys(keep.score.points).length) keep.score.points = null;
      }
      if (Array.isArray(keep.ask) && Object.keys(choice.qedits || {}).length) keep.ask = keep.ask.map((q) => (choice.qedits[q.id] != null ? { ...q, points: choice.qedits[q.id] } : q));
      if (choice.bet) {
        const m = moneyOf(keep);
        if (m[choice.bet]) keep = m[choice.bet];
      }
      const win = choice.win || row.win;
      const base = (KINDS.find((k) => k.id === row.game) || {}).base;
      // A way to win picked is locked and rolled; else the game keeps its own (its rank, as it came).
      const winRoll = choice.win ? rollWin(choice.win, base) : null;
      if (!choice.win && row.spec.rank) keep.rank = clone(row.spec.rank);
      const unchanged = !choice.win && !(choice.tws || []).length && !choice.bet && !changed(choice);
      if (unchanged && row.kind !== 'standard') return { row, win, r: { ok: true, spec: clone(row.spec), describe: row.describe, why: null, seed: row.seed }, keep };
      const r = roll({ length: span, ...(base ? { base } : {}), ...(winRoll ? { win: winRoll } : {}), twists: choice.tws || [], keep }, `c-${row.id}${row.seed ? `-${row.seed}` : ''}`);
      return { row, win, r, keep };
    });
  }

  /** What can change from here, each checked by the engine: a way to win, a twist (two at most), a bet. */
  function winOk(span, choice, w) {
    return memo(`win|${spanKey(span)}|${choiceKey(choice)}|${w}`, () => {
      const c = build(span, choice);
      if (!c || !c.r.ok) return { ok: false, why: 'Nothing fits these episodes yet' };
      if (w === c.win) return { ok: true };
      // One episode has no "each episode" to cut, streak or race through.
      if (nOf(span, input) === 1 && ['last', 'weeks', 'streak', 'race'].includes(w)) return { ok: false, why: `Needs a few ${input.part.plural}: this game is one` };
      const b = build(span, { ...choice, win: w });
      return b && b.r.ok ? { ok: true } : { ok: false, why: whyNot(span, choice, b && b.r.why, WINS.find((x) => x.id === w).label) };
    });
  }
  function twistOk(span, choice, id) {
    return memo(`tw|${spanKey(span)}|${choiceKey(choice)}|${id}`, () => {
      const c = build(span, choice);
      if (!c || !c.r.ok || (choice.tws || []).includes(id) || (choice.tws || []).length >= 2) return null;
      const b = build(span, { ...choice, tws: (choice.tws || []).concat([id]) });
      if (!b || !b.r.ok || b.r.describe.sentence === c.r.describe.sentence) return null;
      return { ok: true, times: b.r.spec && b.r.spec.score && b.r.spec.score.captain && b.r.spec.score.captain.times };
    });
  }
  function bets(span, choice) {
    return memo(`bets|${spanKey(span)}|${choiceKey(choice)}`, () => {
      const base = build(span, { ...choice, bet: '' });
      if (!base || !base.r.ok) return [];
      const out = [];
      for (const id of Object.keys(moneyOf(base.keep))) {
        if (id === choice.bet) {
          out.push(id);
          continue;
        }
        const b = build(span, { ...choice, bet: id });
        if (b && b.r.ok && b.r.describe.sentence !== base.r.describe.sentence) out.push(id);
      }
      return out;
    });
  }
  function options(span, choice) {
    const wins = Object.fromEntries(WINS.map((w) => [w.id, winOk(span, choice, w.id)]));
    const tws = {};
    for (const id of Object.keys(TWISTS)) {
      const v = twistOk(span, choice, id);
      if (v) tws[id] = v;
    }
    return { wins, tws, bets: bets(span, choice) };
  }

  /** The game's name: a rail game's, or the engine's title for a shuffled or typed one. */
  function nameOf(span, choice) {
    const c = build(span, choice);
    if (!c) return 'this game';
    if (c.row.kind === 'typed' && c.row.name) return c.row.name;
    return c.row.kind === 'shuffle' && c.r.ok ? c.r.describe.short.title : c.row.name;
  }

  function whyNot(span, choice, why, what) {
    return !why || /^Nothing fits those locks/.test(why) ? `${what} doesn’t work with ${nameOf(span, choice)} for these ${input.part.plural}` : why;
  }

  /** What changed from the game as it came, in words (Your version's line). */
  function changes(span, choice) {
    const c = build(span, choice);
    if (!c) return [];
    const out = [];
    if (choice.win && choice.win !== c.row.win) out.push(WINS.find((w) => w.id === choice.win).label);
    const times = c.r.spec && c.r.spec.score && c.r.spec.score.captain && c.r.spec.score.captain.times;
    for (const id of choice.tws || []) out.push(twistLabel(id, times));
    if (choice.bet) out.push(MONEY[choice.bet][0]);
    if (choice.scoring && choice.scoring !== 'standard') out.push(`Scoring: ${SCORINGS[choice.scoring].name}`);
    if (choice.cnt && choice.cnt.each) out.push(`A team of ${choice.cnt.each}`);
    if (choice.cnt && choice.cnt.play) out.push(`${c.r.spec && c.r.spec.count && c.r.spec.count.best ? 'Best' : 'Play'} ${choice.cnt.play}`);
    const n = Object.keys(choice.edits || {}).length + (choice.off || []).length + Object.keys(choice.qedits || {}).length + (choice.added || []).length;
    if (n) out.push(`${n} scoring ${n === 1 ? 'change' : 'changes'}`);
    return out;
  }

  /** What scores, named ("What scores: Standard points", "…, changed"). */
  function scoringName(span, choice) {
    const c = build(span, choice);
    if (!c || !c.r.ok) return '';
    const k = scoreKind(c.r.spec);
    const n = Object.keys(choice.edits || {}).length + (choice.off || []).length + Object.keys(choice.qedits || {}).length + (choice.added || []).length;
    const sc = c.row.spec.score || {};
    const name =
      k === 'asks'
        ? 'Right answers'
        : k === 'card'
          ? 'Bingo lines'
          : k === 'survive'
            ? 'Picks who stay in'
            : k === 'place'
              ? 'How long they last'
              : choice.scoring && choice.scoring !== 'standard'
                ? SCORINGS[choice.scoring].name
                : sc.only || (sc.points && Object.keys(sc.points).some((id) => sc.points[id] !== 0))
                  ? `${possessive(nameOf(span, choice))} own`
                  : 'Standard points';
    return name + (n ? ', changed' : '');
  }

  /** What scores in a line under its row: up to six counting moments with their points, else a count. */
  function scoreLine(span, choice) {
    const c = build(span, choice);
    if (!c || !c.r.ok) return '';
    const spec = c.r.spec;
    const k = scoreKind(spec);
    const n = Object.keys(choice.edits || {}).length + (choice.off || []).length + Object.keys(choice.qedits || {}).length;
    const own = (choice.added || []).length ? ` + ${choice.added.length} of your own` : '';
    const chg = own + (n ? ` · ${n} changed` : '');
    if (k === 'asks') {
      const q = spec.ask.filter((x) => x.answer !== 'ticket');
      const tk = spec.ask.some((x) => x.answer === 'ticket');
      if (spec.card && q.some((x) => x.card)) return `A sheet of ${spec.card.each} moments${tk ? ' and a ticket' : ''}${chg}`;
      return `${q.length} ${q.length === 1 ? 'question' : 'questions'}${tk ? ' and a ticket' : ''}${chg}`;
    }
    if (k === 'survive') return `Who stays in each ${part}`;
    if (k === 'place') return 'How long your people last';
    if (k === 'card') return `A card of squares each ${part}`;
    if (k !== 'moments') return '';
    const counting = moments(choice)
      .concat((choice.added || []).map((a) => ({ id: a.id, says: a.says, pts: a.pts })))
      .filter((m) => momentPts(spec, m) !== 0);
    if (counting.length && counting.length <= 6) return counting.map((m) => `${m.says} ${fmt(momentPts(spec, m))}`).join(' · ') + own;
    return `${counting.length} moments${chg}`;
  }

  /** What scores, row by row (moments with this game's points, or its questions). */
  function scoreRows(span, choice) {
    const c = build(span, choice);
    if (!c || !c.r.ok) return { kind: 'other', rows: [] };
    const spec = c.r.spec;
    const k = scoreKind(spec);
    if (k === 'moments') {
      const orig = c.row.spec;
      const rows = moments(choice)
        .concat((choice.added || []).map((a) => ({ id: a.id, says: a.says, pts: a.pts, added: true })))
        .map((m) => {
          const p = momentPts(spec, m);
          const was = m.added ? 0 : momentPts(orig, m);
          return { id: m.id, says: m.says, pts: p, on: p !== 0, was, changed: p !== was && !m.added, added: !!m.added, base: m.added ? m.pts || 1 : ptsOf(m, spec) };
        });
      return { kind: k, rows };
    }
    if (k === 'asks') {
      return {
        kind: k,
        rows: spec.ask
          .filter((q) => q.answer !== 'ticket')
          .map((q) => ({ id: q.id, says: q.card && spec.card ? `Who does each of the ${spec.card.each} moments on the sheet` : q.ask, asked: q.asked, pts: q.points == null ? 1 : q.points, wager: q.wager, odds: q.odds, fixed: q.answer === 'calls' })),
        bank: spec.score && spec.score.bank ? spec.score.bank.start : null,
        parlay: spec.score && Array.isArray(spec.score.parlays) ? spec.score.parlays[0].times : null,
      };
    }
    return { kind: k, rows: [] };
  }

  /** A moment set on (it counts, at `pts`) or off: the choice it makes, or why the engine won't. */
  function setMoment(span, choice, id, on, pts) {
    const c = build(span, choice);
    if (!c) return { why: 'Nothing to change' };
    const added = (choice.added || []).find((a) => a.id === id);
    if (added) {
      const next = on ? choice.added.map((a) => (a.id === id ? { ...a, pts: Math.max(1, Math.min(10, Math.round(pts))) } : a)) : choice.added.filter((a) => a.id !== id);
      return { choice: { ...choice, added: next } };
    }
    const m = moments().find((x) => x.id === id) || { id, pts: 0 };
    const orig = momentPts(c.row.spec, m);
    let off = (choice.off || []).filter((x) => x !== id);
    const e = { ...(choice.edits || {}) };
    const val = Math.max(-10, Math.min(10, Math.round(pts)));
    if (!on || val === 0) {
      if (orig !== 0) off = off.concat([id]);
      delete e[id];
    } else if (val === orig) delete e[id];
    else e[id] = val;
    const next = { ...choice, off, edits: e };
    const b = build(span, next);
    if (!b || !b.r.ok) return { why: /only/.test((b && b.r.why) || '') ? 'Keep at least one moment counting' : (b && b.r.why) || 'The engine can’t score that' };
    return { choice: next };
  }

  /** A question's points changed: the choice, or why not. */
  function setQuestion(span, choice, id, v) {
    const e = { ...(choice.qedits || {}), [id]: Math.max(0, Math.min(20, Math.round(v))) };
    const next = { ...choice, qedits: e };
    const b = build(span, next);
    return !b || !b.r.ok ? { why: (b && b.r.why) || 'The engine can’t score that' } : { choice: next };
  }

  /** A count changed (team size, how many play): the choice, or why not. */
  function setCount(span, choice, which, v) {
    const next = { ...choice, cnt: { ...(choice.cnt || {}), [which]: v } };
    const b = build(span, next);
    return !b || !b.r.ok ? { why: (b && b.r.why) || 'That doesn’t fit' } : { choice: next };
  }

  /** The scorings a moments game can take here, in turn (standard first). */
  function scorings(span, choice) {
    const c = build(span, choice);
    if (!c || !c.r.ok || scoreKind(c.r.spec) !== 'moments') return [];
    return Object.keys(SCORINGS).filter((id) => id === 'standard' || (scoringParts({ scoring: id }, c.row.spec) && (() => {
      const b = build(span, { ...choice, scoring: id, edits: {}, off: [] });
      return !!(b && b.r.ok);
    })()));
  }

  // ---------- the quick changes (the user, 2026-11-08: the game card's four buttons) ----------

  /** The moves a quick change would make, in turn; the first the engine accepts is the one it makes. */
  function quickMoves(span, choice, kind) {
    const c = build(span, choice);
    if (!c || !c.r.ok) return [];
    const g = games(span);
    const tws = choice.tws || [];
    const twist = (id, says) => {
      const v = tws.length < 2 && !tws.includes(id) ? twistOk(span, choice, id) : null;
      return v ? [{ says: says || low(twistLabel(id, v.times)), over: { tws: tws.concat([id]) }, step: TWISTS[id].step }] : [];
    };
    const r0 = RANK[c.win] == null ? 1 : RANK[c.win];
    const win = (w, says, down) => (c.win !== w && (down ? RANK[w] < r0 : RANK[w] > r0) && winOk(span, choice, w).ok ? [{ says, over: { win: w }, step: 'win' }] : []);
    const kindTo = (k, says) => (g.list.some((x) => x.id === k) ? [{ says, kind: k, step: 'each' }] : []);
    const fam = c.row.game;
    if (kind === 'comp') {
      const h2h = () => win('h2h', `head to head each ${part}`);
      const last = () => win('last', `the lowest each ${part} is out`);
      if (TEAM.includes(fam)) return [...h2h(), ...twist('captain'), ...last(), ...twist('bounty'), ...twist('boot-call')];
      if (fam === 'pool') return [...twist('never-twice'), ...twist('boot-call'), ...last(), ...h2h()];
      return [...twist('only-right'), ...h2h(), ...twist('boot-call'), ...last(), ...twist('never-twice')];
    }
    if (kind === 'casual') {
      const on = tws.filter((id) => COMPETITIVE[id]);
      const out = [];
      if (on.length) {
        const id = on[on.length - 1];
        out.push({ says: COMPETITIVE[id], over: { tws: tws.filter((x) => x !== id) }, step: TWISTS[id].step });
      }
      if (r0 > 1) out.push(...win('points', 'most points wins', true));
      if (fam === 'lineup') out.push(...kindTo('bestball', 'now Best Ball, no lineups to set'));
      out.push(...twist('mulligan', 'one wrong pick forgiven'));
      if (fam === 'bestball') out.push(...kindTo('outlast', 'now Outlast: draft once, then just watch'));
      return out;
    }
    if (kind === 'score') {
      const k = scoreKind(c.r.spec);
      if (k === 'moments') {
        const list = scorings(span, choice);
        if (list.length < 2) return [];
        const i0 = Math.max(0, list.indexOf(choice.scoring || 'standard'));
        return list
          .slice(i0 + 1)
          .concat(list.slice(0, i0))
          .map((id) => ({ says: id === 'standard' ? SCORINGS.standard.says(show) : SCORINGS[id].name, over: { scoring: id, edits: {}, off: [] }, step: 'each' }));
      }
      if (k === 'asks') {
        const SHARE = ['split-pot', 'rollover'];
        const cur = tws.find((x) => SHARE.includes(x)) || null;
        const rest = tws.filter((x) => !SHARE.includes(x));
        const order = [null, 'split-pot', 'rollover'];
        const i0 = order.indexOf(cur);
        const out = [];
        for (let j = 1; j < order.length; j++) {
          const id = order[(i0 + j) % order.length];
          if (id && rest.length >= 2) continue;
          out.push({ says: id ? low(twistLabel(id)) : 'a point for each right answer', over: { tws: id ? rest.concat([id]) : rest }, step: 'each' });
        }
        return out;
      }
    }
    return [];
  }

  /** The move a quick change makes next, or null (nothing left: the button is dashed and says why). */
  function quickNext(span, choice, kind) {
    return memo(`qn|${spanKey(span)}|${choiceKey(choice)}|${kind}`, () =>
      quickMoves(span, choice, kind).find((x) => {
        if (x.kind) return true;
        const b = build(span, { ...choice, ...x.over });
        return !!(b && b.r.ok);
      }) || null
    );
  }

  /** The four quick changes, each with its next step on a second line, or dashed with why. `ai`: Creative moments' wait words. */
  function quick(span, choice, ai) {
    const c = build(span, choice);
    if (!c || !c.r.ok) return [];
    const moments = scoreKind(c.r.spec) === 'moments';
    return [
      ['comp', 'More competitive'],
      ['casual', 'More casual'],
      ['score', 'Different scoring'],
      ['creative', 'Creative moments'],
    ].map(([id, label]) => {
      if (id === 'creative') return { id, label, next: moments ? `Our AI · ${ai || 'about 40 s'}` : 'Not in this game', off: !moments };
      const m = quickNext(span, choice, id);
      return { id, label, next: m ? cap(m.says) : nothingLeft(span, choice, id), off: !m };
    });
  }

  function nothingLeft(span, choice, kind) {
    if (kind === 'comp' && (choice.tws || []).length >= 2) return 'Two twists at most';
    if (kind === 'comp') return 'As competitive as it gets here';
    if (kind === 'casual') return 'As casual as it gets here';
    return 'It scores one way here';
  }

  /** A quick change applied: the new choice, its toast (with Undo), and the step it touched (outlined for a moment); or why not. */
  function applyQuick(span, choice, kind) {
    const c = build(span, choice);
    if (!c || !c.r.ok) return { why: 'Nothing to change yet' };
    const name = nameOf(span, choice);
    if (kind === 'creative') return scoreKind(c.r.spec) === 'moments' ? { creative: true } : { why: `${name} doesn’t score moments: a team game does` };
    const m = quickNext(span, choice, kind);
    if (!m) {
      const why =
        kind === 'comp' && (choice.tws || []).length >= 2
          ? 'Two twists at most: take one off in the steps to go further'
          : kind === 'comp'
            ? `That’s as competitive as ${name} gets for these ${input.part.plural}`
            : kind === 'casual'
              ? `That’s as casual as ${name} gets for these ${input.part.plural}`
              : `${name} scores one way here: ${scoringName(span, choice)}`;
      return { why };
    }
    const text = `${{ comp: 'More competitive', casual: 'More casual', score: 'Scoring' }[kind]}: ${m.says}`;
    if (m.kind) {
      // One team game to another: what scores comes along where the new one scores moments; what can't is named.
      const keepsMoments = m.kind !== 'outlast';
      const gone = [choice.bet ? 'your bet' : '', !keepsMoments && ((choice.added || []).length || (choice.scoring && choice.scoring !== 'standard')) ? 'your moments' : ''].filter(Boolean);
      const next = { ...fresh(), sel: m.kind, ...(keepsMoments ? { added: choice.added || [], scoring: choice.scoring || 'standard' } : {}) };
      return { choice: next, toast: text + (gone.length ? ` · ${gone.join(' and ')} ${gone.length > 1 ? 'start' : 'starts'} over` : ''), step: m.step };
    }
    return { choice: { ...choice, ...m.over }, toast: text, step: m.step };
  }

  // ---------- Surprise me ----------

  /** A shuffled game for the span, with `locks` kept ({ game, win } from the current one); null with why when nothing fits. */
  function shuffle(span, choice, locks, n) {
    const c = build(span, choice);
    const l = { length: span };
    if (locks && locks.game && c) l.base = (KINDS.find((k) => k.id === c.row.game) || {}).base;
    if (locks && locks.win && c) l.win = (WINS.find((w) => w.id === c.win) || {}).roll;
    const seed = `sh-${spanKey(span)}-${n}`;
    // A game in stages (the redraft, trivia too) can't start from here yet: the next seed instead.
    let r = null;
    for (let i = 0; i < 12; i++) {
      r = roll(l, i ? `${seed}.s${i}` : seed);
      if (!r.ok || !Array.isArray(r.spec.stages)) break;
    }
    if (!r.ok) return { why: r.why || 'Nothing fits those locks: unlock one' };
    if (Array.isArray(r.spec.stages)) return { why: 'Nothing fits those locks: unlock one' };
    const game = KIND_OF_BASE[r.base] || 'predictions';
    const row = { id: 'shuffle', kind: 'shuffle', game, name: r.describe.short.title, win: winOfSpec(r.spec), spec: r.spec, describe: r.describe, seed: String(r.seed) };
    return { choice: { ...fresh(), sel: 'shuffle', row } };
  }

  /** A typed game (our AI's, checked) as a choice the sheet can change: its spec on these episodes. */
  function typed(span, spec, name) {
    const s = clone(spec);
    s.span = span;
    const base = kindOfSpec(s);
    const problems = G.specProblems(s, ctx);
    if (problems.length) return { why: problems[0].problem };
    const d = G.describeSpec(s, ctx);
    const row = { id: 'typed', kind: 'typed', game: base, name: name || d.short.title, win: winOfSpec(s), spec: s, describe: d, seed: `typed-${hash(JSON.stringify(s))}` };
    return { choice: { ...fresh(), sel: 'typed', row } };
  }

  // ---------- the footer ----------

  /** What happens next, in words: "Next: everyone picks a team of 5, before Wed 8 PM". `when(n)`: an episode's air time in words. */
  function nextLine(span, spec, when) {
    const s = spec || {};
    const g = s.get || {};
    const first = isObj(span.from) ? `${phaseName(input, span.from)} starts` : `${cap(part)} ${span.from}`;
    const at = typeof span.from === 'number' && when ? when(span.from) : null;
    const before = at ? `before ${at}` : `before ${first}`;
    if (g.by === 'draft') return `Next: everyone picks a team of ${g.each}, ${before}`;
    if (g.by === 'card' || (s.score && s.score.by === 'lines')) return `Next: everyone gets a card when ${typeof span.from === 'number' ? `${cap(part)} ${span.from}` : first} starts`;
    if (s.score && s.score.by === 'survive') return `Next: everyone picks who stays in, ${before}`;
    if (g.by === 'pick') return `Next: everyone picks ${g.each}, ${before}`;
    const qs = Array.isArray(s.ask) ? s.ask.filter((q) => q.answer !== 'ticket').length : 0;
    if (qs) return `Next: everyone answers ${qs === 1 ? 'a question' : `${qs} questions`}, ${before}`;
    return `Next: it starts with ${first}`;
  }

  return {
    games,
    build,
    options,
    winOk,
    twistOk,
    bets,
    nameOf,
    changes,
    scoringName,
    scoreLine,
    scoreRows,
    setMoment,
    setQuestion,
    setCount,
    scorings,
    quick,
    quickNext,
    applyQuick,
    shuffle,
    typed,
    nextLine,
    steps: (spec) => steps(spec, input),
    plainLine: (spec) => plainLine(spec, input),
    momentPts,
  };
}

/** A spec's kind of game (KINDS' id) from its own parts, never a league type's name: a typed or made-for game's. */
function kindOfSpec(s) {
  if (s.get && s.get.by === 'draft') return s.count && s.count.start ? 'lineup' : s.count && s.count.best ? 'bestball' : 'outlast';
  if (s.score && s.score.by === 'survive') return 'pool';
  if (s.score && s.score.by === 'lines') return 'bingo';
  if (s.get && s.get.by === 'pick') return 'picks';
  return Array.isArray(s.ask) && s.ask.some((q) => q && q.answer === 'calls') ? 'calls' : 'predictions';
}

/** A short, stable hash of a string (FNV-1a), for a typed game's seed. */
function hash(text) {
  let a = 2166136261;
  for (let i = 0; i < text.length; i++) {
    a ^= text.charCodeAt(i);
    a = Math.imul(a, 16777619);
  }
  return (a >>> 0).toString(36);
}

/** "Outlast's", "Weekly Picks'". */
const possessive = (name) => (/s$/.test(name) ? `${name}’` : `${name}’s`);

const fmt = (n) => (n < 0 ? `−${-n}` : String(n));

/** A choice's key for the memo (the row by its seed, never its whole spec). */
function choiceKey(c) {
  return JSON.stringify([c.sel, c.row ? c.row.seed || c.row.id : null, c.win, c.tws, c.bet, c.cnt, c.scoring, c.edits, c.off, c.qedits, (c.added || []).map((a) => [a.id, a.pts])]);
}

module.exports = { KINDS, WINS, TWISTS, TWIST_GROUPS, MONEY, kindOfSpec, winOfSpec, SCORINGS, fresh, timing, sayRange, nTag, nOf, normalSpan, partsOf, steps, plainLine, twistLabel, scoreKind, moneyOf, keepOf, createWizard, choiceKey };
