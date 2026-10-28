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
const { PRESET_LABELS, NAMES, fullSpec, countKind, presetOf, sameValue, own, spanStart, callsAsk, finaleOf, betsFit } = require('./schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const say = (n) => NUMBER_WORDS[n] || String(n);
const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
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
    moments: Array.isArray(c.moments) ? c.moments : null,
    stats: new Map((Array.isArray(c.stats) ? c.stats : []).map((x) => (isObj(x) ? [x.key, x.label || x.key] : [x, x]))),
    phases: new Map((Array.isArray(c.phases) ? c.phases : []).filter(isObj).map((p) => [p.id, p.name || p.id])),
  };
}
/** A phase by its name ("Merged"), else its id. */
const phaseWord = (id, w) => w.phases.get(id) || id;

/** "Episode 7 to the finale", "Games 1–3", "just Game 1", "all season"; a phase start (A3): "from when Merged starts",
 *  and once that's settled "Episode 9 to the finale, starting with Merged" (aired or still to come). */
function spanWords(span, w) {
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

/** A question's words, or its id while it has none yet. */
const askOf = (q) => String(q.ask || q.id || 'A question').trim();
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

/** The preset's name, while the spec still plays the preset's game (the same parts); else null: "A game". */
function nameOf(s) {
  const p = presetOf(s);
  const same = p && p.get.by === s.get.by && countKind(p.count) === countKind(s.count) && p.score.by === s.score.by && p.rank.by === s.rank.by;
  return same ? PRESET_LABELS[s.preset] : null;
}

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
    put(`everyone drafts ${s.get.each}`, 'get');
    if (count === 'start') put(` and starts ${s.count.start} each ${w.part}`, 'count');
    if (count === 'best') put(`, and their best ${s.count.best} count each ${w.part}`, 'count');
  } else if (by === 'pick') {
    put(`everyone picks one ${w.castaway} to ${s.score.means === 'scores' ? 'score' : 'stay in'} each ${w.part}`, 'get');
  } else if (by === 'card') {
    put(`a new bingo card every ${w.part}`, 'get');
  } else if (by === 'squares') {
    put('everyone takes squares on the grid', 'get');
  } else if (s.score.by === 'answers' && callsAsk(s.ask)) {
    put(`two calls before every ${w.part}`, 'get');
  } else if (s.score.by === 'answers') {
    const n = s.ask.length;
    const each = s.ask.some((q) => q.asked === 'each');
    // A7's windows: every few episodes, or once a phase, when nothing's asked every episode.
    const every = s.ask.find((q) => q.asked === 'every');
    const when = each ? `each ${w.part}` : every ? `every ${say(every.every)} ${w.parts}` : s.ask.some((q) => q.asked === 'phase') ? 'each phase' : 'it starts';
    put(`everyone answers ${say(n)} ${n === 1 ? 'question' : 'questions'} before ${one ? `${w.Part} ${first}` : when}`, 'ask');
    if (n) put(`: ${listOf(s.ask.map(questionPhrase))}`, 'ask');
    spanSaid = one;
  } else {
    put('nothing to pick', 'get');
  }
  if (!spanSaid) {
    put(', ');
    put(spanWords(s.span, w), 'span');
  }
  put('.');
  const rules = w.show ? `${w.show}'s rules` : "the show's rules";
  const sc = s.score;
  if (sc.by === 'moments') {
    const changed = changedPoints(sc.points, s.get.own, w.moments);
    put(changed === null ? ` Scored by ${rules}, with the game's own points.` : changed ? ` Scored by ${rules}, with ${say(changed)} ${changed === 1 ? "moment's" : "moments'"} points changed.` : ` Scored by ${rules}.`, 'score');
  } else if (sc.by === 'place') put(' Each scores by how long they last: the last one standing carries you.', 'score');
  else if (sc.by === 'survive') put(' Longest streak wins.', 'rank');
  else if (sc.by === 'answers' && callsAsk(s.ask)) put(' Most right by the finale wins.', 'score');
  else if (sc.by === 'lines') put(' Most lines by the finale wins.', 'score');
  else if (sc.by === 'stats' && isObj(sc.points)) put(` Scored ${statsWords(sc.points, w)}.`, 'score');
  else if (sc.by === 'answers') {
    const pts = [...new Set(s.ask.map((q) => q.points))];
    put(pts.length === 1 ? ` ${pts[0] === 1 ? 'A point' : pointsWord(pts[0])} for each right answer.` : ' Points for each right answer.', 'score');
  }
  const rank = { matchups: ' Played head to head.', categories: ' Ranked by category.', roto: ' Ranked roto-style.' }[s.rank.by];
  if (rank) put(rank, 'rank');
  return parts;
}

/** When a question is asked, as How it works says it (A7's windows too). */
function whenWords(q, w, each) {
  if (q.asked === 'each') return Number.isInteger(q.over) && q.over > 1 ? `Before each ${w.part}, about it and the next ${say(q.over - 1)}: ` : `Before each ${w.part}: `;
  if (q.asked === 'every') return `Every ${say(q.every)} ${w.parts}, before the first: `;
  if (q.asked === 'phase') return 'Once a phase, as it begins: ';
  return q.closes === 'finale' ? 'Before the finale: ' : each ? 'Before it starts: ' : '';
}
/** One question as How it works says it: when it's asked, what it is, and what a right answer earns. */
function questionRule(q, w, each) {
  const when = whenWords(q, w, each);
  const pts = typeof q.points === 'number' ? q.points : null;
  let earn = pts === null ? '' : ` ${cap(pointsWord(pts))} if you're right.`;
  if (NAMES.includes(q.answer) && q.pick > 1 && pts !== null) earn = ` Name ${say(q.pick)}: ${pointsWord(pts)} for each one right.`;
  if (q.answer === 'number' && pts !== null) earn = ` The closest wins ${pointsWord(pts)}.`;
  // A question about each person (A6): an answer for each of them, each graded on its own.
  if (q.each && pts !== null) {
    earn = q.answer === 'number'
      ? ` Answer for each ${w.castaway} still in: the closest on each wins ${pointsWord(pts)}.`
      : ` Answer for each ${w.castaway} still in: ${pointsWord(pts)} for each one right.`;
  }
  const line = q.answer === 'overUnder' && typeof q.line === 'number' ? ` The line is ${q.line}.` : '';
  const from = q.answer === 'person' && q.from === 'team' ? ' From your own team.' : '';
  return `${when}${askOf(q)}${line}${from}${earn}`;
}

/** How it works: today's five games say what the Rules sheet says (game-rules.ts), the rest in the same voice. */
function rulesOf(s, w) {
  const rules = [];
  const by = s.get.by;
  const count = countKind(s.count);
  const shared = s.get.own === 'shared';
  const draft = shared
    ? `Draft a team of ${say(s.get.each)} in private; everyone's picks are revealed at once, and the same ${w.castaway} can be on more than one team.`
    : `Snake-draft a team of ${say(s.get.each)}: once someone picks a ${w.castaway}, nobody else can have them.`;
  const waivers = s.extras.waivers;
  if (by === 'draft') {
    rules.push(draft);
    if (count === 'start') rules.push(`Before each ${w.part}, start ${say(s.count.start)}. Only starters score.`);
    if (count === 'best') rules.push(`Each ${w.part}, your best ${say(s.count.best)} count.`);
    if (count === 'all' && s.score.by !== 'place') rules.push('Everyone you draft scores.');
    if (s.score.by === 'moments') rules.push(w.groups.length ? `Points come from what happens: ${listOf(w.groups)}.` : `Points come from what happens in each ${w.part}.`);
    if (s.score.by === 'stats' && isObj(s.score.points)) rules.push(`Points come from their stats: ${statsWords(s.score.points, w)}.`);
    if (count === 'start') rules.push(`Lineups lock when the ${w.part} starts. Change yours as often as you like until then.`);
    if (s.score.by === 'place') {
      rules.push(`Each ${w.castaway} earns 1 point, plus 1 for every boot they outlast.`);
      rules.push('So they end on their place in the boot order: the last one standing carries you.');
      rules.push('No lineups to set. Just watch.');
    }
    if (count === 'start') {
      const pickups = isObj(waivers) && waivers.replace !== 'never';
      const swaps = isObj(waivers) && isObj(waivers.windows) && waivers.windows.swaps > 0;
      if (pickups) rules.push(`Lose someone? Pick who comes in on waivers.${swaps ? ' Waiver windows let you swap someone too.' : ''}`);
      else if (swaps) rules.push(`Waiver windows let you swap one of your ${w.castaways} for someone new.`);
    }
  } else if (by === 'pick') {
    rules.push(s.score.means === 'scores'
      ? `No draft. Before each ${w.part}, pick one ${w.castaway} you think scores in it.`
      : `No draft. Before each ${w.part}, pick one ${w.castaway} you think stays in.`);
    rules.push('Right: your streak grows. Wrong, or no pick: it resets. Your best streak still counts.');
    rules.push(`You can't pick the same ${w.castaway} again until you've used everyone still in, and never two ${w.parts} in a row.`);
    rules.push('Longest streak wins; ties go to the most right picks.');
  } else if (s.score.by === 'answers' && callsAsk(s.ask)) {
    rules.push('No draft, no team. Before each show starts, make two calls about what will happen in it.');
    rules.push('The couch says what happened as it watches: two of you agreeing settles a call.');
    rules.push('Change your calls until it starts. Nobody sees them until then.');
    rules.push('Most right calls by the finale wins.');
  } else if (by === 'card') {
    rules.push('No draft, no team. Every show you get a new bingo card: eight things that might happen, the middle one free.');
    rules.push('Tick a square when it happens. Three in a row, down or across makes a line.');
    rules.push('A square counts once the couch agrees it happened: two of you ticking it, or saying so, settles it.');
    rules.push('Most lines by the finale wins.');
  } else if (by === 'squares') {
    rules.push('Take your squares on the grid before it starts.');
  }
  if (s.score.by === 'answers' && !callsAsk(s.ask)) {
    const each = s.ask.some((q) => q.asked !== 'once');
    rules.push(`No draft, no team. Answer ${say(s.ask.length)} ${s.ask.length === 1 ? 'question' : 'questions'}${each ? '' : ' before it starts'}:`);
    for (const q of s.ask) rules.push(questionRule(q, w, each));
    rules.push(each ? `Change an answer until its ${w.part} starts. Nobody sees them until then.` : 'Change your answers until it starts. Nobody sees them until then.');
    // A late lock (A7).
    if (isObj(s.extras.lateLock)) rules.push(`Watching late? Answer before you watch: until you've seen it, up to ${s.extras.lateLock.hours} hours after it airs.`);
    rules.push('Most points wins.');
  }
  const rank = {
    matchups: `You play someone head to head each ${w.part}: the most points wins it.`,
    categories: 'Ranked by category: the most in each stat earns the most.',
    roto: 'Ranked roto-style: each stat ranks everyone, and the ranks add up.',
  }[s.rank.by];
  if (rank) rules.push(rank);
  // Side bets count only beside a draft (a pool, Weekly Calls and Weekly Bingo never scored them).
  if (isObj(s.extras.bets) && betsFit(s)) {
    rules.push(`Predictions: a right answer earns its points (usually ${s.extras.bets.points}), once at least two of you have answered.`);
  }
  const fin = s.get.by === 'draft' ? finaleOf(s.ask) : null;
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
  const end = s.span.to;
  if (end !== null) rules.push(end === spanStart(s.span) ? `It's one ${w.part}: ${w.Part} ${end}, then it's over.` : `It ends with ${w.Part} ${end}: nothing after it scores, and the table there is final.`);
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
      s.get.own === 'shared' ? 'In private, revealed at once' : 'Snake: everyone takes turns',
      d.timer ? `${d.timer === 60 ? '60 seconds' : '2 minutes'} a pick, then ${d.away === 'queue' ? 'from their queue' : 'it waits'}` : 'No pick timer',
      d.at ? `at ${d.at}` : 'no time set',
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
    out.push({ id: 'waivers', label: 'Waivers', recommended: rec('waivers'), value: `${own(REPLACE_WORDS, e.waivers.replace) || 'Replacements as set'} · ${windows}` });
  }
  // Side bets and finale predictions go with a draft: nothing else scores them.
  if (betsFit(s)) out.push({ id: 'bets', label: 'Side bets', recommended: rec('bets'), value: isObj(e.bets) ? `On, ${pointsWord(e.bets.points)} each` : 'Off' });
  if (s.get.by === 'draft') {
    const f = finaleOf(s.ask);
    const presetAsk = presetOf(s) ? presetOf(s).ask : [];
    out.push({ id: 'finale', label: 'Finale predictions', recommended: sameValue(s.ask, presetAsk), value: f ? `Top 3: ${pointsWord(f.top3)} each, the winner: ${pointsWord(f.winner)}${f.from === 'own' ? ', from your own team' : ''}` : 'Off' });
  }
  if (s.get.by === 'pick') out.push({ id: 'calls', label: 'Who goes home?', recommended: rec('calls'), value: e.calls ? `A call every ${w.part}, beside the pick` : 'Off' });
  if (countKind(s.count) === 'start') out.push({ id: 'hideStarters', label: 'Starters', recommended: rec('hideStarters'), value: e.hideStarters ? 'Hidden until the lock' : "Shown as they're set" });
  // A game of questions' late lock (A7).
  if (s.score.by === 'answers' && !callsAsk(s.ask)) out.push({ id: 'lateLock', label: 'Watching late', recommended: rec('lateLock'), value: isObj(e.lateLock) ? `Answer until you've seen it, up to ${e.lateLock.hours} hours after it airs` : 'Answers lock as it starts' });
  out.push({ id: 'lockedDown', label: 'Locked down', recommended: rec('lockedDown'), value: e.lockedDown ? 'Nobody new, and the rules stay as they are' : 'No' });
  return out;
}

/**
 * The spec in words: its sentence (and its parts), How it works and its details. A spec still being made (no score yet, a
 * part missing) is said as far as it goes: the wizard shows it while the GPT and the person fill it in.
 */
function describeSpec(spec, ctx) {
  const full = fullSpec(spec);
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
