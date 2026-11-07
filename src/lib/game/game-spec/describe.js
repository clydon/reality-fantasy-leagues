// A game spec in plain words (docs/PLAN-start-a-game-gpt.md, "The wizard"): the game in a sentence at the top of the
// wizard, How it works as a rule a line, and the details nobody asked about (recommended, out of sight).
//
//   describeSpec(spec, ctx) -> { name, sentence, parts, rules, details }
//
//   sentence  "A Weekly Lineup for Survivor 51: everyone drafts 5 and starts 3 each episode, Episode 7 to the finale.
//             Scored by Survivor 51's rules."
//   parts     the sentence in pieces, each with the part of the spec it says (`at`: preset, about, get, count, span,
//             score, ask, rank), so the wizard can show what someone said as theirs and what we chose as ours
//   rules     How it works: the Rules sheet (game-rules.ts gameRules reads it, step A2)
//   details   [{ id, label, value, recommended }]: the draft room, who can join, waivers, side bets (beside a draft), finale
//             predictions (a draft's questions)...
//
//   ctx       what the spec refers to, in the show's words: { show: 'Survivor 51', castaway: 'castaway', castaways,
//             part: { singular: 'episode', plural: 'episodes' }, groups: the scoring groups' labels, moments: [{ id,
//             label, defaultPoints }], stats: [{ key, label: 'home run' }], phases: [{ id, name: 'Merged' }] }. All
//             optional.
//
// Pure CommonJS, like ./schema.js.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./schema.js */
const { CARD_OUT_HOURS, PRESET_LABELS, NAMES, fullSpec, countKind, presetOf, sameValue, own, spanStart, spanEnd, spanEndPhase, playsAs, callsAsk, finaleIn, draftQuestions, betsFit, poolParts, budgetParts, keepParts, seatPeople, knockoutParts, answerParts, livesQuestion, matchupParts, categoryParts, squaresParts, ordinalWord, questionsGame, poolByPoints, teamParts, handicapParts, stageOn, ON_CHANGE, nextStageAts, fallsTo, stageSide, mainCount, stageAlongside, stageSeason, seasonKey, isPlayers, isBeat, waiverOwnOf, waiverMoves, weekParts, momentsPick, bankOf, isTicket, ticketOf, cardOf, isCardQuestion, onlyCard, questionLines, lifeRides, askOf: linesOf } = require('./schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const say = (n) => NUMBER_WORDS[n] || String(n);
const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** A game of questions' parlays (A9) as far as they're said: each with its list of questions (a spec still being made can have
 *  half of one). */
const parlaysOf = (score) => (isObj(score) && Array.isArray(score.parlays) ? score.parlays.filter((p) => isObj(p) && Array.isArray(p.of)) : []);
/** "a, b and c". */
const listOf = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const pointsWord = (n) => `${n} ${n === 1 ? 'point' : 'points'}`;

function wordsOf(ctx) {
  const c = isObj(ctx) ? ctx : {};
  const castaway = c.castaway || 'person';
  const part = isObj(c.part) && c.part.singular ? c.part : { singular: 'episode', plural: 'episodes' };
  return {
    show: c.show || null,
    castaway,
    castaways: c.castaways || (c.castaway ? `${castaway}s` : 'people'),
    part: part.singular,
    parts: part.plural || `${part.singular}s`,
    Part: cap(part.singular),
    Parts: cap(part.plural || `${part.singular}s`),
    groups: Array.isArray(c.groups) ? c.groups.filter(Boolean) : [],
    // A10 part 3: what the show calls one of its groups ("tribe"), for a draft spread across them.
    group: typeof c.group === 'string' && c.group ? c.group.toLowerCase() : 'group',
    moments: Array.isArray(c.moments) ? c.moments : null,
    stats: new Map((Array.isArray(c.stats) ? c.stats : []).map((x) => (isObj(x) ? [x.key, x.label || x.key] : [x, x]))),
    // L4 part 1b: the stats a categories game can name, each with its label ("Field goal percentage"), which way is better and
    // whether it's a rate.
    categories: new Map((Array.isArray(c.categories) ? c.categories : []).map((x) => (isObj(x) ? [x.key, { label: x.label || x.key, better: x.better, rate: !!x.rate }] : [x, { label: x, better: undefined, rate: false }]))),
    // L1 part 4a: a sport's position groups ("Goalkeepers") and its bouts' formats ("5 sets"), for a stats score's tables.
    positions: new Map((Array.isArray(c.positions) ? c.positions : []).map((x) => (isObj(x) ? [x.key, x.label || x.key] : [x, x]))),
    formats: new Map((Array.isArray(c.formats) ? c.formats : []).map((x) => (isObj(x) ? [String(x.key), x.label || String(x.key)] : [String(x), String(x)]))),
    // L4 part 2: a sport's word for its periods (squares pay at their ends), and the draws a bracket can be of ("Men's singles").
    period: isObj(c.periods) && c.periods.word ? { word: c.periods.word, plural: c.periods.plural || `${c.periods.word}s` } : { word: 'period', plural: 'periods' },
    draws: new Map((Array.isArray(c.draws) ? c.draws : []).map((x) => (isObj(x) ? [x.key, x.label || x.key] : [x, x]))),
    phases: new Map((Array.isArray(c.phases) ? c.phases : []).filter(isObj).map((p) => [p.id, p.name || p.id])),
    // A12 part 2, inside a game in stages: a stage a format change starts says where it starts in these words, and the stage
    // before it runs until then.
    fromChange: typeof c.fromChange === 'string' ? c.fromChange : null,
    // A12 part 2b: the words for where the stage ends ("until there are no more teams"), else true: until the format changes.
    untilChange: typeof c.untilChange === 'string' && c.untilChange ? c.untilChange : c.untilChange === true,
  };
}
// A12 part 2: the kinds of format change in words ("teams form", "everyone goes on alone"); a list that's F3's MAJOR is "a major
// change of format". The words are the user's (U0).
const CHANGE_WORDS = {
  'teams-formed': 'teams form',
  'pairs-formed': 'pairs form',
  'split-into-individuals': 'everyone goes on alone',
  merge: 'the merge',
  swap: 'a swap',
  'swap-all': 'a swap that leaves no group as it was',
  newcomer: 'someone new comes in',
  'new-phase': 'a new phase begins',
};
/** Where a stage a format change starts plays from, in words: "from the first major change of format", "from each time teams form
 *  or everyone goes on alone". */
function onWords(on) {
  const major = sameValue([...on.change].sort(), [...ON_CHANGE.change].sort());
  const ks = on.change.map((k) => CHANGE_WORDS[k] || k);
  const or = ks.length <= 1 ? ks.join('') : `${ks.slice(0, -1).join(', ')} or ${ks[ks.length - 1]}`;
  if (major) return on.again ? 'from each major change of format' : 'from the first major change of format';
  return on.again ? `from each time ${or}` : `from the first time ${or}`;
}
/** A phase by its name ("Merged"), else its id. */
const phaseWord = (id, w) => w.phases.get(id) || id;

/** "Episode 7 to the finale", "Games 1–3", "just Game 1", "all season"; a phase start (A3): "from when Merged starts",
 *  and once that's settled "Episode 9 to the finale, starting with Merged" (aired or still to come). An end at a phase (A12 part
 *  1): "until Merged starts", "Episode 2 until Merged starts", and once that's settled "Episodes 1–8, until Merged". */
function spanWords(span, w) {
  // A12 part 2: a stage a format change starts (until its own end, when it has one), and the stage before it.
  if (span.from === null) {
    const start = w.fromChange || 'from a change of format';
    const endPhase0 = spanEndPhase(span);
    if (endPhase0) return `${start} until ${phaseWord(endPhase0, w)} starts`;
    return span.to === null ? start : `${start} to ${w.Part} ${spanEnd(span)}`;
  }
  if (w.untilChange && span.to === null) {
    const first = spanStart(span);
    const start = isObj(span.from) ? (first === null ? `from when ${phaseWord(span.from.phase, w)} starts ` : `${w.Part} ${first} `) : span.from === 1 ? '' : `${w.Part} ${span.from} `;
    return `${start}${typeof w.untilChange === 'string' ? w.untilChange : 'until the format changes'}`;
  }
  const endPhase = spanEndPhase(span);
  if (endPhase) {
    const name = phaseWord(endPhase, w);
    const first = spanStart(span);
    const last = spanEnd(span);
    const start = isObj(span.from) ? (first === null ? `from when ${phaseWord(span.from.phase, w)} starts` : `${w.Part} ${first}`) : span.from === 1 ? '' : `${w.Part} ${span.from}`;
    if (last !== null && first !== null) return last < first ? `never: ${name} came first` : last === first ? `just ${w.Part} ${first}, until ${name}` : `${w.Parts} ${first}–${last}, until ${name}`;
    return `${start ? `${start} ` : ''}until ${name} starts`;
  }
  if (isObj(span.from)) {
    const name = phaseWord(span.from.phase, w);
    const at = spanStart(span);
    const end = span.to === null ? ' to the finale' : ` to ${w.Part} ${span.to}`;
    return at === null ? `from when ${name} starts${span.to === null ? '' : end}` : `${w.Part} ${at}${end}, starting with ${name}`;
  }
  if (span.to === null) return span.from === 1 ? 'all season' : `${w.Part} ${span.from} to the finale`;
  return span.to === span.from ? `just ${w.Part} ${span.from}` : `${w.Parts} ${span.from}–${span.to}`;
}

/** "a" or "an": by its sound, so an initialism by its first letter's name ("an HR", "a TB"). */
const article = (word) => (/^[A-Z]{2,}/.test(word) ? /^[AEFHILMNORSX]/.test(word) : /^[aeiou]/i.test(word)) ? 'an' : 'a';
/** "5 a home run and 1 an assist". */
const statsWords = (points, w) => listOf(Object.entries(points).map(([k, p]) => {
  const label = w.stats.get(k) || k;
  return `${p} ${article(label)} ${label}`;
}));

const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
/**
 * L1 part 4a: a stats score in words: each stat's points, a position's own beside it ("6 a goal (10 for goalkeepers)"), each
 * place's ("by place: 25 for 1st and 8 for 4th–10th") and a bout's format's ("scheduled for 5 sets: 2 a game won").
 */
/** When lineups or picks lock (`what`): at each part's start, or (L3 part 2b, a sport's daily or weekly lock) at the day's or week's
 *  first start, for everything that day or week (impeccable clarify, 2026-11-06: a later game's lineup locks early with the rest). A
 *  part that's itself a calendar word (a slate's day, week or round) is its games. */
function lockRule(what, s, w) {
  const tail = 'Change yours as often as you like until then.';
  // L8 part 1's engine items, a lineup locking at each game's start (impeccable clarify, 2026-11-06: the one fact first, each person at
  // their own game; then what's still yours to change; then which lineup a game counts for).
  if (s.closes === 'game') return `Each ${w.castaway} locks when their game starts, for the rest of that day. Change the rest of your lineup as often as you like until theirs start: each game counts for whoever's in your lineup when it starts.`;
  if (s.closes !== 'daily' && s.closes !== 'weekly') return `${what} lock when the ${w.part} starts. ${tail}`;
  const span = s.closes === 'daily' ? 'day' : 'week';
  const one = ['day', 'week', 'round', 'gameweek', 'matchday'].includes(w.part) ? 'game' : w.part;
  return `${what} lock when the ${span}'s first ${one} starts, for every ${one} that ${span}. ${tail}`;
}
function statScoreWords(sc, w) {
  const flat = isObj(sc.points) ? sc.points : {};
  const pos = isObj(sc.byPosition) ? sc.byPosition : {};
  const label = (k) => w.stats.get(k) || k;
  const each = (p, k) => `${p} ${article(label(k))} ${label(k)}`;
  const out = [];
  for (const k of [...new Set([...Object.keys(flat), ...Object.keys(pos)])]) {
    const own = isObj(pos[k]) ? Object.entries(pos[k]).filter(([, p]) => p !== flat[k]).map(([g, p]) => `${p} for ${(w.positions.get(g) || g).toLowerCase()}`) : [];
    if (flat[k] !== undefined) out.push(own.length ? `${each(flat[k], k)} (${listOf(own)})` : each(flat[k], k));
    else if (own.length) out.push(`${article(label(k))} ${label(k)}: ${listOf(own)}`);
  }
  const words = [];
  if (out.length) words.push(listOf(out));
  for (const [k, t] of Object.entries(isObj(sc.byPlace) ? sc.byPlace : {})) {
    const at = Object.entries(t).map(([r, p]) => {
      const [a, b] = String(r).split('-');
      return `${p} for ${b === undefined ? nth(Number(a)) : `${nth(Number(a))}–${nth(Number(b))}`}`;
    });
    words.push(`by ${label(k)}: ${listOf(at)}`);
  }
  for (const [f, t] of Object.entries(isObj(sc.byFormat) ? sc.byFormat : {})) words.push(`scheduled for ${w.formats.get(f) || f}: ${statsWords(t, w)}`);
  return words.join('; ');
}

/** A question's words, or its id while it has none yet. */
const askOf = (q) => String(q.ask || q.id || 'A question').trim();
/** A moment by its words, as the show calls it (its id when the context doesn't say). */
const momentWord = (w) => (id) => {
  const m = Array.isArray(w && w.moments) ? w.moments.find((x) => x && x.id === id) : null;
  return m && m.label ? m.label.replace(/\.\s*$/, '').toLowerCase() : id;
};
/** C7: what a question on the card asks of each line, by how its moment settles it. */
const CARD_ASKS = { happened: 'whether it happens', count: 'how many times it happens', who: 'who does it', most: 'who does it most' };
/** C7: a question on the card as a phrase in a list: "whether each of the card's four moments happens". */
function cardPhrase(q, c) {
  const n = c && Number.isInteger(c.each) ? c.each : 0;
  const them = n === 1 ? "the card's moment" : `each of the card's ${say(n)} moments`;
  const take = isObj(q.settle) ? q.settle.take : null;
  if (take === 'who') return `who does ${them}`;
  if (take === 'most') return `who does ${them} most`;
  if (take === 'count') return `how many times ${them} happens`;
  return `whether ${them} happens`;
}
/** C7: the card itself, as the sentence and How it works say it: what it's drawn from and how. */
function cardSentence(c, w) {
  const list = c.of.map(momentWord(w));
  if (c.each >= c.of.length) return `Each ${w.part}'s card: ${listOf(list)}.`;
  // C7 part 2: a card the bot chooses (its words through impeccable's clarify, 2026-11-06).
  if (c.from === 'bot') {
    const late = c.fallback === 'void'
      ? `that ${w.part} has no card: nothing scores for it either way`
      : `it's the next ${say(c.each)} in turn`;
    return `Each ${w.part}'s card is ${say(c.each)} of ${listOf(list)}, picked by the AI from what's in play that ${w.part}. It's out by ${CARD_OUT_HOURS} hours before the ${w.part} airs. If the AI hasn't picked by then, ${late}.`;
  }
  return `Each ${w.part}'s card is the next ${say(c.each)} of ${listOf(list)}, in turn, so it's new each ${w.part}.`;
}
/** C7: the questions a ticket is built from, as the spec names them (a question on the card once, for all its lines). */
const legsOf = (q, all) => (isObj(q.settle) && Array.isArray(q.settle.of) ? q.settle.of : []).map((id) => all.find((x) => x.id === id)).filter(Boolean);
/** C7: a card's lines, as a ticket's legs are said. */
const cardLegs = (s) => {
  const c = s ? cardOf(s) : null;
  return c && Number.isInteger(c.each) ? `the card's ${say(c.each)} lines` : "the card's lines";
};
/** C7: a ticket's parts with a card's lines as its legs (the game's questions as they're answered: askOf). */
const ticketIn = (q, s) => ticketOf((s ? linesOf(s) : []).find((x) => x.id === q.id) || q);
/** A question as a phrase in a list: "who wins", "total points: over or under (237.5)". */
function questionPhrase(q) {
  const text = askOf(q).replace(/\?$/, '');
  const phrase = /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
  return q.answer === 'overUnder' && typeof q.line === 'number' ? `${phrase} (${q.line})` : phrase;
}

/** How many moments' points the spec changes from the rulebook's (its defaults for the draft's ownership), or null. A
 *  moment the rulebook switched off scores nothing whatever its points, so changing them changes nothing. */
function changedPoints(points, own, moments) {
  if (!isObj(points)) return 0;
  if (!moments) return null;
  const def = new Map(moments.filter((m) => !m.off).map((m) => [m.id, isObj(m.defaultPoints) ? m.defaultPoints[own === 'shared' ? 'shared' : 'exclusive'] || 0 : m.defaultPoints || 0]));
  return Object.entries(points).filter(([id, p]) => def.has(id) && def.get(id) !== p).length;
}

/** The preset's name, while the spec still plays the preset's game (the same parts); else null: "A game". Outlast in reverse
 *  (A9 part 2) is another game. */
function nameOf(s) {
  const p = presetOf(s);
  // A pool with lives ranked by who's still standing (A10 part 2) is still a Survival Pool; a draft's stock market ranked by worth
  // (part 3c) is still its draft's game.
  // A11 part 1: a draft that knocks players out is still its draft's game; part 4, one played head to head. C2 part 4b: a pool ranked
  // by its points, or head to head, is still a Survival Pool.
  // C5: weeks won too.
  const rank = p && (p.rank.by === s.rank.by || (s.score.by === 'survive' && (s.rank.by === 'standing' || s.rank.by === 'total' || s.rank.by === 'matchups' || s.rank.by === 'weeks')) || (s.get.by === 'draft' && (s.rank.by === 'worth' || s.rank.by === 'standing' || s.rank.by === 'matchups' || s.rank.by === 'weeks')));
  const same = p && p.get.by === s.get.by && countKind(p.count) === countKind(s.count) && p.score.by === s.score.by && rank && !s.score.reverse;
  return same ? PRESET_LABELS[s.preset] : null;
}

/** A multiplier in words (A9 part 2): "double", "triple", "half", "1.5 times". */
const timesWord = (x) => ({ 2: 'double', 3: 'triple', 4: 'quadruple', 0.5: 'half' })[x] || `${x} times`;
/** When a draft's points multiply (A9 part 2: score.times), as a phrase: "in the finale", "in Episode 7", "in Episodes 1–3",
 *  "from Episode 10 on", "in Merged". */
function whenPhrase(t, w) {
  if (!isObj(t)) return '';
  if (Number.isInteger(t.episode)) return `in ${w.Part} ${t.episode}`;
  if (Number.isInteger(t.from)) {
    if (t.to === undefined || t.to === null) return `from ${w.Part} ${t.from} on`;
    return t.to === t.from ? `in ${w.Part} ${t.from}` : `in ${w.Parts} ${t.from}–${t.to}`;
  }
  if (typeof t.phase === 'string') return `in ${phaseWord(t.phase, w)}`;
  return t.finale === true ? 'in the finale' : '';
}
/** "Points in the finale count double.", one for each window (A9 part 2). */
const timesRules = (sc, w) => (Array.isArray(sc.times) ? sc.times.filter(isObj) : []).map((t) => `Points ${whenPhrase(t, w)} count ${timesWord(t.times)}.`);
/** C3: a multiplier on how a holding joined, in words: "half", "a quarter", "in full", "double". */
const joinedWord = (x) => ({ 1: 'in full', 0.25: 'a quarter' })[x] || timesWord(x);
const JOINED_NOUN = { draft: ['', ''], pickup: ['pickup', 'pickups'], replacement: ['replacement', 'replacements'], swap: ['swap', 'swaps'] };
/**
 * C3: a draft's multipliers on how a holding joined (score.multiply), a sentence each: "Who you draft scores double.", "Pickups score
 * half.", "Your first replacement scores half, your second a quarter, and every one after that a quarter." (per slot: "On each spot
 * on your team, the first replacement scores half, ..."; then 'ratio': "each one after that half the one before"). Only what's
 * said (a spec still being made can have it half-written).
 */
function joinedRules(sc) {
  const list = Array.isArray(sc.multiply) ? sc.multiply.filter((m) => isObj(m) && JOINED_NOUN[m.joined]) : [];
  return list.map((m) => {
    const [one, many] = JOINED_NOUN[m.joined];
    if (m.joined === 'draft') return isNum(m.times) ? `Who you draft scores ${joinedWord(m.times)}.` : '';
    if (isNum(m.times)) return `${cap(many)} score ${joinedWord(m.times)}.`;
    if (!Array.isArray(m.times) || !m.times.length || !m.times.every(isNum)) return '';
    const slot = m.per === 'slot';
    const said = m.times.map((t, i) => (i === 0 ? `${slot ? 'the' : 'your'} ${NTH[i]} ${one} scores ${joinedWord(t)}` : `${slot ? 'the' : 'your'} ${NTH[i]} ${joinedWord(t)}`));
    const last = m.times[m.times.length - 1];
    const step = m.times.length > 1 ? last / m.times[m.times.length - 2] : last;
    const after = m.then === 'ratio' ? `each one after that ${joinedWord(Math.round(step * 1000) / 1000)} the one before` : `every one after that ${joinedWord(last)}`;
    const text = `${said.join(', ')}, and ${after}.`;
    return slot ? `On each spot on your team, ${text}` : cap(text);
  }).filter(Boolean);
}
/**
 * C4: ownership per holding, where a waiver move's isn't the draft's (an exclusive draft whose replacements or swaps are shared):
 * { replace, swap, replaces, swaps } (each shared move the waivers make on their own, and whether they make each), or null. Only
 * what the spec says.
 */
function sharedMoves(s) {
  const e = isObj(s.extras) ? s.extras.waivers : null;
  const made = waiverMoves(s);
  if (!made || !isObj(e.own) || !isObj(s.get) || s.get.own !== 'exclusive') return null;
  const replace = made.replaces && waiverOwnOf(s, 'replace') === 'shared';
  const swap = made.swaps && waiverOwnOf(s, 'swap') === 'shared';
  if (!replace && !swap) return null;
  return { replace, swap, ...made };
}
/** C4: the sentence's few words for it: ", replacements from anyone still in". */
function sharedMovesPhrase(m) {
  if (m.replace && m.swap) return ', pickups from anyone still in';
  return m.replace ? ', replacements from anyone still in' : ', swaps from anyone still in';
}
/** C4: How it works' rule for it ("Lose someone? Their replacement can be anyone still in, even a castaway on another team: ..."). */
function sharedMovesRule(m, w) {
  const anyone = `anyone still in, even a ${w.castaway} on another team: they're on both teams then.`;
  if (m.replace && m.swap) return `Anyone you pick up can be ${anyone}`;
  if (m.replace) return `Lose someone? Their replacement can be ${anyone}${m.swaps ? " A swap brings in only someone on nobody's team." : ''}`;
  return `A swap can bring in ${anyone}${m.replaces ? " A replacement is someone on nobody's team." : ''}`;
}
/** C3: what a multiplied holding counts, said once: an Outlast's what they earn while they're yours, not their whole place. */
const joinedHow = (sc) => (sc.by === 'place'
  ? `Each counts the boots they outlast while they're yours (one you drafted, their whole place), and keeps for you what they earned before you let them go.`
  : `Each counts what they score while they're yours.`);

function sentenceParts(s, w) {
  const parts = [];
  const put = (text, at) => parts.push({ text, at: at || null });
  const name = nameOf(s) || 'game';
  put(`${/^[AEIOU]/.test(name) ? 'An' : 'A'} ${name}`, 'preset');
  if (w.show) put(` for ${w.show}`, 'about');
  put(': ');
  const by = s.get.by;
  const count = countKind(s.count);
  const first = spanStart(s.span);
  const one = first !== null && s.span.to === first;
  let spanSaid = false;
  if (by === 'draft') {
    // A10 part 3: a draw deals the teams; a spread draft takes them across the show's groups. Part 3b: an auction's bids, a
    // salary cap.
    const budget = budgetParts(s);
    put(s.get.order === 'draw' ? `everyone gets ${s.get.each} drawn at random` : s.get.order === 'auction' ? `everyone ${budget ? `has ${budget.total} to bid` : 'bids'} on a team of ${s.get.each}` : `everyone drafts ${s.get.each}`, 'get');
    if (acrossOf(s)) put(` from across the ${w.group}s`, 'get');
    // Part 3c: a stock market buys and sells when its waiver windows open.
    if (budget && budget.trade && !budget.auction) put(` with ${budget.total} to spend`, 'get');
    else if (budget && !budget.auction) put(` under a salary cap of ${budget.total}`, 'get');
    if (budget && budget.trade) put(`, then buys and sells ${tradeWhen(s, w)}`, 'get');
    if (count === 'start') put(` and starts ${s.count.start} each ${w.part}`, 'count');
    // A9 part 2: a lineup's captain.
    if (count === 'start' && isObj(s.score.captain) && isNum(s.score.captain.times)) put(`, one of them a captain who scores ${timesWord(s.score.captain.times)}`, 'score');
    if (count === 'best') put(`, and their best ${s.count.best} count each ${w.part}`, 'count');
    // A10 part 1: group slots.
    const slots = groupSlotsOf(s);
    if (slots) put(`, plus ${slots.slots === 1 ? 'a slot' : `${say(slots.slots)} slots`} for a pair or team the show forms`, 'get');
    // A10 part 4: keepers from last season's game.
    const keep = keepParts(s);
    if (keep) put(keep.each === 1 ? `, keeping one of last season's team if they come back` : `, keeping up to ${say(keep.each)} of last season's team who come back`, 'get');
    // C4: an exclusive draft whose replacements (or swaps) are shared.
    const moves = sharedMoves(s);
    if (moves) put(sharedMovesPhrase(moves), 'extras');
    // C2 part 4c: its own questions beside the team.
    const asks = draftQuestions(s);
    if (asks.length) put(`, and answers ${say(asks.length)} ${asks.length === 1 ? 'question' : 'questions'} before ${askWhen(asks, w)}: ${listOf(asks.map(questionPhrase))}`, 'ask');
  } else if (by === 'pick' && momentsPick(s)) {
    // C5: a pick each episode, one or several, scored by what they do.
    const n = s.get.each;
    put(`everyone picks ${n === 1 ? `one ${w.castaway}` : `${say(n)} ${w.castaways}`} each ${w.part}`, 'get');
    if (s.get.repeat === 'never') put(', never the same one twice', 'get');
    if (s.get.repeat === 'cycle') put(", nobody again until they've used everyone still in", 'get');
  } else if (by === 'pick') {
    put(`everyone picks one ${w.castaway} to ${s.score.means === 'scores' ? 'score' : 'stay in'} each ${w.part}`, 'get');
    // A10 part 2: a second pick.
    const second = secondPickOf(s);
    if (second) put(second.fallback === 'counts' ? ', and a second' : ', and a second that counts when two go home', 'get');
    // A11 part 2: a pick that never repeats.
    if (poolOf(s).never) put(', never the same one twice', 'get');
  } else if (by === 'card') {
    put(`a new bingo card every ${w.part}`, 'get');
  } else if (by === 'squares') {
    // L4 part 2: squares, picked or dealt.
    const sq = squaresParts(s);
    const grid = sq ? `${sq.grid}-by-${sq.grid}` : '10-by-10';
    put(sq && sq.take === 'deal' ? `everyone is dealt squares at random on a ${grid} grid of the two scores' last digits` : `everyone takes squares on a ${grid} grid of the two scores' last digits`, 'get');
    if (sq && sq.take === 'pick' && sq.each) put(`, up to ${say(sq.each)} each`, 'get');
  } else if (s.score.by === 'answers' && callsAsk(s.ask)) {
    put(`two calls before every ${w.part}`, 'get');
  } else if (s.score.by === 'answers') {
    // C6 part 2: a ticket is built from the questions, said with the points (answersPhrases), not as one of them.
    const asks = s.ask.filter((q) => !isTicket(q));
    // C7: each line of the card a question.
    const card = cardOf(s);
    const n = asks.reduce((k, q) => k + questionLines(q, s), 0);
    put(`everyone answers ${say(n)} ${n === 1 ? 'question' : 'questions'} before ${one ? `${w.Part} ${first}` : askWhen(asks, w)}`, 'ask');
    if (n) put(`: ${listOf(asks.map((q) => (isCardQuestion(q) ? cardPhrase(q, card) : questionPhrase(q))))}`, 'ask');
    spanSaid = one;
  } else {
    put('nothing to pick', 'get');
  }
  if (!spanSaid) {
    put(', ');
    put(spanWords(s.span, w), 'span');
  }
  put('.');
  // C7: the card its questions are on, new each episode (one the moments that count are on: countRules).
  const lined = cardOf(s);
  if (lined && lined.of.length && Number.isInteger(lined.each) && s.ask.some(isCardQuestion)) put(` ${cardSentence(lined, w)}`, 'ask');
  const rules = w.show ? `${w.show}'s rules` : "the show's rules";
  const sc = s.score;
  if (sc.by === 'moments') {
    const changed = changedPoints(sc.points, s.get.own, w.moments);
    put(changed === null ? ` Scored by ${rules}, with the game's own points.` : changed ? ` Scored by ${rules}, with ${say(changed)} ${changed === 1 ? "moment's" : "moments'"} points changed.` : ` Scored by ${rules}.`, 'score');
    // C5: only these moments count, and hits counted.
    for (const rule of countRules(sc, w, cardOf(s))) put(` ${rule}`, 'score');
    // A9 part 2: when the points multiply.
    for (const rule of timesRules(sc, w)) put(` ${rule}`, 'score');
    // C3: how a holding joined.
    for (const rule of joinedRules(sc)) put(` ${rule}`, 'score');
  } else if (sc.by === 'place' && sc.reverse === true) put(' Each scores more the earlier they go home: the first one out carries you.', 'score');
  else if (sc.by === 'place') {
    put(' Each scores by how long they last: the last one standing carries you.', 'score');
    // C3: how a holding joined.
    for (const rule of joinedRules(sc)) put(` ${rule}`, 'score');
  }
  else if (sc.by === 'survive') {
    // A10 part 2: lives, a buyback, mulligans; last one standing.
    for (const said of poolPhrases(s, w)) put(` ${said}`, 'score');
    // C2 part 4b: ranked by its points, or head to head on them: what a right pick is worth (who wins is said with the rank, below).
    if (poolByPoints(s)) put(` ${isNum(sc.points) && sc.points !== 1 ? cap(pointsWord(sc.points)) : 'A point'} for each right pick.`, 'score');
    else put(s.rank.by === 'standing' ? ' Last one standing wins.' : ' Longest streak wins.', 'rank');
    // A11 part 2: last one standing's end, as far as the spec says it.
    const { oneLeft, allOut } = poolOf(s);
    if (oneLeft === 'ends') put(" Once one of you is left, it's over.", 'rank');
    if (allOut === 'share') put(' If everyone left goes out together, they share the win.', 'rank');
    if (allOut === 'back') put(" If everyone left goes out together, they're all back in.", 'rank');
  }
  else if (sc.by === 'answers' && callsAsk(s.ask)) put(' Most right by the finale wins.', 'score');
  else if (sc.by === 'lines') put(isNum(sc.points) && sc.points !== 1 ? ` ${cap(pointsWord(sc.points))} a line; most points by the finale wins.` : ' Most lines by the finale wins.', 'score');
  else if (sc.by === 'stats' && categoryParts(s)) put(` ${categoryPhrase(categoryParts(s), w)}`, 'score');
  else if (sc.by === 'squares' && squaresParts(s)) put(` ${squaresPayPhrase(squaresParts(s), w)} Most points wins.`, 'score');
  else if (sc.by === 'stats' && statScoreWords(sc, w)) put(` Scored ${statScoreWords(sc, w)}.`, 'score');
  else if (sc.by === 'answers') answersPhrases(s.ask, parlaysOf(sc), put, bankOf(s), s);
  // C2 part 4c: a draft's own questions, their points beside the team's.
  if (by === 'draft' && draftQuestions(s).length) answersPhrases(draftQuestions(s), [], (text) => put(text, 'ask'));
  // A11 part 5: teams of players (head to head between them, when it's that); C2 part 4b: said first when they're knocked out or race.
  const teams = teamParts(s);
  const teamsOut = !!teams && !!knockoutParts(s);
  if (teamsOut) put(` ${teamPhrase(teams)}`, 'rank');
  // A11 part 1: a draft's cuts and race.
  for (const said of knockoutPhrases(s, w)) put(` ${said}`, 'rank');
  // A10 part 3c: a stock market ranked by worth.
  // A11 part 4: head to head, with its playoffs (a sports spec's, which the engine doesn't play yet: just its name).
  const h2h = matchupParts(s);
  if (teams && !teamsOut) put(` ${teamPhrase(teams)}`, 'rank');
  // A11 part 5b: a handicap.
  const handicap = handicapParts(s);
  if (handicap) put(` ${handicapPhrase(handicap, w)}`, 'rank');
  // C2 part 4b: a pool ranked by its points says who wins (its teams say it themselves).
  const cats = categoryParts(s);
  // C5: weeks won.
  const weeks = weekParts(s);
  const rank = cats ? ` ${categoryRankPhrase(cats, w)}` : h2h ? ` ${matchupPhrase(h2h, w, !!teams)}` : weeks ? ` ${weekPhrase(weeks, w, !!teams)}` : (poolByPoints(s) || momentsPick(s)) && !teams ? ' Most points wins.' : { worth: " Most worth wins: cash plus the team at today's prices.", matchups: ' Played head to head.', categories: ' Ranked by category.', roto: ' Ranked roto-style.' }[s.rank.by];
  if (rank) put(rank, 'rank');
  // A10 part 4b: a team two people share.
  if (seatPeople(s) > 1) put(` Up to ${say(seatPeople(s))} of you can share a team.`, 'extras');
  return parts;
}

/** When a game's questions are answered, as its sentence says it (A7's windows: every few episodes, or once a phase, when nothing's
 *  asked every episode): "each episode", "every two episodes", "each phase", "the finale", "it starts". */
function askWhen(ask, w) {
  const every = ask.find((q) => q.asked === 'every');
  if (ask.some((q) => q.asked === 'each')) return `each ${w.part}`;
  if (every) return `every ${say(every.every)} ${w.parts}`;
  if (ask.some((q) => q.asked === 'phase')) return 'each phase';
  return ask.length && ask.every((q) => q.closes === 'finale') ? 'the finale' : 'it starts';
}
/** C6, money: what every stake of a game's questions is, as its sentence says it: how much (up to a number, any of your points or of
 *  your bank, `bank`) and what a right one pays (even money: double or nothing; the pool: a share of the wrong stakes). */
function stakeWords(ask, bank) {
  const w0 = ask[0].wager;
  const same = ask.every((q) => q.wager === w0);
  const stake = same ? (w0 === 'total' ? `any of your ${bank ? 'bank' : 'points'}` : `up to ${pointsWord(w0)}${bank ? ' of your bank' : ''}`) : bank ? 'from your bank' : 'points';
  const pool = ask.filter((q) => q.odds === 'pool').length;
  const pays = !pool ? 'double or nothing' : pool === ask.length ? 'right, a share of the wrong stakes; wrong, you lose it' : 'double or nothing, or a share of the wrong stakes';
  return `Stake ${stake} on ${ask.length === 1 ? 'it' : 'each'}: ${pays}.`;
}
/** C6 part 2: a ticket's stake ("any of your bank", "up to 20 points") and what it pays for each number of legs right ("3 times your
 *  stake for two, 7 for three"). */
function ticketStake(q, bank) {
  return Number.isInteger(q.wager) ? `up to ${pointsWord(q.wager)}${bank ? ' of your bank' : ''}` : `any of your ${bank ? 'bank' : 'points'}`;
}
function ticketPays(t) {
  return t.payouts.map((x, i) => `${x} ${i === 0 ? `times your stake for ${say(t.min + i)}` : `for ${say(t.min + i)}`}`).join(', ');
}
/** C6 part 2: a ticket as the sentence says it: what it's built from, how many legs, the stake and what it pays. */
function ticketWords(q, all, bank, s) {
  const t = ticketIn(q, s);
  const legs = legsOf(q, all).map((x) => (isCardQuestion(x) ? cardLegs(s) : questionPhrase(x)));
  const many = t.min === t.max ? say(t.min) : `${say(t.min)} to ${say(t.max)}`;
  return `Build a ticket from ${listOf(legs)}: put ${many} of your calls on it and stake ${ticketStake(q, bank)}; all of them right wins ${ticketPays(t)}.`;
}
/** C6 part 2: a ticket as How it works says it, with its fallbacks. */
function ticketRule(q, all, bank, s) {
  const t = ticketIn(q, s);
  const legs = legsOf(q, all).map((x) => (isCardQuestion(x) ? cardLegs(s) : `"${askOf(x)}"`));
  const many = t.min === t.max ? say(t.min) : `${say(t.min)} to ${say(t.max)}`;
  return `Build a ticket: from ${listOf(legs)}, put ${many} of your answers on it and stake ${ticketStake(q, bank)} on all of them being right. All right, you win ${ticketPays(t)}; one wrong, or left blank, you lose your stake. A leg that doesn't count drops out and the ticket rides on the rest (none left: your stake back).`;
}
/** What a game's questions earn, as its sentence says it (`ask`: a game of questions', or a draft's own, C2 part 4c), each phrase
 *  through `put`: their points, A9's ways of combining as far as they're all of them's, the bot's call, a rollover, a shrinking call
 *  and the parlays. C6: every stake (stakeWords), said after a share it goes beside, and a bank (`bank`: bankOf's, or null). */
function answersPhrases(given, parlays, put, bank, s) {
  // C6 part 2: a ticket is said on its own, after the questions' points and stakes.
  const ask = given.filter((q) => !isTicket(q));
  const tickets = given.filter(isTicket);
  const pts = [...new Set(ask.map((q) => q.points))];
  const all = (f) => ask.length > 0 && ask.every(f);
  const some = (f) => ask.some(f);
  const each = pts.length === 1 ? `${pts[0] === 1 ? 'A point' : pointsWord(pts[0])}` : 'Points';
  // A9's ways of combining, as far as they're the whole game's.
  let said = ` ${each} for each right answer.`;
  // A14 part 1: the players' own answers settle every one, the same way.
  if (all((q) => isPlayers(q) && q.settle.take === ask[0].settle.take && q.share === undefined && q.wager === undefined)) said = ` ${each} when yours is the answer ${ask[0].settle.take === 'minority' ? 'fewest' : 'most'} of you give.`;
  // A14 part 2: every one played against the bot's own call.
  else if (all((q) => isBeat(q) && q.share === undefined)) said = ` ${each} when you're right and the bot isn't.`;
  // C2 part 4: a pot whose calls shrink is each one's worth, split: at most its points.
  else if (all((q) => q.share === 'split')) said = some((q) => isObj(q.shrink)) ? ` ${each} at most, split between everyone right.` : ` ${each} each time, split between everyone right.`;
  else if (all((q) => q.share === 'only')) said = ` ${each} for a right answer nobody else has.`;
  // A wager's stake, when nothing above said how the points go (C6: else after it, below).
  const staked = all((q) => q.wager !== undefined);
  const stakeSaid = staked && said === ` ${each} for each right answer.`;
  if (stakeSaid) said = `${pts.length === 1 && pts[0] === 0 ? '' : said} ${stakeWords(ask, bank)}`;
  put(said, 'score');
  // C6: a stake beside a share, its own after it; a bank everyone starts with.
  if (staked && !stakeSaid) put(` ${stakeWords(ask, bank)}`, 'score');
  for (const t of tickets) put(` ${ticketWords(t, given, bank, s)}`, 'score');
  if (bank) put(` Everyone starts with a bank of ${pointsWord(bank.start)}.${bank.out ? " Run out and you're out." : ''}`, 'score');
  // A14 part 2: some of them played against the bot (or all, sharing their points): the bot makes its call too.
  if (some(isBeat) && !all((q) => isBeat(q) && q.share === undefined)) {
    put(all(isBeat) ? " Only when the bot's call isn't right." : ` On ${listOf(ask.filter(isBeat).map(questionPhrase))}, only when the bot's call isn't right.`, 'score');
  }
  if (some((q) => q.rollover)) put(" If nobody's right, the points roll over.", 'score');
  if (some((q) => isObj(q.shrink))) put(some((q) => isObj(q.shrink) && q.shrink.per === 'change') ? ' Changing your call once it starts costs points.' : " The earlier you call it, the more it's worth.", 'score');
  for (const p of parlays) {
    const legs = p.of.map((id) => ask.find((q) => q.id === id)).filter(Boolean).map(questionPhrase);
    put(` Right on ${listOf(legs)} together: ${{ 2: 'double', 3: 'triple', 4: 'quadruple' }[p.times] || `${p.times} times`} the points.`, 'score');
  }
}
/** When a question is asked, as How it works says it (A7's windows too). */
function whenWords(q, w, each) {
  if (q.asked === 'each') return Number.isInteger(q.over) && q.over > 1 ? `Before each ${w.part}, about it and the next ${say(q.over - 1)}: ` : `Before each ${w.part}: `;
  if (q.asked === 'every') return `Every ${say(q.every)} ${w.parts}, before the first: `;
  if (q.asked === 'phase') return 'Once a phase, as it begins: ';
  return q.closes === 'finale' ? 'Before the finale: ' : each ? 'Before it starts: ' : '';
}
/** One question as How it works says it: when it's asked, what it is, and what a right answer earns. */
function questionRule(q, w, each, ask, bank, s) {
  // C6 part 2: a ticket, its own rule.
  if (isTicket(q)) return `${whenWords(q, w, each)}${ticketRule(q, ask, bank, s)}`;
  const when = whenWords(q, w, each);
  const pts = typeof q.points === 'number' ? q.points : null;
  let earn = pts === null ? '' : ` ${cap(pointsWord(pts))} if you're right.`;
  if (NAMES.includes(q.answer) && q.pick > 1 && pts !== null) earn = ` Name ${say(q.pick)}: ${pointsWord(pts)} for each one right.`;
  if (q.answer === 'number' && pts !== null) earn = ` The closest wins ${pointsWord(pts)}.`;
  // A8's answers.
  if (pts !== null) {
    if (q.answer === 'order') earn = ` Put ${say(q.pick)} in order: ${pointsWord(pts)} for each in its place${q.within ? `, or within ${say(q.within)} ${q.within === 1 ? 'place' : 'places'} of it` : ''}.`;
    if (q.answer === 'confidence') earn = ` Rank ${say(q.pick)}, the one you're surest of first: each one right scores ${pointsWord(pts)} times its rank from the bottom (${q.pick} for the first).`;
    if (q.answer === 'chips') earn = ` Spread ${say(q.chips)} chips: ${pointsWord(pts)} for each chip on someone right.`;
    if (q.answer === 'split') earn = ` ${cap(pointsWord(pts))} for the split exactly.`;
    if (q.answer === 'pairs') earn = ` ${cap(say(q.pairs))} ${q.pairs === 1 ? 'pair' : 'pairs'}, the same for everyone: ${pointsWord(pts)} for each one you call.`;
    // A13: the round of trivia before each one, about the one before it.
    if (q.answer === 'trivia') earn = ` A few questions about the ${w.part} before it and the season so far, the same for everyone: ${pointsWord(pts)} for each one right.`;
    // L4 part 2: a draw's bracket.
    if (q.answer === 'bracket') {
      const of = isObj(q.settle) && typeof q.settle.of === 'string' ? w.draws.get(q.settle.of) || q.settle.of : null;
      const draw = of ? `the ${of.charAt(0).toLowerCase()}${of.slice(1)} draw` : 'the draw';
      earn = q.rounds === 'same'
        ? ` Pick the winner of every match of ${draw}, round by round to the final: ${pointsWord(pts)} for each one right.`
        : ` Pick the winner of every match of ${draw}, round by round to the final: ${pointsWord(pts)} for each one right in the first round, doubling each round after it.`;
    }
  }
  // A14 part 2: played against the bot's own call, and its fallback (an episode fact's own, below, still said).
  if (isBeat(q) && pts !== null) earn = beatWords(q, pts);
  // A13 part 2: an episode fact's fallback, void.
  if (isObj(q.settle) && q.settle.by === 'fact') earn += " If research can't say for sure, or it's nobody you could pick, it doesn't count either way.";
  // A14 part 1: the players' own answers settle it, and its fallbacks.
  if (isPlayers(q) && pts !== null) earn = playersWords(q, pts, ask);
  // A question about each person (A6): an answer for each of them, each graded on its own.
  // L3 part 2f part 2: or each game of the episode, each pick graded on its own game; confidence, each right pick worth its rank.
  if (q.each === 'game' && pts !== null) {
    earn = q.confidence === true
      ? ` Answer for each game of the ${w.part}, and rank your picks by how sure you are: the surest worth as many as there are games, the least sure 1. Each one right scores ${pts === 1 ? 'its rank' : `its rank times ${pointsWord(pts)}`}.`
      : q.answer === 'number'
        ? ` Answer for each game of the ${w.part}: the closest on each wins ${pointsWord(pts)}.`
        : ` Answer for each game of the ${w.part}: ${pointsWord(pts)} for each one right.`;
  } else if (q.each && pts !== null) {
    earn = q.answer === 'number'
      ? ` Answer for each ${w.castaway} still in: the closest on each wins ${pointsWord(pts)}.`
      : ` Answer for each ${w.castaway} still in: ${pointsWord(pts)} for each one right.`;
  }
  const line = q.answer === 'overUnder' && typeof q.line === 'number' ? ` The line is ${q.line}.` : '';
  const from = q.answer === 'person' && q.from === 'team' ? ' From your own team.' : '';
  // A wager (A8): its stake, double or nothing; A9's, any of your points. C6: of your bank, at the pool's odds, and apart from a share,
  // a rollover or a shrink.
  let wager = '';
  if (q.wager !== undefined) {
    const what = Number.isInteger(q.wager) ? `up to ${pointsWord(q.wager)}${bank ? ' of your bank' : ''}` : `any of your ${bank ? 'bank' : 'points'}`;
    const pays = q.odds === 'pool'
      ? " right, you take a share of the wrong stakes, by how much you staked; wrong, you lose it. If nobody's right, every stake comes back."
      : ' right, you win them too; wrong, you lose them.';
    wager = ` Stake ${what} on it:${pays}`;
  }
  const apart = q.wager !== undefined && (q.share !== undefined || q.rollover || isObj(q.shrink)) ? " Your stake stays yours: it isn't shared, carried over or shrunk." : '';
  // C7: a question on the card, asked for each of its lines.
  const c = isCardQuestion(q) && s ? cardOf(s) : null;
  const ended = /[.?!]$/.test(askOf(q));
  const lined = c && Number.isInteger(c.each) ? `${ended ? ' For' : ': for'} each of the ${c.each === 1 ? 'moment' : `${say(c.each)} moments`} on that ${w.part}'s card, ${CARD_ASKS[q.settle && q.settle.take] || CARD_ASKS.happened}: each its own question.` : '';
  return `${when}${askOf(q)}${lined}${line}${from}${earn}${wager}${combineWords(q, w)}${apart}`;
}
/** A14 part 1: what a question the players settle earns, as How it works says it: the answer most (or fewest) of you give, to it or
 *  to the question it's about (`of`, among the game's `ask`), and when it doesn't count. */
function playersWords(q, pts, ask) {
  const st = q.settle;
  const of = st.of && Array.isArray(ask) ? ask.find((x) => isObj(x) && x.id === st.of) : null;
  const most = st.take === 'minority' ? 'fewest' : 'most';
  const what = of ? `what ${most} of you answer to "${askOf(of)}"` : `the answer ${most} of you give`;
  const tie = st.tie === 'all' ? ' A tie: each of them counts.' : " A tie doesn't count either way.";
  const none = st.take === 'minority' ? 'If you all say the same, or fewer than two of you answer,' : 'If fewer than two of you answer,';
  return ` ${cap(pointsWord(pts))} if yours is ${what}.${tie} ${none} it doesn't count either way.`;
}
/** A14 part 2: what a question played against the bot earns, as How it works says it: when you're right and the bot isn't, and what a
 *  window the bot made no call for does. */
function beatWords(q, pts) {
  let earn = ` ${cap(pointsWord(pts))} if you're right and it isn't.`;
  if (NAMES.includes(q.answer) && q.pick > 1) earn = ` Name ${say(q.pick)}: ${pointsWord(pts)} for each one right that the bot didn't name.`;
  if (q.answer === 'number') earn = ` The closest wins ${pointsWord(pts)}, if closer than the bot.`;
  const none = q.beat.none === 'void' ? " If the bot makes no call, it doesn't count either way." : ' If the bot makes no call, it plays as usual.';
  return ` The bot makes its call too, before it locks.${earn}${none}`;
}
/** How a question's points combine (A9), as How it works says it. */
function combineWords(q, w) {
  let out = '';
  // C2 part 4: a shrinking call that's split, each right call at what it was worth when it was made, then shared.
  const shared = q.share === 'split' && isObj(q.shrink);
  if (q.share === 'split' && !shared) out += ' The points are a pot, split between everyone who gets it right: the fewer of you, the more each gets.';
  // A person or group answer counts each pick on its own (A9 part 2).
  if (q.share === 'only') out += NAMES.includes(q.answer) && !q.each ? ' A right pick only scores if nobody else named it.' : " It only scores if you're the only one who gets it right.";
  if (q.rollover) out += ` If nobody gets it, its points roll over to the next one.`;
  if (isObj(q.shrink)) {
    const less = q.shrink.per === 'change'
      ? ` Once it's started, each change costs ${pointsWord(q.shrink.points)}`
      : ` It's worth ${pointsWord(q.shrink.points)} less for each ${w.part} that's started when you make or change it`;
    const then = shared ? ", and it's shared: what your call is worth is split between everyone who gets it right." : q.shrink.per === 'change' ? '.' : ": the earlier you call it, the more it's worth.";
    out += `${less}${then}`;
  }
  return out;
}

/** A draft's cut in words (A11 part 1), as a sentence: "Each episode the lowest scorer is out.", "Every two episodes the two
 *  lowest over them are out.", "After Episode 6 the bottom half is cut.", "Before Merged starts the bottom two are cut." */
function cutPhrase(c, w, teams) {
  // C2 part 4b: a cut of teams of players (`teams`), on the teams' points.
  const many = c.out === 'half' ? `the bottom half${teams ? ' of the teams' : ''}` : c.out === 1 ? null : `the bottom ${say(c.out)}${teams ? ' teams' : ''}`;
  if (Number.isInteger(c.at.every)) {
    const when = c.at.every === 1 ? `Each ${w.part}` : `Every ${say(c.at.every)} ${w.parts}`;
    const over = c.at.every === 1 ? '' : ' over them';
    if (c.out === 'half') return `${when} the bottom half${teams ? ' of the teams' : ''} by their points${over} are out.`;
    if (teams) return c.out === 1 ? `${when} the lowest-scoring team${over} is out.` : `${when} the ${say(c.out)} lowest-scoring teams${over} are out.`;
    return c.out === 1 ? `${when} the lowest scorer${over} is out.` : `${when} the ${say(c.out)} lowest scorers${over} are out.`;
  }
  const when = Number.isInteger(c.at.episode) ? `After ${w.Part} ${c.at.episode}` : `Before ${phaseWord(c.at.phase, w)} starts`;
  return `${when} ${many || (teams ? 'the lowest team on points' : 'the lowest on points')} ${c.out === 1 || c.out === 'half' ? 'is' : 'are'} cut.`;
}
/** The sentence's words for a draft's race and cuts (A11 part 1), and a game of questions' with its lives (part 2b). */
function knockoutPhrases(s, w) {
  const a = answerParts(s);
  const k = knockoutParts(s) || a;
  if (!k) return [];
  // A11 part 3: co-op, the couch's lives together.
  if (a && a.coop) return coopPhrases(s, a);
  const out = [];
  // C2 part 4b: a draft's teams of players knocked out, or racing.
  const teams = !a && !!teamParts(s);
  if (a && a.lives) out.push(`${cap(say(a.lives))} ${a.lives === 1 ? 'life' : 'lives'}: a wrong answer${livesWhich(s, a)}, or none, costs one.`);
  out.push(...k.cuts.map((c) => cutPhrase(c, w, teams)));
  if (k.race) out.push(`${teams ? 'The first team' : 'First'} to ${pointsWord(k.race.to)} wins: the game ends there.`);
  else if (k.cuts.length || (a && a.lives) || (a && a.broke && s.rank.by === 'standing')) out.push(teams ? 'Last team standing wins.' : 'Last one standing wins.');
  // A11 part 2b: a game of questions' end, where it isn't the default.
  if (a && a.oneLeft === 'plays') out.push('With one of you left it plays on.');
  if (a && a.allOut === 'share') out.push('If everyone left goes out together, they share the win.');
  if (a && a.allOut === 'back') out.push("If everyone left goes out together, they're all back in.");
  return out;
}
/** A11 part 3: who has to get a question right for a co-op night to cost nothing, in words: "none of you gets it right" is what
 *  costs one with saves 'one'. `it`: the question, or "it". */
const coopMiss = (saves, it) => ({ one: `none of you gets ${it} right`, most: `half or more of you get ${it} wrong`, all: `any of you gets ${it} wrong` })[saves];
/** The sentence's words for co-op (A11 part 3): "Together you have five lives: each time none of you gets it right, you lose one.
 *  Keep one to the end and you all win." */
function coopPhrases(s, a) {
  const asks = livesAsks(s, a);
  const it = asks ? listOf(asks) : 'it';
  return [
    `Together you have ${say(a.lives)} ${a.lives === 1 ? 'life' : 'lives'}: each time ${coopMiss(a.coop.saves, it)}, you lose one.`,
    'Keep one to the end and you all win.',
  ];
}
/** How co-op works (A11 part 3), a rule a line, as the engine plays it (AnswerLogic.walk's co-op); its last line says who wins. */
function coopRules(s, a, w) {
  const asks = livesAsks(s, a);
  const which = asks ? ` (${listOf(asks)})` : '';
  const saves = { one: 'one of you gets it right', most: 'more than half of you who answered get it right', all: 'everyone who answered gets it right' }[a.coop.saves];
  return [
    `You play together, against the show: ${say(a.lives)} ${a.lives === 1 ? 'life' : 'lives'} for all of you, not each. A question asked each ${w.part}${which} costs one once it's settled, unless ${saves}.`,
    `Not answering doesn't count against you, but ${article(w.part)} ${w.part} nobody answers costs one.`,
    `${cap(article(w.part))} ${w.part} where it doesn't count (nobody went home, or nothing settles it) costs nothing.`,
    'Right answers still earn their points, so the table shows who called the most.',
    `Nobody is knocked out: lose the last life and you all lose, there and then; reach the end with one left and you all win.`,
    `A life waits for ${article(w.part)} ${w.part}'s answers to be settled.`,
  ];
}
/** The questions a life rides on as quoted asks, or null when it's every one asked each episode about it alone. */
function livesAsks(s, a) {
  const all = s.ask.filter(lifeRides).map((q) => q.id);
  if (a.on.length === all.length && a.on.every((id) => all.includes(id))) return null;
  const asks = a.on.map((id) => s.ask.find((q) => q.id === id)).filter(Boolean).map((q) => `"${q.ask}"`);
  return asks.length ? asks : null;
}
/** Which questions a life rides on, as a phrase (A11 part 2b): "" when it's every one asked each episode, else ' to "Who wins the
 *  elimination?"'. */
function livesWhich(s, a) {
  const asks = livesAsks(s, a);
  return asks ? ` to ${listOf(asks)}` : '';
}
/** How a game of questions' race, cuts and lives work (A11 part 2b), a rule a line, as the engine plays them (AnswerLogic.walk);
 *  its last line says who wins. */
function answerKnockoutRules(s, w) {
  const a = answerParts(s);
  if (a.coop) return coopRules(s, a, w);
  const out = [];
  if (a.lives) {
    const which = livesWhich(s, a);
    out.push(`You have ${say(a.lives)} ${a.lives === 1 ? 'life' : 'lives'}: a wrong answer${which || ` to a question asked each ${w.part}`}, or none, costs one once it's settled. At none you're out.`);
    out.push(`${cap(article(w.part))} ${w.part} where it doesn't count (nobody went home, or nothing settles it) costs nobody a life.`);
  }
  for (const c of a.cuts) {
    let rule = cutPhrase(c, w);
    if (Number.isInteger(c.at.every)) rule += ' A tie on those points goes to whoever has fewer in all.';
    rule += c.tie === 'all' ? ' Tied at the line, you all go, unless that would be everyone left.' : ' Tied at the line, nobody tied there goes.';
    if (c.quiet === 'skip') rule += ` ${cap(article(w.part))} ${w.part} nobody goes home has no cut.`;
    out.push(rule);
  }
  // C6: a bank at zero that's out (ranked by its points, or last one standing).
  const standing = !!(a.lives || a.cuts.length || (a.broke && s.rank.by === 'standing'));
  if (a.broke && !standing) out.push(`Once you're out you answer nothing more: your bank stays empty. ${a.oneLeft === 'plays' ? 'With one of you left it plays on to the end.' : "Once one of you is left, or none, it's over."}`);
  if (standing) {
    out.push("Once you're out you answer nothing more and score nothing more: your points stay where they were.");
    out.push(`Last one standing wins: whoever's still in by their points, then whoever went out last. ${a.oneLeft === 'plays' ? 'With one of you left it plays on to the end, their points still growing.' : "Once one of you is left, or none, it's over."}`);
    if (a.allOut === 'share') out.push(`If everyone still in goes out the same ${w.part}, you're all out and share the win, whatever your points.`);
    if (a.allOut === 'back') out.push(`If everyone still in goes out the same ${w.part}, you're all back in for the next, with the lives you had.`);
  }
  if (a.race) out.push(`First to ${pointsWord(a.race.to)} wins: the game ends after that ${w.part}, and the most points then win (a tie shares it). If nobody gets there, the most points at the end win.`);
  else if (!standing) out.push('Most points wins.');
  out.push(`A life, a cut${a.broke ? ', running out' : ''} or a finish waits for ${article(w.part)} ${w.part}'s answers to be settled.`);
  return out;
}
/** How a draft's race and cuts work (A11 part 1), a rule a line, as the engine plays them (KnockoutLogic). */
function knockoutRules(s, w) {
  const k = knockoutParts(s);
  if (!k) return [];
  // C2 part 4b: teams of players knocked out (on the teams' points), or racing.
  if (teamParts(s)) return teamKnockoutRules(s, w, k);
  const out = [];
  for (const c of k.cuts) {
    let rule = cutPhrase(c, w);
    if (Number.isInteger(c.at.every)) rule += ' A tie on those points goes to whoever has fewer in all.';
    rule += c.tie === 'all' ? ' Tied at the line, you all go, unless that would be everyone left.' : ' Tied at the line, nobody tied there goes.';
    if (c.quiet === 'skip') rule += ` ${cap(article(w.part))} ${w.part} nobody goes home has no cut.`;
    out.push(rule);
  }
  if (k.cuts.length) {
    out.push(`Once you're out you score nothing more and make no more moves: your points stay where they were.${s.get.own === 'exclusive' ? ` Your ${w.castaways} go back in the pool for everyone else.` : ''}`);
    // A11 part 2: or it plays on to its end with one left (oneLeft 'plays').
    out.push(`Last one standing wins: whoever's still in by their points, then whoever went out last. ${k.oneLeft === 'plays' ? 'With one of you left it plays on to the end, their points still growing.' : "Once one of you is left, it's over."}`);
    out.push("Nobody new joins once someone's out.");
  }
  if (k.race) out.push(`First to ${pointsWord(k.race.to)} wins: the game ends after that ${w.part}, and the most points then win (a tie shares it). If nobody gets there, the most points at the end win.`);
  out.push(`A cut or a finish waits for ${article(w.part)} ${w.part}'s full results.`);
  return out;
}
/** C2 part 4b: how a draft's teams of players knocked out or racing work, a rule a line, as the engine plays them
 *  (KnockoutLogic.teamWalk): the cuts and the race on the teams' points, everyone on a team out with it. */
function teamKnockoutRules(s, w, k) {
  const out = [];
  for (const c of k.cuts) {
    let rule = cutPhrase(c, w, true);
    if (Number.isInteger(c.at.every)) rule += ' A tie on those points goes to whichever team has fewer in all.';
    rule += c.tie === 'all' ? ' Tied at the line, they all go, unless that would be every team left.' : ' Tied at the line, no team tied there goes.';
    if (c.quiet === 'skip') rule += ` ${cap(article(w.part))} ${w.part} nobody goes home has no cut.`;
    out.push(rule);
  }
  if (k.cuts.length) {
    out.push(`Once your team is out, everyone on it scores nothing more and makes no more moves: its points stay where they were.${s.get.own === 'exclusive' ? ` Its ${w.castaways} go back in the pool for everyone else.` : ''}`);
    out.push(`Last team standing wins: whichever's still in by its points, then whichever went out last. ${k.oneLeft === 'plays' ? 'With one team left it plays on to the end, its points still growing.' : "Once one team is left, it's over."}`);
    out.push("Nobody new joins once a team's out, and nobody moves onto one.");
  }
  if (k.race) out.push(`The first team to ${pointsWord(k.race.to)} wins: the game ends after that ${w.part}, and the team with the most points then wins (a tie shares it). If no team gets there, the most points at the end win.`);
  out.push(`A cut or a finish waits for ${article(w.part)} ${w.part}'s full results.`);
  return out;
}

/** Where head to head's playoffs are (A11 part 4), as a phrase: "the last two episodes", "from Episode 11". */
const playoffWhen = (p, w) => (p.from !== null ? `from ${w.Part} ${p.from}` : p.rounds === 1 ? `the last ${w.part}` : `the last ${say(p.rounds)} ${w.parts}`);
/** The sentence's words for head to head (A11 part 4): "Each episode you play one of the others head to head: more points wins it.
 *  The top four by wins make the playoffs, over the last two episodes." */
function matchupPhrase(h, w, teams) {
  // A11 part 5: between teams of players, your team plays another.
  const play = teams ? `Each ${w.part} your team plays another head to head: more points wins it.` : `Each ${w.part} you play one of the others head to head: more points wins it.`;
  if (!h.playoffs) return `${play} Most wins at the end wins.`;
  const p = h.playoffs;
  return `${play} The top ${say(p.teams)}${teams ? ' teams' : ''} by wins make the playoffs, ${p.from !== null ? playoffWhen(p, w) : `over ${playoffWhen(p, w)}`}.`;
}
/** Head to head's playoffs as a rule (A11 part 4; L4 part 1b's by categories): who makes them, when, a round a part, `how` a game
 *  is won, and the byes. */
function playoffRule(p, w, teams, how) {
  const byes = 2 ** p.rounds - p.teams;
  return `The playoffs: the top ${say(p.teams)}${teams ? ' teams' : ''} in the standings, ${p.from !== null ? '' : 'over '}${playoffWhen(p, w)}, a round ${article(w.part)} ${w.part}. The best seed plays the lowest, and ${how}.${byes === 1 ? ' The top seed gets a bye in the first round.' : byes > 0 ? ` The top ${say(byes)} seeds get a bye in the first round.` : ''}`;
}
/** How head to head's playoffs end the game. */
const finalRule = (p) => `Whoever wins the final wins the game${p.from !== null ? ': it ends there' : ''}. If the season ends before the final, the best seed still in wins.`;
/** A category's name in a sentence, from the sport's label ("field goal percentage", "turnovers"); its key when there's none. */
function categoryName(k, w) {
  const c = w.categories.get(k);
  const t = c ? c.label : k;
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}
/** Where less is better, as words from the sport's stats: "fewer is better in turnovers", "lower is better in earned run average"
 *  (a rate is lower, a count fewer); "" for none. */
function lessWords(h, w) {
  const less = h.categories.filter((k) => (w.categories.get(k) || {}).better === 'lower');
  const counts = less.filter((k) => !w.categories.get(k).rate).map((k) => categoryName(k, w));
  const rates = less.filter((k) => w.categories.get(k).rate).map((k) => categoryName(k, w));
  return [counts.length ? `fewer is better in ${listOf(counts)}` : '', rates.length ? `lower is better in ${listOf(rates)}` : ''].filter(Boolean).join('; ');
}
/** L4 part 1b: a categories game's categories in the sentence: "Nine categories: field goal percentage, ... and turnovers (fewer
 *  is better in turnovers)." */
function categoryPhrase(h, w) {
  const n = h.categories.length;
  const less = lessWords(h, w);
  return `${cap(say(n))} ${n === 1 ? 'category' : 'categories'}: ${listOf(h.categories.map((k) => categoryName(k, w)))}${less ? ` (${less})` : ''}.`;
}
/** L4 part 1b: how a categories game ranks, in the sentence: head to head by each category, by most categories, or roto. */
function categoryRankPhrase(h, w) {
  if (h.by === 'roto') return 'Each category ranks everyone on their totals so far, the best earning the most points: most points wins.';
  const play = h.by === 'categories'
    ? `Each ${w.part} you play one of the others head to head in every category: each one you win is a win.`
    : `Each ${w.part} you play one of the others head to head: whoever wins more categories wins it.`;
  if (!h.playoffs) return `${play} Most wins at the end wins.`;
  const p = h.playoffs;
  return `${play} The top ${say(p.teams)} by wins make the playoffs, ${p.from !== null ? playoffWhen(p, w) : `over ${playoffWhen(p, w)}`}.`;
}
/** How a categories game works (L4 part 1b: schema.js categoryParts), a rule a line, as the scorer works it out
 *  (src/lib/game/sequence/categories.js). */
function categoryRules(s, w) {
  const h = categoryParts(s);
  if (!h) return [];
  const out = [];
  const who = countKind(s.count) === 'start' ? 'your starters\' stats' : 'the stats of everyone you drafted';
  out.push(`Your total in each category: ${who}, added up ${h.by === 'roto' ? 'from the start' : `over the ${w.part}`}.`);
  if (h.categories.some((k) => (w.categories.get(k) || {}).rate)) {
    out.push(`A percentage or an average is worked out from what's added up (made over attempted), never an average of each ${w.part}'s. Have no number for one (none of yours took a shot) and you're last in it, tied with anyone else who has none.`);
  }
  const less = lessWords(h, w);
  if (less) out.push(`${cap(less)}.`);
  if (h.by === 'roto') {
    out.push('Each category ranks all of you on your totals: the best gets as many points as there are of you, the next one fewer, down to 1 for the last. Tied, you share your places\' points.');
    out.push('Most points at the end wins.');
    return out;
  }
  out.push(h.by === 'categories'
    ? `Each ${w.part} you play one of the others head to head, everyone in turn: each category you win is a win, each you lose a loss, and the same total a tie (half a win).`
    : `Each ${w.part} you play one of the others head to head, everyone in turn: win more categories than them and you win it; the same number is a tie (half a win).`);
  out.push(h.odd === 'bye' ? `With an odd number of you, one of you sits each ${w.part} out, in turn.` : `With an odd number of you, whoever has nobody to play that ${w.part} plays the middle of everyone else's totals in each category.`);
  out.push(`${cap(article(w.part))} ${w.part} where nobody has anything in any category ${h.quiet === 'tie' ? 'is a tie for everyone' : 'counts for nobody'}.`);
  out.push('The standings: the most wins (a tie is half).');
  if (h.playoffs) {
    const p = h.playoffs;
    out.push(playoffRule(p, w, false, 'whoever wins more categories goes through; the same number goes to the better seed'));
    out.push(finalRule(p));
  } else out.push('Most wins at the end wins.');
  return out;
}
/** The sentence's words for teams of players (A11 part 5: schema.js teamParts): "Played in two teams, drawn at random at the start:
 *  a team's points are its members' average." */
function teamPhrase(t) {
  const named = t.names.every(Boolean) ? ` (${listOf(t.names)})` : '';
  const made = t.made === 'choose' ? 'each of you picking yours before it starts' : 'drawn at random at the start';
  return `Played in ${say(t.of)} teams${named}, ${made}: a team's points are its members' ${t.score === 'sum' ? 'added up' : 'average'}.`;
}
/** Who a handicap is for (A11 part 5b: schema.js handicapParts), as the words say it: "anyone with no game on this couch from an
 *  earlier season". The show isn't named: the words' `show` is the season's label ("Survivor 51"). */
function newcomersWho(h) {
  return h.newTo === 'show' ? 'anyone with no game of this show on this couch from an earlier season' : 'anyone with no game on this couch from an earlier season';
}
/** The sentence's words for a handicap (A11 part 5b): "Newcomers get 5 points an episode: anyone with no game on this couch from an
 *  earlier season." */
function handicapPhrase(h, w) {
  return `Newcomers get ${pointsWord(h.points)} ${article(w.part)} ${w.part}: ${newcomersWho(h)}.`;
}
/** How a handicap works (A11 part 5b), a rule a line, as the engine plays it (state-logic.js HandicapLogic). */
function handicapRules(s, w) {
  const h = handicapParts(s);
  if (!h) return [];
  const out = [`Newcomers get ${pointsWord(h.points)} every ${w.part} the game plays, on top of what they score: ${newcomersWho(h)}.`];
  out.push(`Who's new is worked out from the couch's games when the game starts, and stays that way all season. Join after the start and it's worked out as you join, counting from your first ${w.part}.`);
  if (seatPeople(s) > 1) out.push('A team you share counts as new only if everyone on it is.');
  return out;
}
/** How teams of players work (A11 part 5), a rule a line, as the engine plays them (state-logic.js TeamLogic). `h2h`: played head
 *  to head between the teams (matchupRules says who wins). */
function teamRules(s, w, h2h) {
  const t = teamParts(s);
  if (!t) return [];
  const named = t.names.every(Boolean) ? ` (${listOf(t.names)})` : '';
  const out = [];
  out.push(t.made === 'choose'
    ? `The couch splits into ${say(t.of)} teams${named}: each of you picks yours before the game starts. Everyone still plays their own game.`
    : `The couch splits into ${say(t.of)} teams${named}, drawn at random when the game starts. Everyone still plays their own game.`);
  out.push(t.score === 'sum'
    ? `A team's points: what its members earn each ${w.part}, added up.`
    : `A team's points: each ${w.part}, the average of what its members earn in it, so a smaller team isn't behind.`);
  if (t.unplaced === 'none') {
    out.push(`${t.made === 'choose' ? "Don't pick a team by the start, or join after it," : 'Join after the start'} and you play on no team: your points count for nobody.`);
  } else {
    out.push(t.made === 'choose'
      ? `Don't pick a team by the start and you go onto the smallest one; join after it and you go onto the smallest from the next ${w.part}.`
      : `Join after the start and you go onto the smallest team, from the next ${w.part}.`);
  }
  out.push(`Leave the game and you're off your team from the next ${w.part}; your points before stay with it.`);
  if (!h2h) out.push('The team with the most points wins: everyone on it shares the win.');
  return out;
}
/** C5: the sentence's words for weeks won: "Each episode's most points wins it; most episodes won wins." */
function weekPhrase(wk, w, teams) {
  const tie = wk.ties === 'split' ? ' (tied, they share it)' : wk.ties === 'none' ? ' (tied, nobody does)' : '';
  return `Each ${w.part}, the ${teams ? 'team' : 'one'} with the most points wins it${tie}; most ${w.parts} won wins.`;
}
/** C5: How it works for weeks won (schema.js weekParts), as the engine plays it (state-logic.js WeekLogic). */
function weekRules(s, w) {
  const wk = weekParts(s);
  if (!wk) return [];
  const teams = !!teamParts(s);
  const tie = { all: `Tied for the most, ${teams ? 'each team' : 'each of you'} wins it.`, split: 'Tied for the most, you share it: half a win each for two.', none: 'Tied for the most, nobody wins it.' }[wk.ties];
  return [
    `Each ${w.part}, ${teams ? 'the team with' : 'whoever has'} the most points in it wins it. ${tie}`,
    `${cap(article(w.part))} ${w.part} nobody scores in goes to nobody.`,
    `Most ${w.parts} won wins the game; a tie goes to the most points.`,
  ];
}
/** C5: only these moments count (score.only) and hits counted (score.hits), as the sentence and How it works say them. */
function countRules(sc, w, card) {
  const out = [];
  // C7: only the moments on each episode's card.
  if (onlyCard(sc) && card && card.of.length && Number.isInteger(card.each)) out.push(`Only the moments on each ${w.part}'s card count. ${cardSentence(card, w)}`);
  const label = momentWord(w);
  if (Array.isArray(sc.only) && sc.only.length) out.push(`Only ${sc.only.length === 1 ? 'one moment counts' : `${say(sc.only.length)} moments count`}: ${listOf(sc.only.map(label))}.`);
  const worth = 'a point';
  if (sc.hits === 'every') out.push(`Each time one happens is a hit, worth ${worth}.`);
  if (sc.hits === 'pick') out.push(`Each is an objective: ${worth} for each one each of your ${w.castaways} hits, once each however often they do it.`);
  if (sc.hits === 'objective') out.push(`Each is an objective: ${worth} for each one any of your ${w.castaways} hits, once however many of them do.`);
  return out;
}
/** How it works for head to head (A11 part 4: schema.js matchupParts), as the engine plays it (state-logic.js MatchupLogic). Part 4b:
 *  a game of questions' episodes' points are what its answers settled by then add (AnswerLogic.walk's series). */
function matchupRules(s, w) {
  const h = matchupParts(s);
  if (!h) return [];
  const asks = questionsGame(s);
  // A11 part 5: between teams of players, the teams play each other (their points the teams', teamRules).
  const teams = !!teamParts(s);
  const out = [teams
    ? `Each ${w.part} your team plays another head to head, every team in turn: more points that ${w.part} wins it, and the same points is a tie (half a win).`
    : `Each ${w.part} you play one of the others head to head, everyone in turn: more points that ${w.part} wins it, and the same points is a tie (half a win).`];
  if (asks) {
    // Only what this game asks: a question over more than one episode (a run, a phase), or about the whole game.
    const longer = s.ask.some((q) => q.asked !== 'once' && !livesQuestion(q));
    const whole = s.ask.some((q) => q.asked === 'once');
    const counts = [longer ? `one about more than one ${w.part} counts in the ${w.part} it's settled in` : '', whole ? `one about the whole game counts in the ${w.part} it's settled in, at the end` : ''].filter(Boolean);
    out.push(`Your points in ${article(w.part)} ${w.part} are what your answers settled by then earn${counts.length ? `: ${counts.join(', and ')}` : ''}.`);
  }
  out.push(teams
    ? (h.odd === 'bye' ? `With an odd number of teams, one sits each ${w.part} out, in turn.` : `With an odd number of teams, the one with nobody to play that ${w.part} plays the middle score of the others.`)
    : h.odd === 'bye' ? `With an odd number of you, one of you sits each ${w.part} out, in turn.` : `With an odd number of you, whoever has nobody to play that ${w.part} plays the middle score of everyone else's.`);
  out.push(`${cap(article(w.part))} ${w.part} where nobody scores ${h.quiet === 'tie' ? 'is a tie for everyone' : 'counts for nobody'}.`);
  out.push('The standings: the most wins (a tie is half), then the most points.');
  if (h.playoffs) {
    const p = h.playoffs;
    out.push(playoffRule(p, w, teams, 'whoever wins goes through; a tie goes to the better seed'));
    out.push(finalRule(p));
  } else {
    out.push('Most wins at the end wins.');
  }
  // C2 part 4b: a pool's are settled once it's known who went home (its picks are graded on it, early results too).
  out.push(asks ? `${cap(article(w.part))} ${w.part}'s matchups wait for its full results, and for its questions to be settled.` : poolByPoints(s) ? `${cap(article(w.part))} ${w.part}'s matchups are settled once it's known who went home.` : `${cap(article(w.part))} ${w.part}'s matchups wait for its full results.`);
  return out;
}

/** A pool's lives, buyback, mulligans and second pick (A10 part 2), as the engine plays them (schema.js poolParts). */
const poolOf = (s) => poolParts(s) || { lives: null, mulligans: 0, buyback: null, second: null, standing: false, never: null, oneLeft: null, allOut: null };
/** A pool's second pick (A10 part 2: get.second), or null. */
const secondPickOf = (s) => poolOf(s).second;
/** Until when a buyback holds, as a phrase: " before Merged starts", " before Episode 7", or "" (any time). */
function beforeWords(b, w) {
  if (!isObj(b.before)) return '';
  if (typeof b.before.phase === 'string') return ` before ${phaseWord(b.before.phase, w)} starts`;
  return Number.isInteger(b.before.episode) ? ` before ${w.Part} ${b.before.episode}` : '';
}
/** The sentence's words for a pool's lives, buyback and mulligans: "Two lives: a wrong pick costs one." */
function poolPhrases(s, w) {
  const { lives, buyback, mulligans } = poolOf(s);
  const out = [];
  if (lives) out.push(`${cap(say(lives))} ${lives === 1 ? 'life' : 'lives'}: a wrong pick costs one.`);
  if (buyback) out.push(`${cap(say(buyback.times))} ${buyback.times === 1 ? 'buyback' : 'buybacks'}${beforeWords(buyback, w)}.`);
  if (mulligans) out.push(`${cap(say(mulligans))} wrong ${mulligans === 1 ? 'pick' : 'picks'} forgiven.`);
  return out;
}
/** How a pool's lives, buyback and mulligans work, a rule a line. */
function poolRules(s, w) {
  const { lives, buyback, mulligans } = poolOf(s);
  const out = [];
  if (lives) out.push(`You have ${say(lives)} ${lives === 1 ? 'life' : 'lives'}: a wrong pick, or no pick, costs one. At none you're out, with no more picks.`);
  if (buyback) {
    const cost = buyback.cost > 0 ? `for ${pointsWord(buyback.cost)} off your total` : 'at no cost';
    out.push(`Out${beforeWords(buyback, w)}? You're back in from the next ${w.part} with one life, ${cost}${buyback.times === 1 ? ', once' : `, up to ${say(buyback.times)} times`}.`);
  }
  if (mulligans) {
    const which = mulligans === 1 ? 'wrong pick (or missed one) is' : `${say(mulligans)} wrong picks (or missed ones) are`;
    out.push(`Your first ${which} forgiven: your streak carries on${lives ? ' and you keep your lives' : ''}.`);
  }
  return out;
}

/** A draft's group slots (A10 part 1: get.groups), or null. */
const groupSlotsOf = (s) => (s.get && s.get.by === 'draft' && isObj(s.get.groups) && isNum(s.get.groups.slots) ? s.get.groups : null);
/** How group slots work, a rule a line. */
function groupSlotRules(s, w) {
  const g = groupSlotsOf(s);
  if (!g) return [];
  const one = g.slots === 1;
  const it = one ? 'your slot' : 'each slot';
  const out = [
    `Beside your team you have ${one ? 'a slot' : `${say(g.slots)} slots`} for a pair or team the show forms. When the show forms them, pick ${one ? 'one' : 'one for each'} after the ${w.part} that showed them: it scores from the next ${w.part}.`,
    `While that group lasts, ${it} scores what its people do (${g.points === 'sum' ? 'their points added up' : 'their points averaged, so it scores like one more of yours'}). When the group changes, or the show re-pairs everyone or goes each for themselves, the slot drops and you pick again from the new ones.`,
    g.own === 'exclusive'
      ? "Once someone has a group, nobody else can pick it, while there are enough groups for every team's slots; when there aren't, anyone can."
      : 'Anyone can pick the same group.',
    g.swap ? `You can change ${it}'s group before any ${w.part}.` : `${cap(it)} rides with its group while it lasts: no changing it.`,
    g.fallback === 'carry-on'
      ? `${cap(article(w.part))} ${w.part} where who's with whom isn't sure still counts, following the people you picked.`
      : `${cap(article(w.part))} ${w.part} where who's with whom isn't sure doesn't count for a slot, either way, and nor does a group that changed before it played.`,
  ];
  return out;
}

/** When a stock market trades (A10 part 3c), as its waiver windows open: "after every episode", "every 2 episodes", "when a
 *  window opens". */
function tradeWhen(s, w) {
  const win = isObj(s.extras.waivers) && isObj(s.extras.waivers.windows) ? s.extras.waivers.windows : null;
  if (!win || win.schedule === 'manual') return 'when a window opens';
  return win.schedule === 'everyEpisode' ? `after every ${w.part}` : `every ${say(win.every)} ${w.parts}`;
}
/** How a stock market trades (A10 part 3c), a rule a line: the money left over, when trading opens and how much, what someone
 *  gone home sells for, the fallback (keep what you have), whether two can hold the same one, and worth when it ranks by it. */
function marketRules(s, b, w) {
  const out = [];
  const win = isObj(s.extras.waivers) && isObj(s.extras.waivers.windows) ? s.extras.waivers.windows : null;
  const swaps = win ? win.swaps : 0;
  if (b.auction) out.push(`After the auction, each ${w.castaway} is priced ${b.floor} to ${b.ceiling} by how they're doing, their points so far by this game's rules (the best costs most), and prices move after every ${w.part}.`);
  out.push(b.left === 'lost'
    ? `What you don't spend in the draft is lost: after it, you trade with what you sell for.`
    : `What you don't spend in the draft is cash to trade with.`);
  const when = tradeWhen(s, w);
  const fee = b.trade.fee ? `, each trade costing ${b.trade.fee}` : '';
  out.push(`${cap(when)}, until the next ${w.part} starts, sell one of yours at today's price and buy someone at theirs: ${swaps >= s.get.each ? 'as many as your team' : swaps === 1 ? 'one trade' : `up to ${say(swaps)} trades`} each time${fee}. What you sell for goes into your cash, and nobody spends more than they have.`);
  if (isObj(s.extras.waivers) && s.extras.waivers.replace !== 'never') out.push(`Someone gone home sells for ${b.gone === 'last' ? 'what they cost when they went' : 'nothing'}, and you can buy someone in their place then too.`);
  else out.push(`Someone gone home is worth ${b.gone === 'last' ? 'what they cost when they went' : 'nothing'}.`);
  out.push(s.get.own === 'shared' ? `Anyone still in can be bought, by more than one of you.` : `You can buy only someone nobody holds.`);
  out.push("Don't trade and you keep who you have.");
  if (s.rank.by === 'worth') out.push(`Most worth wins: your cash plus your team at today's prices. Ties go to the most points.`);
  return out;
}
/** How keepers across seasons work (A10 part 4: get.keep), a rule a line: who can be kept, what a keeper costs, whether
 *  someone else can have yours, the fallback for someone who names nobody, and someone who isn't back. */
function keepRules(s, w) {
  const k = keepParts(s);
  if (!k) return [];
  const out = [];
  const b = budgetParts(s);
  out.push(k.each === 1
    ? `Keepers: before the draft, keep one ${w.castaway} from your team in last season's game, if they're on this season's cast. They take a place on your team of ${say(s.get.each)}, and the draft fills the rest.`
    : `Keepers: before the draft, keep up to ${say(k.each)} ${w.castaways} from your team in last season's game, if they're on this season's cast. Each takes a place on your team of ${say(s.get.each)}, and the draft fills the rest.`);
  // A salary cap counts the whole team at today's prices, keepers too, whatever they cost.
  if (b && !b.auction && !b.trade) out.push(`Your keepers count against the cap at today's prices, like anyone on your team.`);
  if (k.cost === 'price' && b && b.trade) out.push(`A keeper costs their price when the draft starts, out of your ${b.total}.`);
  else if (k.cost === 'place' && b && (b.auction || b.trade)) out.push(`A keeper costs nothing: your ${b.total} goes on the rest of your team.`);
  if (k.cost === 'round') out.push(`In the snake, you sit out one of your first rounds for each keeper.`);
  else if (s.get.order === 'snake') out.push(`In the snake, someone with keepers is passed over once their team is full: a keeper costs one of your last rounds.`);
  out.push(s.get.own === 'shared'
    ? `Someone you keep can still be on someone else's team.`
    : `Nobody else can have someone you keep. If two of you want the same one, whoever names them first has them.`);
  out.push(k.fallback === 'best'
    ? `Name nobody by the draft and you keep your best who are back (the most points last season).`
    : `Name nobody by the draft and you keep nobody.`);
  out.push(`Someone who isn't back can't be kept: their place goes to the draft.`);
  return out;
}
/** A draft spread across the cast's groups (A10 part 3: get.across), or null. */
const acrossOf = (s) => (s.get && s.get.by === 'draft' && isObj(s.get.across) ? s.get.across : null);
/** How a draw and a spread draft work (A10 part 3), and a draft's prices (part 3b), a rule a line. */
function drawRules(s, w) {
  const out = [];
  const b = budgetParts(s);
  if (b && b.auction) {
    out.push(`It's an auction: everyone has ${b.total} to spend, and bids in private on the ${w.castaway}s they want (backups too), each bid ${b.floor} or more, keeping ${b.floor} for each other place on the team.`);
    out.push(`When everyone has bid, or when the first ${w.part} starts, the bids are settled at once: the highest bid wins its ${w.castaway} at what was bid, then the next highest, and so on. Equal bids are settled by a draw, recorded so it's the same whenever anyone looks.`);
    out.push(b.fallback === 'fill'
      ? `A team the bids didn't fill (or someone who didn't bid) is filled from who's left, at random, at ${b.floor} each.`
      : `A team the bids didn't fill stays short.`);
  } else if (b && b.trade) {
    out.push(`It's a stock market: everyone has ${b.total} to buy a team. Each ${w.castaway} costs ${b.floor} to ${b.ceiling} by how they're doing, their points so far by this game's rules (the best costs most), and prices move after every ${w.part}. Before anyone's scored, everyone costs the same.`);
    out.push(`Your team costs no more than ${b.total} when you draft it, while anyone left would keep it within (if nobody would, you can still fill it, and start short).`);
  } else if (b) {
    out.push(`There's a salary cap of ${b.total}: each ${w.castaway} costs ${b.floor} to ${b.ceiling} by how they're doing, their points so far by this game's rules (the best costs most). Before anyone's scored, everyone costs the same.`);
    out.push(`Your team's prices add up to no more than the cap when you draft it and whenever you change it. Prices move after every ${w.part}: a team that goes over keeps its ${w.castaway}s, but a change can't take it further over. Someone gone home counts as ${b.gone === 'last' ? 'what they cost when they went' : 'nothing'}.`);
  }
  // A10 part 3c: buying and selling each week.
  if (b && b.trade) out.push(...marketRules(s, b, w));
  if (s.get.order === 'draw') {
    out.push(s.get.own === 'shared'
      ? `Nobody picks: when the draft starts, everyone is dealt ${say(s.get.each)} at random, each from a hat of their own, so the same ${w.castaway} can be on more than one team.`
      : `Nobody picks: when the draft starts, everyone is dealt ${say(s.get.each)} at random from one hat, so nobody shares. If the hat runs out, the last teams dealt come up short.`);
    out.push("The draw is recorded once it's made: it's the same whenever anyone looks.");
  }
  if (acrossOf(s)) {
    out.push(`Each team is spread across the ${w.group}s as they stand at the draft, as evenly as its size allows (a team of three with three ${w.group}s: one from each). A ${w.group} with nobody left to take asks for nobody, and if the show isn't split into ${w.group}s then, it's an ordinary draft.`);
    out.push(`After the draft they're yours wherever they go: a swap or the merge changes nobody's team.`);
  }
  return out;
}

/** L4 part 2: when a squares pay comes, in the sport's words: "the end of the first quarter", "halftime", "the final score". */
function payWhen(at, w) {
  if (at === 'final') return 'the final score';
  if (at === 'half') return 'halftime';
  return `the end of the ${ordinalWord(at)} ${w.period.word}`;
}
/** L4 part 2: what a squares game's pays are worth, in a sentence. */
function squaresPayPhrase(sq, w) {
  return `The square of the two scores' last digits wins ${listOf(sq.pays.map((p) => `${pointsWord(p.points)} at ${payWhen(p.at, w)}`))}.`;
}
/** L4 part 2: a squares game's How it works. */
function squaresRules(s, w) {
  const sq = squaresParts(s);
  if (!sq) return ['Take your squares on the grid before it starts.'];
  const out = [];
  const grid = `${sq.grid} by ${sq.grid}`;
  out.push(sq.take === 'deal'
    ? `Before it starts, everyone is dealt ${sq.each ? say(sq.each) : 'the same number of'} squares at random on a grid ${grid}${sq.each ? '' : ': as many as go round evenly'}.`
    : `Before it starts, take your squares on a grid ${grid}: ${sq.each ? `up to ${say(sq.each)} each` : 'as many as you like'}, first come, first served.`);
  out.push(sq.grid === 10
    ? "Then the digits 0 to 9 are drawn at random onto the rows (the first team's score) and the columns (the other's), so nobody picks a good number."
    : "Then the digits 0 to 9 are drawn at random onto the rows (the first team's score) and the columns (the other's), two to a row and two to a column, so nobody picks a good number.");
  out.push(squaresPayPhrase(sq, w).replace(/^The square/, 'Each time, the square'));
  if (sq.pays.some((p) => p.at === 'final')) out.push('The final score counts overtime.');
  out.push(sq.empty === 'next' ? 'A square nobody holds rolls its points on to the next pay.' : 'A square nobody holds pays nobody.');
  if (sq.pays.some((p) => p.at !== 'final')) out.push(sq.unread === 'void' ? `If the score at the end of a ${w.period.word} isn't known (a game called early), that pay goes to nobody.` : `If the score at the end of a ${w.period.word} isn't known (a game called early), that pay goes on the final score.`);
  const span = s.span;
  if (!(isObj(span) && Number.isInteger(span.from) && span.to === span.from)) out.push(`Your squares are yours for every ${w.part}; the digits are drawn again before each one.`);
  out.push('Most points wins.');
  return out;
}

/** How it works: today's five games say what the Rules sheet says (game-rules.ts), the rest in the same voice. */
function rulesOf(s, w) {
  const rules = [];
  const by = s.get.by;
  const count = countKind(s.count);
  const shared = s.get.own === 'shared';
  const draft = s.get.order === 'draw' || s.get.order === 'auction'
    ? null
    : shared
      ? `Draft a team of ${say(s.get.each)} in private; everyone's picks are revealed at once, and the same ${w.castaway} can be on more than one team.`
      : `Snake-draft a team of ${say(s.get.each)}: once someone picks a ${w.castaway}, nobody else can have them.`;
  const waivers = s.extras.waivers;
  if (by === 'draft') {
    if (draft) rules.push(draft);
    // C4: whom a replacement or a swap brings in, where it isn't the draft's own.
    const moves = sharedMoves(s);
    if (moves) rules.push(sharedMovesRule(moves, w));
    // A12 part 1: a draft that opens at its game's start drafts from who's still in then.
    if (isObj(s.extras.draft) && s.extras.draft.opens === 'start') rules.push(`The draft opens once it's known where the game starts and the ${w.part} before it has results, so you draft from who's still in.`);
    rules.push(...drawRules(s, w));
    rules.push(...keepRules(s, w));
    if (count === 'start') rules.push(`Before each ${w.part}, start ${say(s.count.start)}. Only starters score.`);
    // A9 part 2: best ball, a lineup's captain, when the points multiply, Outlast in reverse.
    if (count === 'best') rules.push(`Each ${w.part}, your best ${say(s.count.best)} count, whoever they are: no lineups to set.`);
    if (count === 'all' && s.score.by !== 'place') rules.push('Everyone you draft scores.');
    if (s.score.by === 'moments') rules.push(w.groups.length ? `Points come from what happens: ${listOf(w.groups)}.` : `Points come from what happens in each ${w.part}.`);
    if (s.score.by === 'stats' && statScoreWords(s.score, w)) rules.push(`Points come from their stats: ${statScoreWords(s.score, w)}.`);
    if (count === 'start' && isObj(s.score.captain) && isNum(s.score.captain.times)) {
      rules.push(`Name one of your starters captain each ${w.part}: their points count ${timesWord(s.score.captain.times)}. Name nobody and your last captain keeps it, while they're starting.`);
    }
    if (s.score.by === 'moments') {
      const times = timesRules(s.score, w);
      rules.push(...times);
      if (times.length > 1) rules.push(`${cap(article(w.part))} ${w.part} in two of them counts both.`);
    }
    // C3: a multiplier on how a holding joined.
    const joinedSaid = s.score.by === 'moments' || s.score.by === 'place' ? joinedRules(s.score) : [];
    if (joinedSaid.length && s.score.by === 'moments') rules.push(...joinedSaid, joinedHow(s.score));
    if (count === 'start') rules.push(lockRule('Lineups', s, w));
    rules.push(...groupSlotRules(s, w));
    if (s.score.by === 'place' && s.score.reverse === true) {
      rules.push(`Each ${w.castaway} earns 1 point, plus 1 for everyone who outlasts them.`);
      rules.push('So the first one out scores the most and the winner 1: the earlier yours go home, the better.');
      rules.push("While they're still in, they count what they'd score if they went home next.");
      rules.push('No lineups to set. Just watch.');
    } else if (s.score.by === 'place') {
      rules.push(`Each ${w.castaway} earns 1 point, plus 1 for every boot they outlast.`);
      rules.push('So they end on their place in the boot order: the last one standing carries you.');
      if (joinedSaid.length) rules.push(...joinedSaid, joinedHow(s.score));
      rules.push('No lineups to set. Just watch.');
    }
    // A10 part 3c: a stock market's moves are its trades (drawRules says them).
    if ((count === 'start' || count === 'best') && !(budgetParts(s) || {}).trade) {
      const pickups = isObj(waivers) && waivers.replace !== 'never';
      const swaps = isObj(waivers) && isObj(waivers.windows) && waivers.windows.swaps > 0;
      if (pickups) rules.push(`Lose someone? Pick who comes in on waivers.${swaps ? ' Waiver windows let you swap someone too.' : ''}`);
      else if (swaps) rules.push(`Waiver windows let you swap one of your ${w.castaways} for someone new.`);
    }
    // C2 part 4c: its own questions, their points added to your team's.
    const asks = draftQuestions(s);
    if (asks.length) {
      const each = asks.some((q) => q.asked !== 'once');
      rules.push(`Answer ${say(asks.length)} ${asks.length === 1 ? 'question' : 'questions'} too${each ? '' : ' before it starts'}, their points added to your team's:`);
      for (const q of asks) rules.push(questionRule(q, w, each, s.ask));
      rules.push(each ? `Change an answer until its ${w.part} starts. Nobody sees them until then.` : 'Change your answers until it starts. Nobody sees them until then.');
    }
    // A11 part 5: teams of players; C2 part 4b: said first when they're knocked out or race, whose rules say who wins.
    const teamsOut = !!teamParts(s) && !!knockoutParts(s);
    const teams = teamRules(s, w, !!matchupParts(s) || !!weekParts(s) || teamsOut);
    if (teamsOut) rules.push(...teams);
    // A11 part 1: players knocked out, and a race.
    rules.push(...knockoutRules(s, w));
    // A11 part 5b: a handicap.
    rules.push(...handicapRules(s, w));
    if (!teamsOut) rules.push(...teams);
    // A11 part 4: head to head, with playoffs.
    rules.push(...matchupRules(s, w));
    // L4 part 1b: a sport's categories, head to head or roto.
    rules.push(...categoryRules(s, w));
    // C5: weeks won.
    rules.push(...weekRules(s, w));
  } else if (by === 'pick' && momentsPick(s)) {
    // C5: a pick each episode, one or several, scored by what they do in it.
    const n = s.get.each;
    rules.push(`No draft. Before each ${w.part}, pick ${n === 1 ? `one ${w.castaway}` : `${say(n)} ${w.castaways}`} still in: ${n === 1 ? 'they score' : 'each scores'} what they do in it.`);
    rules.push(...countRules(s.score, w, cardOf(s)));
    rules.push(...timesRules(s.score, w));
    if (s.get.repeat === 'never') rules.push(`You can't pick the same ${w.castaway} twice, all season.`);
    else if (s.get.repeat === 'cycle') rules.push(`You can't pick the same ${w.castaway} again until you've used everyone still in, and never two ${w.parts} in a row.`);
    else rules.push(`Pick anyone still in, every ${w.part}: the same ${n === 1 ? w.castaway : w.castaways} as last time too.`);
    rules.push(lockRule('Picks', s, w));
    rules.push(...handicapRules(s, w));
    rules.push(...teamRules(s, w, !!matchupParts(s) || !!weekParts(s)));
    rules.push(...matchupRules(s, w));
    rules.push(...weekRules(s, w));
    if (!teamParts(s) && !matchupParts(s) && !weekParts(s)) rules.push('Most points wins.');
  } else if (by === 'pick') {
    rules.push(s.score.means === 'scores'
      ? `No draft. Before each ${w.part}, pick one ${w.castaway} you think scores in it.`
      : `No draft. Before each ${w.part}, pick one ${w.castaway} you think stays in.`);
    // A10 part 2: a second pick, lives, a buyback, mulligans, last one standing.
    const second = secondPickOf(s);
    if (second) {
      rules.push(second.fallback === 'counts'
        ? `Pick a second ${w.castaway} beside the first: it counts the same way.`
        : `You can pick a second ${w.castaway} beside the first. It counts on ${article(w.part)} ${w.part} two or more go home; on one where only one goes, it doesn't count, either way.`);
    }
    // C2 part 4b: a pool ranked by its points, or head to head on them, counts a right pick's points and no streak.
    const points = poolByPoints(s);
    rules.push(points
      ? `Right: you score ${isNum(s.score.points) && s.score.points !== 1 ? pointsWord(s.score.points) : 'a point'}. Wrong, or no pick: nothing.`
      : 'Right: your streak grows. Wrong, or no pick: it resets. Your best streak still counts.');
    rules.push(...poolRules(s, w));
    // A11 part 2: a pick that never repeats, and what a night with nobody left to pick does.
    const never = poolOf(s).never;
    if (never) {
      rules.push(`You can't pick the same ${w.castaway} twice, all season.`);
      rules.push(never.fallback === 'skip'
        ? `Once you've picked everyone still in, ${article(w.part)} ${w.part} you've nobody left to pick doesn't count for you, either way.`
        : `Once you've picked everyone still in, you've nobody left to pick: that counts as a missed pick.`);
    } else if (s.get.repeat === 'any') rules.push(`Pick anyone still in, every ${w.part}: the same ${w.castaway} as last time too.`);
    else rules.push(`You can't pick the same ${w.castaway} again until you've used everyone still in, and never two ${w.parts} in a row.`);
    if (points) {
      // Its handicap, its teams and head to head say themselves (and who wins, when they decide it).
      rules.push(...handicapRules(s, w));
      rules.push(...teamRules(s, w, !!matchupParts(s) || !!weekParts(s)));
      rules.push(...matchupRules(s, w));
      // C5: weeks won.
      rules.push(...weekRules(s, w));
      if (!teamParts(s) && !matchupParts(s) && !weekParts(s)) rules.push('Most points wins.');
    } else rules.push(s.rank.by === 'standing'
      ? "Last one standing wins: whoever's still in, then whoever went out last. Ties go to the most points."
      : 'Longest streak wins; ties go to the most right picks.');
    // A11 part 2: last one standing's end (the default, all out by points, is the line above's "Ties go to the most points").
    const { oneLeft, allOut } = poolOf(s);
    if (oneLeft === 'ends') rules.push(`Once one of you is left, or none, it's over: nobody picks after that ${w.part}.`);
    if (allOut === 'share') rules.push(`If everyone still in goes out the same ${w.part}, you're all out and share the win, whatever your points.`);
    if (allOut === 'back') rules.push(`If everyone still in goes out the same ${w.part}, you're all back in for the next, with the lives you had.`);
  } else if (s.score.by === 'answers' && callsAsk(s.ask)) {
    rules.push('No draft, no team. Before each show starts, make two calls about what will happen in it.');
    rules.push('The couch says what happened as it watches: two of you agreeing settles a call.');
    rules.push('Change your calls until it starts. Nobody sees them until then.');
    rules.push('Most right calls by the finale wins.');
  } else if (by === 'card') {
    rules.push('No draft, no team. Every show you get a new bingo card: eight things that might happen, the middle one free.');
    rules.push('Tick a square when it happens. Three in a row, down or across makes a line.');
    rules.push('A square counts once the couch agrees it happened: two of you ticking it, or saying so, settles it.');
    rules.push(isNum(s.score.points) && s.score.points !== 1 ? `Each line is worth ${pointsWord(s.score.points)}. Most points by the finale wins.` : 'Most lines by the finale wins.');
  } else if (by === 'squares') {
    rules.push(...squaresRules(s, w));
  }
  if (s.score.by === 'answers' && !callsAsk(s.ask)) {
    const each = s.ask.some((q) => q.asked !== 'once');
    // C6 part 2: a ticket is built from the questions, not one of them (its rule says so).
    // C7: each line of the card a question, the card said first.
    const card = cardOf(s);
    const asked = s.ask.filter((q) => !isTicket(q)).reduce((n, q) => n + questionLines(q, s), 0);
    rules.push(`${teamParts(s) ? 'No draft.' : 'No draft, no team.'} Answer ${say(asked)} ${asked === 1 ? 'question' : 'questions'}${each ? '' : ' before it starts'}:`);
    if (card && card.of.length && Number.isInteger(card.each) && s.ask.some(isCardQuestion)) rules.push(cardSentence(card, w));
    const bank = bankOf(s);
    for (const q of s.ask) rules.push(questionRule(q, w, each, s.ask, bank, s));
    // A9's parlays.
    for (const p of parlaysOf(s.score)) {
      const legs = p.of.map((id) => s.ask.find((q) => q.id === id)).filter(Boolean);
      const times = { 2: 'double', 3: 'triple', 4: 'quadruple' }[p.times] || `${p.times} times`;
      rules.push(`A parlay: right on ${listOf(legs.map((q) => `"${q.ask}"`))} together, and your points on them are ${times}.${legs.some((q) => q.wager !== undefined) ? ' A stake you win on them is too.' : ''}`);
    }
    // C6: a bank, every stake drawn from it.
    if (bank) rules.push(`Everyone starts with a bank of ${pointsWord(bank.start)}, and every stake comes out of it: you can't stake more than you have left, less what's still riding on answers to be settled.${bank.out ? " Run out and you're out." : ' Run out and you can still answer, with nothing to stake.'}`);
    // L3 part 2f part 2: a question about each game locks game by game.
    if (s.ask.some((q) => q.each === 'game')) rules.push(`Change a game's pick until that game starts: each locks on its own. Nobody sees anyone's until the ${w.part}'s last game starts.`);
    else rules.push(each ? `Change an answer until its ${w.part} starts. Nobody sees them until then.` : 'Change your answers until it starts. Nobody sees them until then.');
    // A late lock (A7).
    if (isObj(s.extras.lateLock)) rules.push(`Watching late? Answer before you watch: until you've seen it, up to ${s.extras.lateLock.hours} hours after it airs.`);
    // A11 part 2b: a race, cuts and lives say who wins; part 4b, head to head.
    const asks = answerParts(s);
    // A11 part 5b: a handicap.
    rules.push(...handicapRules(s, w));
    // A11 part 5: teams of players say who wins themselves, unless head to head does.
    rules.push(...teamRules(s, w, !!(asks && (asks.matchups || asks.weeks))));
    if (asks && asks.matchups) rules.push(...matchupRules(s, w));
    // C5: weeks won.
    else if (asks && asks.weeks) rules.push(...weekRules(s, w));
    else if (asks && (asks.race || asks.cuts.length || asks.lives !== null || asks.broke)) rules.push(...answerKnockoutRules(s, w));
    else if (!(asks && asks.teams)) rules.push('Most points wins.');
  }
  // A11 part 4: a draft's head to head, and a game of questions' (part 4b), say themselves (matchupRules); a sports spec's, which
  // the engine doesn't play yet, its name.
  const rank = categoryParts(s) ? null : {
    matchups: matchupParts(s) ? null : `You play someone head to head each ${w.part}: the most points wins it.`,
  }[s.rank.by];
  if (rank) rules.push(rank);
  // A10 part 4b: a team two people share.
  if (seatPeople(s) > 1) {
    rules.push(`Sharing a team: up to ${say(seatPeople(s))} of you can hold one ${by === 'pick' ? 'place' : 'team'}, joining by an invite to it. Any of you can make its moves, and the last one made counts. It's one ${by === 'pick' ? 'place' : 'team'} in the game's table.`);
  }
  // Side bets count only beside a draft (a pool, Weekly Calls and Weekly Bingo never scored them).
  if (isObj(s.extras.bets) && betsFit(s)) {
    rules.push(`Predictions: a right answer earns its points (usually ${s.extras.bets.points}), once at least two of you have answered.`);
  }
  const fin = s.get.by === 'draft' ? finaleIn(s.ask) : null;
  if (fin) {
    rules.push(`Finale predictions: before the finale, name your final three and the winner${fin.from === 'own' ? ' from your own team' : ''}. ${cap(pointsWord(fin.top3))} for each of the three you get, ${pointsWord(fin.winner)} for the winner.`);
  }
  if (!isObj(s.span.from) && s.span.from > 1) rules.push(`Scoring starts at ${w.Part} ${s.span.from}; the ${w.parts} before it are history.`);
  if (isObj(s.span.from)) {
    const name = phaseWord(s.span.from.phase, w);
    const at = spanStart(s.span);
    rules.push(at === null
      ? `It starts when ${name} starts: nothing before then scores.`
      : `It starts with ${name}, at ${w.Part} ${at}: the ${w.parts} before it are history.`);
  }
  // A12 part 1: an end at a phase, known once that phase's start is.
  const endPhase = spanEndPhase(s.span);
  const end = spanEnd(s.span);
  if (endPhase) {
    const name = phaseWord(endPhase, w);
    rules.push(end === null ? `It ends when ${name} starts: nothing from then on scores, and the table there is final.` : `It ends with ${w.Part} ${end}, before ${name}: nothing after it scores, and the table there is final.`);
  } else if (end !== null) rules.push(end === spanStart(s.span) ? `It's one ${w.part}: ${w.Part} ${end}, then it's over.` : `It ends with ${w.Part} ${end}: nothing after it scores, and the table there is final.`);
  return rules;
}

const REPLACE_WORDS = { always: 'Replace right away', whenShort: 'Replace only when short', windows: 'Replacements wait for a window', never: 'No replacements' };
const JOIN_WORDS = { open: 'Anyone on the couch', ask: 'They ask first', locked: 'Nobody new' };

/** The details nobody asked about: what each is, and whether it's what we'd recommend (the preset's, or the defaults). */
function detailsOf(s, w) {
  const base = fullSpec({ ...s, extras: undefined });
  const rec = (k) => sameValue(s.extras[k], base.extras[k]);
  const out = [];
  const e = s.extras;
  if (isObj(e.draft)) {
    const d = e.draft;
    out.push({ id: 'draft', label: 'The draft', recommended: rec('draft'), value: [
      s.get.order === 'draw' ? `At random, out of ${s.get.own === 'shared' ? 'a hat each' : 'one hat'}` : s.get.order === 'auction' ? 'An auction: sealed bids, settled at once' : s.get.own === 'shared' ? 'In private, revealed at once' : 'Snake: everyone takes turns',
      d.timer ? `${d.timer === 60 ? '60 seconds' : '2 minutes'} a pick, then ${d.away === 'queue' ? 'from their queue' : 'it waits'}` : 'No pick timer',
      d.at ? `at ${d.at}` : 'no time set',
      // A12 part 1: a draft that opens at its game's start.
      ...(d.opens === 'start' ? [`opens once the ${w.part} before it is in`] : []),
    ].join(' · ') });
  }
  const sharedJoin = s.get.by !== 'draft' || s.get.own === 'shared';
  // Locked down closes joining whatever Who can join says (GhostLogic.allowed), and leaves that as it was for after.
  const join = own(JOIN_WORDS, e.join) || JOIN_WORDS[sharedJoin ? 'open' : 'ask'];
  out.push({ id: 'join', label: 'Who can join', recommended: e.join === null, value: e.lockedDown ? "Nobody new while it's locked down" : join });
  if (isObj(e.waivers) && isObj(e.waivers.windows)) {
    const win = e.waivers.windows;
    const windows = win.schedule === 'manual' ? (win.swaps > 0 ? 'windows when you open one' : 'no windows unless you open one')
      : `a window ${win.schedule === 'everyEpisode' ? `after every ${w.part}` : `every ${win.every} ${w.parts}`}${win.swaps ? `, ${win.swaps === 1 ? 'one swap' : `${win.swaps} swaps`}` : ''}`;
    // Waivers that start with a phase: "From when Merged starts: ...".
    const from = isObj(e.waivers.from) ? `From when ${phaseWord(e.waivers.from.phase, w)} starts: ` : '';
    // C4: whom a shared replacement or swap brings in.
    const moves = sharedMoves(s);
    out.push({ id: 'waivers', label: 'Waivers', recommended: rec('waivers'), value: `${from}${(own(REPLACE_WORDS, e.waivers.replace) || 'Replacements as set').replace(/^./, (c) => (from ? c.toLowerCase() : c))} · ${windows}${moves ? ` ·${sharedMovesPhrase(moves).slice(1)}` : ''}` });
  }
  // Side bets and finale predictions go with a draft: nothing else scores them.
  if (betsFit(s)) out.push({ id: 'bets', label: 'Side bets', recommended: rec('bets'), value: isObj(e.bets) ? `On, ${pointsWord(e.bets.points)} each` : 'Off' });
  if (s.get.by === 'draft') {
    // Its finale predictions, the first of its questions (C2 part 4c: its own after them, said in How it works).
    const f = finaleIn(s.ask);
    const presetAsk = presetOf(s) ? presetOf(s).ask : [];
    out.push({ id: 'finale', label: 'Finale predictions', recommended: sameValue(f ? s.ask.slice(0, 2) : [], presetAsk), value: f ? `Top 3: ${pointsWord(f.top3)} each, the winner: ${pointsWord(f.winner)}${f.from === 'own' ? ', from your own team' : ''}` : 'Off' });
  }
  if (s.get.by === 'pick') out.push({ id: 'calls', label: 'Who goes home?', recommended: rec('calls'), value: e.calls ? `A call every ${w.part}, beside the pick` : 'Off' });
  if (countKind(s.count) === 'start') out.push({ id: 'hideStarters', label: 'Starters', recommended: rec('hideStarters'), value: e.hideStarters ? 'Hidden until the lock' : "Shown as they're set" });
  // A game of questions' late lock (A7).
  if (s.score.by === 'answers' && !callsAsk(s.ask)) out.push({ id: 'lateLock', label: 'Watching late', recommended: rec('lateLock'), value: isObj(e.lateLock) ? `Answer until you've seen it, up to ${e.lateLock.hours} hours after it airs` : 'Answers lock as it starts' });
  out.push({ id: 'lockedDown', label: 'Locked down', recommended: rec('lockedDown'), value: e.lockedDown ? 'Nobody new, and the rules stay as they are' : 'No' });
  // A10 part 4b: a team two people share (never beside a call or a bingo card: each person's own).
  if (!(s.score.by === 'lines' || callsAsk(s.ask) || e.calls === true)) {
    const people = seatPeople(s);
    out.push({ id: 'seats', label: 'Sharing a team', recommended: people === 1, value: people > 1 ? `Up to ${say(people)} a team` : 'One each' });
  }
  return out;
}

const OVERALL_WORDS = {
  points: "Overall, each stage's points add up.",
  places: 'Overall, each stage you finish scores by your place',
  wins: 'Overall, the most stages won wins (ties all win a stage); level on that, by your places, then your points.',
};
const NTH = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
/** ": 4 for first, 3 for second ..." for the overall by places: its points, else one for each of you below you, plus one. */
function placesWords(o) {
  if (Array.isArray(o.places) && o.places.length) return `: ${listOf(o.places.map((p, i) => `${p} for ${NTH[i]}`))}, nothing below that.`;
  return ': one point for each of you below you, plus one.';
}
/**
 * A game in stages in words (A12 part 1): "A game in two stages for Survivor 51: Before the merge, a Weekly Lineup ...; then
 * After the merge, an Outlast .... Overall, each stage's points add up.", How it works the overall then each stage's sentence and
 * rules, the details its own (who can join, locked down).
 */
function describeStages(s, ctx) {
  const w = wordsOf(ctx);
  const stages = s.stages.filter((x) => isObj(x) && isObj(x.game));
  // A12 part 2b: a stage the one before's 'next-stage' fallback starts begins once there are no more groups (and on its own kinds'
  // change, when it has any: whichever comes first); the stage with the fallback runs until then.
  const noGroups = `once there are no more ${w.group}s`;
  // A12 part 3: a side stage opens each time the groups last, beside the game's own stages.
  const mains = mainCount(stages);
  const heldWords = (side) => `${say(side.held)} ${side.held === 1 ? w.part : w.parts}`;
  const fromWords = (st, i) => {
    const side = stageSide(st);
    if (side) return `each time the ${w.group}s hold ${heldWords(side)}, until they change`;
    const on = stageOn(st);
    if (!on) return null;
    if (!fallsTo(stages, i)) return onWords(on);
    return on.change.length ? `${onWords(on)}, or ${noGroups}` : noGroups;
  };
  // A12 part 4b: a stage on another season said in its season's words (ctx.seasons), and named there.
  const seasonOf = (st) => {
    const sn = stageSeason(st);
    if (!sn) return null;
    const c = isObj(ctx) && isObj(ctx.seasons) ? ctx.seasons[seasonKey(sn)] : undefined;
    return { ctx: isObj(c) ? c : {}, label: isObj(c) && c.show ? c.show : `season ${sn.number} of ${sn.show}` };
  };
  const each = stages.map((st, i) => {
    const next = stages[i + 1];
    const nextOn = next ? stageOn(next) : null;
    const until = !nextOn ? false : !fallsTo(stages, i + 1) ? true : nextOn.change.length ? `until the format changes, or there are no more ${w.group}s` : `until there are no more ${w.group}s`;
    const there = seasonOf(st);
    const d = describeSpec(st.game, { ...(there ? there.ctx : isObj(ctx) ? ctx : {}), show: null, fromChange: fromWords(st, i), untilChange: until });
    return { label: st.name || `Stage ${i + 1}`, on: there ? there.label : null, d, sentence: d.sentence.replace(/^An? /, (m) => m.toLowerCase()).replace(/\.$/, '') };
  });
  const parts = [{ text: `A game in ${say(stages.length)} stages`, at: 'preset' }];
  const others = [...new Set(each.map((x) => x.on).filter(Boolean))];
  if (w.show) parts.push({ text: ` for ${[w.show, ...others].join(' and ')}`, at: 'about' });
  parts.push({ text: ': ', at: null });
  each.forEach((x, i) => parts.push({ text: `${!i ? '' : i < mains ? '; then ' : i === mains ? `; and beside ${mains > 1 ? 'them' : 'it'}, ` : '; and '}${x.label}${x.on ? ` on ${x.on}` : ''}, ${x.sentence}`, at: 'span' }));
  const o = isObj(s.overall) ? s.overall : { by: 'points' };
  const overall = o.by === 'places' ? `${OVERALL_WORDS.places}${placesWords(o)}` : OVERALL_WORDS[o.by] || OVERALL_WORDS.points;
  parts.push({ text: `. ${overall}`, at: 'rank' });
  const rules = [overall];
  if (o.by === 'places' || o.by === 'wins') rules.push("A stage counts once it's over.");
  // A12 part 2: a format change, and how the game takes it.
  const moved = stages.find((st) => stageOn(st));
  const ch = isObj(s.extras) && isObj(s.extras.changes) ? s.extras.changes : { ok: 'auto', unanswered: 'start' };
  if (moved) {
    rules.push("A change of format counts once research is sure of it: from the episode it takes effect, or the next still to play.");
    // A14 part 1: or the players vote on it.
    if (ch.ok === 'vote') rules.push(`You vote on whether a new stage starts: once more than half of you say the same, that's it; else the most votes by its first episode decide, and a tie or no votes ${ch.unanswered === 'start' ? 'starts it anyway' : 'carries the game on as it is'}. Whoever runs the game can still call it off.`);
    else rules.push(ch.ok === 'maker' ? `Whoever runs the game says whether a new stage starts; if nobody does by its first episode, ${ch.unanswered === 'start' ? 'it starts anyway' : 'the game carries on as it is'}.` : 'The new stage starts by itself; whoever runs the game can call it off.');
  }
  // A12 part 3: a side stage, when it opens and closes.
  stages.forEach((st, i) => {
    const side = stageSide(st);
    if (!side) return;
    const label = each[i].label;
    rules.push(`${label}: once research is sure the ${w.group}s have held ${heldWords(side)} and go on as they are, it opens with the next ${w.part} (a new one each time they last), and plays until research is sure they changed, its points kept; until research is sure, it carries on.`);
    if (ch.ok === 'vote') rules.push(`${label}: you vote on whether it opens: once more than half of you say the same, that's it; else the most votes by its first ${w.part} decide, and a tie or no votes ${ch.unanswered === 'start' ? 'opens it anyway' : "doesn't"}. Whoever runs the game can still call it off.`);
    else rules.push(ch.ok === 'maker' ? `${label}: whoever runs the game says whether it opens; if nobody does by its first ${w.part}, ${ch.unanswered === 'start' ? 'it opens anyway' : "it doesn't"}.` : `${label}: it opens by itself; whoever runs the game can call it off.`);
  });
  // A12 part 4a: a stage alongside the game's own, at the same time.
  stages.forEach((st, i) => {
    if (i < mains || !stageAlongside(st)) return;
    rules.push(`${each[i].label}: it plays at the same time as ${mains > 1 ? "the game's own stages" : each[0].label}, its points counting in the overall with ${mains > 1 ? 'theirs' : `${each[0].label}'s`}.`);
  });
  // A12 part 2b: where a 'next-stage' fallback ends its stage.
  stages.forEach((st, i) => {
    if (!nextStageAts(st.game).length || !stages[i + 1]) return;
    rules.push(`${each[i].label}: once research is sure nobody is in a ${w.group} going into ${article(w.part)} ${w.part}, it ends and ${each[i + 1].label} starts; until it's sure, ${article(w.part)} ${w.part} it can't play doesn't count.`);
  });
  // A12 part 4b: a stage on another season counts its own episodes, and the game ends with its own stages wherever they play.
  if (others.length) rules.push(`A stage on ${others.join(' or ')} plays that season's episodes, each counted as you've seen them there; the game ends once its own stages are over, wherever they play.`);
  each.forEach((x) => rules.push(`${x.label}${x.on ? ` (${x.on})` : ''}: ${x.d.sentence}`, ...x.d.rules.map((r) => `${x.label}: ${r}`)));
  // A14 part 1: the players vote on each stage a change (or a grouping that lasts) would start.
  if (ch.ok === 'vote' && (moved || stages.some((st) => stageSide(st)))) parts.push({ text: `${/\.$/.test(overall) ? '' : '.'} You vote on each new stage.`, at: 'extras' });
  const e = isObj(s.extras) ? s.extras : {};
  const details = [
    { id: 'join', label: 'Who can join', recommended: e.join === null, value: e.lockedDown ? "Nobody new while it's locked down" : own(JOIN_WORDS, e.join) || JOIN_WORDS.open },
    { id: 'lockedDown', label: 'Locked down', recommended: e.lockedDown !== true, value: e.lockedDown ? 'Nobody new, and the rules stay as they are' : 'No' },
  ];
  return { name: null, sentence: parts.map((p) => p.text).join(''), parts, rules, details };
}

/**
 * The spec in words: its sentence (and its parts), How it works and its details. A spec still being made (no score yet, a
 * part missing) is said as far as it goes: the wizard shows it while the GPT and the person fill it in.
 */
function describeSpec(spec, ctx) {
  const full = fullSpec(spec);
  // A12 part 1: a game in stages, said stage by stage.
  if (Array.isArray(full.stages) && playsAs(full) === 'stages') return describeStages(full, ctx);
  const part = (v, dflt) => (isObj(v) ? v : dflt);
  const s = {
    ...full,
    span: part(full.span, { from: 1, to: null }),
    get: part(full.get, {}),
    score: part(full.score, {}),
    rank: part(full.rank, {}),
    ask: Array.isArray(full.ask) ? full.ask.filter(isObj) : [],
    extras: part(full.extras, {}),
  };
  const w = wordsOf(ctx);
  const parts = sentenceParts(s, w);
  return {
    name: nameOf(s),
    sentence: parts.map((p) => p.text).join(''),
    parts,
    rules: rulesOf(s, w),
    details: detailsOf(s, w),
  };
}

module.exports = { describeSpec };
