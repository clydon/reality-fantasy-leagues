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
const { PRESET_LABELS, NAMES, fullSpec, countKind, presetOf, sameValue, own, spanStart, callsAsk, finaleOf, betsFit, poolParts, budgetParts, keepParts, seatPeople, knockoutParts, answerParts, livesQuestion, matchupParts, questionsGame, teamParts } = require('./schema.js');
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

/** The preset's name, while the spec still plays the preset's game (the same parts); else null: "A game". Outlast in reverse
 *  (A9 part 2) is another game. */
function nameOf(s) {
  const p = presetOf(s);
  // A pool with lives ranked by who's still standing (A10 part 2) is still a Survival Pool; a draft's stock market ranked by worth
  // (part 3c) is still its draft's game.
  // A11 part 1: a draft that knocks players out is still its draft's game; part 4, one played head to head.
  const rank = p && (p.rank.by === s.rank.by || (s.score.by === 'survive' && s.rank.by === 'standing') || (s.get.by === 'draft' && (s.rank.by === 'worth' || s.rank.by === 'standing' || s.rank.by === 'matchups')));
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
    put('everyone takes squares on the grid', 'get');
  } else if (s.score.by === 'answers' && callsAsk(s.ask)) {
    put(`two calls before every ${w.part}`, 'get');
  } else if (s.score.by === 'answers') {
    const n = s.ask.length;
    const each = s.ask.some((q) => q.asked === 'each');
    // A7's windows: every few episodes, or once a phase, when nothing's asked every episode.
    const every = s.ask.find((q) => q.asked === 'every');
    const when = each ? `each ${w.part}` : every ? `every ${say(every.every)} ${w.parts}` : s.ask.some((q) => q.asked === 'phase') ? 'each phase' : n && s.ask.every((q) => q.closes === 'finale') ? 'the finale' : 'it starts';
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
    // A9 part 2: when the points multiply.
    for (const rule of timesRules(sc, w)) put(` ${rule}`, 'score');
  } else if (sc.by === 'place' && sc.reverse === true) put(' Each scores more the earlier they go home: the first one out carries you.', 'score');
  else if (sc.by === 'place') put(' Each scores by how long they last: the last one standing carries you.', 'score');
  else if (sc.by === 'survive') {
    // A10 part 2: lives, a buyback, mulligans; last one standing.
    for (const said of poolPhrases(s, w)) put(` ${said}`, 'score');
    put(s.rank.by === 'standing' ? ' Last one standing wins.' : ' Longest streak wins.', 'rank');
    // A11 part 2: last one standing's end, as far as the spec says it.
    const { oneLeft, allOut } = poolOf(s);
    if (oneLeft === 'ends') put(" Once one of you is left, it's over.", 'rank');
    if (allOut === 'share') put(' If everyone left goes out together, they share the win.', 'rank');
    if (allOut === 'back') put(" If everyone left goes out together, they're all back in.", 'rank');
  }
  else if (sc.by === 'answers' && callsAsk(s.ask)) put(' Most right by the finale wins.', 'score');
  else if (sc.by === 'lines') put(isNum(sc.points) && sc.points !== 1 ? ` ${cap(pointsWord(sc.points))} a line; most points by the finale wins.` : ' Most lines by the finale wins.', 'score');
  else if (sc.by === 'stats' && isObj(sc.points)) put(` Scored ${statsWords(sc.points, w)}.`, 'score');
  else if (sc.by === 'answers') {
    const pts = [...new Set(s.ask.map((q) => q.points))];
    const all = (f) => s.ask.length > 0 && s.ask.every(f);
    const some = (f) => s.ask.some(f);
    const each = pts.length === 1 ? `${pts[0] === 1 ? 'A point' : pointsWord(pts[0])}` : 'Points';
    // A9's ways of combining, as far as they're the whole game's.
    let said = ` ${each} for each right answer.`;
    if (all((q) => q.share === 'split')) said = ` ${each} each time, split between everyone right.`;
    else if (all((q) => q.share === 'only')) said = ` ${each} for a right answer nobody else has.`;
    else if (all((q) => q.wager !== undefined)) {
      const w0 = s.ask[0].wager;
      const stake = all((q) => q.wager === w0) ? (w0 === 'total' ? 'any of your points' : `up to ${pointsWord(w0)}`) : 'points';
      said = `${pts.length === 1 && pts[0] === 0 ? '' : said} Stake ${stake} on ${s.ask.length === 1 ? 'it' : 'each'}: double or nothing.`;
    }
    put(said, 'score');
    if (some((q) => q.rollover)) put(" If nobody's right, the points roll over.", 'score');
    if (some((q) => isObj(q.shrink))) put(some((q) => isObj(q.shrink) && q.shrink.per === 'change') ? ' Changing your call once it starts costs points.' : " The earlier you call it, the more it's worth.", 'score');
    for (const p of parlaysOf(sc)) {
      const legs = p.of.map((id) => s.ask.find((q) => q.id === id)).filter(Boolean).map(questionPhrase);
      put(` Right on ${listOf(legs)} together: ${{ 2: 'double', 3: 'triple', 4: 'quadruple' }[p.times] || `${p.times} times`} the points.`, 'score');
    }
  }
  // A11 part 1: a draft's cuts and race.
  for (const said of knockoutPhrases(s, w)) put(` ${said}`, 'rank');
  // A10 part 3c: a stock market ranked by worth.
  // A11 part 4: head to head, with its playoffs (a sports spec's, which the engine doesn't play yet: just its name).
  const h2h = matchupParts(s);
  // A11 part 5: teams of players (head to head between them, when it's that).
  const teams = teamParts(s);
  if (teams) put(` ${teamPhrase(teams)}`, 'rank');
  const rank = h2h ? ` ${matchupPhrase(h2h, w, !!teams)}` : { worth: " Most worth wins: cash plus the team at today's prices.", matchups: ' Played head to head.', categories: ' Ranked by category.', roto: ' Ranked roto-style.' }[s.rank.by];
  if (rank) put(rank, 'rank');
  // A10 part 4b: a team two people share.
  if (seatPeople(s) > 1) put(` Up to ${say(seatPeople(s))} of you can share a team.`, 'extras');
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
  // A8's answers.
  if (pts !== null) {
    if (q.answer === 'order') earn = ` Put ${say(q.pick)} in order: ${pointsWord(pts)} for each in its place${q.within ? `, or within ${say(q.within)} ${q.within === 1 ? 'place' : 'places'} of it` : ''}.`;
    if (q.answer === 'confidence') earn = ` Rank ${say(q.pick)}, the one you're surest of first: each one right scores ${pointsWord(pts)} times its rank from the bottom (${q.pick} for the first).`;
    if (q.answer === 'chips') earn = ` Spread ${say(q.chips)} chips: ${pointsWord(pts)} for each chip on someone right.`;
    if (q.answer === 'split') earn = ` ${cap(pointsWord(pts))} for the split exactly.`;
    if (q.answer === 'pairs') earn = ` ${cap(say(q.pairs))} ${q.pairs === 1 ? 'pair' : 'pairs'}, the same for everyone: ${pointsWord(pts)} for each one you call.`;
  }
  // A question about each person (A6): an answer for each of them, each graded on its own.
  if (q.each && pts !== null) {
    earn = q.answer === 'number'
      ? ` Answer for each ${w.castaway} still in: the closest on each wins ${pointsWord(pts)}.`
      : ` Answer for each ${w.castaway} still in: ${pointsWord(pts)} for each one right.`;
  }
  const line = q.answer === 'overUnder' && typeof q.line === 'number' ? ` The line is ${q.line}.` : '';
  const from = q.answer === 'person' && q.from === 'team' ? ' From your own team.' : '';
  // A wager (A8): its stake, double or nothing; A9's, any of your points.
  const wager = Number.isInteger(q.wager)
    ? ` Stake up to ${pointsWord(q.wager)} on it: right, you win them too; wrong, you lose them.`
    : q.wager === 'total' ? ' Stake any of your points on it: right, you win them too; wrong, you lose them.' : '';
  return `${when}${askOf(q)}${line}${from}${earn}${wager}${combineWords(q, w)}`;
}
/** How a question's points combine (A9), as How it works says it. */
function combineWords(q, w) {
  let out = '';
  if (q.share === 'split') out += ' The points are a pot, split between everyone who gets it right: the fewer of you, the more each gets.';
  // A person or group answer counts each pick on its own (A9 part 2).
  if (q.share === 'only') out += NAMES.includes(q.answer) && !q.each ? ' A right pick only scores if nobody else named it.' : " It only scores if you're the only one who gets it right.";
  if (q.rollover) out += ` If nobody gets it, its points roll over to the next one.`;
  if (isObj(q.shrink)) {
    out += q.shrink.per === 'change'
      ? ` Once it's started, each change costs ${pointsWord(q.shrink.points)}.`
      : ` It's worth ${pointsWord(q.shrink.points)} less for each ${w.part} that's started when you make or change it: the earlier you call it, the more it's worth.`;
  }
  return out;
}

/** A draft's cut in words (A11 part 1), as a sentence: "Each episode the lowest scorer is out.", "Every two episodes the two
 *  lowest over them are out.", "After Episode 6 the bottom half is cut.", "Before Merged starts the bottom two are cut." */
function cutPhrase(c, w) {
  const many = c.out === 'half' ? 'the bottom half' : c.out === 1 ? null : `the bottom ${say(c.out)}`;
  if (Number.isInteger(c.at.every)) {
    const when = c.at.every === 1 ? `Each ${w.part}` : `Every ${say(c.at.every)} ${w.parts}`;
    const over = c.at.every === 1 ? '' : ' over them';
    if (c.out === 'half') return `${when} the bottom half by their points${over} are out.`;
    return c.out === 1 ? `${when} the lowest scorer${over} is out.` : `${when} the ${say(c.out)} lowest scorers${over} are out.`;
  }
  const when = Number.isInteger(c.at.episode) ? `After ${w.Part} ${c.at.episode}` : `Before ${phaseWord(c.at.phase, w)} starts`;
  return `${when} ${many || 'the lowest on points'} ${c.out === 1 || c.out === 'half' ? 'is' : 'are'} cut.`;
}
/** The sentence's words for a draft's race and cuts (A11 part 1), and a game of questions' with its lives (part 2b). */
function knockoutPhrases(s, w) {
  const a = answerParts(s);
  const k = knockoutParts(s) || a;
  if (!k) return [];
  // A11 part 3: co-op, the couch's lives together.
  if (a && a.coop) return coopPhrases(s, a);
  const out = [];
  if (a && a.lives) out.push(`${cap(say(a.lives))} ${a.lives === 1 ? 'life' : 'lives'}: a wrong answer${livesWhich(s, a)}, or none, costs one.`);
  out.push(...k.cuts.map((c) => cutPhrase(c, w)));
  if (k.race) out.push(`First to ${pointsWord(k.race.to)} wins: the game ends there.`);
  else if (k.cuts.length || (a && a.lives)) out.push('Last one standing wins.');
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
  const all = s.ask.filter(livesQuestion).map((q) => q.id);
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
  if (a.lives || a.cuts.length) {
    out.push("Once you're out you answer nothing more and score nothing more: your points stay where they were.");
    out.push(`Last one standing wins: whoever's still in by their points, then whoever went out last. ${a.oneLeft === 'plays' ? 'With one of you left it plays on to the end, their points still growing.' : "Once one of you is left, or none, it's over."}`);
    if (a.allOut === 'share') out.push(`If everyone still in goes out the same ${w.part}, you're all out and share the win, whatever your points.`);
    if (a.allOut === 'back') out.push(`If everyone still in goes out the same ${w.part}, you're all back in for the next, with the lives you had.`);
  }
  if (a.race) out.push(`First to ${pointsWord(a.race.to)} wins: the game ends after that ${w.part}, and the most points then win (a tie shares it). If nobody gets there, the most points at the end win.`);
  else if (!a.lives && !a.cuts.length) out.push('Most points wins.');
  out.push(`A life, a cut or a finish waits for ${article(w.part)} ${w.part}'s answers to be settled.`);
  return out;
}
/** How a draft's race and cuts work (A11 part 1), a rule a line, as the engine plays them (KnockoutLogic). */
function knockoutRules(s, w) {
  const k = knockoutParts(s);
  if (!k) return [];
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
/** The sentence's words for teams of players (A11 part 5: schema.js teamParts): "Played in two teams, drawn at random at the start:
 *  a team's points are its members' average." */
function teamPhrase(t) {
  const named = t.names.every(Boolean) ? ` (${listOf(t.names)})` : '';
  const made = t.made === 'choose' ? 'each of you picking yours before it starts' : 'drawn at random at the start';
  return `Played in ${say(t.of)} teams${named}, ${made}: a team's points are its members' ${t.score === 'sum' ? 'added up' : 'average'}.`;
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
    out.push(`The playoffs: the top ${say(p.teams)}${teams ? ' teams' : ''} in the standings, ${p.from !== null ? '' : 'over '}${playoffWhen(p, w)}, a round ${article(w.part)} ${w.part}. The best seed plays the lowest, and whoever wins goes through; a tie goes to the better seed.${2 ** p.rounds - p.teams === 1 ? ' The top seed gets a bye in the first round.' : 2 ** p.rounds > p.teams ? ` The top ${say(2 ** p.rounds - p.teams)} seeds get a bye in the first round.` : ''}`);
    out.push(`Whoever wins the final wins the game${p.from !== null ? `: it ends there` : ''}. If the season ends before the final, the best seed still in wins.`);
  } else {
    out.push('Most wins at the end wins.');
  }
  out.push(asks ? `${cap(article(w.part))} ${w.part}'s matchups wait for its full results, and for its questions to be settled.` : `${cap(article(w.part))} ${w.part}'s matchups wait for its full results.`);
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
    rules.push(...drawRules(s, w));
    rules.push(...keepRules(s, w));
    if (count === 'start') rules.push(`Before each ${w.part}, start ${say(s.count.start)}. Only starters score.`);
    // A9 part 2: best ball, a lineup's captain, when the points multiply, Outlast in reverse.
    if (count === 'best') rules.push(`Each ${w.part}, your best ${say(s.count.best)} count, whoever they are: no lineups to set.`);
    if (count === 'all' && s.score.by !== 'place') rules.push('Everyone you draft scores.');
    if (s.score.by === 'moments') rules.push(w.groups.length ? `Points come from what happens: ${listOf(w.groups)}.` : `Points come from what happens in each ${w.part}.`);
    if (s.score.by === 'stats' && isObj(s.score.points)) rules.push(`Points come from their stats: ${statsWords(s.score.points, w)}.`);
    if (count === 'start' && isObj(s.score.captain) && isNum(s.score.captain.times)) {
      rules.push(`Name one of your starters captain each ${w.part}: their points count ${timesWord(s.score.captain.times)}. Name nobody and your last captain keeps it, while they're starting.`);
    }
    if (s.score.by === 'moments') {
      const times = timesRules(s.score, w);
      rules.push(...times);
      if (times.length > 1) rules.push(`${cap(article(w.part))} ${w.part} in two of them counts both.`);
    }
    if (count === 'start') rules.push(`Lineups lock when the ${w.part} starts. Change yours as often as you like until then.`);
    rules.push(...groupSlotRules(s, w));
    if (s.score.by === 'place' && s.score.reverse === true) {
      rules.push(`Each ${w.castaway} earns 1 point, plus 1 for everyone who outlasts them.`);
      rules.push('So the first one out scores the most and the winner 1: the earlier yours go home, the better.');
      rules.push("While they're still in, they count what they'd score if they went home next.");
      rules.push('No lineups to set. Just watch.');
    } else if (s.score.by === 'place') {
      rules.push(`Each ${w.castaway} earns 1 point, plus 1 for every boot they outlast.`);
      rules.push('So they end on their place in the boot order: the last one standing carries you.');
      rules.push('No lineups to set. Just watch.');
    }
    // A10 part 3c: a stock market's moves are its trades (drawRules says them).
    if ((count === 'start' || count === 'best') && !(budgetParts(s) || {}).trade) {
      const pickups = isObj(waivers) && waivers.replace !== 'never';
      const swaps = isObj(waivers) && isObj(waivers.windows) && waivers.windows.swaps > 0;
      if (pickups) rules.push(`Lose someone? Pick who comes in on waivers.${swaps ? ' Waiver windows let you swap someone too.' : ''}`);
      else if (swaps) rules.push(`Waiver windows let you swap one of your ${w.castaways} for someone new.`);
    }
    // A11 part 1: players knocked out, and a race.
    rules.push(...knockoutRules(s, w));
    // A11 part 5: teams of players.
    rules.push(...teamRules(s, w, !!matchupParts(s)));
    // A11 part 4: head to head, with playoffs.
    rules.push(...matchupRules(s, w));
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
    rules.push('Right: your streak grows. Wrong, or no pick: it resets. Your best streak still counts.');
    rules.push(...poolRules(s, w));
    // A11 part 2: a pick that never repeats, and what a night with nobody left to pick does.
    const never = poolOf(s).never;
    if (never) {
      rules.push(`You can't pick the same ${w.castaway} twice, all season.`);
      rules.push(never.fallback === 'skip'
        ? `Once you've picked everyone still in, ${article(w.part)} ${w.part} you've nobody left to pick doesn't count for you, either way.`
        : `Once you've picked everyone still in, you've nobody left to pick: that counts as a missed pick.`);
    } else rules.push(`You can't pick the same ${w.castaway} again until you've used everyone still in, and never two ${w.parts} in a row.`);
    rules.push(s.rank.by === 'standing'
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
    rules.push('Take your squares on the grid before it starts.');
  }
  if (s.score.by === 'answers' && !callsAsk(s.ask)) {
    const each = s.ask.some((q) => q.asked !== 'once');
    rules.push(`${teamParts(s) ? 'No draft.' : 'No draft, no team.'} Answer ${say(s.ask.length)} ${s.ask.length === 1 ? 'question' : 'questions'}${each ? '' : ' before it starts'}:`);
    for (const q of s.ask) rules.push(questionRule(q, w, each));
    // A9's parlays.
    for (const p of parlaysOf(s.score)) {
      const legs = p.of.map((id) => s.ask.find((q) => q.id === id)).filter(Boolean);
      const times = { 2: 'double', 3: 'triple', 4: 'quadruple' }[p.times] || `${p.times} times`;
      rules.push(`A parlay: right on ${listOf(legs.map((q) => `"${q.ask}"`))} together, and your points on them are ${times}.`);
    }
    rules.push(each ? `Change an answer until its ${w.part} starts. Nobody sees them until then.` : 'Change your answers until it starts. Nobody sees them until then.');
    // A late lock (A7).
    if (isObj(s.extras.lateLock)) rules.push(`Watching late? Answer before you watch: until you've seen it, up to ${s.extras.lateLock.hours} hours after it airs.`);
    // A11 part 2b: a race, cuts and lives say who wins; part 4b, head to head.
    const asks = answerParts(s);
    // A11 part 5: teams of players say who wins themselves, unless head to head does.
    rules.push(...teamRules(s, w, !!(asks && asks.matchups)));
    if (asks && asks.matchups) rules.push(...matchupRules(s, w));
    else if (asks && (asks.race || asks.cuts.length || asks.lives !== null)) rules.push(...answerKnockoutRules(s, w));
    else if (!(asks && asks.teams)) rules.push('Most points wins.');
  }
  // A11 part 4: a draft's head to head, and a game of questions' (part 4b), say themselves (matchupRules); a sports spec's, which
  // the engine doesn't play yet, its name.
  const rank = {
    matchups: matchupParts(s) ? null : `You play someone head to head each ${w.part}: the most points wins it.`,
    categories: 'Ranked by category: the most in each stat earns the most.',
    roto: 'Ranked roto-style: each stat ranks everyone, and the ranks add up.',
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
      s.get.order === 'draw' ? `At random, out of ${s.get.own === 'shared' ? 'a hat each' : 'one hat'}` : s.get.order === 'auction' ? 'An auction: sealed bids, settled at once' : s.get.own === 'shared' ? 'In private, revealed at once' : 'Snake: everyone takes turns',
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
  // A10 part 4b: a team two people share (never beside a call or a bingo card: each person's own).
  if (!(s.score.by === 'lines' || callsAsk(s.ask) || e.calls === true)) {
    const people = seatPeople(s);
    out.push({ id: 'seats', label: 'Sharing a team', recommended: people === 1, value: people > 1 ? `Up to ${say(people)} a team` : 'One each' });
  }
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
