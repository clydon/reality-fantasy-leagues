// What scores (docs/PLAN-rulebook-research.md): research looks at a rulebook's moments, the things that can happen and
// score (rulebook-moments.js momentsFor), and answers two things about them: what the show has that none of them
// cover, and what each one is worth. The worth isn't the AI's to invent: it's a ladder of rungs, each with a test and a
// fixed number of points, and the AI only says which rung a moment stands on. So the same moment lands on the same
// rung this time and next time, and the numbers obey the league's three wants by construction:
//
//   strong players stand out   the week's biggest win (wonAlone, 4) beats any two small edges (1 + 1), so whoever won
//                              the week is the week's top earner
//   a bad week hurts, never    the worst anyone can lose in one week (ownFault, -3, plus a slip) is under one
//   sinks a team               wonAlone, and whoever leaves earns nothing more: one bad week is at most one good week undone
//   totals differ              what most of the field gets each week (along, edge) is 0.5 or 1; what one or two people
//                              get (earned and up) is 2 or more, so weekly totals spread instead of bunching
//
//   buildScoresPrompt({ show, season, airing, aired, episodeCount, through, blocks })   the question (`through`: only that far)
//   parseScoresAnswer(text)                                                     the JSON object in a chat's answer
//   reviewScores(answer, blocks, { castNames })                                 what it would change, as blocks and rows
//   pickScores(blocks, review, declined)                                        the changes picked, as blocks
//
// Plain CommonJS, browser-safe, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { OPT, SCHEMA_VERSION, blocksProblems, camelId, partWord } = require('./rulebook-schema.js');
const { momentsFor } = require('./rulebook-moments.js');
const { parseRulebookAnswer } = require('./rulebook-research.js');
const { diffBlocks, opLines } = require('./rulebook-patch.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const list = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const ID = /^[a-z][A-Za-z0-9]*$/;

/** The ladder, top rung first. A moment stands on one rung; its points are the rung's. */
const LADDER = [
  { id: 'wonSeason', points: 6, test: "Won the whole season. The finale's winner, nobody else." },
  { id: 'wonAlone', points: 4, test: "Won the week's biggest contest on their own, or won a head-to-head that sent the loser home (an elimination)." },
  { id: 'bigPlay', points: 3, test: 'One or two people changed who went home or who was safe: played an advantage that cancelled votes, won a way back in, caught out a secret role, reached the final.' },
  { id: 'earned', points: 2, test: "Earned something most people there didn't: found or won an advantage, won a reward alone, won as one of a small team, picked first, survived being the target." },
  { id: 'edge', points: 1, test: 'A small edge on the field: came 2nd, won as one of a large group, shared a reward, no votes against them, votes against them survived, a jury vote.' },
  { id: 'along', points: 0.5, test: 'Happened to most people who were there: voted with the majority, took part, was picked, came 3rd.' },
  { id: 'nothing', points: 0, test: "Says nothing about how well they play (medically removed, arrived partway through), or can't happen on this show." },
  { id: 'slip', points: -0.5, test: 'A small slip: sat out, voted against the majority, put at risk, picked last.' },
  { id: 'lost', points: -1, test: 'Lost to someone and stayed in: lost a head-to-head, finished last, had an advantage used against them, went home holding one, a finalist with no jury votes.' },
  { id: 'out', points: -2, test: 'Left the game by losing: voted out, lost the elimination, last across the line. The usual way out.' },
  { id: 'ownFault', points: -3, test: 'Left by their own doing: quit, disqualified, removed for conduct.' },
];
/** A moment counted per amount (each point, each $1,000) isn't on the ladder: it's scored per unit, a small number. */
const PER_UNIT = { id: 'perUnit', min: 0.01, max: 2 };
const rungOf = (id) => LADDER.find((r) => r.id === id) || null;

// ---------- the question ----------

const pointsNow = (v) => (isObj(v) ? v.exclusive : v);
const pointsWord = (v) => (isObj(v) ? `${v.exclusive} (${v.shared} when shared)` : String(v));

/** Where a moment comes from, in words: "the Daily challenge", "a way out", "the finale", "added by hand". */
function fromWord(m, blocks) {
  const seg = m.from.segment ? list(blocks.segments).find((s) => s.id === m.from.segment) : null;
  const twist = m.from.twist ? list(blocks.twists).find((t) => t.id === m.from.twist) : null;
  if (m.custom) return `added by hand${seg ? `, during ${seg.name}` : twist ? `, during ${twist.name}` : ''}`;
  if (seg) return seg.name;
  if (twist) return twist.name;
  if (m.from.wayOut) return 'a way out';
  if (m.from.finale) return 'the finale';
  return 'the rulebook';
}

const choices = (key) => OPT[key].map(([v, label, help]) => `"${v}" (${label}${help ? `: ${help}` : ''})`).join(', ');

/**
 * The What scores question: the show, how it's played, every moment with where it comes from and what it's worth now,
 * the ladder, then the shape of the answer. `aired` and `episodeCount` point the search at the episodes so far.
 */
function buildScoresPrompt({ show, season, airing = false, aired = 0, episodeCount = null, through = null, blocks } = {}) {
  const b = isObj(blocks) ? blocks : {};
  // Through an episode: only that far is read, so nothing later is given away (someone watching a season that's aired).
  const upTo = Number.isInteger(through) && through > 0 && !(episodeCount && through >= episodeCount) ? through : null;
  const seen = upTo ?? aired;
  const what = [show, season].filter(Boolean).join(', ') || 'this TV show';
  const part = partWord(b).singular;
  const moments = momentsFor(b);
  const parts = [];
  parts.push(
    `These are the moments of ${what} that score in a fantasy game people play along with at home: things one person can do in ${aPart(part)} to earn or lose points. Answer two things: what the show has that none of these moments cover, and which rung of the ladder below each moment stands on. Search the web first: the show's wiki, its network's pages, and recaps${seen ? ` of this season's ${seen === 1 ? 'first episode' : `first ${seen} episodes`}` : ''}. Then answer with ONE JSON object in the shape at the end. Nothing after the JSON.`,
    '',
    'Four rules:',
    "1. No names and no results, anywhere. People read this before they've watched: never name anyone in the cast, and never say what happened in a particular episode. Describe what can happen, not what happened.",
    "2. Score by the ladder, nothing else. Every moment stands on one rung, chosen by the rung's test; its points are the rung's. Judge what the moment is, never how a season or a person is going: the same moment stands on the same rung today, tomorrow and next season.",
    "3. A missing moment is something a recap reliably reports about one person as yes or no, a count or an amount, in the show's own words (\"Got in a fight\", \"Called out an opponent\"). Never a judgement call (\"funniest moment\"), never something these moments already cover, never something that can't happen on this show. Up to 12, the most telling first.",
    '4. Anything that doesn\'t fit goes in "leftOut", one sentence each, with no names or results either.',
    '',
    'The ladder. Why it is built this way, so you never need to adjust a value: the week\'s biggest win (4) beats any two small edges (1 + 1), so whoever won the week is the week\'s top earner; the worst anyone can lose in a week (-3, plus a slip) is under one biggest win, and whoever leaves earns nothing more, so one bad week is at most one good week undone; what most of the field gets each week is 0.5 or 1, and what one or two people get is 2 or more, so weekly totals differ instead of bunching.',
    ...LADDER.map((r) => `  ${r.id}: ${r.points > 0 ? '+' : ''}${r.points}. ${r.test}`),
    `  ${PER_UNIT.id}: for a moment counted per amount (each point, each $1,000, each day) only: give "points" per unit, between ${PER_UNIT.min} and ${PER_UNIT.max}, so a typical ${part}'s total for whoever does best lands on earned (2) or wonAlone (4), and say the typical amount in "why".`,
    ''
  );
  parts.push(`How ${show || 'the show'} is played, from its rulebook:`);
  for (const s of list(b.segments)) parts.push(`- ${s.name} (segment "${s.id}")${s.summary ? `: ${s.summary}` : ''}`);
  for (const t of list(b.twists)) parts.push(`- ${t.name} (twist "${t.id}")${t.summary ? `: ${t.summary}` : ''}`);
  for (const w of list(b.waysOut)) parts.push(`- Way out: ${w.name}`);
  if (b.season && b.season.finale && b.season.finale.summary) parts.push(`- The finale: ${b.season.finale.summary}`);
  if (airing) parts.push(`This season is still airing${aired ? `: ${aired}${episodeCount ? ` of ${episodeCount}` : ''} ${aired === 1 ? 'episode has' : 'episodes have'} aired` : ''}. Describe what can happen, as the show has set it up and aired so far.`);
  if (upTo) parts.push(`Only Episodes 1 to ${upTo} of this season have been watched. Search only those episodes' recaps, treat Episode ${upTo} as the latest aired, and never list or describe a moment, a twist or a way out that first appears after Episode ${upTo}.`);
  parts.push('', `The moments, each with its id, where it comes from, how it's counted, who answers it, and what it's worth now:`);
  for (const m of moments) {
    const how = m.ask && m.ask.type === 'integer' && !m.ask.when ? 'each time' : m.ask && m.ask.type === 'number' ? 'per unit' : 'once';
    const who = m.auto ? 'known from how the game went' : m.answeredBy === 'league' ? 'the league says' : 'research';
    parts.push(`- "${m.id}": ${m.label} · from ${fromWord(m, b)} · ${how} · ${who} · now ${pointsWord(m.defaultPoints)}`);
  }
  parts.push(
    '',
    'Every id is camelCase, made once from the label ("Called out an opponent" -> "calledOutAnOpponent"), and unique: never one of the ids above. Where "during" names where it happens, use a segment or twist id from above.',
    '',
    'The shape:',
    '{',
    `  "schema": ${SCHEMA_VERSION},`,
    '  "scores": { for EVERY moment listed above, by its id: { "rung": "<a rung id>", "points": only for perUnit, "why": "one short line: which part of the test it meets" } },',
    '  "add": [ what\'s missing: {',
    '    "id", "label": "the way a recap would say it",',
    '    "rung": "<a rung id>", "points": only for perUnit, "why": "one short line",',
    '    "during": optional: { "segment": "<id>" } or { "twist": "<id>" } when it only happens there,',
    `    "counted": one of ${choices('counted')},`,
    `    "answeredBy": one of ${choices('answeredBy')},`,
    `    "reliability": only when answered by research, one of ${choices('reliability')},`,
    "    \"exceptWinners\": true when it happens during a segment someone wins and its winners can't have it",
    '  } ],',
    '  "leftOut": ["anything that didn\'t fit, one sentence each, no names or results"]',
    '}'
  );
  return parts.join('\n');
}

const aPart = (part) => (/^[aeiou]/i.test(part) ? `an ${part}` : `a ${part}`);

// ---------- the answer ----------

/** A chat's answer -> the JSON object in it (chatter and code fences around it are fine). */
function parseScoresAnswer(text) {
  return parseRulebookAnswer(text);
}

const STOP = new Set(['a', 'an', 'the', 'was', 'were', 'is', 'got', 'each', 'their', 'at', 'in', 'of', 'by', 'for', 'to', 'as', 'and', 'on', 'with', 'from', 'despite', 'who', 'someone']);
const words = (s) =>
  new Set(
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w))
  );
/** Two labels that say the same thing: one's content words are mostly the other's. */
function sameThing(a, b) {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return false;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / Math.min(x.size, y.size) >= 0.75;
}
/** A cast member named in a label (whole words, any case). */
function namesIn(text, castNames) {
  const t = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9']+/g, ' ')} `;
  return castNames.filter((n) => {
    const first = String(n).toLowerCase().split(/\s+/)[0];
    return first.length > 2 && t.includes(` ${first} `);
  });
}

/** The points a rung (or perUnit's own number) gives, or null with why it can't. */
function pointsOf(entry) {
  if (!isObj(entry)) return { problem: 'no rung' };
  const rung = rungOf(entry.rung);
  if (rung) return { points: rung.points, rung: rung.id, why: typeof entry.why === 'string' ? entry.why.trim().slice(0, 200) : '' };
  if (entry.rung === PER_UNIT.id) {
    const p = Number(entry.points);
    if (!Number.isFinite(p) || p < PER_UNIT.min || p > PER_UNIT.max) return { problem: `perUnit points should be between ${PER_UNIT.min} and ${PER_UNIT.max}` };
    return { points: Math.round(p * 100) / 100, rung: PER_UNIT.id, why: typeof entry.why === 'string' ? entry.why.trim().slice(0, 200) : '' };
  }
  return { problem: `"${entry.rung}" isn't a rung of the ladder` };
}

/**
 * What the answer would change: every moment with its points now and after (the rung's), the moments it adds (as custom
 * moments with their points), what it left out and why, and the blocks with all of it applied. A moment the answer
 * didn't score keeps its points (a warning). A split value ({ exclusive, shared }) takes the rung's number for both, as
 * the editor's stepper does. Writes nothing; `problems` are the applied blocks' own (blocksProblems), so a usable answer
 * has none.
 */
function reviewScores(answer, blocks, { castNames = [] } = {}) {
  const a = isObj(answer) ? answer : {};
  const b = clone(isObj(blocks) ? blocks : {});
  const warnings = [];
  const rows = [];
  const added = [];
  const skipped = [];
  const moments = momentsFor(b);
  const scores = isObj(a.scores) ? a.scores : {};
  const points = isObj(b.points) ? b.points : {};
  for (const m of moments) {
    const now = pointsNow(m.defaultPoints);
    const entry = scores[m.id];
    if (entry === undefined) {
      warnings.push({ at: `scores.${m.id}`, message: `${m.label}: not scored, kept at ${pointsWord(m.defaultPoints)}` });
      rows.push({ id: m.id, label: m.label, before: now, beforeWord: pointsWord(m.defaultPoints), after: now, rung: null, why: '', changed: false });
      continue;
    }
    const got = pointsOf(entry);
    if (got.problem) {
      warnings.push({ at: `scores.${m.id}`, message: `${m.label}: ${got.problem}, kept at ${pointsWord(m.defaultPoints)}` });
      rows.push({ id: m.id, label: m.label, before: now, beforeWord: pointsWord(m.defaultPoints), after: now, rung: null, why: '', changed: false });
      continue;
    }
    const changed = got.points !== now || (isObj(m.defaultPoints) && m.defaultPoints.shared !== got.points);
    if (changed) points[m.id] = isObj(m.defaultPoints) ? { exclusive: got.points, shared: got.points } : got.points;
    rows.push({ id: m.id, label: m.label, before: now, beforeWord: pointsWord(m.defaultPoints), after: got.points, rung: got.rung, why: got.why, changed });
  }
  for (const id of Object.keys(scores)) if (!moments.some((m) => m.id === id)) warnings.push({ at: `scores.${id}`, message: `"${id}" isn't one of the rulebook's moments` });

  const used = new Set([...moments.map((m) => m.id), ...list(b.segments).map((s) => s.id), ...list(b.twists).map((t) => t.id), ...list(b.waysOut).map((w) => w.id)]);
  const customs = list(b.customMoments);
  const labels = [...moments.map((m) => m.label), ...customs.map((m) => m.label)];
  for (const [i, raw] of list(a.add).entries()) {
    const label = isObj(raw) && typeof raw.label === 'string' ? raw.label.trim().slice(0, 120) : '';
    const skip = (why) => skipped.push({ label: label || `Added moment ${i + 1}`, why });
    if (!label) {
      skip('no description');
      continue;
    }
    const named = namesIn(label, castNames);
    if (named.length) {
      skip(`names ${named[0]}`);
      continue;
    }
    const twin = labels.find((l) => sameThing(l, label));
    if (twin) {
      skip(`the rulebook has it: ${twin}`);
      continue;
    }
    const got = pointsOf(raw);
    if (got.problem) {
      skip(got.problem);
      continue;
    }
    let id = typeof raw.id === 'string' && ID.test(raw.id) ? raw.id : camelId(raw.id || label) || 'moment';
    for (let n = 2; used.has(id); n++) id = `${camelId(label) || 'moment'}${n}`;
    used.add(id);
    const counted = OPT.counted.some(([v]) => v === raw.counted) ? raw.counted : 'yesNo';
    if (counted !== raw.counted) warnings.push({ at: `add.${id}.counted`, message: `${label}: counted once an episode (it said "${raw.counted}")` });
    const answeredBy = OPT.answeredBy.some(([v]) => v === raw.answeredBy) ? raw.answeredBy : 'research';
    if (answeredBy !== raw.answeredBy) warnings.push({ at: `add.${id}.answeredBy`, message: `${label}: answered by research (it said "${raw.answeredBy}")` });
    const m = { id, label, counted, answeredBy };
    if (answeredBy === 'research') m.reliability = OPT.reliability.some(([v]) => v === raw.reliability) ? raw.reliability : 'usually';
    if (isObj(raw.during)) {
      if (typeof raw.during.segment === 'string' && list(b.segments).some((s) => s.id === raw.during.segment)) m.during = { segment: raw.during.segment };
      else if (typeof raw.during.twist === 'string' && list(b.twists).some((t) => t.id === raw.during.twist)) m.during = { twist: raw.during.twist };
      else warnings.push({ at: `add.${id}.during`, message: `${label}: happens anywhere (it named "${raw.during.segment || raw.during.twist}", which isn't a segment or twist here)` });
    }
    if (raw.exceptWinners === true && m.during && m.during.segment) m.exceptWinners = true;
    customs.push(m);
    labels.push(label);
    if (got.points !== 0) points[id] = got.points;
    added.push({ id, label, points: got.points, rung: got.rung, why: got.why, counted, answeredBy, during: m.during || null });
  }
  if (customs.length) b.customMoments = customs;
  if (Object.keys(points).length) b.points = points;
  else delete b.points;
  const leftOut = list(a.leftOut).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 300));
  const ops = diffBlocks(blocks, b);
  return { blocks: b, rows, added, skipped, problems: blocksProblems(b), warnings, leftOut, lines: opLines(ops, blocks, b), changes: ops.length };
}

/**
 * The review's changes, only the ones picked (the desk's pick list: new moments first, then every moment with its value now
 * and proposed, each accepted or declined): `declined` is the ids left out, a moment's or an added moment's. Everything
 * else stays as `blocks` has it. `review` is reviewScores' (or the page's card: rows, added, blocks).
 */
function pickScores(blocks, review, declined = []) {
  const skip = new Set(declined);
  const b = clone(isObj(blocks) ? blocks : {});
  const from = isObj(review && review.blocks) ? review.blocks : {};
  const fromPoints = isObj(from.points) ? from.points : {};
  const points = isObj(b.points) ? b.points : {};
  for (const r of list(review && review.rows)) if (r.changed && !skip.has(r.id) && Object.prototype.hasOwnProperty.call(fromPoints, r.id)) points[r.id] = fromPoints[r.id];
  const customs = list(b.customMoments);
  for (const m of list(review && review.added)) {
    if (skip.has(m.id) || customs.some((x) => x.id === m.id)) continue;
    const made = list(from.customMoments).find((x) => x.id === m.id);
    if (!made) continue;
    customs.push(clone(made));
    if (Object.prototype.hasOwnProperty.call(fromPoints, m.id)) points[m.id] = fromPoints[m.id];
  }
  if (customs.length) b.customMoments = customs;
  if (Object.keys(points).length) b.points = points;
  else delete b.points;
  return b;
}

module.exports = { LADDER, PER_UNIT, buildScoresPrompt, parseScoresAnswer, reviewScores, pickScores };
