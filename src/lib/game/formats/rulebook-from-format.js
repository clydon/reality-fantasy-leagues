// A rulebook's blocks read back from a format's data half (docs/PLAN-rulebooks-implementation.md 4.5), for
// the formats with no hand-written blocks: the stored ones research made (show_formats) and the generic
// fallback. Best effort and display-only until someone edits it: the season keeps playing by the format's
// data exactly (the legacy freeze), and these blocks are what How it works shows meanwhile.
//
//   blocksFromFormat(data) -> { blocks, aliases: { events, exits } }
//
// How it reads a format: each exit method is a way out (the winner exit means they won, the other endgame
// exits that they reached the end), and the event its exit implies is that way out's moment. Each category
// with something research asks about becomes a segment nobody decides, holding its events as moments added
// by hand; categories only of automatic events (exits, endgame bonuses) hold nothing, their other events
// sitting loose. Nothing is guessed: no phase starts but the first, no finale (how it's decided isn't in the
// data), every moment's suggested points the format's own. Plain CommonJS, browser-safe, like everything here.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { camelId, pluralOf, SCHEMA_VERSION } = require('./rulebook-schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const list = (v) => (Array.isArray(v) ? v : []);
const lower = (s) => String(s || '').trim().toLowerCase();

function blocksFromFormat(data) {
  const d = data && typeof data === 'object' ? data : {};
  const used = new Set();
  const uniqueId = (wanted, fallback) => {
    const base = camelId(wanted) || fallback;
    let id = base;
    for (let i = 2; used.has(id); i++) id = `${base}${i}`;
    used.add(id);
    return id;
  };
  const events = list(d.events);
  const byId = new Map(events.map((e) => [e.id, e]));
  const endgame = new Set(list(d.endgameExitMethods));
  const points = {};
  const aliases = { events: {}, exits: {} };
  // An event's moment keeps the event's id, unless a way out or segment already has it: then a fresh id,
  // aliased back to the event.
  const momentId = (eventId) => {
    if (!used.has(eventId)) {
      used.add(eventId);
      return eventId;
    }
    const id = uniqueId(eventId, eventId);
    aliases.events[id] = eventId;
    return id;
  };

  // The event an exit implies on its own: a rule naming only that exit, with no other condition.
  const exitEvent = new Map();
  for (const r of list(d.rules && d.rules.implied)) {
    if (typeof r.whenExit === 'string' && !r.when && !r.per && !r.builtIn && r.award && byId.has(r.award) && !exitEvent.has(r.whenExit)) exitEvent.set(r.whenExit, r.award);
  }

  const waysOut = [];
  const claimed = new Set();
  for (const name of list(d.exitMethods).filter((x) => x !== 'Other')) {
    const id = uniqueId(name, 'wayOut');
    const means = name === d.winnerExitMethod ? 'winner' : endgame.has(name) ? 'finalist' : 'out';
    waysOut.push({ id, name, means });
    aliases.exits[id] = name;
    const ev = exitEvent.get(name);
    if (ev && !claimed.has(ev)) {
      claimed.add(ev);
      if (ev !== id) aliases.events[id] = ev;
      points[id] = byId.get(ev).defaultPoints;
    }
  }

  const segments = [];
  const customMoments = [];
  for (const c of list(d.eventCategories)) {
    const own = list(c.events).filter((id) => byId.has(id) && !claimed.has(id));
    if (!own.length) continue;
    const asked = own.some((id) => !byId.get(id).implied);
    let during;
    if (asked) {
      const segId = uniqueId(c.id || c.label, 'segment');
      segments.push({ id: segId, name: c.label, decidedBy: 'nobody', often: 'everyEpisode' });
      during = { segment: segId };
    }
    for (const id of own) {
      const e = byId.get(id);
      claimed.add(id);
      const mid = momentId(id);
      customMoments.push({ id: mid, label: e.label, ...(during ? { during } : {}), counted: 'yesNo', answeredBy: 'research' });
      points[mid] = e.defaultPoints;
    }
  }
  // An event in no category still reaches the rulebook.
  for (const e of events) {
    if (claimed.has(e.id)) continue;
    claimed.add(e.id);
    const mid = momentId(e.id);
    customMoments.push({ id: mid, label: e.label, counted: 'yesNo', answeredBy: 'research' });
    points[mid] = e.defaultPoints;
  }

  const terms = d.terms || {};
  const singular = lower(terms.castaway) || 'contestant';
  const tribe = lower(terms.tribe) || 'team';
  const blocks = {
    schema: SCHEMA_VERSION,
    kind: 'competition',
    show: d.name || '',
    derivedFrom: d.id || '',
    cast: {
      unit: 'people', singular, plural: pluralOf(singular),
      groups: d.hasGroups ? { type: /couple/.test(tribe) ? 'couples' : 'sides', singular: tribe, change: d.hasMerge ? 'atPhases' : 'often' } : null,
    },
    season: {
      phases: [
        { id: uniqueId('the season', 'season'), name: 'The season', starts: { type: 'episode', n: 1 }, changes: [] },
        ...(d.hasMerge ? [{ id: uniqueId('merged', 'merged'), name: 'Merged', starts: { type: 'announced' }, changes: ['groupsEnd'] }] : []),
      ],
    },
    segments,
    waysOut,
    twists: [],
    customMoments,
    points,
    leftOut: [],
  };
  return { blocks, aliases };
}

module.exports = { blocksFromFormat };
