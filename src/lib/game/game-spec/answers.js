// Grading a game's questions (docs/PLAN-start-a-game-gpt.md steps A4 and A6): how each question in a spec's `ask` stands, from
// what the game's results say, and what each answer earns. Pure, like ./schema.js: state-logic.js's AnswerLogic builds the facts
// from a league's state as its viewer sees it (the spoiler guard's view, so nothing past their mark is graded), and calls
// these; the server reads the answers (game_answers, or a draft's finale predictions in its state) and hands them over.
//
//   facts = {
//     from, to      the game's span: its first episode (null while it waits for its phase) and its last (null: the season's end)
//     over          the game is over (its season is, or its span's last episode has results)
//     episodes      Map: episode number -> { out, events, who, in, groups, roles } for the game's own episodes with results.
//                   out: who went home (castaway ids; the winner leaving by winning isn't going home), [] when nobody did,
//                   null while it isn't in; once the full results are in (null before): events, Map moment id -> how many
//                   times it happened, who, Map moment id -> Map castaway id -> how many times it happened to them (a per-unit
//                   moment's units: a couple's judges' points), and roles, Map castaway id -> their secret role as of it (a
//                   show with roles; else empty); in: who was still in at its start; groups: Map castaway id -> the group
//                   (tribe id) they were on in it, after any swap it recorded, or null
//     winner        the season's winner (castaway id), or null
//     ended         the season is over
//     order         everyone by where they finished, the winner first, once the season is over (null before)
//     names         Map castaway id -> name (a choice's options are matched to names)
//     groupNames    Map group id -> name (a choice's options are matched to them too)
//   }
//
//   verdictOf(q, episode, facts)  { state: 'waiting' } | { state: 'off', why } | { state: 'known', right, value?, groups?, each? }
//                                 (right: the right answers: castaway ids, 'yes'/'no', 'over'/'under', options; value: a count;
//                                 groups: the groups the right people were on, for a group answer; each: a question about each
//                                 person's own verdicts, by castaway id)
//   pointsFor(q, verdict, answers) Map playerId -> points, for one question's answers ([{ playerId, answer }]) on one
//                                 episode (a number answer is the closest's, so they're graded together)
//   answerProblem(q, value, faces) why an answer can't be given (null: it can), faces: who (or which groups) it can name
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./schema.js */
const { YES_NO, NAMES, NUMBERS, optionRange } = require('./schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const WAITING = Object.freeze({ state: 'waiting' });
const off = (why) => ({ state: 'off', why });
function known(right, value, groups) {
  const v = { state: 'known', right };
  if (value !== undefined) v.value = value;
  // Only when someone right was on a group: a show without groups reads as it always did.
  if (groups && groups.length) v.groups = groups;
  return v;
}
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ORDINAL = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const NOBODY = "It didn't happen";

/** The game's episodes from its start, in order, as far as its results go (to its end once it's over). */
function spanEpisodes(facts) {
  if (facts.from === null) return [];
  const known = [...facts.episodes.keys()];
  const last = facts.to !== null ? facts.to : known.length ? Math.max(...known) : facts.from - 1;
  const out = [];
  for (let n = facts.from; n <= last; n++) out.push(n);
  return out;
}

/** The groups (distinct, none for nobody's) a list of people were on in an episode. */
function groupsIn(ids, e) {
  const out = [];
  for (const id of ids) {
    const g = e && e.groups ? e.groups.get(id) : null;
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}
/** How many times a moment happened to each person in an episode (empty before its full results). */
const tally = (e, moment) => (e && e.who && e.who.get(moment)) || new Map();
/** Who was still in at an episode's start (none when the facts don't say). */
const inAt = (e) => (e && Array.isArray(e.in) ? e.in : []);
/** The people a tally says it happened to most (ties all), and how many times; nobody when it didn't happen. */
function most(counts) {
  let best = 0;
  for (const c of counts.values()) if (c > best) best = c;
  return { best, who: best > 0 ? [...counts].filter(([, c]) => c === best).map(([id]) => id) : [] };
}
/** Who held a role in an episode, among a list of people. */
const holding = (e, ids, role) => ids.filter((id) => e.roles && e.roles.get(id) === role);
/** A group answer's verdict: settled only by the groups the right people were on (nobody on one: off, never a question
 *  nobody can get right). Any other answer's, as it is. */
function forGroups(q, v) {
  if (q.answer !== 'group' || v.state !== 'known' || (v.groups && v.groups.length)) return v;
  return off("Nobody it happened to was on a group");
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
      if (e.out.length) return known(e.out, undefined, groupsIn(e.out, e));
    }
    return facts.over ? off('Nobody went home') : WAITING;
  }
  // Every one of the game's episodes with its full results, once the game is over: what's only known at the end.
  const whole = facts.over && eps.every((n) => { const e = facts.episodes.get(n); return !!e && e.events !== null; });
  if (st.by === 'role') {
    if (!whole || !eps.length) return WAITING;
    if (st.take === 'who') {
      // Anyone who held it in the game.
      const who = [];
      for (const n of eps) { const e = facts.episodes.get(n); for (const id of holding(e, inAt(e), st.role)) if (!who.includes(id)) who.push(id); }
      return who.length ? known(who) : off(`Nobody was a ${st.role}`);
    }
    // Who held it among those in at the game's last episode.
    const last = facts.episodes.get(eps[eps.length - 1]);
    const end = holding(last, inAt(last), st.role);
    return st.take === 'count' ? known([], end.length) : end.length ? known(end) : off(`No ${st.role} made it to the end`);
  }
  // A moment over the game: it happened as soon as it does; it didn't, its count, who it happened to and who most, once the
  // game is over and every one of its episodes has its full results.
  let count = 0;
  const counts = new Map();
  const groups = [];
  for (const n of eps) {
    const e = facts.episodes.get(n);
    if (!e || e.events === null) continue;
    const c = e.events.get(st.moment) || 0;
    if (st.take === 'happened' && c > 0) return known(['yes']);
    count += c;
    for (const [id, k] of tally(e, st.moment)) {
      if (!(k > 0)) continue;
      counts.set(id, (counts.get(id) || 0) + k);
      for (const g of groupsIn([id], e)) if (!groups.includes(g)) groups.push(g);
    }
  }
  if (!whole) return WAITING;
  if (st.take === 'happened') return known(['no']);
  if (st.take === 'count') return known([], count);
  if (st.take === 'who') return counts.size ? known([...counts.keys()], undefined, groups) : off(NOBODY);
  const m = most(counts);
  return m.who.length ? known(m.who, m.best) : off(NOBODY);
}

/** How a question stands for an episode (asked each) or the game (asked once; `episode` ignored). */
function verdictOf(q, episode, facts) {
  const st = q && q.settle;
  if (!st || (st.by !== 'results' && st.by !== 'moment' && st.by !== 'role')) return WAITING; // the sports branch's settles, and the calls
  if (q.each) return eachVerdict(q, episode, facts);
  return forGroups(q, verdictFor(q, episode, facts));
}
function verdictFor(q, episode, facts) {
  const st = q.settle;
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
  if (st.by === 'results') {
    if (!e || e.out === null) return WAITING;
    if (st.take === 'stays') return known(inAt(e).filter((id) => !e.out.includes(id)));
    return e.out.length ? known(e.out, undefined, groupsIn(e.out, e)) : off('Nobody went home');
  }
  if (!e || e.events === null) return WAITING;
  if (st.by === 'role') {
    const end = holding(e, inAt(e).filter((id) => !(e.out || []).includes(id)), st.role);
    if (st.take === 'count') return known([], end.length);
    if (st.take === 'end') return end.length ? known(end) : off(`No ${st.role} is still in`);
    const who = holding(e, inAt(e), st.role);
    return who.length ? known(who) : off(`Nobody was a ${st.role}`);
  }
  const c = e.events.get(st.moment) || 0;
  if (st.take === 'happened') return known([c > 0 ? 'yes' : 'no']);
  if (st.take === 'count') return known([], c);
  const counts = new Map([...tally(e, st.moment)].filter(([, k]) => k > 0));
  if (st.take === 'who') return counts.size ? known([...counts.keys()], undefined, groupsIn([...counts.keys()], e)) : off(NOBODY);
  const m = most(counts);
  return m.who.length ? known(m.who, m.best) : off(NOBODY);
}

/**
 * A question about each person (q.each): one verdict for each of those still in when it closes (at its episode's start, or,
 * asked once, the game's first), from their own moment or whether they went home or stayed. Waiting until every one of
 * them is known: in the episode once its results are in (its full results, for a moment); over the game, once it's over.
 */
function eachVerdict(q, episode, facts) {
  const st = q.settle;
  const how = `${st.by}:${st.take}`;
  const moment = st.by === 'moment';
  const first = facts.episodes.get(q.asked === 'each' ? episode : facts.from);
  if (!first) return WAITING;
  const people = inAt(first);
  const eps = q.asked === 'each' ? [episode] : spanEpisodes(facts);
  const list = eps.map((n) => facts.episodes.get(n));
  const ready = list.every((e) => !!e && (moment ? e.events !== null : e.out !== null)) && (q.asked === 'each' || facts.over);
  if (!ready) return WAITING;
  const each = {};
  for (const id of people) {
    if (moment) {
      const c = list.reduce((n, e) => n + (tally(e, st.moment).get(id) || 0), 0);
      each[id] = st.take === 'count' ? known([], c) : known([c > 0 ? 'yes' : 'no']);
    } else {
      const out = list.some((e) => e.out.includes(id));
      each[id] = known([(how === 'results:out' ? out : !out) ? 'yes' : 'no']);
    }
  }
  return { state: 'known', right: [], each };
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
    // A count's range (never who it happened to most, whose verdict carries the top count too), a yes or no, or names.
    if (NUMBERS.includes(`${q.settle.by}:${q.settle.take}`)) {
      right = value === null ? [] : opts.filter((o) => { const r = optionRange(o); return r && value >= r.min && value <= r.max; });
    } else if (v.right.length && v.right.every((r) => YES_NO.includes(r))) right = opts.filter((o) => v.right.includes(norm(o)));
    else {
      // Names: the people who were right, and the groups they were on (which tribe won).
      const name = (id) => norm(facts && facts.names && facts.names.has(id) ? facts.names.get(id) : id);
      const names = new Set(v.right.map(name));
      for (const g of v.groups || []) names.add(norm(facts && facts.groupNames && facts.groupNames.has(g) ? facts.groupNames.get(g) : g));
      right = opts.filter((o) => names.has(norm(o)));
    }
    return right.length ? right : null;
  }
  if (q.answer === 'number') return value === null ? null : [];
  if (q.answer === 'group') return v.groups && v.groups.length ? v.groups : null;
  return v.right;
}

/** One answer's picks: a person or group answer's ids (one, or a list), else the answer itself. */
const picks = (q, a) => (NAMES.includes(q.answer) ? (Array.isArray(a) ? a : [a]).filter((x) => typeof x === 'string' && x) : [a]);
const key = (q, x) => (NAMES.includes(q.answer) ? x : norm(x));
/** A question about each person, as each one's: the same question without `each`. */
const baseOf = (q) => { const b = { ...q }; delete b.each; return b; };
/** The answers given for one person, of a question about each ({ castawayId: answer } each), as that person's own. */
const eachAnswers = (answers, id) =>
  answers.filter((a) => isObj(a.answer) && Object.prototype.hasOwnProperty.call(a.answer, id)).map((a) => ({ playerId: a.playerId, answer: a.answer[id] }));

/**
 * What each answer to one question (on one episode) earns, by its verdict: a right answer its points; a person or group
 * answer its points for each one right; a number the closest's (ties all), right or not. A question about each person: its
 * points for each person answered right (a number, the closest for each person). Nothing until it's settled.
 */
function pointsFor(q, v, answers, facts) {
  const out = new Map();
  if (!v || v.state !== 'known') return out;
  if (q.each) {
    if (!isObj(v.each)) return out;
    const base = baseOf(q);
    for (const [id, pv] of Object.entries(v.each)) {
      pointsFor(base, pv, eachAnswers(answers, id), facts).forEach((n, pid) => out.set(pid, (out.get(pid) || 0) + n));
    }
    return out;
  }
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
  const rightSet = new Set(right.map((r) => key(q, r)));
  for (const a of answers) {
    const mine = [...new Set(picks(q, a.answer))];
    const n = mine.filter((x) => rightSet.has(key(q, x))).length;
    if (n) out.set(a.playerId, (out.get(a.playerId) || 0) + n * pts);
  }
  return out;
}

/** Whether one answer (`mine`, one of `answers`) was right: null until it's settled; a number, whether it was the closest; a
 *  question about each person, whether any of theirs was. */
function isRight(q, v, mine, answers, facts) {
  if (!v || v.state !== 'known') return null;
  if (q.each) {
    if (!isObj(v.each) || !isObj(mine.answer)) return false;
    const base = baseOf(q);
    return Object.entries(v.each).some(
      ([id, pv]) => Object.prototype.hasOwnProperty.call(mine.answer, id) && !!isRight(base, pv, { playerId: mine.playerId, answer: mine.answer[id] }, eachAnswers(answers, id), facts)
    );
  }
  if (q.answer === 'number') return pointsFor(q, v, answers, facts).has(mine.playerId);
  const right = rightAnswers(q, v, facts);
  if (!right) return false;
  const set = new Set(right.map((r) => key(q, r)));
  return picks(q, mine.answer).some((x) => set.has(key(q, x)));
}

/**
 * Why an answer can't be given, or null: the shape each kind takes. `faces`: the ids a person or group answer can name (who's
 * still in, or your own team; the groups someone still in is on), or who a question about each person asks about, as a Set. A
 * person or group answer naming more than one is a list of different ones, at most its pick. A question about each person is
 * answered as { castawayId: answer }, for any of them.
 */
function answerProblem(q, value, faces) {
  if (q.each) {
    if (!isObj(value)) return 'An answer for each person: { who: answer }';
    const ids = Object.keys(value);
    if (!ids.length) return 'Answer for someone';
    if (faces && ids.some((id) => !faces.has(id))) return 'Answer only for who is still in';
    const base = baseOf(q);
    for (const id of ids) {
      const p = answerProblem(base, value[id], null);
      if (p) return p;
    }
    return null;
  }
  switch (q.answer) {
    case 'person':
    case 'group': {
      const one = q.answer === 'group' ? 'a group' : 'someone';
      const list = Array.isArray(value) ? value : [value];
      if (!list.length || list.some((x) => typeof x !== 'string' || !x)) return `Name ${one}`;
      if (q.pick === 1 && Array.isArray(value) && value.length !== 1) return 'Name one';
      if (list.length > (q.pick || 1)) return `Name ${q.pick} at most`;
      if (new Set(list).size !== list.length) return 'Name each one once';
      if (faces && list.some((x) => !faces.has(x))) {
        if (q.answer === 'group') return 'Name a group someone still in is on';
        return q.from === 'team' ? 'Name someone on your team who is still in' : 'Name someone still in';
      }
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
