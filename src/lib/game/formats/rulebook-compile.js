// A rulebook's blocks compiled to the engine's format data (docs/PLAN-rulebooks-implementation.md 4.3): the
// FormatData every league, the research pipeline and scoring already run on. The blocks say what can happen;
// this writes the events, categories, research checklist and rules that make it score.
//
//   compileRulebook(blocks, { aliases?, id? }) -> { data, problems, warnings }
//   formatForRulebook(data) -> the runtime format (a data-only format, custom.js)
//
// Each moment is an event (its id through `aliases.events`, so a built-in's recorded events keep their ids);
// each way out an exit method (through `aliases.exits`); each question a moment asks a checklist field; a
// moment with its own yes-or-no question a research rule, a way out an implied rule. A vote by the cast adds
// who was there, how many votes each got and who each voted for, and scores the majority through the
// votedForLeaver built-in. A talk show's moments are about the night, not a person, so they're episode-level
// answers (episode games score them, step 12), with nothing awarded to anyone.
//
// Still R2's (the plan's 4.3, 4.6): a count scores once, not per unit (research rules take no `per` yet); secret
// roles (a data-only format can't carry them until custom.js has a generic roleFor); phase gating from
// phaseStarts; and the legacy freeze's golden tests for the built-ins. `problems` is formatProblems' verdict:
// for valid blocks it should be empty, and anything there is a compiler bug.
//
// Plain CommonJS, browser-safe, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { formatProblems } = require('./define.js');
const { buildDataFormat } = require('./custom.js');
const { formatIdFor } = require('./proposal.js');
const { kindOf, partWord, blockLabel, cap, camelId } = require('./rulebook-schema.js');
const { momentsFor } = require('./rulebook-moments.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const list = (v) => (Array.isArray(v) ? v : []);
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');

const VOTE_SUFFIXES = ['ZeroVotes', 'SurvivedVotes', 'VotedWithMajority', 'VotedAgainstMajority'];

function compileRulebook(blocks, { aliases = {}, id } = {}) {
  const b = blocks || {};
  const warnings = [];
  const kind = kindOf(b);
  const talk = kind === 'talk';
  const part = partWord(b).singular;
  const ev = (mid) => (aliases.events && aliases.events[mid]) || mid;
  const exitName = (w) => (aliases.exits && aliases.exits[w.id]) || w.name;
  const segs = list(b.segments);
  const segById = new Map(segs.map((s) => [s.id, s]));
  const moments = momentsFor(b);

  // ---------- who, and how they leave ----------
  const groups = b.cast && b.cast.groups;
  const terms = { castaway: cap((b.cast && b.cast.singular) || 'contestant'), tribe: cap((groups && groups.singular) || 'group') };
  const ways = list(b.waysOut);
  const exitWays = ways.filter((w) => w.means !== 'outForOne');
  const exitMethods = [...new Set([...exitWays.map(exitName), 'Other'])];
  const winner = exitWays.find((w) => w.means === 'winner');
  const endgameExitMethods = [...new Set(exitWays.filter((w) => ['finalist', 'winner', 'ending'].includes(w.means)).map(exitName))];

  // ---------- events ----------
  const wayOf = new Map(ways.map((w) => [w.id, w]));
  const isImplied = (m) => (m.from.wayOut && wayOf.get(m.from.wayOut).means !== 'outForOne') || !!m.from.finale;
  const events = [];
  const seenIds = new Map();
  const problems = [];
  for (const m of moments) {
    const eid = ev(m.id);
    if (seenIds.has(eid)) {
      problems.push(`events: ${m.id} and ${seenIds.get(eid)} are both ${eid}`);
      continue;
    }
    seenIds.set(eid, m.id);
    events.push({ id: eid, label: m.label, defaultPoints: m.defaultPoints, ...(isImplied(m) ? { implied: true } : {}) });
  }

  // ---------- the checklist and the rules ----------
  const fields = [];
  const episodeFields = [];
  const fieldKeys = new Set();
  const field = (f, into = fields) => {
    if (fieldKeys.has(f.key)) return;
    fieldKeys.add(f.key);
    into.push(f);
  };
  const research = [];
  const implied = [];
  let countedOnce = false;

  for (const m of moments) {
    const award = ev(m.id);
    const seg = m.from.segment ? segById.get(m.from.segment) : null;
    if (talk) {
      // Episode-level: did it happen tonight?
      if (m.ask) field({ key: m.ask.key, type: m.ask.type === 'answer' ? 'answer' : 'integer', ...(m.ask.type === 'answer' ? {} : { nullable: true }), description: m.ask.question, note: lowerFirst(m.label) }, episodeFields);
      continue;
    }
    if (seg && seg.decidedBy === 'vote' && seg.voters === 'cast' && !m.custom && VOTE_SUFFIXES.some((x) => m.id === `${seg.id}${x}`)) continue; // below, per segment
    if (m.from.wayOut && wayOf.get(m.from.wayOut).means !== 'outForOne') {
      implied.push({ whenExit: exitName(wayOf.get(m.from.wayOut)), award });
      continue;
    }
    if (m.from.finale) {
      const finish = endgameExitMethods;
      if (m.id === 'finaleJuryVote') implied.push({ whenExit: finish, award, per: 'juryVotes' });
      if (m.id === 'finaleNoJuryVotes') implied.push({ whenExit: finish, when: { fact: 'juryVotes', equals: 0 }, award });
      continue;
    }
    if (!m.ask) {
      warnings.push(`${m.label}: known from roles, which a compiled rulebook can't carry yet (R2), so nothing awards it`);
      continue;
    }
    if (m.ask.type === 'answer') {
      field({ key: m.ask.key, type: 'answer', description: `${m.label}, this ${part}: yes, no, or unknown.`, note: lowerFirst(m.label) });
      research.push({ when: { answer: m.ask.key, is: 'yes' }, award });
    } else if (m.ask.type === 'integer') {
      field({ key: m.ask.key, type: 'integer', nullable: true, description: `${m.ask.question} This person's number; 0 if none, null if unknown.`, note: lowerFirst(m.label) });
      research.push({ when: { answer: m.ask.key, greaterThan: 0 }, award });
      countedOnce = true;
    }
  }

  // A vote by the cast: who was there, the votes against each, and who each voted for.
  for (const s of segs.filter((x) => !talk && x.decidedBy === 'vote' && x.voters === 'cast')) {
    const built = new Set(moments.filter((m) => m.from.segment === s.id).map((m) => m.id));
    if (!VOTE_SUFFIXES.some((x) => built.has(`${s.id}${x}`))) continue;
    const there = `${s.id}Attended`;
    const votes = `${s.id}VotesReceived`;
    const votedFor = `${s.id}VotedFor`;
    field({ key: there, type: 'answer', description: `Was this person at ${s.name} this ${part}, able to be voted for?`, note: `at ${s.name}` });
    field({ key: votes, type: 'integer', nullable: true, description: `How many votes this person got at ${s.name}: 0 if they were there and got none, null if they weren't there.`, note: `votes at ${s.name}` });
    field({ key: votedFor, type: 'string', nullable: true, description: `Who this person voted for at ${s.name}, their full name as in the list; null if they didn't vote.`, note: `voted for at ${s.name}` });
    const stayed = { answer: 'leftTheGame', isNot: 'yes' };
    if (built.has(`${s.id}ZeroVotes`)) research.push({ when: { all: [{ answer: there, is: 'yes' }, { answer: votes, equals: 0 }, stayed] }, award: ev(`${s.id}ZeroVotes`) });
    if (built.has(`${s.id}SurvivedVotes`)) research.push({ when: { all: [{ answer: votes, greaterThan: 0 }, stayed] }, award: ev(`${s.id}SurvivedVotes`) });
    const out = exitWays.find((w) => w.cause && typeof w.cause === 'object' && w.cause.segment === s.id);
    if (built.has(`${s.id}VotedWithMajority`) && built.has(`${s.id}VotedAgainstMajority`)) {
      if (out) research.push({ builtIn: 'votedForLeaver', vote: votedFor, exitMethod: exitName(out), award: ev(`${s.id}VotedWithMajority`), otherwise: ev(`${s.id}VotedAgainstMajority`) });
      else warnings.push(`${s.name}: no way out says it sends someone home, so voting with the majority can't be told`);
    }
  }
  if (countedOnce) warnings.push('A count scores once when above 0, not per unit, until research rules take `per` (R2)');
  if (list(b.twists).some((t) => t.type === 'secretRole')) warnings.push('Secret roles are left out: a compiled rulebook can\'t carry them until custom.js has a generic roleFor (R2)');
  if (finaleNeedsJury(b)) field({ key: 'juryVotesReceived', type: 'integer', nullable: true, description: 'Finalists only: how many jury votes they received. Null for everyone else.' });

  const checklist = [
    { key: 'name', type: 'string', description: `The ${terms.castaway.toLowerCase()}'s full name, exactly as given in the list you were sent.` },
    { key: 'leftTheGame', type: 'answer', description: talk ? `Did this person leave the show for good in THIS ${part}?` : `Did this person leave the game permanently in THIS ${part}?` },
    { key: 'exitMethod', type: 'exitMethod', nullable: true, description: 'How they left, if they left. Null if they did not leave.' },
    ...fields,
    { key: 'sources', type: 'stringList', description: "URLs you actually read that support the answers above for THIS person. Empty only if every answer is 'unknown'." },
    {
      key: 'confidence', type: 'enum', values: ['high', 'medium', 'low'],
      description: 'high: a source states it plainly. medium: a source implies it. low: pieced together or a single weak source.',
    },
  ];

  // ---------- how it's grouped and headlined ----------
  const categories = [];
  const catFor = new Map();
  const usedCat = new Set();
  const category = (key, label) => {
    if (!catFor.has(key)) {
      let cid = camelId(key) || 'group';
      for (let i = 2; usedCat.has(cid); i++) cid = `${camelId(key)}${i}`;
      usedCat.add(cid);
      const c = { id: cid, label, events: [] };
      catFor.set(key, c);
      categories.push(c);
    }
    return catFor.get(key);
  };
  const twistName = (tid) => (list(b.twists).find((t) => t.id === tid) || {}).name || 'Twists';
  for (const m of moments) {
    const eid = ev(m.id);
    if (!events.some((e) => e.id === eid) || categories.some((c) => c.events.includes(eid))) continue;
    let c;
    if (m.from.segment) c = category(`segment ${m.from.segment}`, segById.get(m.from.segment).name);
    else if (m.from.twist) c = category(`twist ${m.from.twist}`, twistName(m.from.twist));
    else if (m.from.wayOut) c = wayOf.get(m.from.wayOut).means === 'out' || wayOf.get(m.from.wayOut).means === 'outForOne'
      ? category('leaving', blockLabel(b, 'waysOut') || 'Leaving the game')
      : category('endgame', 'Endgame');
    else if (m.from.finale) c = category('endgame', 'Endgame');
    else c = category('other', talk ? 'What can happen' : 'Other moments');
    c.events.push(eid);
  }
  const recap = [];
  for (const s of segs.filter((x) => x.onTheLine === 'safety' || x.onTheLine === 'reward')) {
    const won = moments.find((m) => m.id === `${s.id}Won`);
    const group = moments.find((m) => m.id === `${s.id}GroupWon`);
    if (!won && !group) continue;
    const ids = [won, group].filter(Boolean).map((m) => ev(m.id));
    recap.push({ label: s.name, events: [...new Set(ids)], ...(group ? { tribeEvents: [ev(group.id)] } : {}) });
  }

  const name = b.show || 'A show';
  const data = {
    id: id || formatIdFor(name),
    name,
    exitMethods,
    terms,
    winnerExitMethod: winner ? exitName(winner) : null,
    endgameExitMethods,
    events,
    eventCategories: categories,
    recap,
    hasMerge: list(b.season && b.season.phases).some((p) => list(p.changes).includes('groupsEnd')),
    hasGroups: !!groups,
    wiki: {
      version: 1,
      voteSections: [],
      guideSections: [],
      missingVotesNote: 'no vote or elimination table found: who left will come from research',
      missingGuideNote: 'no episode guide found: who left will come from research',
      eventTypes: [],
      routineEliminations: 1,
    },
    research: {
      checklist,
      episodeFields,
      searchHint: searchHint(b, part),
      claims: ['leftTheGame', ...fields.filter((f) => f.type === 'answer').map((f) => f.key)],
    },
    rules: { research, implied },
  };
  problems.push(...formatProblems(data));
  return { data, problems, warnings };
}

function finaleNeedsJury(b) {
  const f = b.season && b.season.finale;
  return !!f && f.decidedBy === 'juryVote' && kindOf(b) !== 'talk';
}

function searchHint(b, part) {
  const names = list(b.segments).filter((s) => s.decidedBy !== 'nobody').map((s) => s.name);
  if (kindOf(b) === 'talk') {
    return [`Search for this ${part}'s recap and reviews: who hosted, who performed, and what happened in it.`, 'Then answer the episode questions, and the checklist for every person above.'];
  }
  return [
    `Search for this ${part}'s recap and any reporting on ${names.length ? `${names.join(', ')}, ` : ''}what happened to each person, and who left.`,
    'Then answer the checklist for every person above.',
  ];
}

// Built once per data object, like formatForRuleset.
const built = new WeakMap();
/** The runtime format for a compiled rulebook's data. */
function formatForRulebook(data) {
  if (!built.has(data)) built.set(data, buildDataFormat(data));
  return built.get(data);
}

module.exports = { compileRulebook, formatForRulebook };
