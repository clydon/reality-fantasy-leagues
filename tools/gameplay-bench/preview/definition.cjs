// A live preview's definition from a real season (docs/PLAN-preview-release.md, step 1): any season, at the person's own mark, with the
// game they're making. Pure: it reads nothing. The app reads the season (src/lib/server/preview-definition.ts: the cast, the
// calendar, the real results through the mark, the season page as the person sees it) and hands it here; the dev proof hands it the
// same from its recordings (scripts/dev-test/preview-proof.js), so both make the same definition.
//
// The spoiler rule (the plan's decision 5): `season.mark` is what the app's own guard lets this person be told about (guard.ts
// seenThrough, "everything" as the latest aired), and nothing real past it goes in: the real results are only those through the mark
// (`build` refuses any later one), the made-up moments' rates come from those same episodes, and the cast is names and photos only
// (never a format's secret fields, the Traitors' role: guard.ts secretFields). Episodes after the mark and before the game's start
// are made up here; the rest are made up as the story plays (resultsFor).
//
//   const P = require('./definition.cjs')
//   P.build(season, { base, changes, gameId, gameName, seed, merge }) -> the v2 definition
//   P.verdict(definition) -> { ok, why, gaps }: whether the runtime can play it (asked before anything is made)
//   P.resultsFor(season) -> (session, n) => episode n's made-up results, shaped like the season's
//   P.mixTribes(cast)    -> the cast a tribe at a time in turn (so a smaller pool still has every tribe)
'use strict';
const path = require('path');
const D = require('../explorer/document.cjs');
const J = require('../explorer/json.cjs');
const { resultsData } = require('../explorer/publish.cjs');
const root = path.resolve(__dirname, '../../..');
const G = require(path.join(root, 'src/lib/game/start-gallery/index.js'));
const Formats = require(path.join(root, 'src/lib/game/formats'));

const HOUR = 3600000;
/** The preview's couch: made-up people (the zt fixture couch's names), Alex first: Alex runs the game and is the viewer. */
const COUCH = ['Alex', 'Riley', 'Jordan', 'Sam'].map((name) => ({ id: name.toLowerCase(), name }));
/** The fields a cast member may carry into a preview: who they are, never what a format keeps secret. */
const CAST_FIELDS = ['name', 'photoUrl', 'tribe'];

const roll = (seed, ...parts) => parseInt(J.digest([seed, ...parts]).slice(0, 8), 16);
const momentId = (n, type, who) => 'moment-' + J.digest([n, type, who]).slice(0, 16);

function mixTribes(cast) {
  const byTribe = new Map();
  for (const c of cast) byTribe.set(c.tribe || '', [...(byTribe.get(c.tribe || '') || []), c]);
  const lists = [...byTribe.values()], mixed = [];
  for (let i = 0; mixed.length < cast.length; i++) for (const l of lists) if (l[i]) mixed.push(l[i]);
  return mixed;
}

/** The season checked: what `build` needs, and nothing real past the mark. */
function checked(season) {
  const need = (ok, why) => { if (!ok) throw Object.assign(Error('No preview for this season: ' + why), { code: 'preview-season' }); };
  need(season && Array.isArray(season.cast) && season.cast.length >= 4, 'it has no cast yet');
  need(Array.isArray(season.episodes) && season.episodes.length, 'its episodes aren\'t listed');
  need(Number.isInteger(season.mark) && season.mark >= 0, 'no mark');
  need(Number.isInteger(season.from) && season.from > season.mark, 'the game starts before the mark');
  need(season.episodes.some((e) => e.number >= season.from), 'nothing left to play');
  need(season.page && season.page.ctx, 'no season page');
  const late = (season.real || []).find((x) => !(x.n <= season.mark));
  if (late) throw Object.assign(Error(`A real result past the mark (Episode ${late.n}, mark ${season.mark}) can't go in a preview`), { code: 'preview-spoiler' });
  const extra = season.cast.flatMap((c) => Object.keys(c).filter((k) => !CAST_FIELDS.includes(k)));
  if (extra.length) throw Object.assign(Error('A cast member carries more than who they are: ' + [...new Set(extra)].join(', ')), { code: 'preview-spoiler' });
  return season;
}

/**
 * How often a moment happens per cast member still in, when a season gives nothing to go by (no episode seen, no other season of the
 * show): one of a few made-up rates, the same for a moment whatever the show (by its id alone), so a preview of a premiere still has
 * nights where things happen. Nothing in it is any show's: every format's own moments get one (the user, 2026-11-20: the bank is
 * generic, placeholders are fine).
 */
const TYPICAL = [0.01, 0.02, 0.04, 0.08, 0.16];
const typicalRate = (type) => TYPICAL[roll('typical', type) % TYPICAL.length];

/** How often each moment happened per cast member still in, over the episodes through the mark (season.rates if given). Empty when
 *  there's nothing to go by: the made-up moments then use typicalRate for each of the format's own. */
function ratesOf(season) {
  if (season.rates && Object.keys(season.rates).length) return season.rates;
  return season.cast ? learnedRates(season) : {};
}
function learnedRates(season) {
  const real = season.real || [], cast = season.cast.length;
  const exits = real.filter((x) => x.kind === 'elimination');
  let castEpisodes = 0;
  for (let n = 1; n <= season.mark; n++) castEpisodes += cast - exits.filter((x) => x.n < n).length;
  const rates = {};
  if (!castEpisodes) return rates;
  for (const x of real) if (x.kind === 'event' && x.type) rates[x.type] = (rates[x.type] || 0) + 1 / castEpisodes;
  return rates;
}

/** The format's moments a preview can score (the season's own beyond them are left out: the world's rulebook is the format's). */
const formatOf = (id) => Formats.formatFor(id || 'survivor');
const knownOf = (season) => new Set(formatOf(season.format).events.map((e) => e.id));

/** How someone leaves in a made-up episode: the format's own first way out that isn't its winner's or an endgame's (its own word). */
function exitOf(id) {
  const f = formatOf(id), end = new Set([f.winnerExitMethod, ...(f.endgameExitMethods || []), 'Other']);
  return f.exitMethods.find((m) => !end.has(m)) || f.exitMethods[0];
}

/** The moments the format tags as being safe (never given to someone who left that night). */
const safeOf = (id) => new Set(formatOf(id).events.filter((e) => (e.tags || []).includes('safe')).map((e) => e.id));

/** An episode's moments: each of the format's own at the season's rate (typicalRate with nothing to go by) among those still in,
 *  given at random (by the seed). Nothing about any one show: only the format's own moments and tags. */
function shapedMoments(rates, seed, n, still, outs, known, safe) {
  const out = new Set(outs.map((o) => o.castawayId)), list = [], typical = !Object.keys(rates).length;
  const kinds = (typical ? [...known] : Object.keys(rates).filter((t) => known.has(t))).sort();
  for (const type of kinds) {
    const want = (typical ? typicalRate(type) : rates[type]) * still.length, k = Math.floor(want) + ((roll(seed, n, type, 'frac') % 1000) / 1000 < want - Math.floor(want) ? 1 : 0);
    const pool = still.filter((id) => !(safe.has(type) && out.has(id))).sort((a, b) => roll(seed, n, type, a) - roll(seed, n, type, b));
    for (const id of pool.slice(0, k)) list.push({ id: momentId(n, type, id), type, castawayId: id });
  }
  return list;
}

/** The real results through the mark, as supplied facts, by the dress's ids (named as the season names them). */
function realFacts(season, participants, known) {
  const idOf = new Map(participants.map((p) => [p.name, p.id]));
  const id = (name) => { const x = idOf.get(name); if (!x) throw Error('No participant named ' + name + ' in the cast'); return x; };
  const facts = [];
  for (let n = 1; n <= season.mark; n++) {
    const rows = (season.real || []).filter((x) => x.n === n);
    const events = rows.filter((x) => x.kind === 'elimination').map((x) => ({ castawayId: id(x.name), method: x.method || exitOf(season.format) }));
    const seen = new Set();
    const scoringEvents = rows.filter((x) => x.kind === 'event' && known.has(x.type))
      .filter((x) => { const k = x.type + '|' + x.name; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((x) => ({ id: momentId(n, x.type, x.name), type: x.type, castawayId: id(x.name) }));
    facts.push({ id: 'fact-show-event-' + n, eventId: 'show-event-' + n, contextId: 'show', source: 'real-season', data: { events, scoringEvents, ...(events.length ? {} : { noExit: true }) } });
  }
  return facts;
}

/** Episodes after the mark and before the game starts, made up (someone goes home each, the moments at the season's rates). */
function madeUpBefore(season, participants, facts, known, seed) {
  const rates = ratesOf(season), out = [], way = exitOf(season.format), safe = safeOf(season.format);
  const gone = new Set(facts.flatMap((f) => (f.data.events || []).map((o) => o.castawayId)));
  for (let n = season.mark + 1; n < season.from; n++) {
    const still = participants.map((p) => p.id).filter((x) => !gone.has(x));
    const who = still.slice().sort((a, b) => roll(seed, n, 'out', a) - roll(seed, n, 'out', b))[0];
    const events = who ? [{ castawayId: who, method: way }] : [];
    if (who) gone.add(who);
    out.push({ id: 'fact-show-event-' + n, eventId: 'show-event-' + n, contextId: 'show', source: 'made-up', data: { events, scoringEvents: shapedMoments(rates, seed, n, still, events, known, safe), ...(events.length ? {} : { noExit: true }) } });
  }
  return out;
}

/** The game: a gallery base from the game's start, with the gallery's changes on it, checked on the season's page. */
function gameSpec(pg, base, changes) {
  const b = G.baseById(base);
  if (!b) throw Object.assign(Error('No gallery game ' + base), { code: 'preview-game' });
  let spec = G.baseSpec(b, { from: pg.from, to: null }, pg);
  for (const c of changes || []) spec = G.applyChange(spec, c, pg);
  const verdict = G.check(spec, pg);
  if (!verdict.ok) throw Object.assign(Error('The game doesn\'t check: ' + verdict.problems.join('; ')), { code: 'preview-game' });
  return { spec, name: b.name };
}

/** A game's rules as the gallery holds them (a person's own, so checked as a base's are before anything plays them). */
function specChecked(pg, spec, name) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw Object.assign(Error('Not a game'), { code: 'preview-game' });
  const verdict = G.check(spec, pg);
  if (!verdict.ok) throw Object.assign(Error("The game doesn't check: " + verdict.problems.join('; ')), { code: 'preview-game' });
  return { spec, name };
}

/**
 * A stage a format change starts (a stage's `on`: a new draft whenever the format changes): in a made-up season the change is its
 * merge (the format's major change, tribes into individuals), so the stage plays from there, as a stage that starts at the merge
 * does (span from { phase: 'merged' }); the change's own settings (extras.changes: the maker's say, a vote) go with it. A format
 * without a merge keeps it as it is (the explorer's gap).
 */
function atTheMerge(spec, ctx) {
  if (!Array.isArray(spec.stages) || !spec.stages.some((st) => st && st.on)) return spec;
  if (!(ctx.phases || []).some((p) => p.id === 'merged')) return spec;
  const stages = spec.stages.map((st) => {
    if (!st || !st.on) return st;
    const { on, ...rest } = st;
    return { ...rest, game: { ...st.game, span: { ...(st.game.span || {}), from: { phase: 'merged' } } } };
  });
  const extras = spec.extras ? Object.fromEntries(Object.entries(spec.extras).filter(([k]) => k !== 'changes')) : undefined;
  return { ...spec, stages, ...(extras ? { extras } : {}) };
}

/** The made-up merge: halfway from the game's start to the season's last episode (season.merge when the season says). */
function mergeOf(season) {
  if (Number.isInteger(season.merge)) return season.merge;
  const last = Math.max(...season.episodes.map((e) => e.number));
  return Math.max(season.from + 1, Math.round((season.from + last) / 2));
}

function build(input, o = {}) {
  const season = checked(input);
  const seed = o.seed ?? 51, merge = o.merge ?? mergeOf(season), known = knownOf(season);
  const label = season.label || season.page.pack?.page || 'The season';
  const pg = G.pageFacts(season.page, { show: label });
  // The gallery's game as set (o.spec: its rules, its changes already in them), checked on the season's page as a base is; else a
  // base and its changes.
  const made = o.spec ? specChecked(pg, o.spec, o.gameName || (G.baseById(o.base || '') || {}).name || 'Your game') : gameSpec(pg, o.base || 'fantasy', o.changes);
  const spec = atTheMerge(made.spec, season.page.ctx), name = made.name;
  const moments = season.page.ctx.moments.filter((m) => known.has(m.id));
  const count = season.page.ctx.pool || season.cast.length;
  if (count > season.cast.length) throw Object.assign(Error('No preview for this season: its cast is smaller than its game\'s pool'), { code: 'preview-season' });
  // The cast in the order the caller dealt it (the app: mixTribes of the season's order; the proof: its recording, already mixed).
  const dealt = season.cast.slice(0, count);
  // The season's tribes as its cast lists them (2 to 4: a draft spread across them, a tribe's moments), each person on their own.
  const tribeNames = [...new Set(dealt.map((c) => c.tribe).filter(Boolean))];
  const tribal = tribeNames.length >= 2 && tribeNames.length <= 4 && dealt.every((c) => c.tribe);
  const participants = dealt.map((c, i) => ({ id: 'show-participant-' + (i + 1), contextId: 'show', name: c.name, photoUrl: c.photoUrl || null, ...(tribal ? { tribeId: 'tribe-' + (tribeNames.indexOf(c.tribe) + 1) } : {}) }));
  const context = {
    id: 'show', kind: 'show', label, format: { id: season.format || 'survivor' },
    engine: { ...season.page.ctx, moments, couch: COUCH.length, pool: season.page.ctx.pool },
    phaseStarts: { merged: merge },
    ...(tribal ? { tribes: tribeNames.length, tribeNames } : {}),
    // Its results carry the server's own facts (resultsFor: a trivia round about each episode, who says its title quote).
    bank: true,
    // The art: given (the app's reader sends the real show's, as its URLs) or, without it, borrowed by slug (the dev proof's).
    dress: { name: season.show?.name || label, seasonName: season.seasonName || label, number: season.number, art: season.art ? { given: season.art } : { borrow: season.show?.slug || season.format || 'survivor' } },
  };
  const events = season.episodes.slice().sort((a, b) => a.number - b.number).map((e) => ({ id: 'show-event-' + e.number, contextId: 'show', number: e.number, airAt: e.airAt, resultStatus: e.number < season.from ? 'final' : 'unavailable' }));
  const real = realFacts(season, participants, new Set(moments.map((m) => m.id)));
  // (Made up: only the moments someone is given, never the format's automatic ones, which follow from the rest; as resultsFor.)
  const given = new Set(moments.filter((m) => !m.auto && !m.off).map((m) => m.id));
  const facts = withBank([...real, ...madeUpBefore(season, participants, real, given, seed)], participants, seed);
  const start = events.find((e) => e.number === season.from);
  return D.create({
    seed,
    world: { contexts: [context], people: COUCH, participants, events, facts },
    games: [{ id: o.gameId || 'fantasy', name: o.gameName || name, contextId: 'show', spec, timing: 'live-only' }],
    situation: { clock: new Date(Date.parse(start.airAt) - 5 * HOUR).toISOString(), viewerId: 'alex', marks: COUCH.map((p) => ({ personId: p.id, contextId: 'show', through: season.from - 1 })) },
    content: { labels: 'normal' },
  });
}

/**
 * Episode n's results as the story plays it: who goes out (the bench's own Publish: the finale crowns a winner and its finalists),
 * the moments shaped like the season's, and the bank: what research gives the server for each episode, as placeholders that fit any
 * show (the user, 2026-11-20: nothing in it is one show's; it needn't make sense, only have a right answer): the finale's votes (a
 * split question's), a round of trivia (asked before the next episode), and who says the title quote (an episode fact).
 */
function resultsFor(season) {
  const rates = ratesOf(season);
  return (s, n) => {
    const snap = s.snapshot(), doc = s.export().input, world = snap.contexts.show, e = world.events.find((x) => x.number === n);
    const data = resultsData(snap, doc, 'show', e.id, 'final');
    const gone = new Set(world.facts.filter((f) => f.eventId !== e.id).flatMap((f) => (f.data.events || []).map((o) => o.castawayId)));
    const still = world.participants.map((p) => p.id).filter((id) => !gone.has(id));
    const known = new Set(world.context.engine.moments.filter((m) => !m.auto && !m.off).map((m) => m.id));
    const last = Math.max(...world.events.map((x) => x.number));
    const scoringEvents = shapedMoments(rates, doc.seed, n, still, data.events, known, safeOf(world.context.format?.id));
    const events = n === last ? withVotes(data.events, doc.seed) : data.events;
    const name = new Map(world.participants.map((p) => [p.id, p.name]));
    return { ...data, events, scoringEvents, trivia: triviaRound(n, still, name, doc.seed), episodeFacts: { titleQuote: titleQuote(n, still, name, doc.seed) } };
  };
}

/** The finale's votes (the engine's juryVotes, which a split question settles by), made up: 5 to 9 of them, the winner's a majority,
 *  the rest between the other finalists. */
function withVotes(events, seed) {
  const votes = 5 + (roll(seed, 'votes') % 5);
  const winner = events[events.length - 1], others = events.filter((o, i) => i < events.length - 1 && o.method === events[events.length - 2]?.method && o !== winner);
  if (!winner) return events;
  // The winner's a majority (more than half, now and then all of it); the rest split between the others, the first more often.
  const most = Math.floor(votes / 2) + 1 + (roll(seed, 'votes', 'lead') % Math.max(1, votes - Math.floor(votes / 2) - 1));
  let rest = votes - most;
  const theirs = others.map((o, i) => { const v = i === others.length - 1 ? rest : Math.min(rest, Math.ceil(rest / 2) + (roll(seed, 'votes', o.castawayId) % 2)); rest -= v; return v; });
  const got = new Map([[winner.castawayId, most], ...others.map((o, i) => [o.castawayId, theirs[i]])]);
  return events.map((o) => (got.has(o.castawayId) ? { ...o, juryVotes: got.get(o.castawayId) } : o));
}

/** The bank for the episodes before the game (real through the mark, made up after): each its trivia round and its title quote, as
 *  the story's own nights have them (resultsFor), so the game's first round, about the episode before it, has questions too. Each is
 *  a placeholder about nothing in the results, so a real episode's tells nothing past what the person has seen. */
function withBank(facts, participants, seed) {
  const name = new Map(participants.map((p) => [p.id, p.name])), gone = new Set();
  return facts.map((f) => {
    const n = Number(f.eventId.replace('show-event-', '')), still = participants.map((p) => p.id).filter((id) => !gone.has(id));
    for (const o of f.data.events || []) gone.add(o.castawayId);
    return { ...f, data: { ...f.data, trivia: triviaRound(n, still, name, seed), episodeFacts: { titleQuote: titleQuote(n, still, name, seed) } } };
  });
}

/** Four names for a question: the right one and three others from `pool`, in a seeded order. */
function fourOf(right, pool, seed, key) {
  const others = pool.filter((x) => x !== right).sort((a, b) => roll(seed, key, a) - roll(seed, key, b)).slice(0, 3);
  return [right, ...others].sort((a, b) => roll(seed, key, 'o', a) - roll(seed, key, 'o', b));
}

/** A trivia question's id: a UUID from the seed, the episode and which question (the server's key is its rows' ids: the live tier
 *  files each with this one, so an answer the runtime took is the server's too). */
const uuidOf = (...parts) => { const h = J.digest(['trivia', ...parts]); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };

/** A round of trivia after episode n (asked before n + 1), as the bot's trivia research writes it ({ id, kind, question, options,
 *  answer }): three placeholders that fit any show, a person, a number and a yes or no, each answer picked by the seed. */
function triviaRound(n, still, name, seed) {
  const round = [], names = still.map((id) => name.get(id)), r = (k) => roll(seed, 'trivia', n, k);
  if (names.length >= 2) {
    const who = names[r('who') % names.length];
    round.push({ id: uuidOf(seed, n, 'who'), kind: 'person', question: 'Who is it?', options: fourOf(who, names, seed, `who${n}`), answer: who });
  }
  const many = 1 + (r('many') % 8), from = Math.max(0, many - (r('from') % 4));
  round.push({ id: uuidOf(seed, n, 'many'), kind: 'number', question: 'How many?', options: [0, 1, 2, 3].map((i) => String(from + i)), answer: String(many) });
  round.push({ id: uuidOf(seed, n, 'did'), kind: 'text', question: 'Did it happen?', options: ['Yes', 'No'], answer: r('did') % 2 ? 'Yes' : 'No' });
  return round;
}

/** Who says the episode's title quote (an episode fact, research's 'who'): someone still in at its start, picked by the seed. */
function titleQuote(n, still, name, seed) {
  if (!still.length) return { state: 'none' };
  const who = still[roll(seed, 'quote', n) % still.length];
  return { state: 'who', who, name: name.get(who) };
}

/**
 * Whether the runtime can play this definition's game (the release plan's step 2), asked before anything is made: the explorer's own
 * analysis (engine-valid, and a runtime profile with no gaps). Checked against the gallery's whole catalogue
 * (scripts/dev-test/preview-catalogue.js): every game it passes played a season headless, every one it stops failed. `why` is the
 * first gap's reason (the builder's words, for the log and the desk); the app says "No preview for this game yet".
 */
function verdict(definition) {
  const { analyze } = require('../explorer/analyze.cjs');
  const a = analyze(definition);
  if (a.engine.status !== 'valid') {
    const p = a.nodes.flatMap((n) => [...n.engine.problems, ...n.engine.waits])[0];
    return { ok: false, why: p ? p.problem || p.reason || String(p.waitsFor || 'it waits for something') : "the game isn't valid", gaps: [] };
  }
  const gaps = (a.runtimeSupport.gaps || []).map((g) => g.reason);
  return a.runtimeSupport.status === 'supported-profile' && !a.diagnostics.length ? { ok: true, why: null, gaps: [] } : { ok: false, why: gaps[0] || a.diagnostics[0]?.message || "the runtime can't play it yet", gaps };
}

module.exports = { build, verdict, resultsFor, mixTribes, ratesOf, typicalRate, COUCH, CAST_FIELDS };
