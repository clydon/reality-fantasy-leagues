// "Check for rule changes" (docs/PLAN-season-rule-changes.md): the prompt an admin copies into a
// web-searching chat mid-season, the chat's answer parsed, and the review model a change is approved
// from -- the season counterpart of proposal.js, which does this for a whole new show. Three steps,
// all pure:
//
//   buildCheckPrompt   the rules the season plays by now, and "what's new or different since?"
//   parseCheck         the chat's answer -> an object (JSON, chatter around it tolerated)
//   reviewCheck        answer + the season's current rules -> the change (season-changes.js's delta),
//                      every problem at the row it's about, the rows the review screen shows, and
//                      whether it can be approved
//
// The admin edits the ANSWER (its rows), never the derived delta, and the server re-derives on save
// and approval, exactly as proposal.js does. "Nothing changed" is a real answer, and is recorded too:
// it's how the season row knows a check was done through episode N.
//
// A change only adds (or retires an event); see season-changes.js for why. Everything the chat
// reports that doesn't fit -- a change to how an existing mechanic works, a new secret role -- goes in
// `flagged`, for a developer, exactly like a proposal's flagged mechanics.
//
// Plain CommonJS with no dependencies outside formats/, like everything here.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { parseProposal, camelId } = require('./proposal.js');
const { CORE_FIELDS } = require('./checklist.js');
const { describeRule } = require('./rules.js');
const { applyChanges, deltaProblems } = require('./season-changes.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const TIERS = ['A', 'B', 'C', 'D'];
const QUESTION_TYPES = ['answer', 'integer', 'string', 'stringList', 'enum'];
// A change can add a way of leaving, or of reaching the end -- not a second winner.
const EXIT_KINDS = ['out', 'finalist'];
const ID = /^[a-z][A-Za-z0-9]*$/;
const EPISODE_KEYS = ['episodeTitle', 'airDate', 'summary', 'castaways', 'betAnswers', 'rulesNote'];

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const list = (v) => (Array.isArray(v) ? v : []);
const episodeOf = (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n >= 1 ? n : null;
};

// What the chat fills in. Hand-written, beside the checks below, which are the real contract.
const CHECK_SHAPE = {
  changed: 'boolean: has anything about how this season is played changed from the rules listed above?',
  summary: 'two or three sentences: what changed and when, or why you found nothing',
  effectiveEpisode: 'the first episode the change applies to (a number), or null if nothing changed',
  checkedThrough: 'the last aired episode you found recaps for (a number)',
  exitMethods: [{ name: 'a NEW way of leaving, in the show\'s words', kind: 'out | finalist', meaning: 'one line' }],
  questions: [{ key: 'camelCase', type: 'answer | integer | string | stringList | enum', values: ['only for enum'], question: 'what research is asked about EACH person EACH episode from now on', note: 'a 1-4 word phrase for a reviewer when the answer is yes', tier: 'A | B | C | D', where: 'where this is reported' }],
  events: [{ id: 'camelCase', label: 'shown to players', category: 'an existing category\'s name, or a new one', points: 'number (a suggestion; each league decides)', tier: 'A | B | C | D', why: 'why a fantasy player would care, and how reliably it\'s reported' }],
  rules: { research: ['rules reading the questions'], implied: ['rules reading exits or exile'] },
  retire: [{ event: 'an existing event id that can no longer happen', why: 'what changed' }],
  notTrackable: [{ fact: 'something a league would want', why: 'why recaps don\'t report it reliably' }],
  flagged: [{ name: 'a change the additions above can\'t express', what: 'how it works now', whyCode: 'why it needs more than new questions, events and rules', findings: 'what you found, with sources' }],
  sources: ['every URL you read'],
};

/**
 * The prompt: the season's rules as they stand (base plus approved changes, `data`), and what to
 * report. `flags` are research's own "something new happened" notes, [{ episode, note }].
 */
function buildCheckPrompt({ showName, seasonLabel, wikiUrl, data, airedThrough, approved = [], flags = [] } = {}) {
  const show = text(showName) || 'the show';
  const season = text(seasonLabel) || 'the current season';
  const d = isObj(data) ? data : {};
  const research = isObj(d.research) ? d.research : {};
  const questions = list(research.checklist).filter((f) => f && !(f.key in CORE_FIELDS));
  const categoryOf = (id) => (list(d.eventCategories).find((c) => list(c.events).includes(id)) || {}).label || 'Other';
  const rules = isObj(d.rules) ? [...list(d.rules.research), ...list(d.rules.implied)] : [];
  const lines = [
    `A fantasy league is running on "${show}", ${season}, which is still airing${episodeOf(airedThrough) ? ` (episode ${airedThrough} has aired)` : ''}.`,
    wikiUrl ? `The season's fan wiki page: ${text(wikiUrl)}` : '',
    '',
    'The league scores the season with a fixed set of RULES, listed below: what research asks about every',
    'person after every episode, the scoring events, and the rules connecting them. Shows sometimes change',
    'how they are played partway through a season -- a new twist, a new kind of advantage, a new way to',
    'leave the game. Your job: find out whether THIS season has done that, and if so, describe it as',
    'additions to the rules below.',
    '',
    'WHAT COUNTS AS A CHANGE',
    '  - Something new for this season that the rules below don\'t already cover. A mechanic the rules',
    '    already ask about (even under another name) is NOT a change.',
    '  - Only what has actually aired. Don\'t report announced, rumoured or expected twists.',
    '  - Nothing new is a perfectly good answer: say changed: false and explain in summary.',
    '',
    `HOW IT GETS USED: research asks your new questions about each person in every episode from`,
    'effectiveEpisode on, and your rules turn the answers into points. A question recaps don\'t answer',
    'plainly is worse than none -- the researcher will invent plausible answers.',
    '',
    'THE RULES AS THEY STAND',
    '',
    `Ways of leaving: ${list(d.exitMethods).join(', ')}`,
    '',
    'Questions asked about every person, every episode (besides who left and how):',
    ...questions.map((f) => `  - ${f.key} (${f.type}${f.values ? `: ${f.values.join(' / ')}` : ''}): ${text(f.description) || f.key}`),
    '',
    'Scoring events, by category:',
    ...list(d.events).filter((e) => !e.retiredFrom).map((e) => `  - [${categoryOf(e.id)}] ${e.id}: ${e.label}`),
    '',
    'Scoring rules:',
    ...rules.map((r) => `  - ${describeRule(r, d)}`),
    approved.length ? '' : null,
    approved.length ? 'Changes already recorded for this season (included above -- don\'t report them again):' : null,
    ...approved.map((c) => `  - from episode ${c.effectiveEpisode}: ${text(c.summary) || 'a change'}`),
    flags.length ? '' : null,
    flags.length ? 'Episode research noted these as possibly new -- check each one:' : null,
    ...flags.map((f) => `  - episode ${f.episode}: ${text(f.note)}`),
    '',
    'IF SOMETHING CHANGED, describe it ONLY as additions:',
    '  - exitMethods: new ways of leaving (kind out, or finalist for reaching the end). Not existing ones.',
    '  - questions: new per-person questions. Ask for PRIMITIVES a recap states (who was sent where,',
    '    how many times), not conclusions. Don\'t re-ask anything listed above.',
    '  - events: new scoring events. category: one of the categories above, or a new one.',
    '  - rules: what awards each new event, in the same language as the rules above, e.g.',
    '      { "when": { "answer": "sentToIsland", "is": "yes" }, "award": "sentToIsland" }',
    '      { "whenExit": "Banished", "award": "banished" }',
    '    A new rule may read existing questions too. An event is awarded by research rules OR exit rules.',
    '  - retire: an existing event that can no longer happen from effectiveEpisode on (rare).',
    '  If what changed is HOW something existing works (its rules, its points, what a question means),',
    '  or a secret role, put it in flagged: it needs a developer, and nothing above should pretend otherwise.',
    '',
    'TIERS (for every question and event): A stated plainly every episode; B worked out from other answers;',
    'C reported often but not always; D rarely or only speculation (put those in notTrackable instead).',
    '',
    'POINTS: a suggestion on the scale above (a rare decisive moment 3-4, a frequent minor one 0.5-1,',
    '0 for "track it, don\'t score it yet"). Every league decides its own.',
    '',
    'Name every page you read in sources. Don\'t claim anything about a page you didn\'t open.',
    '',
    'Answer with ONE JSON object and nothing else, in this shape (the values describe what goes there):',
    '',
    JSON.stringify(CHECK_SHAPE, null, 1),
    '',
    'Paste the JSON back into Reality Fantasy Leagues\' "Check for rule changes" box.',
  ].filter((l) => l !== null);
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n').replace(/^\n+/, '');
}

/** A chat's answer -> an object. Same tolerance as a proposal's (chatter, code fences). */
const parseCheck = (answer) => parseProposal(answer);

// Which events a rule awards (an award, or a built-in's event params).
function awardsOf(rule) {
  if (!isObj(rule)) return [];
  if (rule.award) return [rule.award];
  return Object.entries(rule).filter(([k, v]) => typeof v === 'string' && k !== 'builtIn' && /^(award|otherwise|roleOn|otherOn)/.test(k)).map(([, v]) => v);
}

/**
 * The review of a check answer against `base` -- the season's rules as they stand (its format's data
 * with every OTHER approved change already merged). `effectiveEpisode` overrides the answer's (the
 * admin's correction). Returns the delta it derives plus everything the review screen shows.
 */
function reviewCheck(answer, base, { effectiveEpisode } = {}) {
  const a = isObj(answer) ? answer : {};
  const problems = [];
  const warnings = [];
  const repairs = [];
  const notTrackable = list(a.notTrackable).filter(isObj).map((x) => ({ fact: text(x.fact), why: text(x.why) })).filter((x) => x.fact);
  const flagged = list(a.flagged).filter(isObj).map((f) => ({ name: text(f.name), what: text(f.what), whyCode: text(f.whyCode), findings: text(f.findings) })).filter((f) => f.name);
  const ep = episodeOf(effectiveEpisode) || episodeOf(a.effectiveEpisode);
  const b = isObj(base) ? base : {};
  const has = {
    exit: (n) => list(b.exitMethods).some((x) => x.toLowerCase() === n.toLowerCase()),
    question: (k) => list(b.research && b.research.checklist).some((f) => f.key === k),
    event: (id) => list(b.events).some((e) => e.id === id),
  };

  // --- exits ---
  const exits = [];
  for (const x of list(a.exitMethods)) {
    const name = text(isObj(x) ? x.name : x);
    if (!name) continue;
    if (has.exit(name)) { repairs.push({ at: `exits[${name}]`, message: 'already a way of leaving; left out' }); continue; }
    if (exits.some((e) => e.name.toLowerCase() === name.toLowerCase())) { repairs.push({ at: `exits[${name}]`, message: 'listed twice; kept the first' }); continue; }
    let kind = isObj(x) ? text(x.kind).toLowerCase() : '';
    if (!EXIT_KINDS.includes(kind)) {
      if (kind) repairs.push({ at: `exits[${name}]`, message: `kind "${kind}" isn't out or finalist; read as out` });
      kind = 'out';
    }
    exits.push({ name, kind, meaning: isObj(x) ? text(x.meaning) : '' });
  }

  // --- questions ---
  const questions = [];
  for (const [i, q] of list(a.questions).entries()) {
    if (!isObj(q)) continue;
    let key = text(q.key);
    const at = () => `questions[${key || i}]`;
    if (!ID.test(key)) {
      const fixed = camelId(key || q.question);
      if (fixed) repairs.push({ at: `questions[${fixed}]`, message: `key "${key}" isn't camelCase; renamed ${fixed}` });
      key = fixed;
    }
    if (!key) { problems.push({ at: at(), message: 'no key, and none could be made from the question' }); continue; }
    if (key in CORE_FIELDS || EPISODE_KEYS.includes(key) || has.question(key)) {
      repairs.push({ at: at(), message: `${key} is already asked; left out` });
      continue;
    }
    if (questions.some((x) => x.key === key)) { repairs.push({ at: at(), message: 'key used twice; kept the first' }); continue; }
    const tier = TIERS.includes(text(q.tier).toUpperCase()) ? text(q.tier).toUpperCase() : null;
    if (tier === 'D') {
      notTrackable.push({ fact: text(q.question) || key, why: text(q.where) || 'research rated it tier D' });
      repairs.push({ at: at(), message: 'tier D: moved to "not reliably trackable"' });
      continue;
    }
    const type = text(q.type);
    const row = { key, type, values: Array.isArray(q.values) ? q.values.map(String) : undefined, question: text(q.question), note: text(q.note), tier, where: text(q.where), problems: [] };
    if (!QUESTION_TYPES.includes(type)) row.problems.push(`type must be one of ${QUESTION_TYPES.join(', ')}`);
    if (!row.question) row.problems.push('the question itself is missing');
    if (!tier) row.problems.push('no tier (A, B or C)');
    if (type === 'enum' && !(row.values && row.values.length)) row.problems.push('an enum question needs its values');
    if (tier === 'C') warnings.push({ at: at(), message: 'tier C: reported often but not always' });
    questions.push(row);
  }

  // --- rules ---
  const rules = isObj(a.rules) ? a.rules : {};
  const research = list(rules.research);
  const implied = list(rules.implied);
  const awardedBy = { research: new Set(research.flatMap(awardsOf)), implied: new Set(implied.flatMap(awardsOf)) };

  // --- events (and the categories they go in) ---
  const baseCategories = list(b.eventCategories);
  const newCategories = [];
  const categoryFor = (label) => {
    const l = label.toLowerCase();
    const found = baseCategories.find((c) => c.id.toLowerCase() === l || text(c.label).toLowerCase() === l);
    if (found) return { id: found.id, label: found.label, isNew: false };
    let c = newCategories.find((x) => x.label.toLowerCase() === l);
    if (!c) {
      c = { id: camelId(label) || `group${newCategories.length + 1}`, label };
      while (baseCategories.some((x) => x.id === c.id) || newCategories.some((x) => x.id === c.id)) c.id += '2';
      newCategories.push(c);
    }
    return { id: c.id, label: c.label, isNew: true };
  };
  const events = [];
  for (const [i, e] of list(a.events).entries()) {
    if (!isObj(e)) continue;
    let eid = text(e.id);
    const at = () => `events[${eid || i}]`;
    if (!ID.test(eid)) {
      const fixed = camelId(eid || e.label);
      if (fixed) repairs.push({ at: `events[${fixed}]`, message: `id "${eid}" isn't camelCase; renamed ${fixed}` });
      eid = fixed;
    }
    if (!eid) { problems.push({ at: at(), message: 'no id, and none could be made from the label' }); continue; }
    if (has.event(eid)) { problems.push({ at: at(), message: `${eid} is already an event; a change can't redefine one (use a new id, or flag it)` }); continue; }
    if (events.some((x) => x.id === eid)) { repairs.push({ at: at(), message: 'id used twice; kept the first' }); continue; }
    const tier = TIERS.includes(text(e.tier).toUpperCase()) ? text(e.tier).toUpperCase() : null;
    if (tier === 'D') {
      notTrackable.push({ fact: text(e.label) || eid, why: text(e.why) || 'research rated it tier D' });
      repairs.push({ at: at(), message: 'tier D: moved to "not reliably trackable"' });
      continue;
    }
    const points = typeof e.points === 'string' && e.points.trim() !== '' ? Number(e.points) : e.points;
    const category = categoryFor(text(e.category) || 'Other');
    const row = { id: eid, label: text(e.label), category: category.label, categoryId: category.id, newCategory: category.isNew, points, tier, why: text(e.why), implied: awardedBy.implied.has(eid), problems: [] };
    if (!Number.isFinite(points)) row.problems.push('points must be a number');
    if (!row.label) row.problems.push('the label is missing');
    if (!tier) row.problems.push('no tier (A, B or C)');
    if (awardedBy.research.has(eid) && awardedBy.implied.has(eid)) row.problems.push('awarded by both a research rule and an exit rule; pick one');
    if (tier === 'C') warnings.push({ at: at(), message: 'tier C: reported often but not always' });
    events.push(row);
  }

  // --- retirements ---
  const retire = [];
  for (const r of list(a.retire)) {
    const id = text(isObj(r) ? r.event : r);
    if (!id) continue;
    const row = { event: id, why: isObj(r) ? text(r.why) : '', problems: [] };
    if (!has.event(id)) row.problems.push(`no event ${id} to retire`);
    retire.push(row);
  }

  // --- the delta ---
  const usableEvents = events.filter((e) => !e.problems.length);
  const usedCategories = new Set(usableEvents.filter((e) => e.newCategory).map((e) => e.categoryId));
  const delta = {
    addCategories: newCategories.filter((c) => usedCategories.has(c.id)).map((c) => ({ id: c.id, label: c.label })),
    addEvents: usableEvents.map((e) => ({ id: e.id, label: e.label, defaultPoints: e.points, ...(e.implied ? { implied: true } : {}), category: e.categoryId })),
    addQuestions: questions.filter((q) => !q.problems.length).map((q) => ({
      key: q.key,
      type: q.type,
      ...(q.type === 'answer' ? {} : { nullable: true }),
      ...(q.type === 'enum' ? { values: q.values } : {}),
      description: q.question,
      ...(q.note ? { note: q.note } : {}),
    })),
    addExitMethods: exits.map((x) => ({ name: x.name, ...(x.kind === 'finalist' ? { endgame: true } : {}) })),
    addRules: { research, implied },
    retireEvents: retire.filter((r) => !r.problems.length).map((r) => r.event),
  };
  const empty = !delta.addEvents.length && !delta.addQuestions.length && !delta.addExitMethods.length && !delta.retireEvents.length && !research.length && !implied.length;

  // --- does it fit the season's rules? ---
  const changed = a.changed === true || (a.changed !== false && !empty);
  let skipped = [];
  let merged = null;
  if (changed) {
    if (!ep) problems.push({ at: 'change', message: 'which episode does it apply from? (effectiveEpisode)' });
    if (empty) problems.push({ at: 'change', message: 'says something changed, but adds nothing: describe it as additions, or flag it for a developer' });
    for (const m of deltaProblems(delta)) problems.push({ at: 'change', message: m });
    if (ep && !problems.length) {
      try {
        const out = applyChanges(b, [{ id: 'review', effectiveEpisode: ep, delta }]);
        merged = out.data;
        // Against the season's own rules, anything skipped is a real conflict, not a league's quirk.
        skipped = out.skipped;
        for (const s of skipped) problems.push({ at: whereIs(s.what), message: s.why });
      } catch (e) {
        problems.push({ at: 'change', message: e.message });
      }
    }
  }
  for (const q of questions) for (const m of q.problems) problems.push({ at: `questions[${q.key}]`, message: m });
  for (const e of events) for (const m of e.problems) problems.push({ at: `events[${e.id}]`, message: m });
  for (const r of retire) for (const m of r.problems) problems.push({ at: `retire[${r.event}]`, message: m });

  // --- what it means for the screen ---
  const sentenceData = merged || { ...b, events: [...list(b.events), ...delta.addEvents] };
  const sentence = (r) => describeRule(ep ? { ...r, fromEpisode: ep } : r, sentenceData);
  const at = (prefix) => (x) => x.at === prefix;
  const ruleRows = [
    ...research.map((r, i) => ({ r, at: `rules.research[${i}]` })),
    ...implied.map((r, i) => ({ r, at: `rules.implied[${i}]` })),
  ];
  const rulesFor = (eid) => ruleRows.filter(({ r }) => awardsOf(r).includes(eid)).map(({ r, at: where }) => ({ at: where, sentence: sentence(r) }));
  for (const e of events) if (!rulesFor(e.id).length) warnings.push({ at: `events[${e.id}]`, message: 'no rule awards it: it can only be added by hand' });
  const reads = JSON.stringify(ruleRows.map(({ r }) => r));
  for (const q of questions) if (!reads.includes(`"${q.key}"`)) warnings.push({ at: `questions[${q.key}]`, message: 'no rule reads it: asked every episode, never scored' });
  for (const x of exits) {
    const scored = implied.some((r) => isObj(r) && (Array.isArray(r.whenExit) ? r.whenExit : [r.whenExit]).includes(x.name));
    if (!scored) warnings.push({ at: `exits[${x.name}]`, message: 'leaving this way scores nothing' });
  }
  if (flagged.length) warnings.push({ at: 'change', message: `${flagged.length} thing${flagged.length === 1 ? '' : 's'} flagged for a developer: approving records only the additions` });

  return {
    changed,
    summary: text(a.summary),
    effectiveEpisode: ep,
    checkedThrough: episodeOf(a.checkedThrough),
    delta,
    approvable: changed && problems.length === 0,
    problems,
    warnings,
    repairs,
    skipped,
    exits: exits.map((x) => ({ ...x, warnings: warnings.filter(at(`exits[${x.name}]`)).map((w) => w.message) })),
    questions: questions.map((q) => ({ ...q, problems: problems.filter(at(`questions[${q.key}]`)).map((x) => x.message), warnings: warnings.filter(at(`questions[${q.key}]`)).map((x) => x.message) })),
    events: events.map((e) => ({ ...e, rules: rulesFor(e.id), problems: problems.filter(at(`events[${e.id}]`)).map((x) => x.message), warnings: warnings.filter(at(`events[${e.id}]`)).map((x) => x.message) })),
    // Rules no event row shows (one awarding an existing event, say), so none goes unseen.
    otherRules: ruleRows.filter(({ r }) => !awardsOf(r).some((x) => events.some((e) => e.id === x))).map(({ r, at: where }) => ({ at: where, sentence: sentence(r) })),
    retire: retire.map((r) => ({ ...r, problems: problems.filter(at(`retire[${r.event}]`)).map((x) => x.message) })),
    notTrackable,
    flagged,
    sources: list(a.sources).map(text).filter(Boolean),
  };
}

// A skip's "what" ("event x", "question y", "a research rule") -> the row it belongs to.
function whereIs(what) {
  const m = /^(event|question|exit method|retiring) (.+)$/.exec(what);
  if (!m) return 'change';
  return { event: `events[${m[2]}]`, question: `questions[${m[2]}]`, 'exit method': `exits[${m[2]}]`, retiring: `retire[${m[2]}]` }[m[1]];
}

module.exports = { CHECK_SHAPE, buildCheckPrompt, parseCheck, reviewCheck };
