// Research a show's rulebook (docs/PLAN-rulebooks-implementation.md 4.9): the prompt a chat (ChatGPT, through
// "Ask ChatGPT for me" or a paste) answers with a rulebook's blocks, the parser for its answer, and the review
// that turns the answer into blocks with every problem located on its row.
//
//   buildRulebookPrompt({ show, season?, airing?, template? }) -> the prompt
//   parseRulebookAnswer(text) -> the JSON object in the answer (chatter and code fences around it are fine)
//   reviewRulebook(answer, { castNames? }) -> { blocks, phaseStarts, problems, warnings, leftOut, approvable }
//
// The prompt is generated from the schema (rulebook-schema.js): every field, its allowed values and each
// value's help, in full. Three rules keep answers usable: only listed values; the show's own names;
// "leftOut" instead of forcing a fit. The review never drops a row: an answer with a bad value keeps it, with
// its problem, so a person can fix it. What it can tidy without changing meaning it does, and says so in
// `warnings`: missing ids made from names, references given by name instead of id.
//
// Plain CommonJS, browser-safe, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { OPT, KINDS, SCHEMA_VERSION, TWIST_FIELDS, blocksProblems, camelId } = require('./rulebook-schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const ID = /^[a-z][A-Za-z0-9]*$/;

// ---------- the prompt ----------

// "one of: a | b | c", then each value with its label and help, indented.
function choices(key, { many = false, skip = [] } = {}) {
  const opts = OPT[key].filter((o) => !skip.includes(o[0]));
  const head = `${many ? 'any of' : 'one of'}: ${opts.map((o) => o[0]).join(' | ')}`;
  const lines = opts.map(([v, label, help]) => `      ${v}: ${label}${help ? `. ${help}` : ''}`);
  return [head, ...lines].join('\n');
}

const KIND_LINES = () =>
  Object.entries(KINDS)
    .map(([k, K]) => `      ${k}: ${K.name}. ${K.blurb} Like ${K.like}.${k === 'talk' ? ' Has no ways out and no twists.' : k === 'sport' ? ' Has no twists.' : ''}`)
    .join('\n');

function buildRulebookPrompt({ show, season, airing = false, template } = {}) {
  const what = [show, season].filter(Boolean).join(', ');
  const parts = [];
  parts.push(
    `Describe how ${what || 'this TV show'} works, as a rulebook for a fantasy game people play along with at home. Search the web: the show's wiki, its network's pages, recaps. Then answer with ONE JSON object in the shape below. Nothing after the JSON.`,
    '',
    'Four rules:',
    '1. No names and no results, anywhere. People read this before they\'ve watched: never name anyone in the cast, and never say what happened in a particular episode (who won, who left, who found what, when the merge came). Describe how the show works, not what happened in it.',
    '2. Only the listed values, wherever a field says "one of" or "any of". If none fits, choose the closest and say what didn\'t fit in "leftOut".',
    '3. The show\'s own names for its segments, ways out, twists and moments ("Tribal Council", "Pit Stop", "Weekend Update").',
    '4. Anything the choices can\'t describe goes in "leftOut", one sentence each, with no names or results either. Don\'t force it in.',
    '',
    'Describe the game as it is played, not one season\'s story:',
    '- "segments" are the regular parts of a typical episode. A one-time event (a special vote, a mutiny, the opening day) isn\'t a segment: mention it in a phase\'s summary or in "leftOut". A tie, a revote or a tiebreaker is part of its segment, not one of its own.',
    '- The vote or decision that crowns the winner is "season.finale", not a segment. A final duel that only happens near the end (a fire-making challenge, a final race) is a segment with "often": "onePhase" and "phase": "finale".',
    '- For a talk, variety or awards show: the moments are what might or might not happen tonight, so people can call them (someone breaks character, a surprise cameo, the host sings, a winner cries), never what happens every show (the monologue airs). They\'re answered by "league".',
    '- For a scripted series: the moments are what happens to the characters that anyone watching could say yes or no to (in the episode, at the centre of the story, a big reveal about them, in danger and survives, a romance starts or ends), and the comings and goings are written out, killed off and new characters. "segments" are the regular parts of the episode\'s structure (a cold open, the ending), not its themes.',
    '- For a sport or live event: "segments" are the parts of one event that decide something (qualifying, the race; for a team sport, the game itself), never each inning, quarter or lap. What competitors do in it (a home run, a goal, a fastest lap, places gained) are "customMoments", counted "eachTime" or "perUnit". "waysOut" are only withdrawals (injured, ejected, did not finish); winning or losing an event is its segment\'s result, and winning the title is the finale.',
    '- "twists" are things that recur or last, and each is one of the four types. Similar advantages that score alike are one twist ("Idols and advantages"), with their kinds listed in its summary. Anything else goes in "leftOut".',
    '- "waysOut" lists every way someone can leave or finish on this show, even if nobody has left that way yet this season. Each segment that sends someone home causes a way out of its own ("Lost fire-making", cause: that segment). "outForOne" is only for a sport or live event, where someone misses one race and is back for the next; a reprieve (a non-elimination leg) isn\'t a way out.',
    '- A phase "starts" at an "episode" only when the show fixes it in advance (a finale week, a scheduled playoff). A swap or a merge that comes when the show decides is "remaining" or "announced". When a season has already reached a phase, say the episode in "phaseStarts" (outside the blocks), never in a phase\'s summary.',
    '- Every answer builds its own moments, so "customMoments" must not repeat them: a segment decided by the result builds "Won the <segment>" (and 2nd and 3rd for the top three, best and worst, first and last), its group\'s win when groups take part, and what\'s on the line (an advantage, a shared reward, being put at risk); a vote by the cast builds zero votes, received votes and survived, voted with and against the majority; a pick builds picked, picked first and not picked; each way out scores on its own; a jury finale builds each jury vote; each twist builds got, played and one moment per thing it does. "customMoments" are for everything else.',
    ''
  );
  if (airing) {
    parts.push(
      'This season is still airing. Describe the game as the show has set it up and as it has aired so far. Never guess what hasn\'t happened: a phase that hasn\'t started keeps its usual condition ("remaining" or "announced"), and leave out anything not yet shown or announced.',
      ''
    );
  }
  parts.push(
    'A rulebook says what the show is and what can happen in it. It never says what the game\'s players draft or pick: the game decides that. Every "id" is camelCase, made once from the name ("Tribal Council" -> "tribalCouncil"), and unique across the whole rulebook. Where a field refers to another item, use that item\'s id.',
    '',
    'The shape:',
    '{',
    '  "schema": 1,',
    '  "kind": ' + choices('kind').split('\n')[0],
    KIND_LINES(),
    '  "start": only for a series, ' + choices('start'),
    '  "show": "the show\'s name",',
    '  "tagline": "a few words on what it is, like \'Castaways voted out one by one\'",',
    '  "premise": "two or three sentences a new viewer would understand: who\'s in it, what happens each episode, how it ends",',
    '  "parts": only if the show isn\'t made of episodes: { "singular": "race", "plural": "races" }. Add "label" for the heading of what happens in each one, if the show has its own ("Each leg", "Each race weekend").',
    '  "cast": {',
    '    "unit": ' + choices('unit'),
    '    "singular": "what one of them is called (castaway, houseguest, driver)",',
    '    "plural": "what more than one are called",',
    '    "usualSize": how many there usually are, a whole number,',
    '    "groups": null when they aren\'t split into groups, else {',
    '      "type": ' + choices('groupType', { skip: ['none'] }),
    '      "singular": "what one group is called (tribe, team, house)",',
    '      "change": ' + choices('groupChange'),
    '    }',
    '  },',
    '  "season": {',
    '    "phases": [ each stretch of the season that plays differently, in order (at least one): {',
    '      "id", "name",',
    '      "starts": { "type": ' + choices('startType'),
    '                  "n": the episode for "episode", how many are left for "remaining"; leave it out for "announced" },',
    '      "changes": ' + choices('changes', { many: true }),
    '      "summary": "one sentence on how it plays"',
    '    } ],',
    '    "finale": null when the show has no finale or winner, else {',
    '      "decidedBy": ' + choices('finale'),
    '      "finalists": how many reach it, a whole number (leave out if it varies),',
    '      "summary": "one sentence on how it ends"',
    '    }',
    '  },',
    '  "segments": [ the regular parts of an episode, in broadcast order: {',
    '    "id", "name", "summary": "one sentence on what happens in it",',
    '    "decidedBy": ' + choices('decidedBy'),
    '    "voters": only when decidedBy is vote, ' + choices('voters'),
    '    "pickers": only when decidedBy is pick, ' + choices('pickers'),
    '    "takesPart": not when decidedBy is nobody, ' + choices('takesPart'),
    '    "decides": only when decidedBy is result, judges or headToHead, ' + choices('decides'),
    '    "onTheLine": ' + choices('onTheLine'),
    '    "often": ' + choices('often'),
    '    "phase": only when often is onePhase: a phase id, or "finale"',
    '  } ],',
    '  "waysOut": [ how people leave the game or finish it (none for a talk show): {',
    '    "id", "name",',
    '    "means": ' + choices('means'),
    '    "cause": optional: { "segment": "<a segment id>" } when a segment causes it, else ' + choices('cause'),
    '  } ],',
    '  "twists": [ optional, none for a talk show or a sport: {',
    '    "id", "name", "summary": "one sentence",',
    '    "type": ' + choices('twistType'),
    '    for secretRole: "roles": ["the secret role first", "the other"], "revealed": ' + choices('revealed') + ',',
    '      "canSwitch": ' + choices('canSwitch'),
    '    for advantage: "oneIsCalled": "an idol", "gotBy": ' + choices('gotBy') + ', "wonAt": a segment id when gotBy is wonAt,',
    '      "does": ' + choices('does', { many: true }) + ',',
    '      "lasts": ' + choices('lasts'),
    '    for comeback: "who": ' + choices('comebackWho') + ', "how": ' + choices('comebackHow'),
    '    for sideTrip: "oneIsCalled": "a journey", "who": ' + choices('tripWho') + ', "canGet": ' + choices('canGet', { many: true }),
    '  } ],',
    '  "customMoments": [ things that can happen and are worth scoring that the segments, ways out and twists don\'t already cover. Written the way a recap would say it ("Got in a fight"). Only what recaps report as yes or no, a count or an amount, never a judgement call ("funniest moment"): {',
    '    "id", "label",',
    '    "during": optional: { "segment": "<id>" } or { "twist": "<id>" } when it only happens there,',
    '    "counted": ' + choices('counted'),
    '    "answeredBy": ' + choices('answeredBy'),
    '    "reliability": how reliably recaps report it, ' + choices('reliability'),
    '  } ],',
    '  "points": optional: { "<a custom moment\'s id>": suggested points, a number (negative for bad things) },',
    '  "leftOut": ["anything that didn\'t fit the choices above, one sentence each, no names or results"],',
    '  "phaseStarts": only for a season already under way: { "<phase id>": the episode it started in }, for the phases it has reached',
    '}'
  );
  if (template && isObj(template)) {
    parts.push(
      '',
      'Start from this rulebook of a similar show and correct it to fit, rather than starting over. Keep what matches; change, add or remove the rest:',
      JSON.stringify(template, null, 1)
    );
  }
  return parts.join('\n');
}

// ---------- the answer ----------

/**
 * Every top-level JSON object in a chat's answer, in order, as text: braces counted outside strings. A chat
 * sometimes sends a draft and then a corrected copy back to back.
 */
function jsonObjectsIn(text) {
  const s = String(text || '');
  const out = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      if (depth > 0) inString = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}' && depth > 0) {
      depth--;
      if (depth === 0) out.push(s.slice(start, i + 1));
    }
  }
  return out;
}

/**
 * A chat's answer -> the JSON object in it. Chatter and code fences around it are fine; of several objects, the
 * last one that parses (the chat's own correction) wins.
 */
function parseRulebookAnswer(answer) {
  const s = String(answer || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error("There's no JSON object in the answer.");
  let parsed;
  try {
    parsed = JSON.parse(s.slice(start, end + 1));
  } catch (e) {
    for (const candidate of jsonObjectsIn(s).reverse()) {
      try {
        parsed = JSON.parse(candidate);
        break;
      } catch {
        // an earlier one, then
      }
    }
    if (parsed === undefined) throw new Error(`The answer's JSON doesn't parse (${e.message}). Ask the chat to send it again as one JSON object.`);
  }
  if (!isObj(parsed)) throw new Error("The answer's JSON is not an object.");
  return parsed;
}

/**
 * An answer -> blocks to review. Tidies what it can without changing meaning (and says so in `warnings`):
 * the schema number, missing or non-camelCase ids (made from names, kept unique), references given by a name
 * instead of an id, groups given as "none". Every row is kept, problems and all.
 */
function reviewRulebook(answer, { castNames = [] } = {}) {
  const blocks = JSON.parse(JSON.stringify(isObj(answer) ? answer : {}));
  const warnings = [];
  if (blocks.schema !== SCHEMA_VERSION) {
    if (blocks.schema !== undefined) warnings.push({ at: 'schema', message: `Read as schema ${SCHEMA_VERSION}` });
    blocks.schema = SCHEMA_VERSION;
  }
  if (isObj(blocks.cast) && isObj(blocks.cast.groups) && (blocks.cast.groups.type === 'none' || blocks.cast.groups.type == null)) {
    blocks.cast.groups = null;
    warnings.push({ at: 'cast.groups', message: 'No groups' });
  }

  // Ids, made from names where missing or not camelCase, and unique across the rulebook.
  const used = new Set();
  const byName = { segments: new Map(), phases: new Map(), twists: new Map() };
  const fix = (item, at, nameField, kind) => {
    if (!isObj(item)) return;
    const name = item[nameField];
    let id = typeof item.id === 'string' && ID.test(item.id) ? item.id : camelId(item.id || name || '');
    if (!id) return;
    const base = id;
    for (let i = 2; used.has(id); i++) id = `${base}${i}`;
    if (id !== item.id) warnings.push({ at, message: `${name || 'An item'} gets the id "${id}"` });
    item.id = id;
    used.add(id);
    if (kind && typeof name === 'string') {
      byName[kind].set(name.trim().toLowerCase(), id);
      byName[kind].set(String(id).toLowerCase(), id);
    }
  };
  const phases = isObj(blocks.season) ? list(blocks.season.phases) : [];
  phases.forEach((p, i) => fix(p, `season.phases[${i}]`, 'name', 'phases'));
  list(blocks.segments).forEach((s, i) => fix(s, `segments[${i}]`, 'name', 'segments'));
  list(blocks.waysOut).forEach((w, i) => fix(w, `waysOut[${i}]`, 'name'));
  list(blocks.twists).forEach((t, i) => fix(t, `twists[${i}]`, 'name', 'twists'));
  list(blocks.customMoments).forEach((m, i) => fix(m, `customMoments[${i}]`, 'label'));

  // References by name ("Tribal Council") instead of id.
  const resolve = (kind, v) => (typeof v === 'string' ? byName[kind].get(v.trim().toLowerCase()) : undefined);
  const segValues = new Set(byName.segments.values());
  for (const w of list(blocks.waysOut)) {
    if (!isObj(w)) continue;
    if (typeof w.cause === 'string' && !OPT.cause.some((o) => o[0] === w.cause) && resolve('segments', w.cause)) {
      w.cause = { segment: resolve('segments', w.cause) };
      warnings.push({ at: `waysOut[${w.id}].cause`, message: `${w.name}: caused by ${w.cause.segment}` });
    } else if (isObj(w.cause) && typeof w.cause.segment === 'string' && !segValues.has(w.cause.segment) && resolve('segments', w.cause.segment)) {
      w.cause.segment = resolve('segments', w.cause.segment);
    }
  }
  for (const s of list(blocks.segments)) {
    if (isObj(s) && typeof s.phase === 'string' && s.phase !== 'finale' && !new Set(byName.phases.values()).has(s.phase) && resolve('phases', s.phase)) s.phase = resolve('phases', s.phase);
  }
  for (const t of list(blocks.twists)) {
    if (isObj(t) && typeof t.wonAt === 'string' && !segValues.has(t.wonAt) && resolve('segments', t.wonAt)) t.wonAt = resolve('segments', t.wonAt);
    // A list answer given as one value.
    for (const [field, key] of Object.entries(TWIST_FIELDS[t && t.type] || {})) {
      if (Array.isArray(key) && typeof t[field] === 'string') t[field] = [t[field]];
    }
  }
  for (const m of list(blocks.customMoments)) {
    if (!isObj(m) || !isObj(m.during)) continue;
    if (typeof m.during.segment === 'string' && !segValues.has(m.during.segment) && resolve('segments', m.during.segment)) m.during.segment = resolve('segments', m.during.segment);
    if (typeof m.during.twist === 'string' && !new Set(byName.twists.values()).has(m.during.twist) && resolve('twists', m.during.twist)) m.during.twist = resolve('twists', m.during.twist);
  }
  for (const p of phases) if (isObj(p) && typeof p.changes === 'string') p.changes = [p.changes];
  // "When this many are left" with no number is "when the show says so"; the first phase starts at the premiere.
  for (const p of phases) {
    if (isObj(p) && isObj(p.starts) && p.starts.type === 'remaining' && !(Number.isInteger(p.starts.n) && p.starts.n >= 1)) {
      p.starts = { type: 'announced' };
      warnings.push({ at: `season.phases[${p.id}].starts`, message: `${p.name}: when the show says so (no number for how many are left)` });
    }
  }
  if (isObj(phases[0]) && !(isObj(phases[0].starts) && phases[0].starts.type === 'episode' && phases[0].starts.n === 1)) {
    phases[0].starts = { type: 'episode', n: 1 };
    warnings.push({ at: `season.phases[${phases[0].id}].starts`, message: `${phases[0].name}: from the first episode` });
  }

  // When phases actually started is the season's, not the rulebook's: it comes back beside the blocks, for a
  // person to confirm (How it works shows each one only to someone who has seen it).
  const phaseStarts = {};
  if (isObj(blocks.phaseStarts)) {
    const phaseIds = new Set(byName.phases.values());
    for (const [k, v] of Object.entries(blocks.phaseStarts)) {
      const id = phaseIds.has(k) ? k : resolve('phases', k);
      if (id && Number.isInteger(v) && v >= 1) phaseStarts[id] = v;
      else warnings.push({ at: `phaseStarts.${k}`, message: `Left out: "${k}" isn't a phase, or ${JSON.stringify(v)} isn't an episode` });
    }
  }
  delete blocks.phaseStarts;
  // A phase the answer says started at a given episode came when the show decided, whatever its type says: in
  // the rulebook it's "when the show says so", so How it works never gives its episode away early.
  for (const p of phases) {
    if (isObj(p) && phaseStarts[p.id] && isObj(p.starts) && p.starts.type === 'episode' && p.starts.n > 1) {
      p.starts = { type: 'announced' };
      warnings.push({ at: `season.phases[${p.id}].starts`, message: `${p.name}: when the show says so (it started in episode ${phaseStarts[p.id]}: season data)` });
    }
  }

  const segs = list(blocks.segments);
  // Answers that don't go with who decides a segment are left out ("who takes part" in something nobody decides).
  const FIELDS_FOR = { voters: ['vote'], pickers: ['pick'], decides: ['result', 'judges', 'headToHead'], takesPart: ['result', 'judges', 'vote', 'pick', 'headToHead'] };
  for (const s of segs) {
    if (!isObj(s) || !OPT.decidedBy.some((o) => o[0] === s.decidedBy)) continue;
    for (const [field, ok] of Object.entries(FIELDS_FOR)) {
      if (s[field] !== undefined && !ok.includes(s.decidedBy)) {
        delete s[field];
        warnings.push({ at: `segments[${s.id}].${field}`, message: `${s.name}: left out ${field}, which doesn't go with ${s.decidedBy}` });
      }
    }
  }
  // The jury vote that crowns the winner is the finale; as a segment it would build bottom-and-saved moments.
  const finale = isObj(blocks.season) && isObj(blocks.season.finale) ? blocks.season.finale : null;
  if (finale && finale.decidedBy === 'juryVote') {
    const jury = segs.filter((s) => isObj(s) && s.decidedBy === 'vote' && s.voters === 'jury' && s.phase === 'finale');
    for (const s of jury) warnings.push({ at: `segments[${s.id}]`, message: `${s.name}: left out, the finale's jury vote` });
    if (jury.length) {
      const gone = new Set(jury.map((s) => s.id));
      blocks.segments = segs.filter((s) => !jury.includes(s));
      // What happens during it still happens: in the finale, not in one segment.
      for (const m of list(blocks.customMoments)) if (isObj(m) && isObj(m.during) && gone.has(m.during.segment)) delete m.during;
    }
  }

  const problems = blocksProblems(blocks);
  problems.push(...spoilers(blocks, castNames, warnings));
  // A moment added by hand that a built one already is would score twice: left out.
  const repeats = repeatedMoments(blocks);
  if (repeats.length) {
    const gone = new Set(repeats.map((r) => r.id));
    blocks.customMoments = list(blocks.customMoments).filter((m) => !(isObj(m) && gone.has(m.id)));
    if (isObj(blocks.points)) for (const id of gone) delete blocks.points[id];
    warnings.push(...repeats.map(({ at, message }) => ({ at, message })));
  }
  // A segment that sends someone home should have the way out it causes.
  for (const s of list(blocks.segments)) {
    if (!isObj(s) || s.onTheLine !== 'goingHome') continue;
    if (!list(blocks.waysOut).some((w) => isObj(w) && isObj(w.cause) && w.cause.segment === s.id)) {
      warnings.push({ at: `segments[${s.id}]`, message: `${s.name} sends someone home, but no way out says it's the cause` });
    }
  }
  const leftOut = list(blocks.leftOut).filter((x) => typeof x === 'string');
  return { blocks, phaseStarts, problems, warnings, leftOut, approvable: problems.length === 0 };
}

// Every sentence a rulebook shows people, with where it is.
function textsOf(blocks) {
  const out = [];
  const add = (at, v) => typeof v === 'string' && v.trim() && out.push({ at, text: v });
  for (const f of ['show', 'tagline', 'premise']) add(f, blocks[f]);
  const season = isObj(blocks.season) ? blocks.season : {};
  list(season.phases).forEach((p) => isObj(p) && (add(`season.phases[${p.id}].name`, p.name), add(`season.phases[${p.id}].summary`, p.summary)));
  if (isObj(season.finale)) add('season.finale.summary', season.finale.summary);
  for (const key of ['segments', 'waysOut', 'twists']) {
    list(blocks[key]).forEach((x) => isObj(x) && (add(`${key}[${x.id}].name`, x.name), add(`${key}[${x.id}].summary`, x.summary)));
  }
  list(blocks.customMoments).forEach((m) => isObj(m) && (add(`customMoments[${m.id}].label`, m.label), add(`customMoments[${m.id}].question`, m.question)));
  list(blocks.leftOut).forEach((x, i) => add(`leftOut[${i}]`, x));
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A rulebook is read before anyone's watched, so it can't carry results. Any cast member's name is a problem
 * (with `castNames`, the season's cast: a full name, or a surname of four letters or more); a sentence about a
 * particular episode ("in Episode 5", "the premiere") is a warning, since it often is one.
 */
function spoilers(blocks, castNames, warnings) {
  const problems = [];
  const names = [];
  for (const full of list(castNames)) {
    if (typeof full !== 'string' || !full.trim()) continue;
    names.push(full.trim());
    const last = full.trim().split(/\s+/).slice(1).join(' ');
    if (last.length >= 4) names.push(last);
  }
  const res = names.map((n) => ({ n, re: new RegExp(`(^|[^\\p{L}])${escapeRe(n)}($|[^\\p{L}])`, 'iu') }));
  for (const { at, text } of textsOf(blocks)) {
    const hit = res.find((r) => r.re.test(text));
    if (hit) problems.push({ at, message: `Names ${hit.n}: a rulebook can't say what happened to anyone` });
    else if (/\b(episode|ep\.?|week)\s+\d+\b|\bthe premiere\b/i.test(text) && !/^season\.phases\[[^\]]+\]\.name$/.test(at)) {
      warnings.push({ at, message: 'Says what happened in an episode? A rulebook only says how the show works' });
    }
  }
  return problems;
}

// "Won a reward challenge" -> { won, reward, challenge }: the words that matter, to tell a repeat.
const STOP = new Set(['a', 'an', 'the', 'was', 'were', 'is', 'got', 'each', 'their', 'at', 'in', 'of', 'by', 'for', 'to']);
const wordsOf = (s) =>
  new Set(
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w && !STOP.has(w))
      .map((w) => w.replace(/s$/, ''))
  );
// One says all the other does ("Received a jury vote" and "Each jury vote received"), in two words or more.
const repeats = (a, b) => a.size >= 2 && b.size >= 2 && ([...a].every((w) => b.has(w)) || [...b].every((w) => a.has(w)));

/** A moment added by hand that says what a built one already does. */
function repeatedMoments(blocks) {
  let built;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js
    built = require('./rulebook-moments.js').momentsFor(blocks).filter((m) => !m.custom);
  } catch {
    return [];
  }
  const out = [];
  for (const m of list(blocks.customMoments)) {
    if (!isObj(m)) continue;
    const w = wordsOf(m.label);
    const same = built.find((b) => repeats(w, wordsOf(b.label)));
    if (same) out.push({ id: m.id, at: `customMoments[${m.id}]`, message: `${m.label}: left out, already built as "${same.label}"` });
  }
  return out;
}

module.exports = { buildRulebookPrompt, parseRulebookAnswer, reviewRulebook, jsonObjectsIn };
