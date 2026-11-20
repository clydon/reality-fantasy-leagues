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

/** How often each moment happened per cast member still in, over the episodes through the mark (season.rates if given). */
function ratesOf(season) {
  if (season.rates) return season.rates;
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
const knownOf = (season) => new Set(Formats.formatFor(season.format || 'survivor').events.map((e) => e.id));

/** An episode's moments: each kind at the season's rate among those still in, given at random (by the seed); after the merge, one
 *  individual immunity a night instead of tribe immunity. */
function shapedMoments(rates, seed, n, still, outs, known, merged) {
  const out = new Set(outs.map((o) => o.castawayId)), list = [];
  const safe = new Set(['zeroVotesSafe', 'survivedVotes', 'votedWithMajority']);
  const kinds = Object.keys(rates).filter((t) => known.has(t) && !(merged && (t === 'tribeImmunity' || t === 'individualImmunity'))).sort();
  for (const type of kinds) {
    const want = rates[type] * still.length, k = Math.floor(want) + ((roll(seed, n, type, 'frac') % 1000) / 1000 < want - Math.floor(want) ? 1 : 0);
    const pool = still.filter((id) => !(safe.has(type) && out.has(id))).sort((a, b) => roll(seed, n, type, a) - roll(seed, n, type, b));
    for (const id of pool.slice(0, k)) list.push({ id: momentId(n, type, id), type, castawayId: id });
  }
  if (merged && known.has('individualImmunity') && still.length) {
    const id = still[roll(seed, n, 'immunity') % still.length];
    if (!out.has(id)) list.push({ id: momentId(n, 'individualImmunity', id), type: 'individualImmunity', castawayId: id });
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
    const events = rows.filter((x) => x.kind === 'elimination').map((x) => ({ castawayId: id(x.name), method: x.method || 'Voted Out' }));
    const seen = new Set();
    const scoringEvents = rows.filter((x) => x.kind === 'event' && known.has(x.type))
      .filter((x) => { const k = x.type + '|' + x.name; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((x) => ({ id: momentId(n, x.type, x.name), type: x.type, castawayId: id(x.name) }));
    facts.push({ id: 'fact-show-event-' + n, eventId: 'show-event-' + n, contextId: 'show', source: 'real-season', data: { events, scoringEvents, ...(events.length ? {} : { noExit: true }) } });
  }
  return facts;
}

/** Episodes after the mark and before the game starts, made up (someone goes home each, the moments at the season's rates). */
function madeUpBefore(season, participants, facts, known, seed, merge) {
  const rates = ratesOf(season), out = [];
  const gone = new Set(facts.flatMap((f) => (f.data.events || []).map((o) => o.castawayId)));
  for (let n = season.mark + 1; n < season.from; n++) {
    const still = participants.map((p) => p.id).filter((x) => !gone.has(x));
    const who = still.slice().sort((a, b) => roll(seed, n, 'out', a) - roll(seed, n, 'out', b))[0];
    const events = who ? [{ castawayId: who, method: 'Voted Out' }] : [];
    if (who) gone.add(who);
    out.push({ id: 'fact-show-event-' + n, eventId: 'show-event-' + n, contextId: 'show', source: 'made-up', data: { events, scoringEvents: shapedMoments(rates, seed, n, still, events, known, n >= merge), ...(events.length ? {} : { noExit: true }) } });
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
  const { spec, name } = o.spec ? { spec: o.spec, name: o.gameName || 'Your game' } : gameSpec(pg, o.base || 'fantasy', o.changes);
  const moments = season.page.ctx.moments.filter((m) => known.has(m.id));
  const count = season.page.ctx.pool || season.cast.length;
  if (count > season.cast.length) throw Object.assign(Error('No preview for this season: its cast is smaller than its game\'s pool'), { code: 'preview-season' });
  // The cast in the order the caller dealt it (the app: mixTribes of the season's order; the proof: its recording, already mixed).
  const participants = season.cast.slice(0, count).map((c, i) => ({ id: 'show-participant-' + (i + 1), contextId: 'show', name: c.name, photoUrl: c.photoUrl || null }));
  const context = {
    id: 'show', kind: 'show', label, format: { id: season.format || 'survivor' },
    engine: { ...season.page.ctx, moments, couch: COUCH.length, pool: season.page.ctx.pool },
    phaseStarts: { merged: merge },
    dress: { name: season.show?.name || label, seasonName: season.seasonName || label, number: season.number, art: { borrow: season.show?.slug || season.format || 'survivor' } },
  };
  const events = season.episodes.slice().sort((a, b) => a.number - b.number).map((e) => ({ id: 'show-event-' + e.number, contextId: 'show', number: e.number, airAt: e.airAt, resultStatus: e.number < season.from ? 'final' : 'unavailable' }));
  const real = realFacts(season, participants, new Set(moments.map((m) => m.id)));
  const facts = [...real, ...madeUpBefore(season, participants, real, new Set(moments.map((m) => m.id)), seed, merge)];
  const start = events.find((e) => e.number === season.from);
  return D.create({
    seed,
    world: { contexts: [context], people: COUCH, participants, events, facts },
    games: [{ id: o.gameId || 'fantasy', name: o.gameName || name, contextId: 'show', spec, timing: 'live-only' }],
    situation: { clock: new Date(Date.parse(start.airAt) - 5 * HOUR).toISOString(), viewerId: 'alex', marks: COUCH.map((p) => ({ personId: p.id, contextId: 'show', through: season.from - 1 })) },
    content: { labels: 'normal' },
  });
}

/** Episode n's results as the story plays it: who goes out (the bench's own Publish: the finale crowns a winner and its finalists)
 *  and the moments shaped like the season's. */
function resultsFor(season) {
  const rates = ratesOf(season);
  return (s, n) => {
    const snap = s.snapshot(), doc = s.export().input, world = snap.contexts.show, e = world.events.find((x) => x.number === n);
    const data = resultsData(snap, doc, 'show', e.id, 'final');
    const gone = new Set(world.facts.filter((f) => f.eventId !== e.id).flatMap((f) => (f.data.events || []).map((o) => o.castawayId)));
    const still = world.participants.map((p) => p.id).filter((id) => !gone.has(id));
    const known = new Set(world.context.engine.moments.filter((m) => !m.auto && !m.off).map((m) => m.id));
    return { ...data, scoringEvents: shapedMoments(rates, doc.seed, n, still, data.events, known, n >= world.context.phaseStarts.merged) };
  };
}

module.exports = { build, resultsFor, mixTribes, ratesOf, COUCH, CAST_FIELDS };
