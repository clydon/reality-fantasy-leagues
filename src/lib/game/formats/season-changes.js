// Season rule changes (docs/PLAN-season-rule-changes.md): a show's rules changing partway through a
// season -- a new twist, a new advantage, a new way to leave -- recorded as a change layered on the
// season's base rules instead of an edit to the show's format, which every season shares.
//
// A change is { id, version, effectiveEpisode, delta }, and a delta only ADDS (decided 2026-10-06):
//
//   addCategories   [{ id, label }]                                  new display groups
//   addEvents       [{ id, label, defaultPoints, implied?, category }]   category: an existing or added one
//   addQuestions    [checklist field]                                what research asks each person
//   addExitMethods  [{ name, endgame? }]                             endgame: a finalist/winner exit
//   addRules        { research: [rule], implied: [rule] }            rules.js's language
//   retireEvents    [eventId]                                        nothing awards it from then on
//
// It never edits an existing event, question or rule: point values belong to each league's settings,
// and a change to how an existing mechanic works is flagged for a developer. Every rule a change adds
// is stamped `fromEpisode: effectiveEpisode`, and a retired event gets `retiredFrom`; rules.js checks
// both against the episode, so no change can reach back into an episode before it.
//
// applyChanges merges changes into a format's data half. Something a change adds that the data already
// has (a league's own ruleset copy may already define it) is skipped and reported, never overwritten,
// and so is a rule that no longer makes sense without what was skipped. withChanges builds the runtime
// format from that, memoised per changes list -- the one formatOf calls for a league's adopted changes.
//
// What this does NOT cover: a built-in format's wiki read is hand-written code with the show's own
// exit methods, so an exit method a change adds reaches research (whose schema is built from data) but
// not the built-in's wiki read. That's the season-level wiring's concern (phase 2 of the plan).
//
// Plain CommonJS with no dependencies outside formats/, like everything here.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { defineFormat, formatProblems } = require('./define.js');
const { buildDataFormat, questionPhrases } = require('./custom.js');
const { fieldProblems } = require('./checklist.js');
const { rulesProblems } = require('./rules.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const DELTA_KEYS = ['addCategories', 'addEvents', 'addQuestions', 'addExitMethods', 'addRules', 'retireEvents'];
const ID = /^[a-z][A-Za-z0-9]*$/;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isPoints = (v) => Number.isFinite(v) || (isObj(v) && Number.isFinite(v.exclusive) && Number.isFinite(v.shared) && Object.keys(v).length === 2);
const listAt = (delta, k) => (Array.isArray(delta[k]) ? delta[k] : []);
const unknownKeys = (obj, allowed, at) => Object.keys(obj).filter((k) => !allowed.includes(k)).map((k) => `${at}: unknown key "${k}"`);

/**
 * Why a change isn't well-formed on its own: [] when it is. Whether it fits a particular format (an
 * event id it reuses, a rule naming a question that doesn't exist) is applyChanges' business, since the
 * same change lands on different bases (the show's rules, or a league's own copy).
 */
function changeProblems(change) {
  if (!isObj(change)) return ['not an object'];
  const p = [];
  p.push(...unknownKeys(change, ['id', 'version', 'effectiveEpisode', 'delta'], 'change'));
  if (!isText(change.id)) p.push('id: missing');
  if ('version' in change && !(Number.isInteger(change.version) && change.version >= 1)) p.push('version: a whole number from 1');
  if (!(Number.isInteger(change.effectiveEpisode) && change.effectiveEpisode >= 1)) p.push('effectiveEpisode: an episode number from 1');
  return [...p, ...deltaProblems(change.delta)];
}

/** Why a delta isn't well-formed: [] when it is. */
function deltaProblems(delta) {
  if (!isObj(delta)) return ['delta: not an object'];
  const p = unknownKeys(delta, DELTA_KEYS, 'delta');
  for (const k of DELTA_KEYS) if (k in delta && k !== 'addRules' && !Array.isArray(delta[k])) p.push(`${k}: a list`);
  listAt(delta, 'addCategories').forEach((c, i) => {
    const at = `addCategories[${i}]`;
    if (!isObj(c)) return p.push(`${at}: not an object`);
    p.push(...unknownKeys(c, ['id', 'label'], at));
    if (!isText(c.id) || !isText(c.label)) p.push(`${at}: id and label`);
  });
  listAt(delta, 'addEvents').forEach((e, i) => {
    const at = `addEvents[${isObj(e) && isText(e.id) ? e.id : i}]`;
    if (!isObj(e)) return p.push(`${at}: not an object`);
    p.push(...unknownKeys(e, ['id', 'label', 'defaultPoints', 'implied', 'category'], at));
    if (!isText(e.id) || !ID.test(e.id)) p.push(`${at}: id must be a camelCase identifier`);
    if (!isText(e.label)) p.push(`${at}: label missing`);
    if (!isPoints(e.defaultPoints)) p.push(`${at}: defaultPoints must be a number or { exclusive, shared }`);
    if ('implied' in e && typeof e.implied !== 'boolean') p.push(`${at}: implied must be true or false`);
    if (!isText(e.category)) p.push(`${at}: category missing (which display group it goes in)`);
  });
  p.push(...fieldProblems(listAt(delta, 'addQuestions')).map((m) => `addQuestions: ${m}`));
  listAt(delta, 'addExitMethods').forEach((x, i) => {
    const at = `addExitMethods[${i}]`;
    if (!isObj(x)) return p.push(`${at}: not an object`);
    p.push(...unknownKeys(x, ['name', 'endgame'], at));
    if (!isText(x.name)) p.push(`${at}: name missing`);
    if ('endgame' in x && typeof x.endgame !== 'boolean') p.push(`${at}: endgame must be true or false`);
  });
  if ('addRules' in delta) {
    const r = delta.addRules;
    if (!isObj(r)) p.push('addRules: an object with research and implied lists');
    else {
      p.push(...unknownKeys(r, ['research', 'implied'], 'addRules'));
      for (const list of ['research', 'implied']) {
        if (list in r && !Array.isArray(r[list])) p.push(`addRules.${list}: a list`);
        // The change's effective episode is what gates them; a rule carrying its own would disagree.
        listAt(r, list).forEach((rule, i) => { if (isObj(rule) && 'fromEpisode' in rule) p.push(`addRules.${list}[${i}]: fromEpisode is set from the change's effective episode`); });
      }
    }
  }
  listAt(delta, 'retireEvents').forEach((id, i) => { if (!isText(id)) p.push(`retireEvents[${i}]: an event id`); });
  return p;
}

const byEpisode = (changes) => changes.map((c, i) => [c, i]).sort((a, b) => a[0].effectiveEpisode - b[0].effectiveEpisode || a[1] - b[1]).map(([c]) => c);

/**
 * `data` (a format's data half) with `changes` merged in, in effective-episode order. Returns
 * { data, skipped: [{ change, what, why }] }. Throws only on a malformed change, or if the merge would
 * somehow leave the format unusable -- a skip is how every expected conflict is handled.
 */
function applyChanges(data, changes) {
  const out = JSON.parse(JSON.stringify(data));
  const skipped = [];
  for (const change of byEpisode(changes || [])) {
    const problems = changeProblems(change);
    if (problems.length) throw new Error(`season change ${change && change.id}: ${problems.join('; ')}`);
    mergeOne(out, change, (what, why) => skipped.push({ change: change.id, what, why }));
    const left = formatProblems(out);
    if (left.length) throw new Error(`season change ${change.id} leaves the format unusable: ${left.join('; ')}`);
  }
  return { data: out, skipped };
}

function mergeOne(data, { effectiveEpisode: ep, delta }, skip) {
  for (const c of listAt(delta, 'addCategories')) {
    if (data.eventCategories.some((x) => x.id === c.id)) skip(`category ${c.id}`, 'this format already has a category with that id; its new events join it');
    else data.eventCategories.push({ id: c.id, label: c.label, events: [] });
  }
  for (const e of listAt(delta, 'addEvents')) {
    const category = data.eventCategories.find((x) => x.id === e.category);
    if (data.events.some((x) => x.id === e.id)) skip(`event ${e.id}`, 'this format already has an event with that id');
    else if (!category) skip(`event ${e.id}`, `no category "${e.category}"`);
    else {
      const event = { ...e };
      delete event.category;
      data.events.push(event);
      category.events.push(e.id);
    }
  }
  const checklist = data.research.checklist;
  for (const f of listAt(delta, 'addQuestions')) {
    if (checklist.some((x) => x.key === f.key)) skip(`question ${f.key}`, 'this format already asks a question with that key');
    else checklist.push(f);
  }
  for (const x of listAt(delta, 'addExitMethods')) {
    if (data.exitMethods.includes(x.name)) skip(`exit method ${x.name}`, 'this format already has that exit method');
    else {
      data.exitMethods.push(x.name);
      if (x.endgame) data.endgameExitMethods.push(x.name);
    }
  }
  for (const id of listAt(delta, 'retireEvents')) {
    const e = data.events.find((x) => x.id === id);
    if (!e) skip(`retiring ${id}`, 'this format has no such event');
    else if (Number.isInteger(e.retiredFrom) && e.retiredFrom <= ep) skip(`retiring ${id}`, `already retired from episode ${e.retiredFrom}`);
    else e.retiredFrom = ep;
  }
  // Rules last, each checked against everything merged so far: one that names something skipped above
  // (or something this base never had) is dropped with the reason, not left to break the format.
  const rules = isObj(delta.addRules) ? delta.addRules : {};
  for (const list of ['research', 'implied']) {
    for (const rule of listAt(rules, list)) {
      const stamped = { ...rule, fromEpisode: ep };
      const problems = rulesProblems({ research: list === 'research' ? [stamped] : [], implied: list === 'implied' ? [stamped] : [] }, data);
      if (problems.length) skip(`a ${list} rule`, problems.map((m) => m.replace(/^rules\.\w+\[0\]: /, '')).join('; '));
      else data.rules[list].push(stamped);
    }
  }
}

// A built-in's reviewer notes are hand-written for its own questions; the ones a change added get the
// generic phrasing data-only formats use, after the format's own.
function codeWithAddedQuestions(code, added) {
  if (!added.length) return code;
  const withAdded = (fn) => (c, ...rest) => [...fn(c, ...rest), ...questionPhrases(added, c)];
  return { ...code, research: { ...code.research, notes: withAdded(code.research.notes), sentences: withAdded(code.research.sentences) } };
}

const built = new WeakMap();

/**
 * Runtime `format` with `changes` layered on: the same format when there are none. Memoised per
 * changes list (a league hands the same cached array in on every read) and base format. What was
 * skipped rides along as the non-enumerable `seasonChangeSkips`.
 */
function withChanges(format, changes) {
  if (!Array.isArray(changes) || !changes.length) return format;
  const cached = built.get(changes);
  if (cached && cached.base === format) return cached.format;
  const { data, skipped } = applyChanges(format.data, changes);
  const before = new Set(format.data.research.checklist.map((f) => f.key));
  const added = data.research.checklist.filter((f) => !before.has(f.key));
  const result = format.dataOnly ? buildDataFormat(data) : defineFormat(data, codeWithAddedQuestions(format.code, added));
  Object.defineProperty(result, 'seasonChangeSkips', { value: skipped, enumerable: false });
  built.set(changes, { base: format, format: result });
  return result;
}

module.exports = { DELTA_KEYS, changeProblems, deltaProblems, applyChanges, withChanges };
