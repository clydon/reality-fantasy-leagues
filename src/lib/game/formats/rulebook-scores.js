// What scores (docs/PLAN-rulebook-research.md): research looks at a rulebook's moments, the things that can happen and
// score (rulebook-moments.js momentsFor), and answers two things about them: what the show has that none of them
// cover, and what each one is worth. The worth isn't the AI's to invent: it's a ladder of rungs, each with a test and a
// fixed number of points, plus a rarity step for positive moments, and the AI only says which rung a moment stands on
// and how often it comes up. So the same moment lands on the same number this time and next time, and the numbers obey
// the league's three wants by construction (at a given rarity):
//
//   strong players stand out   the week's biggest win (wonAlone, 4) beats any two small edges (1 + 1), so whoever won
//                              the week is the week's top earner
//   a bad week hurts, never    the worst anyone can lose in one week (ownFault, -3, plus a slip) is under one
//   sinks a team               wonAlone, and whoever leaves earns nothing more: one bad week is at most one good week undone
//   totals differ              what most of the field gets each week (along, edge) is small; what one or two people
//                              get (earned and up) is 2 or more, so weekly totals spread instead of bunching
//
// Rarity (the user, 2026-11-05): a rare advantage is worth a smidge more than a common one, so a moment on earned or
// above gains 0, 0.5 or 1 by how often it comes up across a season; a small edge gains nothing (it's still a small edge),
// and a negative one gains nothing (a rare disaster is no worse than a common one, so the worst week stays under the best). It's fixed when the moment is scored, from the show's history:
// what actually happened this season never moves a value in play.
//
// Spoilers (the same day): research reads the whole season, so nothing is missed, and what it adds carries whether the
// show has done this kind of thing in earlier seasons (anyone who's watched before expects it) and the first episode it
// applies from. A new-this-season moment past where the reader is (their Where I am mark) is held: not in the rows, the
// counts or the blocks, with no trace of it, until they're past that episode. A season's own "didn't fit" notes the same.
//
//   buildScoresPrompt({ show, season, airing, aired, episodeCount, blocks })   the question
//
// A moment that isn't something one person did (the tip is revealed, a guest complains: a show's first research sometimes
// writes these) stands on nothing; when it was added by hand, the review proposes dropping it (`drop` on its row), a row
// to accept or decline like the rest, so research isn't asked about it every episode for nothing.
//   parseScoresAnswer(text)                                                     the JSON object in a chat's answer
//   reviewScores(answer, blocks, { castNames, mark, episodeCount, settled })    what it would change, as blocks and rows
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
  { id: 'nothing', points: 0, test: "Says nothing about how well they play (medically removed, arrived partway through), isn't something one person did (a happening of the show as a whole), or can't happen on this show." },
  { id: 'slip', points: -0.5, test: 'A small slip: sat out, voted against the majority, put at risk, picked last.' },
  { id: 'lost', points: -1, test: 'Lost to someone and stayed in: lost a head-to-head, finished last, had an advantage used against them, went home holding one, a finalist with no jury votes.' },
  { id: 'out', points: -2, test: 'Left the game by losing: voted out, lost the elimination, last across the line. The usual way out.' },
  { id: 'ownFault', points: -3, test: 'Left by their own doing: quit, disqualified, removed for conduct.' },
];
/** How often a moment comes up across a season: what a moment on earned or above (RARITY_FROM) gains on top of its rung. */
const RARITY = [
  { id: 'mostEpisodes', bump: 0, test: 'It comes up in most episodes.' },
  { id: 'someEpisodes', bump: 0.5, test: 'A few times a season.' },
  { id: 'onceOrTwice', bump: 1, test: 'Once or twice a season, or only at a set point like the final.' },
];
/** A moment counted per amount (each point, each $1,000) isn't on the ladder: it's scored per unit, a small number. */
/** The least a rung is worth for rarity to count: earned and up, what one or two people get. */
const RARITY_FROM = 2;
const PER_UNIT = { id: 'perUnit', min: 0.01, max: 2 };
/** Where what it adds comes from: the show's own repertoire, or this season's. */
const KNOWN = ['pastSeasons', 'thisSeason'];
const rungOf = (id) => LADDER.find((r) => r.id === id) || null;
const rarityOf = (id) => RARITY.find((r) => r.id === id) || null;

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
 * the ladder and the rarity steps, then the shape of the answer. The whole season is read: what's past the reader is held
 * back on our side (reviewScores), never left out of the question.
 */
function buildScoresPrompt({ show, season, airing = false, aired = 0, episodeCount = null, blocks } = {}) {
  const b = isObj(blocks) ? blocks : {};
  const what = [show, season].filter(Boolean).join(', ') || 'this TV show';
  const part = partWord(b).singular;
  const moments = momentsFor(b);
  const parts = [];
  parts.push(
    `These are the moments of ${what} that score in a fantasy game people play along with at home: things one person can do in ${aPart(part)} to earn or lose points. Answer two things: what the show has that none of these moments cover, and which rung of the ladder below each moment stands on, with how often it comes up. Search the web first: the show's wiki (its earlier seasons too: what the show does, not only this season), its network's pages, and recaps${aired ? ` of this season's ${aired === 1 ? 'first episode' : `first ${aired} episodes`}` : ''}. Then answer with ONE JSON object in the shape at the end. Nothing after the JSON.`,
    '',
    'Four rules:',
    "1. No names and no results, anywhere. People read this before they've watched: never name anyone in the cast, and never say what happened in a particular episode. Describe what can happen, not what happened.",
    "2. Score by the ladder, nothing else. Every moment stands on one rung, chosen by the rung's test; its points are the rung's, plus its rarity step on earned or above. Judge what the moment is and how often the show produces it, never how a season or a person is going: the same moment stands on the same rung with the same rarity today, tomorrow and next season. A moment that isn't something one person did or had done to them (the tip is revealed, a guest complains, the weather turns) stands on nothing, and its why says so: it says nothing about anyone.",
    "3. A missing moment is something a recap reliably reports about one person as yes or no, a count or an amount, in the show's own words (\"Got in a fight\", \"Called out an opponent\", \"Eliminated in a purge\"). Never a judgement call (\"funniest moment\"), never something these moments already cover, never something that can't happen on this show. Up to 12, the most telling first. For each, say whether this kind of moment has happened in earlier seasons of the show (anyone who's watched before would expect it) or is new to this season, and the first episode of this season it could happen in under the show's rules.",
    '4. Anything that doesn\'t fit goes in "leftOut", one sentence each, with no names or results either, each with the first episode it concerns.',
    '',
    "The ladder. Why it is built this way, so you never need to adjust a value: the week's biggest win (4) beats any two small edges (1 + 1), so whoever won the week is the week's top earner; the worst anyone can lose in a week (-3, plus a slip) is under one biggest win, and whoever leaves earns nothing more, so one bad week is at most one good week undone; what most of the field gets each week is small, and what one or two people get is 2 or more, so weekly totals differ instead of bunching.",
    ...LADDER.map((r) => `  ${r.id}: ${r.points > 0 ? '+' : ''}${r.points}. ${r.test}`),
    `  ${PER_UNIT.id}: for a moment counted per amount (each point, each $1,000, each day) only: give "points" per unit, between ${PER_UNIT.min} and ${PER_UNIT.max}, so a typical ${part}'s total for whoever does best lands on earned (2) or wonAlone (4), and say the typical amount in "why". No rarity step.`,
    '',
    'Rarity, for every moment, from how the show has played across its seasons: a moment on earned or above gains this on top of its rung, so a rare thing earned beats a common one; a small edge gains nothing (it is still a small edge), and a moment worth 0 or less gains nothing, so a rare disaster is no worse than a common one.',
    ...RARITY.map((r) => `  ${r.id}: +${r.bump}. ${r.test}`),
    ''
  );
  parts.push(`How ${show || 'the show'} is played, from its rulebook:`);
  for (const s of list(b.segments)) parts.push(`- ${s.name} (segment "${s.id}")${s.summary ? `: ${s.summary}` : ''}`);
  for (const t of list(b.twists)) parts.push(`- ${t.name} (twist "${t.id}")${t.summary ? `: ${t.summary}` : ''}`);
  for (const w of list(b.waysOut)) parts.push(`- Way out: ${w.name}`);
  if (b.season && b.season.finale && b.season.finale.summary) parts.push(`- The finale: ${b.season.finale.summary}`);
  if (airing) parts.push(`This season is still airing${aired ? `: ${aired}${episodeCount ? ` of ${episodeCount}` : ''} ${aired === 1 ? 'episode has' : 'episodes have'} aired` : ''}. Describe what can happen, as the show has set it up and aired so far.`);
  else if (episodeCount) parts.push(`This season has ${episodeCount} episodes.`);
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
    '  "scores": { for EVERY moment listed above, by its id: { "rung": "<a rung id>", "rarity": "<a rarity id>", "points": only for perUnit, "why": "one short line: which part of the test it meets" } },',
    '  "add": [ what\'s missing: {',
    '    "id", "label": "the way a recap would say it",',
    '    "rung": "<a rung id>", "rarity": "<a rarity id>", "points": only for perUnit, "why": "one short line",',
    `    "known": "${KNOWN[0]}" when this kind of moment has happened in earlier seasons of the show, else "${KNOWN[1]}",`,
    '    "firstEpisode": the first episode of this season in which it could happen under the show\'s rules: 1 if any episode, the episode a mechanic is introduced, the final\'s episode for the final. Never the episode it first did happen in.',
    '    "during": optional: { "segment": "<id>" } or { "twist": "<id>" } when it only happens there,',
    `    "counted": one of ${choices('counted')},`,
    `    "answeredBy": one of ${choices('answeredBy')},`,
    `    "reliability": only when answered by research, one of ${choices('reliability')},`,
    "    \"exceptWinners\": true when it happens during a segment someone wins and its winners can't have it",
    '  } ],',
    '  "leftOut": [ { "note": "anything that didn\'t fit, one sentence, no names or results", "firstEpisode": the first episode it concerns, 1 for the whole season } ]',
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
/** Two labels that say the same thing: their content words are mostly the same ("Eliminated in a purge" isn't "Eliminated"). */
function sameThing(a, b) {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return false;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / Math.max(x.size, y.size) >= 0.75;
}
/** A cast member named in a label (whole words, any case). */
function namesIn(text, castNames) {
  const t = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9']+/g, ' ')} `;
  return castNames.filter((n) => {
    const first = String(n).toLowerCase().split(/\s+/)[0];
    return first.length > 2 && t.includes(` ${first} `);
  });
}

/**
 * The points a rung (or perUnit's own number) gives, with the rarity step on earned or above, or why it can't. A missing
 * or unknown rarity is the common one (a warning, in `note`), never a refusal: the rung is what matters.
 */
function pointsOf(entry) {
  if (!isObj(entry)) return { problem: 'no rung' };
  const why = typeof entry.why === 'string' ? entry.why.trim().slice(0, 200) : '';
  const rung = rungOf(entry.rung);
  if (rung) {
    const rarity = rarityOf(entry.rarity);
    const note = rarity ? null : entry.rarity === undefined ? 'no rarity given: counted as most episodes' : `"${entry.rarity}" isn't a rarity: counted as most episodes`;
    const bump = rung.points >= RARITY_FROM && rarity ? rarity.bump : 0;
    return { points: rung.points + bump, rung: rung.id, rarity: rarity ? rarity.id : RARITY[0].id, why, note };
  }
  if (entry.rung === PER_UNIT.id) {
    const p = Number(entry.points);
    if (!Number.isFinite(p) || p < PER_UNIT.min || p > PER_UNIT.max) return { problem: `perUnit points should be between ${PER_UNIT.min} and ${PER_UNIT.max}` };
    return { points: Math.round(p * 100) / 100, rung: PER_UNIT.id, rarity: null, why, note: null };
  }
  return { problem: `"${entry.rung}" isn't a rung of the ladder` };
}

/** Whether someone up to `mark` may see something that first concerns `firstEpisode`: no mark, or the whole season, sees everything. */
function visibleAt(firstEpisode, mark) {
  if (!Number.isFinite(mark) || mark <= 0) return true;
  return firstEpisode <= mark;
}

/**
 * What the answer would change: every moment with its points now and after (the rung's, plus rarity), the moments it adds
 * (as custom moments with their points), what it left out and why, and the blocks with all of it applied. A moment the
 * answer didn't score keeps its points (a warning). A split value ({ exclusive, shared }) takes the number for both, as
 * the editor's stepper does. `mark`: where the reader is (their Where I am mark); a new-this-season moment past it, and
 * a "didn't fit" note past it, are held: not in `added`, `leftOut`, `lines`, `changes` or `blocks`, only their ids in
 * `held` (for whoever keeps the answer open; never shown). No mark (0, null, Infinity) holds nothing. `settled`: ids
 * already used or put away, left out of everything. Writes nothing; `problems` are the applied blocks' own.
 */
function reviewScores(answer, blocks, { castNames = [], mark = null, episodeCount = null, settled = {} } = {}) {
  const a = isObj(answer) ? answer : {};
  const b = clone(isObj(blocks) ? blocks : {});
  const done = isObj(settled) ? settled : {};
  const warnings = [];
  const rows = [];
  const added = [];
  const skipped = [];
  const held = [];
  const drops = [];
  const moments = momentsFor(b);
  const scores = isObj(a.scores) ? a.scores : {};
  const points = isObj(b.points) ? b.points : {};
  for (const m of moments) {
    if (done[m.id]) continue;
    const now = pointsNow(m.defaultPoints);
    const entry = scores[m.id];
    const same = { id: m.id, label: m.label, before: now, beforeWord: pointsWord(m.defaultPoints), after: now, rung: null, rarity: null, why: '', changed: false, drop: false };
    if (entry === undefined) {
      warnings.push({ at: `scores.${m.id}`, message: `${m.label}: not scored, kept at ${pointsWord(m.defaultPoints)}` });
      rows.push(same);
      continue;
    }
    const got = pointsOf(entry);
    if (got.problem) {
      warnings.push({ at: `scores.${m.id}`, message: `${m.label}: ${got.problem}, kept at ${pointsWord(m.defaultPoints)}` });
      rows.push(same);
      continue;
    }
    if (got.note) warnings.push({ at: `scores.${m.id}.rarity`, message: `${m.label}: ${got.note}` });
    // Added by hand and worth nothing: dropped, so it isn't asked about every episode for nothing.
    if (m.custom && got.rung === 'nothing') {
      drops.push(m.id);
      rows.push({ id: m.id, label: m.label, before: now, beforeWord: pointsWord(m.defaultPoints), after: 0, rung: got.rung, rarity: got.rarity, why: got.why, changed: true, drop: true });
      continue;
    }
    const changed = got.points !== now || (isObj(m.defaultPoints) && m.defaultPoints.shared !== got.points);
    if (changed) points[m.id] = isObj(m.defaultPoints) ? { exclusive: got.points, shared: got.points } : got.points;
    rows.push({ id: m.id, label: m.label, before: now, beforeWord: pointsWord(m.defaultPoints), after: got.points, rung: got.rung, rarity: got.rarity, why: got.why, changed, drop: false });
  }
  for (const id of Object.keys(scores)) if (!moments.some((m) => m.id === id)) warnings.push({ at: `scores.${id}`, message: `"${id}" isn't one of the rulebook's moments` });

  const used = new Set([...moments.map((m) => m.id), ...list(b.segments).map((s) => s.id), ...list(b.twists).map((t) => t.id), ...list(b.waysOut).map((w) => w.id)]);
  const customs = list(b.customMoments).filter((m) => !drops.includes(m.id));
  for (const id of drops) delete points[id];
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
    if (done[id]) continue;
    // Where it comes from, and from when: the show's own repertoire is never a spoiler; this season's is, until it's reached.
    const known = KNOWN.includes(raw.known) ? raw.known : 'thisSeason';
    const first = Number.isInteger(raw.firstEpisode) && raw.firstEpisode >= 1 ? raw.firstEpisode : 1;
    if (known === 'thisSeason' && !visibleAt(first, mark)) {
      held.push(id);
      continue;
    }
    if (got.note) warnings.push({ at: `add.${id}.rarity`, message: `${label}: ${got.note}` });
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
    added.push({ id, label, points: got.points, rung: got.rung, rarity: got.rarity, why: got.why, known, firstEpisode: first, counted, answeredBy, during: m.during || null });
  }
  if (customs.length) b.customMoments = customs;
  else delete b.customMoments;
  if (Object.keys(points).length) b.points = points;
  else delete b.points;
  // "Didn't fit", each from the episode it concerns; a bare sentence (an older answer's shape) concerns the whole season.
  const leftOut = [];
  for (const l of list(a.leftOut)) {
    const note = typeof l === 'string' ? l : isObj(l) && typeof l.note === 'string' ? l.note : '';
    if (!note.trim()) continue;
    const first = isObj(l) && Number.isInteger(l.firstEpisode) && l.firstEpisode >= 1 ? l.firstEpisode : episodeCount || Infinity;
    if (visibleAt(first, mark)) leftOut.push(note.trim().slice(0, 300));
  }
  const ops = diffBlocks(blocks, b);
  return { blocks: b, rows, added, skipped, held, problems: blocksProblems(b), warnings, leftOut, lines: opLines(ops, blocks, b), changes: ops.length };
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
  const dropped = new Set(list(review && review.rows).filter((r) => r.drop && !skip.has(r.id)).map((r) => r.id));
  for (const r of list(review && review.rows)) if (r.changed && !r.drop && !skip.has(r.id) && Object.prototype.hasOwnProperty.call(fromPoints, r.id)) points[r.id] = fromPoints[r.id];
  for (const id of dropped) delete points[id];
  const customs = list(b.customMoments).filter((m) => !dropped.has(m.id));
  for (const m of list(review && review.added)) {
    if (skip.has(m.id) || customs.some((x) => x.id === m.id)) continue;
    const made = list(from.customMoments).find((x) => x.id === m.id);
    if (!made) continue;
    customs.push(clone(made));
    if (Object.prototype.hasOwnProperty.call(fromPoints, m.id)) points[m.id] = fromPoints[m.id];
  }
  if (customs.length) b.customMoments = customs;
  else delete b.customMoments;
  if (Object.keys(points).length) b.points = points;
  else delete b.points;
  return b;
}

module.exports = { LADDER, RARITY, RARITY_FROM, PER_UNIT, KNOWN, buildScoresPrompt, parseScoresAnswer, reviewScores, pickScores };
