// A proposed format: what research says a show nobody hand-wrote should look like, and the review model
// an admin approves it from (docs/PLAN-stage-3-format-proposals.md). Three steps, all pure:
//
//   buildProposalPrompt   the text an admin copies into any web-searching chat (free; a paid call later)
//   parseProposal         the chat's answer -> a proposal object (JSON, chatter around it tolerated)
//   reviewProposal        proposal -> the format's data half, every problem at the row it's about, the
//                         rows the review screen shows, and whether it can be approved
//
// The screen edits the PROPOSAL (its rows), never the derived data, and the server re-derives on save
// and on approval -- so this file runs in the browser bundle and under bare node alike. A bad row is
// kept with its problem rather than failing the whole proposal: one wrong line never throws away a long
// research answer.
//
// What the chat writes vs what this fills in: the chat proposes the show's own vocabulary -- exit
// methods, per-person questions, scoring events, the rules that connect them -- plus what it found
// untrackable and what needs a developer. Everything the app needs on every format (the core checklist
// fields, an Other exit, categories, claims, the search hint, the wiki half) is filled in here, so a
// chat can't get it wrong.
//
// Plain CommonJS with no dependencies, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { formatProblems } = require('./define.js');
const { CORE_FIELDS } = require('./checklist.js');
const { BUILT_INS, describeRule } = require('./rules.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const TIERS = ['A', 'B', 'C', 'D'];
const QUESTION_TYPES = ['answer', 'integer', 'string', 'stringList', 'enum'];
const EXIT_KINDS = ['out', 'finalist', 'winner'];
const ID = /^[a-z][A-Za-z0-9]*$/;
// Keys research's episode-level answer already uses (db/episode-research.js researchSchemaFor).
const EPISODE_KEYS = ['episodeTitle', 'airDate', 'summary', 'castaways', 'betAnswers'];
// Recap and reference sites episode research already trusts for other shows. A suggested domain on one
// of these is pre-checked on the review screen; nothing is ever applied without the admin's say.
const KNOWN_GOOD_DOMAINS = [
  'wikipedia.org', 'fandom.com', 'goldderby.com', 'today.com', 'ew.com', 'vulture.com', 'avclub.com',
  'tvline.com', 'variety.com', 'hollywoodreporter.com', 'people.com', 'usatoday.com', 'radiotimes.com',
  'theguardian.com', 'bbc.co.uk', 'digitalspy.com', 'screenrant.com', 'tvinsider.com',
];

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const list = (v) => (Array.isArray(v) ? v : []);

/** "Love Island (UK)" -> "love-island-uk": a format id. */
function formatIdFor(name) {
  return text(name).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^[^a-z]+/, '') || 'show';
}

/** "Won the challenge!" -> "wonTheChallenge": an event id or question key from a label. */
function camelId(label) {
  const parts = text(label).normalize('NFKD').replace(/[^A-Za-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const id = parts.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('');
  return /^[a-z]/.test(id) ? id : id ? `x${id}` : '';
}

// ---------- the prompt ----------

// The JSON shape the chat fills in, written out for it. Hand-written (no zod here) and kept beside the
// checks below, which are the real contract.
const PROPOSAL_SHAPE = {
  show: { name: 'string', castawayTerm: 'what the show calls a contestant, singular', tribeTerm: 'what it calls a group/team, singular', hasMerge: 'boolean: do groups merge into one partway through?', hasGroups: 'boolean: are people in groups that can change?' },
  seasonsChecked: ['the seasons you actually researched, by name'],
  exitMethods: [{ name: 'how someone leaves, in the show\'s words', kind: 'out | finalist | winner', meaning: 'one line' }],
  questions: [{ key: 'camelCase', type: 'answer | integer | string | stringList | enum', values: ['only for enum'], question: 'what research is asked about EACH person EACH episode', note: 'a 1-4 word phrase for a reviewer when the answer is yes', tier: 'A | B | C | D', where: 'where this is reported' }],
  events: [{ id: 'camelCase', label: 'shown to players', category: 'a display group', points: 'number', tier: 'A | B | C | D', why: 'why a fantasy player would care, and how reliably it\'s reported', headline: 'boolean: one of the episode\'s headline wins' }],
  rules: { research: ['rules reading the questions (see the rules language)'], implied: ['rules reading exits (see the rules language)'] },
  notTrackable: [{ fact: 'something a fantasy league would want', why: 'why recaps don\'t report it reliably' }],
  flagged: [{ name: 'a mechanic the rules language can\'t express', what: 'how it works', whyCode: 'why it needs more than these rules', findings: 'what you found, with sources' }],
  domains: [{ domain: 'example.com', why: 'what it reliably reports' }],
  sources: ['every URL you read'],
};

// The built-ins a proposed format can use: not those that need secret roles, which a data-only format
// can't have yet (custom.js) -- a role mechanic is flagged instead.
function builtInLines() {
  return Object.entries(BUILT_INS).filter(([, b]) => !Object.values(b.params).some((s) => s.type === 'role')).map(([name, b]) => {
    const params = Object.entries(b.params).map(([k, s]) => `${k} (${s.type === 'field' ? `a ${s.fieldTypes.join('/')} question key` : s.type})`).join(', ');
    return `  - ${name} [${b.context} rules; params: ${params}]: ${b.describe}`;
  });
}

/**
 * The prompt an admin copies into a web-searching chat to research a new show's format.
 * `terms` is an optional hint ({ castaway, tribe }), `seasons` an optional hint of which seasons to read.
 */
function buildProposalPrompt({ showName, wikiUrl, terms, seasons } = {}) {
  const show = text(showName) || 'the show';
  const lines = [
    `You are designing the data model for a fantasy league built on the reality show "${show}".`,
    wikiUrl ? `Its fan wiki: ${text(wikiUrl)}` : '',
    terms && (terms.castaway || terms.tribe) ? `It calls a contestant "${text(terms.castaway) || '?'}" and a group "${text(terms.tribe) || '?'}" (correct this if the show doesn't).` : '',
    '',
    'HOW YOUR ANSWER GETS USED, so you can judge what matters: after every episode, a web-searching model',
    'is asked your per-person QUESTIONS about that episode and answers them from recaps (yes / no /',
    'unknown, a number, a name). Code then turns those answers into fantasy points with your RULES. So a',
    'question is only worth asking if recaps report it plainly, every episode, season after season. A',
    'question that sounds extractable but isn\'t is worse than useless: the model will invent a plausible',
    'answer and nothing downstream can catch it.',
    '',
    'WHAT TO DO',
    `1. Search for and read episode recaps and the wiki pages of ${text(seasons) || 'at least four recent seasons, plus one or two older ones'}. Name them in seasonsChecked.`,
    '2. Work out every way someone leaves the game (exitMethods). Exactly one is the winner.',
    '3. List the per-person facts recaps report. Ask for PRIMITIVES -- what a recap states (who was at',
    '   risk, how many votes they got, who they voted for) -- not conclusions you can compute from them.',
    '   Prefer numbers to yes/no wherever recaps give a number.',
    '4. Propose the scoring events a fantasy player would care about, and the rules that award each one',
    '   from the questions or from how someone left.',
    '5. Say what a league would want but recaps don\'t reliably report (notTrackable), and any mechanic the',
    '   rules language below can\'t express (flagged) -- don\'t force it into rules that are wrong. Secret',
    '   roles (a hidden Traitor, a Mole) always go in flagged.',
    '',
    'TIERS (give one for every question and event):',
    '  A -- stated plainly every episode (a table, or every recap says it)',
    '  B -- worked out from other answers (counting, comparing)',
    '  C -- reported often but not always, or only in some seasons',
    '  D -- rarely, or only as speculation. Put these in notTrackable instead of questions/events.',
    '',
    'POINTS: one number per event, on the scale other formats here use: a rare decisive moment 3-4, a',
    'frequent minor one 0.5-1, leaving -3, quitting -5, winning the season 6-10. 0 is fine for something',
    'worth tracking but not scoring yet.',
    '',
    'DON\'T ADD these questions -- every format already asks them: name, leftTheGame (did they leave this',
    'episode, yes/no/unknown), exitMethod (how, one of your exitMethods), sources, confidence. Your rules',
    'CAN read leftTheGame and exitMethod. Question keys and event ids are camelCase and unique.',
    '',
    'THE RULES LANGUAGE. A rule says "when this is true, award this event".',
    '  research rules read one person\'s answers:',
    '    { "when": { "answer": "wonChallenge", "is": "yes" }, "award": "challengeWin" }',
    '    { "when": { "all": [{ "answer": "atRisk", "is": "yes" }, { "answer": "leftTheGame", "isNot": "yes" }] }, "award": "survivedDumping" }',
    '    { "when": { "answer": "votesReceived", "greaterThan": 0 }, "award": "receivedVotes" }',
    '  tests: is / isNot (exact text: yes, no, unknown, or an enum value), equals / greaterThan (a',
    '  number question), present: true|false (a text or list question has an answer). Combine with',
    '  { "all": [...] }, { "any": [...] }, { "not": {...} }.',
    '  implied rules read how someone left, so they always follow the recorded exit:',
    '    { "whenExit": "Dumped", "award": "dumped" }',
    '    { "whenExit": ["Finalist", "Winner"], "award": "reachedFinal" }',
    '  An event is awarded by research rules OR implied rules, never both.',
    '  Built-ins: for rules that look across people (who went home decides who voted with the majority).',
    '  Write { "builtIn": "<name>", ...params } (optionally with a "when"):',
    ...builtInLines(),
    '',
    'RULES FOR YOUR RESEARCH',
    '  - Name the pages you actually read in sources. Don\'t claim anything about a page you didn\'t open.',
    '  - Don\'t list a fact you haven\'t seen reported. No inference from how you think the show works.',
    '  - Flag uncertainty in the `why`/`where` text ("only from series 7 on") rather than sounding sure.',
    '',
    'Answer with ONE JSON object and nothing else, in this shape (the values describe what goes there):',
    '',
    JSON.stringify(PROPOSAL_SHAPE, null, 1),
    '',
    'Paste the JSON back into Reality Fantasy Leagues\' "Research a new show" box.',
  ];
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n').replace(/^\n+/, '');
}

// ---------- parsing ----------

/** A chat's answer -> a proposal object. Chatter and code fences around the JSON are fine. */
function parseProposal(answer) {
  const s = String(answer || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error("There's no JSON object in what was pasted.");
  let parsed;
  try {
    parsed = JSON.parse(s.slice(start, end + 1));
  } catch (e) {
    throw new Error(`The pasted JSON doesn't parse (${e.message}). Ask the chat to send it again as one JSON object.`);
  }
  if (!isObj(parsed)) throw new Error('The pasted JSON is not an object.');
  return parsed;
}

// ---------- the review ----------

const CORE_DESCRIPTIONS = (terms) => ({
  name: `The ${terms.castaway.toLowerCase()}'s full name, exactly as given in the list you were sent.`,
  leftTheGame: 'Did this person leave the game permanently in THIS episode?',
  exitMethod: 'How they left, if they left. Null if they did not leave.',
  sources: "URLs you actually read that support the answers above for THIS person. Empty only if every answer is 'unknown'.",
  confidence: 'high: a source states it plainly. medium: a source implies it. low: pieced together or a single weak source.',
});

function coreField(key, description) {
  const want = CORE_FIELDS[key];
  return { key, type: want.type, ...(want.nullable ? { nullable: true } : {}), ...(want.values ? { values: want.values } : {}), description };
}

// Every event id a rule awards (its own award, and a built-in's event params).
function awardsOf(rule) {
  if (!isObj(rule)) return [];
  const out = [];
  if (typeof rule.award === 'string') out.push(rule.award);
  const b = rule.builtIn && BUILT_INS[rule.builtIn];
  if (b) for (const [k, spec] of Object.entries(b.params)) if (spec.type === 'event' && typeof rule[k] === 'string' && k !== 'award') out.push(rule[k]);
  return out;
}

// Every answer a condition (or a built-in's field and condition params) reads.
function readsOf(rule) {
  const out = [];
  const walk = (c) => {
    if (!isObj(c)) return;
    if (typeof c.answer === 'string') out.push(c.answer);
    for (const k of ['all', 'any']) list(c[k]).forEach(walk);
    if (c.not) walk(c.not);
  };
  if (!isObj(rule)) return out;
  walk(rule.when);
  const b = rule.builtIn && BUILT_INS[rule.builtIn];
  if (b) {
    for (const [k, spec] of Object.entries(b.params)) {
      if (spec.type === 'field' && typeof rule[k] === 'string') out.push(rule[k]);
      if (spec.type === 'condition') walk(rule[k]);
    }
  }
  return out;
}

// Where a formatProblems message belongs on the review screen.
function locate(message, questionKeys) {
  let m = /^events\[([^\]]+)\]: (.*)$/.exec(message);
  if (m) return { at: `events[${m[1]}]`, message: m[2] };
  m = /^(rules\.(?:research|implied)\[\d+\]): (.*)$/.exec(message);
  if (m) return { at: m[1], message: m[2] };
  m = /^research\.checklist: (\w+): (.*)$/.exec(message);
  if (m && questionKeys.includes(m[1])) return { at: `questions[${m[1]}]`, message: m[2] };
  return { at: 'format', message };
}

/**
 * proposal -> { id, data, approvable, problems, warnings, repairs, categories, questions, exits,
 * notTrackable, flagged, domains, sources, seasonsChecked }.
 * `problems` block approval; `warnings` and `repairs` are for the admin to read. Each is { at, message },
 * `at` naming a row (`events[id]`, `questions[key]`, `exits[name]`, `rules.research[2]`) or `format`.
 */
function reviewProposal(proposal, { id } = {}) {
  const p = isObj(proposal) ? proposal : {};
  const problems = [];
  const warnings = [];
  const repairs = [];
  const notTrackable = list(p.notTrackable).filter(isObj).map((x) => ({ fact: text(x.fact), why: text(x.why) })).filter((x) => x.fact);

  // --- the show ---
  const show = isObj(p.show) ? p.show : {};
  const name = text(show.name);
  if (!name) problems.push({ at: 'format', message: "the show's name is missing" });
  const terms = { castaway: text(show.castawayTerm) || 'Contestant', tribe: text(show.tribeTerm) || 'Team' };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  terms.castaway = cap(terms.castaway);
  terms.tribe = cap(terms.tribe);
  const formatId = id || formatIdFor(name);

  // --- exit methods ---
  const exits = [];
  for (const x of list(p.exitMethods)) {
    const n = text(isObj(x) ? x.name : x);
    if (!n) continue;
    if (exits.some((e) => e.name.toLowerCase() === n.toLowerCase())) {
      repairs.push({ at: `exits[${n}]`, message: 'listed twice; kept the first' });
      continue;
    }
    let kind = isObj(x) ? text(x.kind).toLowerCase() : '';
    if (!EXIT_KINDS.includes(kind)) {
      if (kind) repairs.push({ at: `exits[${n}]`, message: `kind "${kind}" isn't out, finalist or winner; read as out` });
      kind = 'out';
    }
    exits.push({ name: n, kind, meaning: isObj(x) ? text(x.meaning) : '' });
  }
  if (!exits.some((e) => e.name === 'Other')) exits.push({ name: 'Other', kind: 'out', meaning: 'Any other way of leaving', added: true });
  const winners = exits.filter((e) => e.kind === 'winner');
  if (winners.length !== 1) problems.push({ at: 'format', message: `exactly one exit method must be the winner (found ${winners.length})` });

  // --- questions ---
  const questions = [];
  for (const [i, q] of list(p.questions).entries()) {
    if (!isObj(q)) continue;
    let key = text(q.key);
    const at = () => `questions[${key || i}]`;
    if (!ID.test(key)) {
      const fixed = camelId(key || q.question);
      if (fixed) repairs.push({ at: `questions[${fixed}]`, message: `key "${key}" isn't camelCase; renamed ${fixed}` });
      key = fixed;
    }
    if (!key) { problems.push({ at: at(), message: 'no key, and none could be made from the question' }); continue; }
    if (key in CORE_FIELDS || EPISODE_KEYS.includes(key)) {
      repairs.push({ at: at(), message: `${key} is asked on every format already; left out` });
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

  // --- rules (passed through; checked with everything else below) ---
  const rules = isObj(p.rules) ? p.rules : {};
  const research = list(rules.research);
  const implied = list(rules.implied);
  if (!Array.isArray(rules.research) || !Array.isArray(rules.implied)) problems.push({ at: 'format', message: 'rules must have a research list and an implied list' });
  const awardedBy = { research: new Set(research.flatMap(awardsOf)), implied: new Set(implied.flatMap(awardsOf)) };

  // --- events ---
  const events = [];
  for (const [i, e] of list(p.events).entries()) {
    if (!isObj(e)) continue;
    let eid = text(e.id);
    const at = () => `events[${eid || i}]`;
    if (!ID.test(eid)) {
      const fixed = camelId(eid || e.label);
      if (fixed) repairs.push({ at: `events[${fixed}]`, message: `id "${eid}" isn't camelCase; renamed ${fixed}` });
      eid = fixed;
    }
    if (!eid) { problems.push({ at: at(), message: 'no id, and none could be made from the label' }); continue; }
    if (events.some((x) => x.id === eid)) { repairs.push({ at: at(), message: 'id used twice; kept the first' }); continue; }
    const tier = TIERS.includes(text(e.tier).toUpperCase()) ? text(e.tier).toUpperCase() : null;
    if (tier === 'D') {
      notTrackable.push({ fact: text(e.label) || eid, why: text(e.why) || 'research rated it tier D' });
      repairs.push({ at: at(), message: 'tier D: moved to "not reliably trackable"' });
      continue;
    }
    const points = typeof e.points === 'string' && e.points.trim() !== '' ? Number(e.points) : e.points;
    const row = {
      id: eid, label: text(e.label), category: text(e.category) || 'Other', points, tier, why: text(e.why), headline: e.headline === true,
      implied: awardedBy.implied.has(eid), problems: [],
    };
    if (!Number.isFinite(points)) row.problems.push('points must be a number');
    if (!row.label) row.problems.push('the label is missing');
    if (!tier) row.problems.push('no tier (A, B or C)');
    if (awardedBy.research.has(eid) && awardedBy.implied.has(eid)) row.problems.push('awarded by both a research rule and an exit rule; pick one');
    if (tier === 'C') warnings.push({ at: at(), message: 'tier C: reported often but not always' });
    events.push(row);
  }

  // --- the data half ---
  const desc = CORE_DESCRIPTIONS(terms);
  const usableQuestions = questions.filter((q) => !q.problems.length);
  const usableEvents = events.filter((e) => !e.problems.length);
  const categories = [];
  for (const e of usableEvents) {
    let c = categories.find((x) => x.label === e.category);
    if (!c) {
      c = { id: camelId(e.category) || `group${categories.length + 1}`, label: e.category, events: [] };
      while (categories.some((x) => x.id === c.id)) c.id += '2';
      categories.push(c);
    }
    c.events.push(e.id);
  }
  const answerKeys = usableQuestions.filter((q) => q.type === 'answer').map((q) => q.key);
  const notes = usableQuestions.map((q) => q.note).filter(Boolean);
  const data = {
    id: formatId,
    name: name || formatId,
    exitMethods: exits.map((e) => e.name),
    terms,
    winnerExitMethod: winners.length === 1 ? winners[0].name : (exits[0] && exits[0].name) || 'Winner',
    endgameExitMethods: exits.filter((e) => e.kind !== 'out').map((e) => e.name),
    events: usableEvents.map((e) => ({ id: e.id, label: e.label, defaultPoints: e.points, ...(e.implied ? { implied: true } : {}) })),
    eventCategories: categories,
    recap: usableEvents.filter((e) => e.headline && !e.implied).map((e) => ({ label: e.label, events: [e.id] })),
    hasMerge: show.hasMerge === true,
    hasGroups: show.hasGroups === true,
    wiki: {
      version: 1,
      voteSections: [],
      guideSections: [],
      missingVotesNote: 'no vote/elimination table found -- eliminations will be missing',
      missingGuideNote: 'no episode guide found -- eliminations will be missing',
      eventTypes: [],
      routineEliminations: 1,
    },
    research: {
      checklist: [
        coreField('name', desc.name),
        coreField('leftTheGame', desc.leftTheGame),
        coreField('exitMethod', desc.exitMethod),
        ...usableQuestions.map((q) => ({
          key: q.key,
          type: q.type,
          // yes/no/unknown already has its "don't know"; everything else can be null.
          ...(q.type === 'answer' ? {} : { nullable: true }),
          ...(q.type === 'enum' ? { values: q.values } : {}),
          description: q.question,
          ...(q.note ? { note: q.note } : {}),
        })),
        coreField('sources', desc.sources),
        coreField('confidence', desc.confidence),
      ],
      episodeFields: [],
      searchHint: [
        `Search for this episode's recaps${notes.length ? ` and any reporting on who was ${notes.slice(0, 6).join(', ')}` : ''}.`,
        'Then answer the checklist for every person above.',
      ],
      claims: ['leftTheGame', ...answerKeys],
    },
    rules: { research, implied },
  };

  // --- every reference, checked once, attributed to its row ---
  const questionKeys = questions.map((q) => q.key);
  for (const m of formatProblems(data)) problems.push(locate(m, questionKeys));
  for (const q of questions) for (const m of q.problems) problems.push({ at: `questions[${q.key}]`, message: m });
  for (const e of events) for (const m of e.problems) problems.push({ at: `events[${e.id}]`, message: m });

  // --- what it means for the screen ---
  const sentence = (r) => describeRule(r, data);
  const rulesFor = (eid) => [
    ...research.map((r, i) => ({ r, at: `rules.research[${i}]` })),
    ...implied.map((r, i) => ({ r, at: `rules.implied[${i}]` })),
  ].filter(({ r }) => awardsOf(r).includes(eid)).map(({ r, at }) => ({ at, sentence: sentence(r) }));
  const reads = new Set([...research, ...implied].flatMap(readsOf));
  for (const e of events) if (!rulesFor(e.id).length) warnings.push({ at: `events[${e.id}]`, message: 'no rule awards it: it can only be added by hand' });
  for (const q of questions) if (!reads.has(q.key)) warnings.push({ at: `questions[${q.key}]`, message: 'no rule reads it: asked every episode, never scored' });
  for (const x of exits) {
    if (x.name === 'Other') continue;
    const scored = implied.some((r) => isObj(r) && (Array.isArray(r.whenExit) ? r.whenExit : [r.whenExit]).includes(x.name));
    if (!scored) warnings.push({ at: `exits[${x.name}]`, message: 'leaving this way scores nothing' });
  }
  const at = (prefix) => (x) => x.at === prefix;
  const groups = [];
  for (const e of events) {
    let g = groups.find((x) => x.label === e.category);
    if (!g) groups.push((g = { label: e.category, events: [] }));
    g.events.push({
      ...e,
      rules: rulesFor(e.id),
      problems: problems.filter(at(`events[${e.id}]`)).map((x) => x.message),
      warnings: warnings.filter(at(`events[${e.id}]`)).map((x) => x.message),
    });
  }
  const domains = list(p.domains).filter(isObj).map((d) => {
    const domain = text(d.domain).toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split('/')[0];
    return { domain, why: text(d.why), preChecked: KNOWN_GOOD_DOMAINS.some((k) => domain === k || domain.endsWith(`.${k}`)) };
  }).filter((d) => d.domain.includes('.'));

  return {
    id: formatId,
    data,
    approvable: problems.length === 0,
    problems,
    warnings,
    repairs,
    exits: exits.map((x) => ({ ...x, warnings: warnings.filter(at(`exits[${x.name}]`)).map((w) => w.message) })),
    questions: questions.map((q) => ({
      ...q,
      problems: problems.filter(at(`questions[${q.key}]`)).map((x) => x.message),
      warnings: warnings.filter(at(`questions[${q.key}]`)).map((x) => x.message),
    })),
    categories: groups,
    // Rules no event row shows (a stage, or one whose award isn't an event), so none goes unseen.
    otherRules: [...research.map((r, i) => ({ r, at: `rules.research[${i}]` })), ...implied.map((r, i) => ({ r, at: `rules.implied[${i}]` }))]
      .filter(({ r }) => !awardsOf(r).some((a) => events.some((e) => e.id === a)))
      .map(({ r, at: where }) => ({ at: where, sentence: sentence(r), problems: problems.filter(at(where)).map((x) => x.message) })),
    notTrackable,
    flagged: list(p.flagged).filter(isObj).map((f) => ({ name: text(f.name), what: text(f.what), whyCode: text(f.whyCode), findings: text(f.findings) })).filter((f) => f.name),
    domains,
    sources: list(p.sources).map(text).filter(Boolean),
    seasonsChecked: list(p.seasonsChecked).map(text).filter(Boolean),
  };
}

module.exports = { PROPOSAL_SHAPE, buildProposalPrompt, parseProposal, reviewProposal, formatIdFor, camelId };
