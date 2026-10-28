// Grading a game's questions (docs/PLAN-start-a-game-gpt.md step A4): how each question in a spec's `ask` stands, from what
// the game's results say, and what each answer earns. Pure, like ./schema.js: state-logic.js's AnswerLogic builds the facts
// from a league's state as its viewer sees it (the spoiler guard's view, so nothing past their mark is graded), and calls
// these; the server reads the answers (game_answers, or a draft's finale predictions in its state) and hands them over.
//
//   facts = {
//     from, to      the game's span: its first episode (null while it waits for its phase) and its last (null: the season's end)
//     over          the game is over (its season is, or its span's last episode has results)
//     episodes      Map: episode number -> { out, events } for the game's own episodes with results. out: who went home
//                   (castaway ids; the winner leaving by winning isn't going home), [] when nobody did, null while it isn't
//                   in; events: Map moment id -> how many times it happened, once the full results are in (null before)
//     winner        the season's winner (castaway id), or null
//     ended         the season is over
//     order         everyone by where they finished, the winner first, once the season is over (null before)
//     names         Map castaway id -> name (a choice's options are matched to names)
//   }
//
//   verdictOf(q, episode, facts)  { state: 'waiting' } | { state: 'off', why } | { state: 'known', right, value? }
//                                 (right: the right answers: castaway ids, 'yes'/'no', 'over'/'under', options; value: a count)
//   pointsFor(q, verdict, answers) Map playerId -> points, for one question's answers ([{ playerId, answer }]) on one
//                                 episode (a number answer is the closest's, so they're graded together)
//   answerProblem(q, value, faces) why an answer can't be given (null: it can), faces: who a person answer can name
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./schema.js */
const { YES_NO, optionRange } = require('./schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const WAITING = Object.freeze({ state: 'waiting' });
const off = (why) => ({ state: 'off', why });
const known = (right, value) => (value === undefined ? { state: 'known', right } : { state: 'known', right, value });
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const ORDINAL = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/** The game's episodes from its start, in order, as far as its results go (to its end once it's over). */
function spanEpisodes(facts) {
  if (facts.from === null) return [];
  const known = [...facts.episodes.keys()];
  const last = facts.to !== null ? facts.to : known.length ? Math.max(...known) : facts.from - 1;
  const out = [];
  for (let n = facts.from; n <= last; n++) out.push(n);
  return out;
}

/** What the results say for a question asked once, over the game's episodes. */
function overGame(q, facts) {
  const st = q.settle;
  const eps = spanEpisodes(facts);
  if (st.by === 'results') {
    // The first to go home in the game: the first episode someone did, once every one before it is in.
    for (const n of eps) {
      const e = facts.episodes.get(n);
      if (!e || e.out === null) return WAITING;
      if (e.out.length) return known(e.out);
    }
    return facts.over ? off('Nobody went home') : WAITING;
  }
  // A moment over the game: it happened as soon as it does; it didn't, or its count, once the game is over and every one of
  // its episodes has its full results.
  let count = 0;
  let whole = facts.over;
  for (const n of eps) {
    const e = facts.episodes.get(n);
    if (!e || e.events === null) { whole = false; continue; }
    const c = e.events.get(st.moment) || 0;
    if (st.take === 'happened' && c > 0) return known(['yes']);
    count += c;
  }
  if (!whole) return WAITING;
  return st.take === 'happened' ? known(['no']) : known([], count);
}

/** How a question stands for an episode (asked each) or the game (asked once; `episode` ignored). */
function verdictOf(q, episode, facts) {
  const st = q && q.settle;
  if (!st || (st.by !== 'results' && st.by !== 'moment')) return WAITING; // the sports branch's settles, and the calls
  const how = `${st.by}:${st.take}`;
  if (how === 'results:winner') return facts.winner ? known([facts.winner]) : facts.ended ? off('Nobody won') : WAITING;
  if (how === 'results:top') return facts.order ? known(facts.order.slice(0, st.place)) : WAITING;
  if (how === 'results:placed') {
    if (!facts.order) return WAITING;
    const who = facts.order[st.place - 1];
    return who ? known([who]) : off(`Nobody finished ${ORDINAL(st.place)}`);
  }
  if (q.asked !== 'each') return overGame(q, facts);
  const e = facts.episodes.get(episode);
  if (how === 'results:out') {
    if (!e || e.out === null) return WAITING;
    return e.out.length ? known(e.out) : off('Nobody went home');
  }
  if (!e || e.events === null) return WAITING;
  const c = e.events.get(st.moment) || 0;
  return st.take === 'happened' ? known([c > 0 ? 'yes' : 'no']) : known([], c);
}

/** A number the verdict is about (a count), else null. */
const valueOf = (v) => (v && v.state === 'known' && isNum(v.value) ? v.value : null);

/** The right answers for an answer kind, from a verdict (a choice's options matched to what happened; an over/under to its
 *  line). Null when nothing is right (still to settle, off, or right on the line). */
function rightAnswers(q, v, facts) {
  if (!v || v.state !== 'known') return null;
  const value = valueOf(v);
  if (q.answer === 'overUnder') {
    if (value === null || !isNum(q.line) || value === q.line) return null;
    return [value > q.line ? 'over' : 'under'];
  }
  if (q.answer === 'choice') {
    const opts = Array.isArray(q.options) ? q.options : [];
    let right;
    if (value !== null) right = opts.filter((o) => { const r = optionRange(o); return r && value >= r.min && value <= r.max; });
    else if (q.settle.by === 'moment') right = opts.filter((o) => v.right.includes(norm(o)));
    else {
      const names = new Set(v.right.map((id) => norm(facts && facts.names ? facts.names.get(id) : id)));
      right = opts.filter((o) => names.has(norm(o)));
    }
    return right.length ? right : null;
  }
  if (q.answer === 'number') return value === null ? null : [];
  return v.right;
}

/** One answer's picks: a person answer's ids (one, or a list), else the answer itself. */
const picks = (q, a) => (q.answer === 'person' ? (Array.isArray(a) ? a : [a]).filter((x) => typeof x === 'string' && x) : [a]);

/**
 * What each answer to one question (on one episode) earns, by its verdict: a right answer its points; a person answer its
 * points for each one right; a number the closest's (ties all), right or not. Nothing until it's settled.
 */
function pointsFor(q, v, answers, facts) {
  const out = new Map();
  if (!v || v.state !== 'known') return out;
  const pts = isNum(q.points) ? q.points : 0;
  if (q.answer === 'number') {
    const value = valueOf(v);
    const given = answers.filter((a) => isNum(a.answer));
    if (value === null || !given.length) return out;
    const best = Math.min(...given.map((a) => Math.abs(a.answer - value)));
    for (const a of given) if (Math.abs(a.answer - value) === best) out.set(a.playerId, (out.get(a.playerId) || 0) + pts);
    return out;
  }
  const right = rightAnswers(q, v, facts);
  if (!right) return out;
  const rightSet = new Set(right.map((r) => (q.answer === 'person' ? r : norm(r))));
  for (const a of answers) {
    const mine = [...new Set(picks(q, a.answer))];
    const n = mine.filter((x) => rightSet.has(q.answer === 'person' ? x : norm(x))).length;
    if (n) out.set(a.playerId, (out.get(a.playerId) || 0) + n * pts);
  }
  return out;
}

/** Whether one answer (`mine`, one of `answers`) was right: null until it's settled; a number, whether it was the closest. */
function isRight(q, v, mine, answers, facts) {
  if (!v || v.state !== 'known') return null;
  if (q.answer === 'number') return pointsFor(q, v, answers, facts).has(mine.playerId);
  const right = rightAnswers(q, v, facts);
  if (!right) return false;
  const set = new Set(right.map((r) => (q.answer === 'person' ? r : norm(r))));
  return picks(q, mine.answer).some((x) => set.has(q.answer === 'person' ? x : norm(x)));
}

/**
 * Why an answer can't be given, or null: the shape each kind takes. `faces`: the castaway ids a person answer can name (who's
 * still in, or your own team), as a Set. A person answer naming more than one is a list of different ones, at most its pick.
 */
function answerProblem(q, value, faces) {
  switch (q.answer) {
    case 'person': {
      const list = Array.isArray(value) ? value : [value];
      if (!list.length || list.some((x) => typeof x !== 'string' || !x)) return 'Name someone';
      if (q.pick === 1 && Array.isArray(value) && value.length !== 1) return 'Name one';
      if (list.length > (q.pick || 1)) return `Name ${q.pick} at most`;
      if (new Set(list).size !== list.length) return 'Name each one once';
      if (faces && list.some((x) => !faces.has(x))) return q.from === 'team' ? 'Name someone on your team who is still in' : 'Name someone still in';
      return null;
    }
    case 'yesNo': return YES_NO.includes(value) ? null : 'Yes or no';
    case 'number': return isNum(value) && value >= 0 && value <= 100000 ? null : 'A number, 0 or more';
    case 'overUnder': return value === 'over' || value === 'under' ? null : 'Over or under';
    case 'choice': return Array.isArray(q.options) && q.options.includes(value) ? null : 'One of its options';
    default: return "This question isn't answered here";
  }
}

module.exports = { WAITING, verdictOf, rightAnswers, pointsFor, isRight, answerProblem, spanEpisodes };
