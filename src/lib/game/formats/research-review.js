// Research's review as data (docs/PLAN-start-a-game-gpt.md S2): how each person's answers read to a reviewer, and the
// checks that catch answers contradicting each other, from a format's data rather than its own code, so any show's
// rulebook can say them (rulebook-compile.js writes them from its blocks and its research block, custom.js runs them).
//
// WORDS. A checklist field can say how its answer reads to a reviewer (`note`) and to semantic search (`sentence`, the
// fuller form; the note when it has none). Either is a template:
//   {value}             the answer itself; {s} is "s" unless it's 1 ("3 votes", "1 vote"); {nth} it as a place ("2nd")
//   {key}               another of the person's answers; "found {advantageFoundName|an advantage}" says what's after the
//                       bar when that answer is empty
// `shown` (a condition on the person's answers, rules.js) says when it's said; without one, a yes, a count above 0, or
// text or a list that's there. `note: false` (or `sentence: false`) says nothing. A note with no placeholder is a label,
// as data-only formats always read it: a yes reads as the label, any other answer as "label: answer". So is one whose
// braces name nothing it can say (a moment labelled "Said {catchphrase}"): stored notes were never templates.
//
// CHECKS. data.research.checks, run in order: each a condition over checklist answers that reports a problem (`say`) and
// can repair (`set`: the answers put in place of those that contradict, in practice only ever "no", "unknown" or null,
// which stage nothing). Two kinds:
//   { id, when, say, set? }        one person's answers, checked with the rest of each person's (validateResearch)
//   { id, of: 'episode', values?, when?, who?, each?, set?, say }
//                                  the whole episode's, after everyone's own: `values` names counts and sums over the cast
//                                  ({ count: <a person condition> }, { sum: '<a number question>' }); `when` tests them
//                                  ({ value: name, greaterThan: 0 }; a number test can compare with another value, { equals:
//                                  { value: name } }) and the episode's own answers ({ episode: key, is: 'no' }); `who` is
//                                  who it repairs; `each` says one line per person in `who` rather than one in all.
// A person's check (and an `each`) says {name} and their answers; an episode's says its values and the episode's answers.
//
// Plain CommonJS, browser-safe, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { test, listOf, words, OPS, OPS_FOR, answerConditionProblems } = require('./rules.js');
const { CORE_FIELDS } = require('./checklist.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const ID = /^[a-z][A-Za-z0-9]*$/;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)(?:\|([^{}]*))?\}/g;
// What a field's own words can say besides other answers.
const OWN = ['value', 's', 'nth'];
// What a missed group move's words say: who, the group whose vote they were at, and the group they were still on.
const GROUP_MOVE = ['name', 'group', 'was'];

const isEmpty = (v) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !listOf(v).length);
const asText = (v) => (Array.isArray(v) ? listOf(v).join(', ') : String(v));

/** 2 -> "2nd", 11 -> "11th". */
function nth(n) {
  const v = Math.abs(n) % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th';
  return `${n}${suffix}`;
}

/** The placeholders a template names: [{ key, fallback }]. */
function placeholdersOf(template) {
  return [...String(template).matchAll(PLACEHOLDER)].map((m) => ({ key: m[1], fallback: m[2] }));
}

/**
 * A template filled in: `read(key)` gives an answer (or a value); `own`, when given, is the field's own answer, for
 * {value}, {s} and {nth}.
 */
function fill(template, read, own) {
  const hasOwn = arguments.length > 2;
  return String(template).replace(PLACEHOLDER, (_, key, fallback) => {
    if (hasOwn && key === 's') return own === 1 ? '' : 's';
    if (hasOwn && key === 'nth') return typeof own === 'number' ? nth(own) : asText(own);
    const v = hasOwn && key === 'value' ? own : read(key);
    if (isEmpty(v)) return fallback !== undefined ? fallback : '';
    return asText(v);
  });
}

// ---------- words ----------

// Whether a field's answer is worth a phrase, when the field doesn't say.
function shownByDefault(f, v) {
  if (f.type === 'answer') return v === 'yes';
  if (f.type === 'integer' || f.type === 'number') return typeof v === 'number' && v > 0;
  if (f.type === 'stringList') return listOf(v).length > 0;
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * One person's answers as phrases, listing only what happened: each field's own words (its `sentence` when `sentence`
 * is set, else its `note`), skipping the questions every checklist has. `fields` is a checklist (or part of one: the
 * questions a season rule change added, season-changes.js).
 */
function phrasesOf(fields, c, { sentence = false } = {}) {
  const out = [];
  const keys = new Set([...OWN, ...fields.map((f) => f.key), ...Object.keys(c || {})]);
  const isTemplate = (t) => {
    const named = placeholdersOf(t);
    return named.length > 0 && named.every((x) => keys.has(x.key));
  };
  for (const f of fields) {
    if (f.key in CORE_FIELDS) continue;
    const said = sentence && f.sentence !== undefined ? f.sentence : f.note;
    if (said === false) continue;
    const v = c[f.key];
    if (!(f.shown ? test(f.shown, (leaf) => c[leaf.answer]) : shownByDefault(f, v))) continue;
    const template = isText(said) ? said : words(f.key);
    if (isTemplate(template)) out.push(fill(template, (key) => c[key], v));
    else if (f.type === 'answer') out.push(template);
    else out.push(`${template}: ${asText(v)}`);
  }
  return out;
}

// ---------- checks ----------

const personTest = (cond) => (c) => test(cond, (leaf) => c[leaf.answer]);

// A number test's operand given as another value ({ equals: { value: 'voters' } }), read in.
function withValues(cond, values) {
  if (!isObj(cond)) return cond;
  if ('all' in cond) return { all: cond.all.map((c) => withValues(c, values)) };
  if ('any' in cond) return { any: cond.any.map((c) => withValues(c, values)) };
  if ('not' in cond) return { not: withValues(cond.not, values) };
  const out = { ...cond };
  for (const op of ['equals', 'greaterThan']) if (isObj(out[op]) && 'value' in out[op]) out[op] = values[out[op].value];
  return out;
}

/** One person's checks on `entry` (repairing it in place where a check says): the problems, in order. */
function personProblems(checks, entry) {
  const out = [];
  for (const k of Array.isArray(checks) ? checks : []) {
    if (k.of === 'episode' || !personTest(k.when)(entry)) continue;
    out.push(fill(k.say, (key) => entry[key]));
    if (k.set) Object.assign(entry, k.set);
  }
  return out;
}

/** The whole episode's checks on `payload` (repairing its people in place where a check says): the problems, in order. */
function episodeProblems(checks, payload) {
  const out = [];
  const cast = payload && Array.isArray(payload.castaways) ? payload.castaways : [];
  for (const k of Array.isArray(checks) ? checks : []) {
    if (k.of !== 'episode') continue;
    const values = {};
    for (const [name, v] of Object.entries(k.values || {})) {
      values[name] = 'count' in v ? cast.filter(personTest(v.count)).length : cast.reduce((n, c) => n + (Number.isFinite(c[v.sum]) ? c[v.sum] : 0), 0);
    }
    const read = (leaf) => ('value' in leaf ? values[leaf.value] : payload[leaf.episode]);
    if (k.when && !test(withValues(k.when, values), read)) continue;
    const who = k.who ? cast.filter(personTest(k.who)) : [];
    if (k.each) {
      for (const c of who) {
        out.push(fill(k.say, (key) => c[key]));
        if (k.set) Object.assign(c, k.set);
      }
    } else {
      out.push(fill(k.say, (key) => (key in values ? values[key] : payload[key])));
      if (k.set) for (const c of who) Object.assign(c, k.set);
    }
  }
  return out;
}

// ---------- validation ----------

function setProblems(set, byKey, at) {
  if (!isObj(set) || !Object.keys(set).length) return [`${at}.set: the answers it puts in place, by question`];
  const p = [];
  for (const [key, v] of Object.entries(set)) {
    const f = byKey.get(key);
    if (!f) { p.push(`${at}.set: no checklist question "${key}"`); continue; }
    if (key in CORE_FIELDS) p.push(`${at}.set: ${key} is read on every format, so a check doesn't change it`);
    else if (v === null) { if (!f.nullable) p.push(`${at}.set.${key}: can't be empty`); }
    else if (f.type === 'answer' ? !['yes', 'no', 'unknown'].includes(v)
      : f.type === 'integer' ? !Number.isInteger(v)
        : f.type === 'number' ? !Number.isFinite(v)
          : f.type === 'enum' ? !(f.values || []).includes(v)
            : f.type === 'stringList' ? !(Array.isArray(v) && v.every((x) => typeof x === 'string'))
              : typeof v !== 'string') p.push(`${at}.set.${key}: ${JSON.stringify(v)} isn't an answer it can have`);
  }
  return p;
}

// An episode check's `when`: its values and the episode's own answers.
function episodeConditionProblems(cond, values, episodeFields) {
  if (!isObj(cond)) return ['a condition must be an object'];
  for (const k of ['all', 'any']) {
    if (k in cond) {
      if (Object.keys(cond).length !== 1) return [`${k} must be alone in its condition`];
      if (!Array.isArray(cond[k]) || !cond[k].length) return [`${k}: a non-empty list of conditions`];
      return cond[k].flatMap((c, i) => episodeConditionProblems(c, values, episodeFields).map((m) => `${k}[${i}]: ${m}`));
    }
  }
  if ('not' in cond) return Object.keys(cond).length !== 1 ? ['not must be alone in its condition'] : episodeConditionProblems(cond.not, values, episodeFields).map((m) => `not: ${m}`);
  const subjects = ['value', 'episode'].filter((k) => k in cond);
  const ops = OPS.filter((k) => k in cond);
  if (subjects.length !== 1) return ['needs exactly one of value (a count or sum it names) or episode (an episode question)'];
  if (ops.length !== 1) return [`needs exactly one test: ${OPS.join(', ')}`];
  for (const k of Object.keys(cond)) if (!subjects.includes(k) && !ops.includes(k)) return [`unknown key "${k}"`];
  const op = ops[0];
  const operand = cond[op];
  if (subjects[0] === 'value') {
    if (!Object.prototype.hasOwnProperty.call(values, cond.value)) return [`value: "${cond.value}" isn't one it counts`];
    if (!['equals', 'greaterThan'].includes(op)) return [`${op}: a count or sum takes equals / greaterThan`];
  } else {
    const f = episodeFields.find((x) => x && x.key === cond.episode);
    if (!f) return [`episode: no episode question "${cond.episode}"`];
    if (!OPS_FOR[f.type].includes(op)) return [`${op}: "${cond.episode}" is ${f.type}, which takes ${OPS_FOR[f.type].join(' / ')}`];
    if (f.type === 'answer' && !['yes', 'no', 'unknown'].includes(operand)) return [`${op}: "${operand}" isn't yes, no or unknown`];
  }
  if (op === 'equals' || op === 'greaterThan') {
    if (isObj(operand)) return Object.keys(operand).length === 1 && Object.prototype.hasOwnProperty.call(values, operand.value) ? [] : [`${op}: a number, or { value } naming one it counts`];
    return Number.isFinite(operand) ? [] : [`${op}: a number`];
  }
  if (op === 'present') return typeof operand === 'boolean' ? [] : ['present: true or false'];
  return typeof operand === 'string' ? [] : [`${op}: a text value`];
}

function templateProblems(template, at, known) {
  if (!isText(template)) return [`${at}: non-empty text`];
  return placeholdersOf(template).filter((x) => !known(x.key)).map((x) => `${at}: {${x.key}} isn't something it can say`);
}

/** Why `data`'s checks aren't usable: [] when they are. */
function checksProblems(checks, data) {
  if (!Array.isArray(checks)) return ['research.checks: a list of checks'];
  const research = (data && data.research) || {};
  const fields = Array.isArray(research.checklist) ? research.checklist : [];
  const episodeFields = Array.isArray(research.episodeFields) ? research.episodeFields : [];
  const byKey = new Map(fields.filter((f) => f && typeof f.key === 'string').map((f) => [f.key, f]));
  const cond = (c, at) => answerConditionProblems(c, data).map((m) => `${at}: ${m}`);
  const p = [];
  const seen = new Set();
  checks.forEach((k, i) => {
    const at = `research.checks[${isObj(k) && isText(k.id) ? k.id : i}]`;
    if (!isObj(k)) return p.push(`${at}: not an object`);
    if (!isText(k.id) || !ID.test(k.id)) p.push(`${at}: id must be a camelCase identifier`);
    else if (seen.has(k.id)) p.push(`${at}: id used twice`);
    seen.add(k.id);
    const episode = k.of === 'episode';
    if (k.of !== undefined && !episode) p.push(`${at}: of is episode, or left out for one person's`);
    const allowed = episode ? ['id', 'of', 'values', 'when', 'who', 'each', 'set', 'say'] : ['id', 'when', 'set', 'say'];
    for (const key of Object.keys(k)) if (!allowed.includes(key)) p.push(`${at}: "${key}" isn't something ${episode ? "an episode's" : "a person's"} check takes`);
    if ('set' in k) p.push(...setProblems(k.set, byKey, at));
    if (!episode) {
      if (!('when' in k)) p.push(`${at}.when: missing (which answers it checks)`);
      else p.push(...cond(k.when, `${at}.when`));
      p.push(...templateProblems(k.say, `${at}.say`, (key) => byKey.has(key)));
      return;
    }
    const values = isObj(k.values) ? k.values : {};
    if ('values' in k && !isObj(k.values)) p.push(`${at}.values: a map of names to counts and sums`);
    for (const [name, v] of Object.entries(values)) {
      const vat = `${at}.values.${name}`;
      if (!ID.test(name)) p.push(`${vat}: a camelCase name`);
      if (!isObj(v) || Object.keys(v).length !== 1 || !('count' in v || 'sum' in v)) { p.push(`${vat}: { count: <condition> } or { sum: <question> }`); continue; }
      if ('count' in v) p.push(...cond(v.count, `${vat}.count`));
      else if (!byKey.has(v.sum) || !['integer', 'number'].includes(byKey.get(v.sum).type)) p.push(`${vat}.sum: "${v.sum}" isn't a number question`);
    }
    if ('when' in k) p.push(...episodeConditionProblems(k.when, values, episodeFields).map((m) => `${at}.when: ${m}`));
    if ('who' in k) p.push(...cond(k.who, `${at}.who`));
    if ('set' in k && !('who' in k)) p.push(`${at}.set: an episode's check repairs who \`who\` says`);
    if ('each' in k && typeof k.each !== 'boolean') p.push(`${at}.each: true or false`);
    if (k.each && !('who' in k)) p.push(`${at}.each: one line for each of \`who\`, which it doesn't say`);
    const known = k.each ? (key) => byKey.has(key) : (key) => Object.prototype.hasOwnProperty.call(values, key) || episodeFields.some((f) => f && f.key === key);
    p.push(...templateProblems(k.say, `${at}.say`, known));
  });
  return p;
}

/**
 * Why research's review data isn't usable, beyond each field's own shape (checklist.js): when its words are said
 * (`shown`; a note's braces needn't name anything, phrasesOf), its checks, and its votes one group goes to at a time (`groupVotes`: [{ attended, say }], who was at it and
 * the words for a missed move, {name}, {group} and {was}, which db/episode-research.js tribalGroupProblems reads). [] when
 * it is.
 */
function reviewProblems(data) {
  const research = (data && data.research) || {};
  const fields = Array.isArray(research.checklist) ? research.checklist : [];
  const byKey = new Map(fields.filter((f) => f && typeof f.key === 'string').map((f) => [f.key, f]));
  const p = [];
  for (const f of fields) {
    if (isObj(f) && 'shown' in f) p.push(...answerConditionProblems(f.shown, data).map((m) => `research.checklist: ${f.key}.shown: ${m}`));
  }
  if ('checks' in research) p.push(...checksProblems(research.checks, data));
  if ('groupVotes' in research) {
    const g = research.groupVotes;
    if (!Array.isArray(g) || !g.length) p.push('research.groupVotes: a list of the votes one group goes to at a time');
    for (const [i, v] of (Array.isArray(g) ? g : []).entries()) {
      const at = `research.groupVotes[${i}]`;
      if (!isObj(v) || Object.keys(v).some((k) => !['attended', 'say'].includes(k))) { p.push(`${at}: { attended, say }`); continue; }
      if (!byKey.has(v.attended) || byKey.get(v.attended).type !== 'answer') p.push(`${at}.attended: a yes-or-no checklist question (who was at the vote)`);
      p.push(...templateProblems(v.say, `${at}.say`, (key) => GROUP_MOVE.includes(key)));
    }
  }
  return p;
}

/** A template with each placeholder's key renamed (`rename(key)`), bar a field's own {value}, {s} and {nth}. */
function renamePlaceholders(template, rename) {
  return String(template).replace(PLACEHOLDER, (all, key, fallback) => (OWN.includes(key) ? all : `{${rename(key)}${fallback !== undefined ? `|${fallback}` : ''}}`));
}

/** A condition with each answer it reads renamed (`rename(key)`). */
function renameAnswers(cond, rename) {
  if (Array.isArray(cond)) return cond.map((c) => renameAnswers(c, rename));
  if (!isObj(cond)) return cond;
  const out = {};
  for (const [k, v] of Object.entries(cond)) out[k] = k === 'answer' && typeof v === 'string' ? rename(v) : renameAnswers(v, rename);
  return out;
}

module.exports = {
  fill, nth, placeholdersOf, phrasesOf, personProblems, episodeProblems, checksProblems, reviewProblems, renamePlaceholders, renameAnswers,
};
