// A format is two halves (docs/PLAN-ai-generated-show-formats.md, "What moves to data, what stays code"):
//
//   DATA  plain JSON -- exit methods, the scoring catalog and its display groups, wiki section names,
//         the research checklist, terms, and the scoring rules (rules.js: research answers -> results,
//         and the events implied by exits, exile and roles). What a database row could hold, and what
//         a model could one day propose for a show nobody has modelled yet. formatProblems() says
//         whether it's usable.
//   CODE  functions -- the wiki read's schema, prompt and derivedEvents, research's contradiction
//         checks and reviewer notes. What still needs a developer.
//
// defineFormat puts the two back together as the one object every caller has always read (formatFor),
// so nothing outside formats/ knows or cares which half a piece came from. The data stays reachable as
// `format.data` (not enumerable, so the object looks exactly as it did).
//
// Plain CommonJS, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { buildChecklist, buildShape, checklistProblems, fieldProblems } = require('./checklist.js');
const { researchItemsFrom, impliedEventsFrom, rulesProblems } = require('./rules.js');
const { reviewProblems } = require('./research-review.js');
const { tagsProblem } = require('./moment-tags.js');
/* eslint-enable @typescript-eslint/no-require-imports */

// What each half may hold, in the order the assembled object lists them.
const DATA_KEYS = ['id', 'name', 'exitMethods', 'terms', 'winnerExitMethod', 'endgameExitMethods', 'events', 'eventCategories', 'recap', 'hasMerge', 'hasGroups', 'roles', 'wiki', 'research', 'rules'];
// impliedEvents and research.items are built from data.rules, so code can't supply them.
const CODE_KEYS = ['roles', 'wiki', 'research'];
const ORDER = ['id', 'name', 'exitMethods', 'terms', 'winnerExitMethod', 'endgameExitMethods', 'events', 'eventCategories', 'recap', 'impliedEvents', 'hasMerge', 'hasGroups', 'roles', 'wiki', 'research'];
const WIKI_DATA = ['version', 'voteSections', 'guideSections', 'contextSections', 'missingVotesNote', 'missingGuideNote', 'castNote', 'eventTypes', 'routineEliminations'];
const WIKI_CODE = ['episodesSchema', 'episodesPrompt', 'rejectEvent', 'derivedEvents', 'roles'];
const WIKI_ORDER = ['version', 'voteSections', 'guideSections', 'contextSections', 'missingVotesNote', 'missingGuideNote', 'castNote', 'eventTypes', 'episodesSchema', 'episodesPrompt', 'rejectEvent', 'derivedEvents', 'roles', 'routineEliminations'];
// checks (research-review.js): conditions over the answers that report a contradiction or repair it, which a data-only
// format's research runs (a built-in's code half has its own). groupVotes: who was at each vote one group goes to at a
// time, which research reads to fill in a missed group move (db/episode-research.js tribalGroupProblems).
const RESEARCH_DATA = ['checklist', 'episodeFields', 'searchHint', 'claims', 'checks', 'groupVotes'];
const RESEARCH_CODE = ['entryProblems', 'notes', 'sentences'];
// Code a format MAY supply: episodeProblems(payload) checks answers against each other across the whole
// cast (who attended Tribal against who won immunity, say), repairing what it must and reporting it.
const RESEARCH_OPTIONAL_CODE = ['episodeProblems'];
// `becomes` (optional): a recorded value that makes someone another role ("Recruited Traitor" -> "Traitor"),
// read by a data-only format's roleFor (custom.js); a built-in's own roleFor says it in code.
const ROLES_DATA = ['default', 'values', 'becomes'];
const ROLES_CODE = ['roleFor'];
// Keys research's episode-level answer already has (db/episode-research.js researchSchemaFor).
const EPISODE_RESERVED = ['episodeTitle', 'airDate', 'summary', 'rulesNote', 'castaways', 'betAnswers', 'merged', 'sourcesRead', 'formatState'];

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isTextList = (v, { empty = true } = {}) => Array.isArray(v) && (empty || v.length > 0) && v.every(isText);
const isPoints = (v) => Number.isFinite(v) || (v && typeof v === 'object' && Number.isFinite(v.exclusive) && Number.isFinite(v.shared) && Object.keys(v).length === 2);
const unknownKeys = (obj, allowed, at) => Object.keys(obj || {}).filter((k) => !allowed.includes(k)).map((k) => `${at}: unknown key "${k}"`);

/**
 * Why a format's data half isn't usable: [] when it is. Checks it's plain JSON, that every list refers
 * to things that exist (an event in a category, the winner among the exit methods, a claim among the
 * checklist's answers, every question, event and exit method a scoring rule names), and that the
 * checklist has what the research code reads.
 */
function formatProblems(data) {
  const p = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['not an object'];
  try {
    if (JSON.stringify(JSON.parse(JSON.stringify(data))) !== JSON.stringify(data)) p.push('not plain JSON');
  } catch {
    return ['not plain JSON'];
  }
  if (containsNonJson(data)) p.push('not plain JSON (a function, undefined or a non-finite number)');
  p.push(...unknownKeys(data, DATA_KEYS, 'format'));
  if (!isText(data.id) || !/^[a-z][a-z0-9-]*$/.test(data.id)) p.push('id: lowercase letters, digits and dashes');
  if (!isText(data.name)) p.push('name: missing');

  const exits = data.exitMethods;
  if (!isTextList(exits, { empty: false })) p.push('exitMethods: a non-empty list of names');
  else if (new Set(exits).size !== exits.length) p.push('exitMethods: a name is listed twice');
  const exitList = Array.isArray(exits) ? exits : [];
  // Null: nobody wins (a series, a talk show, a sport's standings; a compiled rulebook, rulebook-compile.js).
  // state-logic then ends the season when nobody is left in it, and never crowns anyone.
  const noWinner = data.winnerExitMethod === null;
  if (!noWinner && !exitList.includes(data.winnerExitMethod)) p.push('winnerExitMethod: not one of the exit methods');
  if (!isTextList(data.endgameExitMethods) || !data.endgameExitMethods.every((m) => exitList.includes(m))) {
    p.push('endgameExitMethods: must all be exit methods');
  } else if (!noWinner && !data.endgameExitMethods.includes(data.winnerExitMethod)) {
    p.push('endgameExitMethods: must include the winner');
  }
  if (!data.terms || !isText(data.terms.castaway) || !isText(data.terms.tribe)) p.push('terms: castaway and tribe');
  else p.push(...unknownKeys(data.terms, ['castaway', 'tribe'], 'terms'));

  const ids = new Set();
  if (!Array.isArray(data.events) || !data.events.length) p.push('events: a non-empty list');
  for (const [i, e] of (Array.isArray(data.events) ? data.events : []).entries()) {
    const at = `events[${e && isText(e.id) ? e.id : i}]`;
    if (!e || typeof e !== 'object') { p.push(`${at}: not an object`); continue; }
    p.push(...unknownKeys(e, ['id', 'label', 'defaultPoints', 'implied', 'retiredFrom', 'tags'], at));
    if (!isText(e.id) || !/^[a-z][A-Za-z0-9]*$/.test(e.id)) p.push(`${at}: id must be a camelCase identifier`);
    else if (ids.has(e.id)) p.push(`${at}: id used twice`);
    ids.add(e.id);
    if (!isText(e.label)) p.push(`${at}: label missing`);
    if (!isPoints(e.defaultPoints)) p.push(`${at}: defaultPoints must be a number or { exclusive, shared }`);
    if ('implied' in e && typeof e.implied !== 'boolean') p.push(`${at}: implied must be true or false`);
    // Set by a season rule change (season-changes.js): nothing awards it from this episode on.
    if ('retiredFrom' in e && !(Number.isInteger(e.retiredFrom) && e.retiredFrom >= 1)) p.push(`${at}: retiredFrom must be an episode number from 1`);
    // What it says about someone's place in the game (moment-tags.js), which the computer players and the Safety ranking
    // read. Data from before tags has none, and reads the built-ins' by id (index.js momentTags).
    if ('tags' in e && tagsProblem(e.tags)) p.push(`${at}: ${tagsProblem(e.tags)}`);
  }
  const eventList = (v) => isTextList(v) && v.every((id) => ids.has(id));

  const grouped = new Set();
  if (!Array.isArray(data.eventCategories)) p.push('eventCategories: a list');
  for (const c of Array.isArray(data.eventCategories) ? data.eventCategories : []) {
    const at = `eventCategories[${c && c.id}]`;
    p.push(...unknownKeys(c, ['id', 'label', 'events'], at));
    if (!c || !isText(c.id) || !isText(c.label)) p.push(`${at}: id and label`);
    if (!c || !eventList(c.events)) p.push(`${at}: events must all be in the catalog`);
    for (const id of (c && Array.isArray(c.events) ? c.events : [])) {
      if (grouped.has(id)) p.push(`${at}: ${id} is already in another category`);
      grouped.add(id);
    }
  }
  if (!Array.isArray(data.recap)) p.push('recap: a list');
  for (const r of Array.isArray(data.recap) ? data.recap : []) {
    const at = `recap[${r && r.label}]`;
    p.push(...unknownKeys(r, ['label', 'events', 'tribeEvents'], at));
    if (!r || !isText(r.label) || !eventList(r.events)) p.push(`${at}: a label and catalog events`);
    else if ('tribeEvents' in r && !(isTextList(r.tribeEvents) && r.tribeEvents.every((id) => r.events.includes(id)))) {
      p.push(`${at}: tribeEvents must be among its events`);
    }
  }
  if (typeof data.hasMerge !== 'boolean') p.push('hasMerge: true or false');
  if (typeof data.hasGroups !== 'boolean') p.push('hasGroups: true or false');
  if ('roles' in data) {
    p.push(...unknownKeys(data.roles, ROLES_DATA, 'roles'));
    if (!data.roles || !isText(data.roles.default) || !isTextList(data.roles.values, { empty: false })) p.push('roles: a default and a list of values');
    else if ('becomes' in data.roles) {
      const b = data.roles.becomes;
      const roles = [data.roles.default, ...data.roles.values];
      if (!b || typeof b !== 'object' || Array.isArray(b)) p.push('roles.becomes: an object of value -> role');
      else {
        for (const [k, v] of Object.entries(b)) {
          if (!data.roles.values.includes(k)) p.push(`roles.becomes: ${k} isn't one of the role values`);
          if (!roles.includes(v)) p.push(`roles.becomes.${k}: ${v} isn't a role in this format`);
        }
      }
    }
  }

  const w = data.wiki;
  if (!w || typeof w !== 'object') p.push('wiki: missing');
  else {
    p.push(...unknownKeys(w, WIKI_DATA, 'wiki'));
    if ('version' in w && !(Number.isInteger(w.version) && w.version >= 1)) p.push('wiki.version: a whole number from 1');
    if (!isTextList(w.voteSections)) p.push('wiki.voteSections: a list of headings');
    if (!isTextList(w.guideSections)) p.push('wiki.guideSections: a list of headings');
    if ('contextSections' in w && !isTextList(w.contextSections)) p.push('wiki.contextSections: a list of headings');
    for (const k of ['missingVotesNote', 'missingGuideNote']) if (!isText(w[k])) p.push(`wiki.${k}: missing`);
    if ('castNote' in w && !isText(w.castNote)) p.push('wiki.castNote: text');
    if (!eventList(w.eventTypes)) p.push('wiki.eventTypes: must all be in the catalog');
    if (!(Number.isInteger(w.routineEliminations) && w.routineEliminations >= 1)) p.push('wiki.routineEliminations: a whole number from 1');
  }

  const r = data.research;
  if (!r || typeof r !== 'object') p.push('research: missing');
  else {
    p.push(...unknownKeys(r, RESEARCH_DATA, 'research'));
    p.push(...checklistProblems(r.checklist).map((m) => `research.checklist: ${m}`));
    p.push(...fieldProblems(r.episodeFields, { reserved: EPISODE_RESERVED }).map((m) => `research.episodeFields: ${m}`));
    // Lines of the research prompt; a blank one is a paragraph break.
    if (!(Array.isArray(r.searchHint) && r.searchHint.length && r.searchHint.every((l) => typeof l === 'string'))) {
      p.push('research.searchHint: a list of lines');
    }
    const answers = (Array.isArray(r.checklist) ? r.checklist : []).filter((f) => f && f.type === 'answer').map((f) => f.key);
    if (!isTextList(r.claims) || !r.claims.every((k) => answers.includes(k))) p.push('research.claims: must all be yes/no/unknown checklist questions');
    if (!p.some((m) => m.startsWith('research.checklist') || m.startsWith('research.episodeFields'))) p.push(...reviewProblems(data));
  }
  if (!('rules' in data)) p.push('rules: missing (how the format scores: { research: [...], implied: [...] })');
  else p.push(...rulesProblems(data.rules, data));
  return p;
}

function containsNonJson(v) {
  if (v === undefined || typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') return true;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (Array.isArray(v)) return v.some(containsNonJson);
  if (v && typeof v === 'object') {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return true;
    return Object.values(v).some(containsNonJson);
  }
  return false;
}

// `from` in the order `order` lists, skipping keys neither half has.
function ordered(order, ...halves) {
  const out = {};
  for (const k of order) {
    for (const h of halves) if (h && k in h) out[k] = h[k];
  }
  return out;
}

function checkCode(code, allowed, at) {
  for (const [k, v] of Object.entries(code || {})) {
    if (!allowed.includes(k)) throw new Error(`${at}: "${k}" isn't something code supplies`);
    if (typeof v !== 'function') throw new Error(`${at}.${k}: must be a function`);
  }
}

/** The runtime format from its two halves. Throws if the data isn't usable or the halves overlap. */
function defineFormat(data, code) {
  const problems = formatProblems(data);
  if (problems.length) throw new Error(`format ${data && data.id}: ${problems.join('; ')}`);
  for (const k of Object.keys(code)) if (!CODE_KEYS.includes(k)) throw new Error(`format ${data.id}: code can't supply "${k}"`);
  checkCode(code.wiki, WIKI_CODE, `format ${data.id} wiki`);
  checkCode(code.research, [...RESEARCH_CODE, ...RESEARCH_OPTIONAL_CODE], `format ${data.id} research`);
  checkCode(code.roles, ROLES_CODE, `format ${data.id} roles`);
  for (const k of ['episodesSchema', 'episodesPrompt', 'rejectEvent']) {
    if (!code.wiki || !code.wiki[k]) throw new Error(`format ${data.id}: wiki.${k} is missing`);
  }
  for (const k of RESEARCH_CODE) if (!code.research || !code.research[k]) throw new Error(`format ${data.id}: research.${k} is missing`);
  if (!!data.roles !== !!code.roles) throw new Error(`format ${data.id}: roles needs both its data and roleFor`);

  const { checklist, episodeFields, ...researchData } = data.research;
  const research = {
    // Handed z and Answer by db/episode-research.js, exactly as the hand-written ones were.
    checklistSchema: (z, Answer) => buildChecklist(checklist, z, Answer, data.exitMethods),
    episodeFields: (z, Answer) => buildShape(episodeFields, z, Answer, data.exitMethods),
    ...researchData,
    // Named researchItems / impliedEvents, like the hand-written functions they replaced.
    items: researchItemsFrom(data.rules.research, data),
  };
  const format = ordered(ORDER, data, {
    // A format with nothing implied has no impliedEvents at all, which is what state-logic checks for.
    impliedEvents: data.rules.implied.length ? impliedEventsFrom(data.rules.implied, data) : undefined,
    roles: data.roles && ordered([...ROLES_DATA, ...ROLES_CODE], data.roles, code.roles),
    wiki: ordered(WIKI_ORDER, data.wiki, code.wiki),
    research: ordered(['checklistSchema', 'episodeFields', 'searchHint', 'entryProblems', 'episodeProblems', 'claims', 'items', 'notes', 'sentences'], research, code.research),
  });
  if (!format.roles) delete format.roles;
  if (!format.impliedEvents) delete format.impliedEvents;
  Object.defineProperty(format, 'data', { value: data, enumerable: false });
  // The code half too, so a season's rule changes (season-changes.js) can rebuild this format from
  // changed data without losing what only code supplies (a built-in's wiki read, reviewer notes).
  Object.defineProperty(format, 'code', { value: code, enumerable: false });
  return format;
}

module.exports = { defineFormat, formatProblems };
